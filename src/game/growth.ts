import type { GrowthStage } from '../config/progression';

export function growthLevers(mass: number, stages: readonly GrowthStage[]): GrowthStage {
  let current = stages[0];
  for (const stage of stages) {
    if (mass >= stage.massThreshold) current = stage;
  }
  return current;
}
