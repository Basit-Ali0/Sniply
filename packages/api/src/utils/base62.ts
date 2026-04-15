/**
 * Base62 short codes — alphabet matches `knowledge/SYSTEM_DESIGN.md` §4.2.
 * Encoding uses the usual least-significant-digit-first base conversion so
 * values round-trip with `decodeBase62`. Some illustrative rows in the design
 * doc do not all match this single scheme; code and tests are authoritative.
 */
export const BASE62_ALPHABET =
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' as const;

const ALPHABET: string = BASE62_ALPHABET;

const charToIndex = new Map<string, number>();
for (let i = 0; i < ALPHABET.length; i += 1) {
  charToIndex.set(ALPHABET[i]!, i);
}

export function encodeBase62(id: bigint): string {
  if (id < 1n) {
    throw new RangeError('id must be >= 1');
  }
  let n = id;
  let out = '';
  while (n > 0n) {
    const remainder = n % 62n;
    out = ALPHABET[Number(remainder)]! + out;
    n = n / 62n;
  }
  return out;
}

export function decodeBase62(code: string): bigint {
  if (code.length === 0) {
    throw new RangeError('code must not be empty');
  }
  let value = 0n;
  for (const ch of code) {
    const idx = charToIndex.get(ch);
    if (idx === undefined) {
      throw new RangeError(`Invalid base62 character: ${ch}`);
    }
    value = value * 62n + BigInt(idx);
  }
  if (value < 1n) {
    throw new RangeError('decoded value must be >= 1');
  }
  return value;
}
