import type { Redis } from 'ioredis';

import type { GeoResponse } from '../types/index.js';
import { hashGeoCacheKey } from '../utils/hash.js';

const GEO_TTL_SECONDS = 86400 as const;

function normalizeGeoBase(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

export async function lookupCountry(
  redis: Redis,
  rawIp: string,
  geoBaseUrl: string
): Promise<string | null> {
  if (!rawIp || rawIp === 'unknown') {
    return null;
  }

  const cacheKey = `geo:${hashGeoCacheKey(rawIp)}`;
  const cached = await redis.get(cacheKey);
  if (cached !== null) {
    if (cached.length === 0) {
      return null;
    }
    return cached.length === 2 ? cached.toUpperCase() : null;
  }

  const base = normalizeGeoBase(geoBaseUrl);
  const url = `${base}/${encodeURIComponent(rawIp)}`;
  let json: GeoResponse;
  try {
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) {
      await redis.set(cacheKey, '', 'EX', GEO_TTL_SECONDS);
      return null;
    }
    json = (await res.json()) as GeoResponse;
  } catch {
    await redis.set(cacheKey, '', 'EX', GEO_TTL_SECONDS);
    return null;
  }

  if (json.status !== 'success' || !json.countryCode) {
    await redis.set(cacheKey, '', 'EX', GEO_TTL_SECONDS);
    return null;
  }

  const code = json.countryCode.slice(0, 2).toUpperCase();
  await redis.set(cacheKey, code, 'EX', GEO_TTL_SECONDS);
  return code;
}
