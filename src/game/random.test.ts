import { describe, expect, it } from 'vitest';
import { deterministicUnit } from './random';

describe('deterministicUnit', () => {
  it('returns values in [0, 1)', () => {
    for (let seed = 1; seed < 500; seed++) {
      const value = deterministicUnit(seed);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('is deterministic for the same seed', () => {
    expect(deterministicUnit(42.5)).toBe(deterministicUnit(42.5));
  });
});
