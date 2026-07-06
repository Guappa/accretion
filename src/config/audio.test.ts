import { describe, expect, it } from 'vitest';
import { AUDIO } from './audio';

describe('AUDIO invariants', () => {
  it('every recipe has sane gains, durations, and gaps', () => {
    for (const recipe of Object.values(AUDIO.sfx)) {
      expect(recipe.minGapMs).toBeGreaterThanOrEqual(0);
      for (const tone of recipe.tones) {
        expect(tone.gain).toBeGreaterThan(0);
        expect(tone.gain).toBeLessThanOrEqual(1);
        expect(tone.durationSeconds).toBeGreaterThan(0);
        expect(tone.frequency).toBeGreaterThan(0);
      }
      if (recipe.noise) {
        expect(recipe.noise.gain).toBeGreaterThan(0);
        expect(recipe.noise.durationSeconds).toBeGreaterThan(0);
      }
    }
  });

  it('master defaults are in range', () => {
    expect(AUDIO.defaultMasterVolume).toBeGreaterThan(0);
    expect(AUDIO.defaultMasterVolume).toBeLessThanOrEqual(1);
    expect(AUDIO.maxConcurrent).toBeGreaterThanOrEqual(1);
    expect(AUDIO.attenuateAbove).toBeLessThanOrEqual(AUDIO.maxConcurrent);
  });
});
