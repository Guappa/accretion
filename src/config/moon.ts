import type { EffectMap } from './upgrades';

export interface MoonConfig {
  buffEffects: EffectMap;
  baseDurationSeconds: number;
  satelliteCap: number;
  orbitRadiusWorldUnits: number;
  orbitSpeed: number;
}

export const MOON: MoonConfig = {
  buffEffects: { breakerRadiusFraction: 0.12, tickIntervalFraction: -0.06 },
  baseDurationSeconds: 8,
  satelliteCap: 6,
  orbitRadiusWorldUnits: 34,
  orbitSpeed: 2.2,
};
