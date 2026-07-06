import type { EffectMap } from './upgrades';

export interface CometConfig {
  flybyIntervalSeconds: number;
  lifetimeSeconds: number;
  spawnRadiusFraction: number;
  showerCount: number;
  buffEffects: EffectMap;
  buffDurationSeconds: number;
}

export const COMET: CometConfig = {
  flybyIntervalSeconds: 14,
  lifetimeSeconds: 9,
  spawnRadiusFraction: 1.0,
  showerCount: 3,
  buffEffects: { critChanceFlat: 0.2, critDamageFlat: 0.5 },
  buffDurationSeconds: 8,
};
