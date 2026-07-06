import { describe, expect, it } from 'vitest';
import { GROWTH_STAGES } from '../config/progression';
import { growthLevers } from './growth';

describe('growthLevers', () => {
  it('returns the base stage below the first threshold', () => {
    expect(growthLevers(0, GROWTH_STAGES)).toEqual(GROWTH_STAGES[0]);
  });

  it('returns the stage at an exact threshold', () => {
    const secondStage = GROWTH_STAGES[1];
    expect(growthLevers(secondStage.massThreshold, GROWTH_STAGES)).toEqual(secondStage);
  });

  it('returns the top stage beyond the last threshold', () => {
    const lastStage = GROWTH_STAGES[GROWTH_STAGES.length - 1];
    expect(growthLevers(lastStage.massThreshold * 10, GROWTH_STAGES)).toEqual(lastStage);
  });
});
