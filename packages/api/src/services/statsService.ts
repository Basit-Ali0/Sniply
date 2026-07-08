import type { SupabaseClient } from '@supabase/supabase-js';

import { createError } from '../utils/errors.js';

export interface StatsResult {
  code: string;
  period: { from: string; to: string };
  totals: { clicks: number; unique_clicks: number };
  top_referrers: { referrer: string; clicks: number }[];
  top_countries: { country: string; clicks: number }[];
  hourly_breakdown: { hour: string; clicks: number }[];
}

export async function getLinkStats(
  supabase: SupabaseClient,
  code: string,
  userId: string,
  from: string | undefined,
  to: string | undefined
): Promise<StatsResult> {
  const { data: link, error: linkError } = await supabase
    .from('links')
      .select('id, code, created_at')
    .eq('code', code)
    .eq('user_id', userId)
    .maybeSingle();

  if (linkError || !link) {
    throw createError('LINK_NOT_FOUND', 'Link does not exist or access denied.', 404);
  }

  const linkId = Number(link.id);
  const periodFrom = from ?? link.created_at;
  const periodTo = to ?? new Date().toISOString();

  const { data: events, error: eventsError } = await supabase
    .from('click_events')
    .select('clicked_at, referrer, country, ip_hash')
    .eq('link_id', linkId)
    .gte('clicked_at', periodFrom)
    .lte('clicked_at', periodTo);

  if (eventsError) {
    throw createError('INTERNAL_ERROR', 'Failed to load click events.', 500);
  }

  const totalClicks = events?.length ?? 0;
  const uniqueIps = new Set<string>();
  for (const e of events ?? []) {
    if (e.ip_hash) uniqueIps.add(e.ip_hash);
  }

  const referrerMap = new Map<string, number>();
  const countryMap = new Map<string, number>();
  const hourMap = new Map<string, number>();

  for (const e of events ?? []) {
    const ref = e.referrer ?? 'direct';
    referrerMap.set(ref, (referrerMap.get(ref) ?? 0) + 1);

    const country = e.country ?? 'UNKNOWN';
    countryMap.set(country, (countryMap.get(country) ?? 0) + 1);

    const hour = e.clicked_at
      ? `${e.clicked_at.slice(0, 13)}:00:00Z`
      : 'UNKNOWN';
    hourMap.set(hour, (hourMap.get(hour) ?? 0) + 1);
  }

  const topReferrers = [...referrerMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([referrer, clicks]) => ({ referrer, clicks }));

  const topCountries = [...countryMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([country, clicks]) => ({ country, clicks }));

  const hourlyBreakdown = [...hourMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([hour, clicks]) => ({ hour, clicks }));

  return {
    code,
    period: { from: periodFrom, to: periodTo },
    totals: { clicks: totalClicks, unique_clicks: uniqueIps.size },
    top_referrers: topReferrers,
    top_countries: topCountries,
    hourly_breakdown: hourlyBreakdown,
  };
}
