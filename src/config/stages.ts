import type { UpgradePathId } from './upgrades';

export interface ProgressionStage {
  id: string;
  name: string;
  massThreshold: number;
  unlockedPaths: UpgradePathId[];
  spawnRateMult: number;
  initialSpawnBonus: number;
}

export const PROGRESSION_STAGES: readonly ProgressionStage[] = [
  { id: 'stellarMass', name: 'Stellar-Mass', massThreshold: 0, unlockedPaths: ['hub', 'chainLightning', 'golden'], spawnRateMult: 1, initialSpawnBonus: 0 },
  { id: 'intermediateMass', name: 'Intermediate-Mass', massThreshold: 2500, unlockedPaths: ['planets', 'radioactive', 'moon', 'comet'], spawnRateMult: 1.25, initialSpawnBonus: 6 },
  { id: 'supermassive', name: 'Supermassive', massThreshold: 40000, unlockedPaths: ['stars', 'laser'], spawnRateMult: 1.6, initialSpawnBonus: 14 },
  { id: 'galacticCore', name: 'Galactic Core', massThreshold: 400000, unlockedPaths: ['orb'], spawnRateMult: 2.1, initialSpawnBonus: 26 },
];

export function stageForMass(mass: number): ProgressionStage {
  let current = PROGRESSION_STAGES[0];
  for (const stage of PROGRESSION_STAGES) {
    if (mass >= stage.massThreshold) current = stage;
  }
  return current;
}

export function stageIndexForPath(pathId: UpgradePathId): number {
  const index = PROGRESSION_STAGES.findIndex((stage) => stage.unlockedPaths.includes(pathId));
  // Unmapped paths fall back to stage 1 rather than crashing purchase checks; the stages test guards full coverage.
  return index === -1 ? 0 : index;
}

export function massRequirementForPath(pathId: UpgradePathId): number {
  return PROGRESSION_STAGES[stageIndexForPath(pathId)].massThreshold;
}
