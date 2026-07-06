import crypto from 'node:crypto';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Redis } from 'ioredis';

import type { Env } from '../config.js';
import { createError } from '../utils/errors.js';
import { encodeBase62 } from '../utils/base62.js';
import { hashPassword } from '../utils/hash.js';
import { wsEmitter } from '../utils/wsEmitter.js';

export interface ShortenBody {
  url: string;
  slug?: string;
  expiry_at?: string;
  max_clicks?: number;
  password?: string;
}

export interface LinkRow {
  id: string;
  code: string;
  long_url: string;
  user_id: string | null;
  active: boolean;
  click_count: number;
  expiry_at: string | null;
  max_clicks: number | null;
  password_hash: string | null;
  created_at: string;
  updated_at: string;
}

const LINK_KEY_PREFIX = 'link:' as const;

function linkRedisKey(code: string): string {
  return `${LINK_KEY_PREFIX}${code}`;
}

function normalizeFrontendBase(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function normalizeApiBase(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

export async function populateRedisCache(
  redis: Redis,
  link: LinkRow
): Promise<void> {
  const key = linkRedisKey(link.code);
  const expiryUnix =
    link.expiry_at !== null && link.expiry_at !== undefined
      ? String(Math.floor(new Date(link.expiry_at).getTime() / 1000))
      : '0';
  const maxClicks =
    link.max_clicks !== null && link.max_clicks !== undefined
      ? String(link.max_clicks)
      : '0';
  const passwordHash = link.password_hash ?? '';

  const fields: Record<string, string> = {
    link_id: link.id,
    long_url: link.long_url,
    active: link.active ? '1' : '0',
    password_hash: passwordHash,
    expiry_at: expiryUnix,
    max_clicks: maxClicks,
    click_count: String(link.click_count),
  };

  await redis.hset(key, fields);

  if (link.expiry_at) {
    const ttlSeconds = Math.max(
      1,
      Math.floor((new Date(link.expiry_at).getTime() - Date.now()) / 1000)
    );
    await redis.expire(key, ttlSeconds);
  }
}

export async function getLinkByCode(
  supabase: SupabaseClient,
  code: string
): Promise<LinkRow | null> {
  const { data, error } = await supabase
    .from('links')
    .select('*')
    .eq('code', code)
    .maybeSingle();

  if (error) {
    throw createError('INTERNAL_ERROR', 'Failed to load link.', 500);
  }
  return data as LinkRow | null;
}

function assertUrlAllowed(url: string, blocklist: string | undefined): void {
  if (!blocklist) return;
  const parts = blocklist
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const needle of parts) {
    if (url.includes(needle)) {
      throw createError(
        'URL_BLOCKED',
        'This destination URL is not allowed.',
        422
      );
    }
  }
}

const SLUG_REGEX = /^[a-zA-Z0-9-]{3,32}$/u;

export async function createLink(
  supabase: SupabaseClient,
  redis: Redis,
  env: Env,
  body: ShortenBody,
  userId: string
): Promise<{
  code: string;
  short_url: string;
  long_url: string;
  qr_url: string;
  created_at: string;
  expiry_at: string | null;
  max_clicks: number | null;
  password_protected: boolean;
}> {
  assertUrlAllowed(body.url, env.URL_BLOCKLIST);

  if (body.slug !== undefined && body.slug !== '') {
    if (!SLUG_REGEX.test(body.slug)) {
      throw createError(
        'INVALID_SLUG',
        'Slug must be 3–32 characters and use only letters, numbers, or hyphens.',
        400
      );
    }
  }

  const passwordHash =
    body.password !== undefined && body.password.length > 0
      ? await hashPassword(body.password)
      : null;

  const tempCode = `tmp_${crypto.randomUUID().replace(/-/g, '')}`;

  const insertPayload: Record<string, unknown> = {
    code: tempCode,
    long_url: body.url,
    user_id: userId,
    expiry_at: body.expiry_at ?? null,
    max_clicks: body.max_clicks ?? null,
    password_hash: passwordHash,
  };

  const { data: inserted, error: insertError } = await supabase
    .from('links')
    .insert(insertPayload)
    .select('*')
    .single();

  if (insertError) {
    throw createError('INTERNAL_ERROR', 'Failed to create link.', 500);
  }

  const row = inserted as LinkRow;
  const idBig = BigInt(row.id);

  let finalCode: string;
  if (body.slug !== undefined && body.slug !== '') {
    finalCode = body.slug;
  } else {
    finalCode = encodeBase62(idBig);
  }

  const { data: updated, error: updateError } = await supabase
    .from('links')
    .update({ code: finalCode, updated_at: new Date().toISOString() })
    .eq('id', row.id)
    .select('*')
    .single();

  if (updateError) {
    await supabase.from('links').delete().eq('id', row.id);
    if (updateError.code === '23505') {
      throw createError(
        'SLUG_TAKEN',
        `The slug '${finalCode}' is already in use. Choose a different one.`,
        409
      );
    }
    throw createError('INTERNAL_ERROR', 'Failed to finalize short code.', 500);
  }

  const link = updated as LinkRow;
  await populateRedisCache(redis, link);

  const frontend = normalizeFrontendBase(env.FRONTEND_URL);
  const apiBase = normalizeApiBase(env.PUBLIC_API_URL);

  return {
    code: link.code,
    short_url: `${frontend}/${link.code}`,
    long_url: link.long_url,
    qr_url: `${apiBase}/qr/${link.code}`,
    created_at: link.created_at,
    expiry_at: link.expiry_at,
    max_clicks: link.max_clicks,
    password_protected: Boolean(link.password_hash),
  };
}

export function formatLinkResponse(
  link: LinkRow,
  frontendBase: string
): {
  code: string;
  short_url: string;
  long_url: string;
  click_count: number;
  active: boolean;
  created_at: string;
  expiry_at: string | null;
  max_clicks: number | null;
  password_protected: boolean;
} {
  return {
    code: link.code,
    short_url: `${normalizeFrontendBase(frontendBase)}/${link.code}`,
    long_url: link.long_url,
    click_count: link.click_count,
    active: link.active,
    created_at: link.created_at,
    expiry_at: link.expiry_at,
    max_clicks: link.max_clicks,
    password_protected: Boolean(link.password_hash),
  };
}

export function formatLinkDetailResponse(
  link: LinkRow,
  unique_clicks: number,
  frontendBase: string,
  apiBase: string
): {
  code: string;
  short_url: string;
  long_url: string;
  click_count: number;
  unique_clicks: number;
  active: boolean;
  created_at: string;
  expiry_at: string | null;
  max_clicks: number | null;
  password_protected: boolean;
  qr_url: string;
} {
  const base = {
    code: link.code,
    short_url: `${normalizeFrontendBase(frontendBase)}/${link.code}`,
    long_url: link.long_url,
    click_count: link.click_count,
    active: link.active,
    created_at: link.created_at,
    expiry_at: link.expiry_at,
    max_clicks: link.max_clicks,
    password_protected: Boolean(link.password_hash),
  };
  return {
    ...base,
    unique_clicks,
    qr_url: `${normalizeApiBase(apiBase)}/qr/${link.code}`,
  };
}

export async function getLinks(
  supabase: SupabaseClient,
  userId: string,
  page: number,
  limit: number,
  status: string | undefined,
  sort: string | undefined,
  order: string | undefined
): Promise<{
  links: LinkRow[];
  pagination: { page: number; limit: number; total: number; total_pages: number };
}> {
  const pageNum = Math.max(1, page);
  const limitNum = Math.min(100, Math.max(1, limit));
  const from = (pageNum - 1) * limitNum;
  const to = from + limitNum - 1;

  let query = supabase.from('links').select('*', { count: 'exact' }).eq('user_id', userId);

  if (status === 'active') {
    query = query.eq('active', true);
  } else if (status === 'inactive') {
    query = query.eq('active', false);
  } else if (status === 'expired') {
    query = query.eq('active', true).lt('expiry_at', new Date().toISOString());
  }

  const sortField = sort === 'click_count' ? 'click_count' : 'created_at';
  const sortOrder = order === 'asc' ? { ascending: true } : { ascending: false };
  query = query.order(sortField, sortOrder);

  const { data, error, count } = await query.range(from, to);

  if (error) {
    throw createError('INTERNAL_ERROR', 'Failed to fetch links.', 500);
  }

  return {
    links: (data as LinkRow[]) ?? [],
    pagination: {
      page: pageNum,
      limit: limitNum,
      total: count ?? 0,
      total_pages: Math.ceil((count ?? 0) / limitNum),
    },
  };
}

export async function getLinkByCodeAndUser(
  supabase: SupabaseClient,
  code: string,
  userId: string
): Promise<LinkRow | null> {
  const { data, error } = await supabase
    .from('links')
    .select('*')
    .eq('code', code)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw createError('INTERNAL_ERROR', 'Failed to load link.', 500);
  }
  return data as LinkRow | null;
}

