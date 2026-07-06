import { describe, expect, it } from 'vitest';

import { hashIp, hashPassword, verifyPassword } from '../hash.js';

describe('hashIp', () => {
  it('is deterministic for the same inputs', () => {
    const a = hashIp('203.0.113.1', 42n, '2026-04-15');
    const b = hashIp('203.0.113.1', 42n, '2026-04-15');
    expect(a).toBe(b);
  });

  it('changes when IP, link id, or date changes', () => {
    const base = hashIp('203.0.113.1', 1n, '2026-04-15');
    expect(hashIp('203.0.113.2', 1n, '2026-04-15')).not.toBe(base);
    expect(hashIp('203.0.113.1', 2n, '2026-04-15')).not.toBe(base);
    expect(hashIp('203.0.113.1', 1n, '2026-04-16')).not.toBe(base);
  });

  it('produces a 64-char lowercase hex digest', () => {
    const digest = hashIp('203.0.113.1', 1n, '2026-04-15');
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('hashPassword / verifyPassword', () => {
  it('creates a bcrypt hash and verifies it', async () => {
    const hash = await hashPassword('secretword');
    expect(hash.startsWith('$2')).toBe(true);
    await expect(verifyPassword('secretword', hash)).resolves.toBe(true);
    await expect(verifyPassword('wrong', hash)).resolves.toBe(false);
  });
});
