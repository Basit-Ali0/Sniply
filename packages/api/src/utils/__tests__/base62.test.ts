import { describe, expect, it } from 'vitest';

import { decodeBase62, encodeBase62 } from '../base62.js';

describe('encodeBase62', () => {
  it('encodes 1000 to qi (design-doc canonical multi-digit example)', () => {
    expect(encodeBase62(1000n)).toBe('qi');
  });

  it('encodes 62 to ba', () => {
    expect(encodeBase62(62n)).toBe('ba');
  });

  it('encodes 1 to b', () => {
    expect(encodeBase62(1n)).toBe('b');
  });

  it('throws for id < 1', () => {
    expect(() => encodeBase62(0n)).toThrow(RangeError);
  });
});

describe('decodeBase62', () => {
  it('decodes qi to 1000', () => {
    expect(decodeBase62('qi')).toBe(1000n);
  });

  it('throws on invalid characters', () => {
    expect(() => decodeBase62('!bad')).toThrow(RangeError);
  });
});

describe('base62 round-trip', () => {
  it('round-trips ids 1..5000', () => {
    for (let i = 1; i <= 5000; i += 1) {
      const id = BigInt(i);
      expect(decodeBase62(encodeBase62(id))).toBe(id);
    }
  });
});