export async function countUniqueClicks(
  supabase: SupabaseClient,
  linkId: string
): Promise<number> {
  const { data, error } = await supabase
    .from('click_events')
    .select('ip_hash')
    .eq('link_id', Number(linkId));

  if (error) {
    throw createError('INTERNAL_ERROR', 'Failed to count unique clicks.', 500);
  }

  const unique = new Set<string>();
  for (const row of data ?? []) {
    if (row.ip_hash) unique.add(row.ip_hash);
  }
  return unique.size;
}

export async function updateLink(
  supabase: SupabaseClient,
  redis: Redis,
  userId: string,
  code: string,
  updates: {
    url?: string;
    active?: boolean;
    expiry_at?: string | null;
    max_clicks?: number | null;
  }
): Promise<LinkRow | null> {
  const link = await getLinkByCodeAndUser(supabase, code, userId);
  if (!link) return null;

  const patch: Record<string, unknown> = {};
  if (updates.url !== undefined) patch.long_url = updates.url;
  if (updates.active !== undefined) patch.active = updates.active;
  if (updates.expiry_at !== undefined) patch.expiry_at = updates.expiry_at;
  if (updates.max_clicks !== undefined) patch.max_clicks = updates.max_clicks;
  patch.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('links')
    .update(patch)
    .eq('id', link.id)
    .select('*')
    .single();

  if (error) {
    throw createError('INTERNAL_ERROR', 'Failed to update link.', 500);
  }

  await redis.del(linkRedisKey(code));

  wsEmitter.emit('link_updated', {
    code,
    active: data.active,
  });

  return data as LinkRow;
}

