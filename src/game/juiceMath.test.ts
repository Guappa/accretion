import { describe, expect, it } from 'vitest';
import type { BurstRecipe, ShakeRecipe } from '../config/juice';
import { burstCount, clampOutsideRadius, HitStopClock, shakeIntensity } from './juiceMath';

const BURST: BurstRecipe = {
  baseCount: 6,
  countPerValue: 2,
  maxCount: 20,
  speedMin: 30,
  speedMax: 110,
  lifeSeconds: 2,
  sizeWorldMin: 1.5,
  sizeWorldMax: 4,
};

const SHAKE: ShakeRecipe = {
  valueThreshold: 6,
  valueForMaxIntensity: 40,
  minIntensity: 0.003,
  maxIntensity: 0.012,
  durationMs: 130,
};

describe('burstCount', () => {
  it('returns the base count at value 0', () => {
    expect(burstCount(BURST, 0)).toBe(6);
  });

  it('scales with value', () => {
    expect(burstCount(BURST, 3)).toBe(12);
  });

  it('clamps at maxCount', () => {
    expect(burstCount(BURST, 1000)).toBe(20);
  });
});

describe('shakeIntensity', () => {
  it('returns null below the threshold', () => {
    expect(shakeIntensity(SHAKE, 5)).toBeNull();
  });

  it('returns minIntensity exactly at the threshold', () => {
    expect(shakeIntensity(SHAKE, 6)).toBe(SHAKE.minIntensity);
  });

  it('returns maxIntensity at and beyond valueForMaxIntensity', () => {
    expect(shakeIntensity(SHAKE, 40)).toBe(SHAKE.maxIntensity);
    expect(shakeIntensity(SHAKE, 4000)).toBe(SHAKE.maxIntensity);
  });

  it('interpolates between min and max', () => {
    const midValue = (SHAKE.valueThreshold + SHAKE.valueForMaxIntensity) / 2;
    const expected = (SHAKE.minIntensity + SHAKE.maxIntensity) / 2;
    expect(shakeIntensity(SHAKE, midValue)).toBeCloseTo(expected, 6);
  });
});

describe('clampOutsideRadius', () => {
  it('returns a point outside the radius unchanged', () => {
    const result = clampOutsideRadius(30, 40, 10);
    expect(result).toEqual({ x: 30, y: 40 });
  });

  it('pushes a point inside the radius radially outward onto the radius', () => {
    const result = clampOutsideRadius(3, 4, 10);
    expect(Math.hypot(result.x, result.y)).toBeCloseTo(10, 6);
    expect(result.x / result.y).toBeCloseTo(3 / 4, 6);
  });

  it('maps the origin to (0, -minRadius)', () => {
    expect(clampOutsideRadius(0, 0, 10)).toEqual({ x: 0, y: -10 });
  });
});

describe('HitStopClock', () => {
  it('passes real delta through when idle', () => {
    const clock = new HitStopClock(0.1);
    expect(clock.scale(0.016)).toBe(0.016);
  });

  it('scales delta during the stop window', () => {
    const clock = new HitStopClock(0.1);
    clock.trigger(0.08);
    expect(clock.scale(0.016)).toBeCloseTo(0.0016, 6);
  });

  it('recovers after the window elapses', () => {
    const clock = new HitStopClock(0.1);
    clock.trigger(0.05);
    clock.scale(0.03);
    clock.scale(0.03);
    expect(clock.scale(0.016)).toBe(0.016);
  });

  it('a new trigger never shortens an active window', () => {
    const clock = new HitStopClock(0.1);
    clock.trigger(0.2);
    clock.trigger(0.05);
    clock.scale(0.1);
    expect(clock.scale(0.016)).toBeCloseTo(0.0016, 6);
  });
});
