import { describe, expect, it } from 'vitest';
import {
  PROGRESSION_STAGES,
  massRequirementForPath,
  stageForMass,
  stageIndexForPath,
} from './stages';
import { UPGRADE_NODES, type UpgradePathId } from './upgrades';

const ALL_PATHS: UpgradePathId[] = [
  'hub',
  'chainLightning',
  'planets',
  'stars',
  'golden',
  'radioactive',
  'comet',
  'laser',
  'orb',
  'moon',
];

describe('PROGRESSION_STAGES', () => {
  it('thresholds are strictly increasing and start at zero', () => {
    expect(PROGRESSION_STAGES[0].massThreshold).toBe(0);
    for (let i = 1; i < PROGRESSION_STAGES.length; i++) {
      expect(PROGRESSION_STAGES[i].massThreshold).toBeGreaterThan(PROGRESSION_STAGES[i - 1].massThreshold);
    }
  });

  it('density levers escalate stage over stage - later stages must feel busier', () => {
    for (let i = 1; i < PROGRESSION_STAGES.length; i++) {
      expect(PROGRESSION_STAGES[i].spawnRateMult).toBeGreaterThan(PROGRESSION_STAGES[i - 1].spawnRateMult);
      expect(PROGRESSION_STAGES[i].initialSpawnBonus).toBeGreaterThan(PROGRESSION_STAGES[i - 1].initialSpawnBonus);
    }
  });

  it('every upgrade path is assigned to exactly one stage', () => {
    for (const pathId of ALL_PATHS) {
      const owners = PROGRESSION_STAGES.filter((stage) => stage.unlockedPaths.includes(pathId));
      expect(owners, pathId).toHaveLength(1);
    }
  });

  it('every path used by a node in the tree is covered by the stage table', () => {
    for (const node of UPGRADE_NODES) {
      const owners = PROGRESSION_STAGES.filter((stage) => stage.unlockedPaths.includes(node.pathId));
      expect(owners, node.id).toHaveLength(1);
    }
  });
});

describe('stageForMass', () => {
  it('returns the highest stage whose threshold is at or below the mass', () => {
    // Derived from the stage table so the pacing knobs stay single-source; boundary intent is what matters here.
    const [, intermediate, supermassive, galacticCore] = PROGRESSION_STAGES;
    expect(stageForMass(0).id).toBe('stellarMass');
    expect(stageForMass(intermediate.massThreshold - 1).id).toBe('stellarMass');
    expect(stageForMass(intermediate.massThreshold).id).toBe('intermediateMass');
    expect(stageForMass(supermassive.massThreshold - 1).id).toBe('intermediateMass');
    expect(stageForMass(supermassive.massThreshold).id).toBe('supermassive');
    expect(stageForMass(galacticCore.massThreshold - 1).id).toBe('supermassive');
    expect(stageForMass(galacticCore.massThreshold).id).toBe('galacticCore');
    expect(stageForMass(10_000_000).id).toBe('galacticCore');
  });
});

describe('stageIndexForPath / massRequirementForPath', () => {
  it('maps stage-1 paths to threshold 0', () => {
    for (const pathId of ['hub', 'chainLightning', 'golden'] as const) {
      expect(stageIndexForPath(pathId)).toBe(0);
      expect(massRequirementForPath(pathId)).toBe(0);
    }
  });

  it('maps later paths to their stage thresholds', () => {
    const [, intermediate, supermassive, galacticCore] = PROGRESSION_STAGES;
    for (const pathId of ['planets', 'radioactive', 'moon', 'comet'] as const) {
      expect(massRequirementForPath(pathId)).toBe(intermediate.massThreshold);
    }
    expect(massRequirementForPath('stars')).toBe(supermassive.massThreshold);
    expect(massRequirementForPath('laser')).toBe(supermassive.massThreshold);
    expect(massRequirementForPath('orb')).toBe(galacticCore.massThreshold);
  });
});
