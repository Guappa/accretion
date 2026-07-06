import { describe, expect, it } from 'vitest';
import { JUICE } from './juice';
import { VISUAL } from './visual';

describe('JUICE invariants', () => {
  it('burst recipes are internally consistent', () => {
    for (const recipe of [JUICE.breakBurst, JUICE.consumeBurst]) {
      expect(recipe.maxCount).toBeGreaterThanOrEqual(recipe.baseCount);
      expect(recipe.speedMax).toBeGreaterThanOrEqual(recipe.speedMin);
      expect(recipe.sizeWorldMax).toBeGreaterThanOrEqual(recipe.sizeWorldMin);
      expect(recipe.lifeSeconds).toBeGreaterThan(0);
    }
  });

  it('a single burst can never exhaust the particle pool', () => {
    expect(JUICE.breakBurst.maxCount).toBeLessThan(VISUAL.particles.poolSize / 4);
  });

  it('shake intensities are ordered and subtle for routine play', () => {
    expect(JUICE.breakShake.maxIntensity).toBeGreaterThan(JUICE.breakShake.minIntensity);
    expect(JUICE.breakShake.minIntensity).toBeLessThan(0.01);
  });

  it('hit-stop slows but never freezes or reverses time', () => {
    expect(JUICE.hitStop.timeScale).toBeGreaterThan(0);
    expect(JUICE.hitStop.timeScale).toBeLessThan(1);
    expect(JUICE.hitStop.durationSeconds).toBeLessThan(0.3);
  });
});
