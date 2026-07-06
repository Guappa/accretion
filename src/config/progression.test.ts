import { describe, expect, it } from 'vitest';
import { GROWTH_STAGES } from './progression';

describe('GROWTH_STAGES invariants', () => {
  it('thresholds strictly increase', () => {
    for (let index = 1; index < GROWTH_STAGES.length; index++) {
      expect(GROWTH_STAGES[index].massThreshold).toBeGreaterThan(
        GROWTH_STAGES[index - 1].massThreshold,
      );
    }
  });

  it('horizon grows and view shrinks monotonically (dual-lever contract)', () => {
    for (let index = 1; index < GROWTH_STAGES.length; index++) {
      expect(GROWTH_STAGES[index].horizonScale).toBeGreaterThan(
        GROWTH_STAGES[index - 1].horizonScale,
      );
      expect(GROWTH_STAGES[index].viewScale).toBeLessThan(GROWTH_STAGES[index - 1].viewScale);
    }
  });

  it('starts at the identity stage', () => {
    expect(GROWTH_STAGES[0]).toEqual({ massThreshold: 0, horizonScale: 1, viewScale: 1 });
  });
});
