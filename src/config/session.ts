import type { CelestialTierId } from './celestials';

export interface BreakerStats {
  damagePerTick: number;
  tickInterval: number;
  ringRadius: number;
  critChance: number;
  critDamageMult: number;
}

// Below-target refill curve: interval = baseSeconds / (1 + target * perTargetRate), so bigger fields refill proportionally faster.
export interface RefillTuning {
  baseSeconds: number;
  perTargetRate: number;
}

export interface SessionConfig {
  baseDurationSeconds: number;
  baseInitialSpawn: number;
  maxAddedTimeFraction: number;
  spawnStartInterval: number;
  spawnEndInterval: number;
  spawnRadius: number;
  maxEntities: number;
  baseFieldTarget: number;
  refill: RefillTuning;
  horizonRadius: number;
  tierWeights: Partial<Record<CelestialTierId, number>>;
  breaker: BreakerStats;
}

export const SESSION_CONFIG: SessionConfig = {
  baseDurationSeconds: 25,
  // Sessions open with a populated field; the perf gate holds 3k+ entities so a rich baseline is free.
  baseInitialSpawn: 24,
  // Bonus time per session (Overtime etc.) caps at half the session's duration, the old game's anti-infinite rule.
  maxAddedTimeFraction: 0.5,
  spawnStartInterval: 1.1,
  spawnEndInterval: 0.35,
  spawnRadius: 640,
  maxEntities: 1200,
  baseFieldTarget: 42,
  refill: { baseSeconds: 0.4, perTargetRate: 0.05 },
  horizonRadius: 70,
  tierWeights: {
    rock: 0.5,
    smallAsteroid: 0.22,
    ferrousRock: 0.18,
    metalAsteroid: 0.1,
    dwarfPlanet: 0.05,
    planet: 0.025,
    gasGiant: 0.01,
    redDwarf: 0.02,
    star: 0.008,
    blueGiant: 0.003,
  },
  breaker: { damagePerTick: 7, tickInterval: 1.5, ringRadius: 45, critChance: 0, critDamageMult: 1.5 },
};
