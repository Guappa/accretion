import { describe, expect, it } from 'vitest';
import {
  consumptionScale,
  spaghettificationProximity,
  spaghettificationStretch,
} from './spaghettification';

const ZONE = 90;
const HORIZON = 70;

describe('spaghettificationProximity', () => {
  it('is 0 at and beyond the zone edge', () => {
    expect(spaghettificationProximity(HORIZON + ZONE, HORIZON, ZONE)).toBe(0);
    expect(spaghettificationProximity(HORIZON + ZONE * 5, HORIZON, ZONE)).toBe(0);
  });

  it('is 1 at and inside the horizon', () => {
    expect(spaghettificationProximity(HORIZON, HORIZON, ZONE)).toBe(1);
    expect(spaghettificationProximity(HORIZON - 10, HORIZON, ZONE)).toBe(1);
  });

  it('is 0.5 halfway into the zone', () => {
    expect(spaghettificationProximity(HORIZON + ZONE / 2, HORIZON, ZONE)).toBeCloseTo(0.5, 6);
  });
});

describe('spaghettificationStretch', () => {
  it('is 1 at proximity 0 and maxStretch at proximity 1', () => {
    expect(spaghettificationStretch(0, 2.6)).toBe(1);
    expect(spaghettificationStretch(1, 2.6)).toBe(2.6);
  });
});

describe('consumptionScale', () => {
  it('is full size at the zone edge and minScale at the horizon', () => {
    expect(consumptionScale(0, 0.01, 0.7)).toBe(1);
    expect(consumptionScale(1, 0.01, 0.7)).toBeCloseTo(0.01, 6);
  });

  it('shrinks monotonically as proximity grows', () => {
    let previous = consumptionScale(0, 0.01, 0.7);
    for (let step = 1; step <= 10; step++) {
      const current = consumptionScale(step / 10, 0.01, 0.7);
      expect(current).toBeLessThan(previous);
      previous = current;
    }
  });

  it('an exponent below 1 holds size early and dives near the horizon', () => {
    expect(consumptionScale(0.5, 0.01, 0.7)).toBeGreaterThan(0.5);
  });
});
