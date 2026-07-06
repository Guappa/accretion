import { SESSION_CONFIG } from '../../config/session';
import {
  UPGRADE_NODE_MAP,
  UPGRADE_TUNING,
  type BehaviorFlag,
  type EffectKey,
  type EffectMap,
} from '../../config/upgrades';

export interface DerivedStats {
  breakerRadius: number;
  tickIntervalSeconds: number;
  damagePerTick: number;
  critChance: number;
  critDamageMult: number;
  sessionDurationSeconds: number;
  electricSpawnChance: number;
  chainCount: number;
  chainDamageMult: number;
  chainCritChance: number;
  chainCritDamageMult: number;
  chainForkChance: number;
  chainRangeWorldUnits: number;
  sessionTimeOnKillChance: number;
  planetWeightMult: number;
  planetValueMult: number;
  planetDamageMult: number;
  goldenSpawnChance: number;
  goldenValueMult: number;
  radioactiveSpawnChance: number;
  radioactiveDotMult: number;
  starWeightMult: number;
  starValueMult: number;
  starDamageMult: number;
  moonSpawnChance: number;
  moonDurationMult: number;
  cometShowerChance: number;
  laserSpawnChance: number;
  laserDamage: number;
  laserWidthMult: number;
  orbChance: number;
  orbDamage: number;
  orbBounces: number;
  spawnRateMult: number;
  initialSpawnCount: number;
  fieldTarget: number;
  spawnOnKillChance: number;
  planetRespawnChance: number;
  starRespawnChance: number;
  laserCritChance: number;
  laserCritDamageMult: number;
  orbCritChance: number;
  orbCritDamageMult: number;
  moonCapBonus: number;
  supernovaRadiusMult: number;
  flags: ReadonlySet<BehaviorFlag>;
}

const MIN_TICK_INTERVAL_SECONDS = 0.1;

