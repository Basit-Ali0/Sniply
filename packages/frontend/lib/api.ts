import { supabase } from './supabase';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

let cachedToken: string | null = null;

async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  cachedToken = data.session?.access_token ?? null;
  return cachedToken;
}

export async function ensureSession(): Promise<boolean> {
  const token = await getAccessToken();
  return !!token;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public errorCode: string,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return undefined as T;

  const json = await res.json();

  if (!res.ok) {
    throw new ApiError(
      res.status,
      json.error ?? 'UNKNOWN',
      json.message ?? 'Something went wrong'
    );
  }

  return json as T;
}

export interface LinkListItem {
  code: string;
  short_url: string;
  long_url: string;
  click_count: number;
  active: boolean;
  created_at: string;
  expiry_at: string | null;
  max_clicks: number | null;
  password_protected: boolean;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface LinkListResponse {
  links: LinkListItem[];
  pagination: Pagination;
}

export interface LinkDetailResponse extends LinkListItem {
  unique_clicks: number;
  qr_url: string;
}

export interface ShortenPayload {
  url: string;
  slug?: string;
  expiry_at?: string;
  max_clicks?: number;
  password?: string;
}

export interface ShortenResponse {
  code: string;
  short_url: string;
  long_url: string;
  qr_url: string;
  created_at: string;
  expiry_at: string | null;
  max_clicks: number | null;
  password_protected: boolean;
}

export interface LinkUpdatePayload {
  url?: string;
  active?: boolean;
  expiry_at?: string | null;
  max_clicks?: number | null;
}

export interface LinkUpdateResponse {
  code: string;
  short_url: string;
  long_url: string;
  active: boolean;
  updated_at: string;
}

export interface StatsTopItem {
  referrer?: string;
  country?: string;
  clicks: number;
}

export interface StatsHourlyItem {
  hour: string;
  clicks: number;
}

export interface StatsResponse {
  code: string;
  period: { from: string; to: string };
  totals: { clicks: number; unique_clicks: number };
  top_referrers: StatsTopItem[];
  top_countries: StatsTopItem[];
  hourly_breakdown: StatsHourlyItem[];
}

export const api = {
  shorten: (data: ShortenPayload) =>
    request<ShortenResponse>('POST', '/api/shorten', data),

  getLinks: (params?: {
    page?: number;
    limit?: number;
    status?: string;
    sort?: string;
    order?: string;
  }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.status) q.set('status', params.status);
    if (params?.sort) q.set('sort', params.sort);
    if (params?.order) q.set('order', params.order);
    const qs = q.toString();
    return request<LinkListResponse>(`GET`, `/api/links${qs ? `?${qs}` : ''}`);
  },

  getLink: (code: string) =>
    request<LinkDetailResponse>('GET', `/api/links/${encodeURIComponent(code)}`),

  updateLink: (code: string, data: LinkUpdatePayload) =>
    request<LinkUpdateResponse>('PATCH', `/api/links/${encodeURIComponent(code)}`, data),

  deleteLink: (code: string) =>
    request<void>('DELETE', `/api/links/${encodeURIComponent(code)}`),

  getStats: (code: string, from?: string, to?: string) => {
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    const qs = q.toString();
    return request<StatsResponse>('GET', `/api/links/${encodeURIComponent(code)}/stats${qs ? `?${qs}` : ''}`);
  },

  unlock: (code: string, password: string) =>
    request<{ long_url: string }>('POST', `/api/links/${encodeURIComponent(code)}/unlock`, { password }),
};

export function getQrUrl(code: string, size = 256): string {
  return `${API_URL}/qr/${encodeURIComponent(code)}?size=${size}&format=png`;
}
