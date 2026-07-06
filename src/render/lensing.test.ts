import { describe, expect, it } from 'vitest';
import { haloStreak, lensStar, type LensingConfig } from './lensing';

const LENSING: LensingConfig = {
  zoneScale: 3.2,
  deflectionStrength: 0.35,
  maxArcRadians: 0.9,
  hideBelowScale: 1.05,
};

const HOLE = 100;

describe('lensStar', () => {
  it('leaves stars outside the lensing zone untouched', () => {
    const star = lensStar(1000, 0, 0, 0, HOLE, LENSING);
    expect(star.visible).toBe(true);
    expect(star.radiusPx).toBe(1000);
    expect(star.arcHalfWidthRadians).toBe(0);
  });

  it('hides stars swallowed by the photon ring', () => {
    const star = lensStar(80, 0, 0, 0, HOLE, LENSING);
    expect(star.visible).toBe(false);
  });

  it('deflects apparent position outward inside the zone', () => {
    const star = lensStar(150, 0, 0, 0, HOLE, LENSING);
    expect(star.visible).toBe(true);
    expect(star.radiusPx).toBeGreaterThan(150);
  });

  it('smears stars into longer arcs the closer they sit to the ring', () => {
    const near = lensStar(130, 0, 0, 0, HOLE, LENSING);
    const far = lensStar(280, 0, 0, 0, HOLE, LENSING);
    expect(near.arcHalfWidthRadians).toBeGreaterThan(far.arcHalfWidthRadians);
    expect(far.arcHalfWidthRadians).toBeGreaterThan(0);
    expect(near.arcHalfWidthRadians).toBeLessThanOrEqual(LENSING.maxArcRadians / 2);
  });

  it('preserves the star angle around an offset center', () => {
    const star = lensStar(200, 300, 200, 100, HOLE, LENSING);
    expect(star.angleRadians).toBeCloseTo(Math.PI / 2, 6);
  });
});

describe('haloStreak', () => {
  const HALO = { count: 90, minAlpha: 0.04, maxAlpha: 0.28 };

  it('places every streak inside the lensing band', () => {
    for (let index = 0; index < HALO.count; index++) {
      const streak = haloStreak(index, 100, 3.2, HALO);
      expect(streak.radiusPx).toBeGreaterThan(100 * 1.05);
      expect(streak.radiusPx).toBeLessThan(100 * 3.2);
    }
  });

  it('is deterministic per index', () => {
    expect(haloStreak(7, 100, 3.2, HALO)).toEqual(haloStreak(7, 100, 3.2, HALO));
  });

  it('keeps alpha within the configured range and brightens toward the ring', () => {
    let sawBright = false;
    for (let index = 0; index < HALO.count; index++) {
      const streak = haloStreak(index, 100, 3.2, HALO);
      expect(streak.alpha).toBeGreaterThanOrEqual(HALO.minAlpha);
      expect(streak.alpha).toBeLessThanOrEqual(HALO.maxAlpha);
      if (streak.alpha > HALO.maxAlpha * 0.8 && streak.radiusPx < 100 * 1.6) sawBright = true;
    }
    expect(sawBright).toBe(true);
  });
});
