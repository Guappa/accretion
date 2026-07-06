import type { CelestialAffix, CelestialTierId } from '../config/celestials';
import type { UpgradePathId } from '../config/upgrades';

export type KillSource = 'breaker' | 'chain' | 'radioactive' | 'supernova' | 'laser' | 'orb';

export interface GameEvents extends Record<string, unknown> {
  objectBroken: {
    id: number;
    tierId: CelestialTierId;
    value: number;
    x: number;
    y: number;
    source: KillSource;
    affix: CelestialAffix | null;
  };
  entityDamaged: { id: number; tierId: CelestialTierId; amount: number; x: number; y: number };
  critLanded: { id: number; tierId: CelestialTierId; amount: number; x: number; y: number };
  matterConsumed: { value: number; tierId: CelestialTierId; x: number; y: number };
  bonusMatter: { value: number };
  lightningBolt: { fromX: number; fromY: number; toX: number; toY: number };
  sessionStarted: { durationSeconds: number };
  sessionTick: { remainingSeconds: number; progress: number };
  sessionTimeAdded: { seconds: number };
  sessionEnded: null;
  stageAdvanced: { stageId: string; stageName: string; unlockedPaths: UpgradePathId[] };
  victoryAchieved: { mass: number };
}