export function deriveStats(
  purchased: ReadonlySet<string>,
  buffLayers: readonly EffectMap[],
): DerivedStats {
  const sums: Record<EffectKey, number> = {
    breakerRadiusFraction: 0,
    tickIntervalFraction: 0,
    damagePerTickFlat: 0,
    critChanceFlat: 0,
    critDamageFlat: 0,
    sessionSecondsFlat: 0,
    electricSpawnChanceFlat: 0,
    chainCountFlat: 0,
    chainDamageMultFlat: 0,
    chainCritChanceFlat: 0,
    chainCritDamageFlat: 0,
    chainForkChanceFlat: 0,
    chainRangeFraction: 0,
    sessionTimeOnKillChanceFlat: 0,
    planetWeightFraction: 0,
    planetValueFraction: 0,
    planetDamageFraction: 0,
    goldenSpawnChanceFlat: 0,
    goldenValueFraction: 0,
    radioactiveSpawnChanceFlat: 0,
    radioactiveDotFraction: 0,
    starWeightFraction: 0,
    starValueFraction: 0,
    starDamageFraction: 0,
    moonSpawnChanceFlat: 0,
    moonDurationFraction: 0,
    cometShowerChanceFlat: 0,
    laserSpawnChanceFlat: 0,
    laserDamageFlat: 0,
    laserWidthFraction: 0,
    orbChanceFlat: 0,
    orbDamageFlat: 0,
    orbBounceFlat: 0,
    spawnRateFraction: 0,
    initialSpawnFlat: 0,
    fieldTargetFlat: 0,
    spawnOnKillChanceFlat: 0,
    planetRespawnChanceFlat: 0,
    starRespawnChanceFlat: 0,
    laserCritChanceFlat: 0,
    laserCritDamageFlat: 0,
    orbCritChanceFlat: 0,
    orbCritDamageFlat: 0,
    moonCapFlat: 0,
    supernovaRadiusFraction: 0,
  };
  const flags = new Set<BehaviorFlag>();
  for (const nodeId of purchased) {
    const node = UPGRADE_NODE_MAP.get(nodeId);
    if (!node) continue;
    accumulate(sums, node.effects);
    for (const flag of node.flags ?? []) flags.add(flag);
  }
  for (const layer of buffLayers) accumulate(sums, layer);

  const base = SESSION_CONFIG.breaker;
  return {
    breakerRadius: base.ringRadius * (1 + sums.breakerRadiusFraction),
    tickIntervalSeconds: Math.max(
      base.tickInterval * (1 + sums.tickIntervalFraction),
      MIN_TICK_INTERVAL_SECONDS,
    ),
    damagePerTick: base.damagePerTick + sums.damagePerTickFlat,
    critChance: clamp(base.critChance + sums.critChanceFlat, 0, UPGRADE_TUNING.critChanceCap),
    critDamageMult: base.critDamageMult + sums.critDamageFlat,
    sessionDurationSeconds:
      SESSION_CONFIG.baseDurationSeconds +
      Math.min(sums.sessionSecondsFlat, UPGRADE_TUNING.sessionSecondsCap),
    electricSpawnChance: clamp(sums.electricSpawnChanceFlat, 0, UPGRADE_TUNING.electricSpawnCap),
    chainCount: sums.chainCountFlat,
    chainDamageMult: sums.chainDamageMultFlat,
    chainCritChance: clamp(sums.chainCritChanceFlat, 0, UPGRADE_TUNING.critChanceCap),
    // Baseline matches critDamageMult's 1.5x - a chain crit with no crit-damage node must still deal more than normal damage.
    chainCritDamageMult: 1.5 + sums.chainCritDamageFlat,
    chainForkChance: clamp(sums.chainForkChanceFlat, 0, UPGRADE_TUNING.chainForkCap),
    chainRangeWorldUnits: UPGRADE_TUNING.chainRangeWorldUnits * (1 + sums.chainRangeFraction),
    sessionTimeOnKillChance: clamp(
      sums.sessionTimeOnKillChanceFlat,
      0,
      UPGRADE_TUNING.sessionTimeOnKillCap,
    ),
    planetWeightMult: 1 + sums.planetWeightFraction,
    planetValueMult: 1 + sums.planetValueFraction,
    planetDamageMult: 1 + sums.planetDamageFraction,
    goldenSpawnChance: clamp(sums.goldenSpawnChanceFlat, 0, UPGRADE_TUNING.goldenSpawnCap),
    goldenValueMult: 1 + sums.goldenValueFraction,
    radioactiveSpawnChance: clamp(
      sums.radioactiveSpawnChanceFlat,
      0,
      UPGRADE_TUNING.radioactiveSpawnCap,
    ),
    radioactiveDotMult: 1 + sums.radioactiveDotFraction,
    starWeightMult: 1 + sums.starWeightFraction,
    starValueMult: 1 + sums.starValueFraction,
    starDamageMult: 1 + sums.starDamageFraction,
    moonSpawnChance: clamp(sums.moonSpawnChanceFlat, 0, UPGRADE_TUNING.moonSpawnCap),
    moonDurationMult: 1 + sums.moonDurationFraction,
    cometShowerChance: clamp(sums.cometShowerChanceFlat, 0, 1),
    laserSpawnChance: clamp(sums.laserSpawnChanceFlat, 0, UPGRADE_TUNING.laserSpawnCap),
    laserDamage: sums.laserDamageFlat,
    laserWidthMult: 1 + sums.laserWidthFraction,
    orbChance: clamp(sums.orbChanceFlat, 0, UPGRADE_TUNING.orbChanceCap),
    orbDamage: sums.orbDamageFlat,
    orbBounces: sums.orbBounceFlat,
    spawnRateMult: 1 + sums.spawnRateFraction,
    initialSpawnCount: Math.max(0, Math.round(sums.initialSpawnFlat)),
    fieldTarget: Math.max(0, Math.round(SESSION_CONFIG.baseFieldTarget + sums.fieldTargetFlat)),
    spawnOnKillChance: clamp(sums.spawnOnKillChanceFlat, 0, UPGRADE_TUNING.spawnOnKillCap),
    planetRespawnChance: clamp(sums.planetRespawnChanceFlat, 0, UPGRADE_TUNING.categoryRespawnCap),
    starRespawnChance: clamp(sums.starRespawnChanceFlat, 0, UPGRADE_TUNING.categoryRespawnCap),
    laserCritChance: clamp(sums.laserCritChanceFlat, 0, UPGRADE_TUNING.critChanceCap),
    // Same 1.5x baseline as the breaker and chain: an un-upgraded crit must still outdamage a normal hit.
    laserCritDamageMult: 1.5 + sums.laserCritDamageFlat,
    orbCritChance: clamp(sums.orbCritChanceFlat, 0, UPGRADE_TUNING.critChanceCap),
    orbCritDamageMult: 1.5 + sums.orbCritDamageFlat,
    moonCapBonus: Math.max(0, Math.round(sums.moonCapFlat)),
    supernovaRadiusMult: 1 + sums.supernovaRadiusFraction,
    flags,
  };
}

function accumulate(sums: Record<EffectKey, number>, effects: EffectMap): void {
  for (const key of Object.keys(effects) as EffectKey[]) {
    sums[key] += effects[key] ?? 0;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
