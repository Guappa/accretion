import { describe, expect, it } from 'vitest';
import { celestialVariantIndex, celestialVariantKey } from './textureKeys';

describe('texture variant keys', () => {
  it('maps entity ids onto the bucket range', () => {
    expect(celestialVariantIndex(0, 12)).toBe(0);
    expect(celestialVariantIndex(13, 12)).toBe(1);
    expect(celestialVariantIndex(24, 12)).toBe(0);
  });

  it('two entities in the same bucket share a key', () => {
    const first = celestialVariantKey('rock', celestialVariantIndex(5, 12));
    const second = celestialVariantKey('rock', celestialVariantIndex(17, 12));
    expect(first).toBe(second);
  });

  it('keys are tier-distinct', () => {
    expect(celestialVariantKey('rock', 3)).not.toBe(celestialVariantKey('smallAsteroid', 3));
  });
});