export async function deleteLink(
  supabase: SupabaseClient,
  redis: Redis,
  userId: string,
  code: string
): Promise<boolean> {
  const link = await getLinkByCodeAndUser(supabase, code, userId);
  if (!link) return false;

  const { error } = await supabase.from('links').delete().eq('id', link.id);

  if (error) {
    throw createError('INTERNAL_ERROR', 'Failed to delete link.', 500);
  }

  await redis.del(linkRedisKey(code));

  wsEmitter.emit('link_deleted', {
    code,
  });

  return true;
}

export function parseRedisLinkFields(
  fields: Record<string, string>
): {
  link_id: bigint;
  long_url: string;
  active: boolean;
  password_hash: string;
  expiry_at: number;
  max_clicks: number;
  click_count: number;
} | null {
  if (!fields.long_url) {
    return null;
  }
  const linkIdRaw = fields.link_id;
  if (!linkIdRaw) {
    return null;
  }
  return {
    link_id: BigInt(linkIdRaw),
    long_url: fields.long_url,
    active: fields.active === '1',
    password_hash: fields.password_hash ?? '',
    expiry_at: Number(fields.expiry_at ?? '0'),
    max_clicks: Number(fields.max_clicks ?? '0'),
    click_count: Number(fields.click_count ?? '0'),
  };
}
