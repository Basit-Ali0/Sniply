import crypto from 'node:crypto';

import bcrypt from 'bcrypt';

const BCRYPT_COST = 12 as const;

/** Fingerprint for unique-click sets: `raw_ip + link_id + YYYY-MM-DD` (UTF-8). */
export function hashIp(rawIp: string, linkId: bigint, date: string): string {
  const payload = `${rawIp}${linkId.toString()}${date}`;
  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
}

export function hashApiKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey, 'utf8').digest('hex');
}

export async function hashPassword(raw: string): Promise<string> {
  return bcrypt.hash(raw, BCRYPT_COST);
}

export async function verifyPassword(
  raw: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(raw, hash);
}
