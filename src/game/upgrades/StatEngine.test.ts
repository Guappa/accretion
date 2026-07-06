import { describe, expect, it } from 'vitest';
import { SESSION_CONFIG } from '../../config/session';
import { UPGRADE_TUNING } from '../../config/upgrades';
import { deriveStats } from './StatEngine';

const NONE: ReadonlySet<string> = new Set();

describe('deriveStats', () => {
  it('returns base stats with no purchases and no buffs', () => {
    const stats = deriveStats(NONE, []);
    expect(stats.breakerRadius).toBe(SESSION_CONFIG.breaker.ringRadius);
    expect(stats.tickIntervalSeconds).toBe(SESSION_CONFIG.breaker.tickInterval);
    expect(stats.damagePerTick).toBe(SESSION_CONFIG.breaker.damagePerTick);
    expect(stats.critChance).toBe(0);
    expect(stats.sessionDurationSeconds).toBe(SESSION_CONFIG.baseDurationSeconds);
    expect(stats.electricSpawnChance).toBe(0);
    expect(stats.chainCount).toBe(0);
    expect(stats.flags.size).toBe(0);
  });

  it('folds purchased hub effects', () => {
    const stats = deriveStats(new Set(['hub.size1', 'hub.tick1', 'hub.damage1']), []);
    expect(stats.breakerRadius).toBeCloseTo(SESSION_CONFIG.breaker.ringRadius * 1.2, 6);
    expect(stats.tickIntervalSeconds).toBeCloseTo(SESSION_CONFIG.breaker.tickInterval * 0.88, 6);
    expect(stats.damagePerTick).toBe(SESSION_CONFIG.breaker.damagePerTick + 3);
  });

  it('the keystone grants electric spawns, a single-hop chain, and the flag', () => {
    const stats = deriveStats(new Set(['cl.static']), []);
    expect(stats.electricSpawnChance).toBeCloseTo(0.25, 6);
    expect(stats.chainCount).toBe(1);
    expect(stats.chainDamageMult).toBeCloseTo(0.6, 6);
    expect(stats.flags.has('chainLightning')).toBe(true);
  });

  it('buff layers stack on top of purchases', () => {
    const stats = deriveStats(new Set(['hub.tick1']), [{ tickIntervalFraction: -0.5 }]);
    expect(stats.tickIntervalSeconds).toBeCloseTo(SESSION_CONFIG.breaker.tickInterval * (1 - 0.12 - 0.5), 6);
  });

  it('caps clamp crit chance, electric spawn chance, and session time', () => {
    const stats = deriveStats(NONE, [
      { critChanceFlat: 5, electricSpawnChanceFlat: 5, sessionSecondsFlat: 500 },
    ]);
    expect(stats.critChance).toBe(UPGRADE_TUNING.critChanceCap);
    expect(stats.electricSpawnChance).toBe(UPGRADE_TUNING.electricSpawnCap);
    expect(stats.sessionDurationSeconds).toBe(
      SESSION_CONFIG.baseDurationSeconds + UPGRADE_TUNING.sessionSecondsCap,
    );
  });

  it('tick interval never reaches zero', () => {
    const stats = deriveStats(NONE, [{ tickIntervalFraction: -5 }]);
    expect(stats.tickIntervalSeconds).toBeGreaterThan(0);
  });

  it('chain crit damage baseline matches the breaker crit baseline with no crit-damage node purchased', () => {
    const stats = deriveStats(new Set(['cl.static']), []);
    expect(stats.chainCritDamageMult).toBe(1.5);
  });

  it('derives chain fork, range, and time-on-kill from effects', () => {
    const stats = deriveStats(new Set(), [
      { chainForkChanceFlat: 0.2, chainRangeFraction: 0.5, sessionTimeOnKillChanceFlat: 0.1 },
    ]);
    expect(stats.chainForkChance).toBeCloseTo(0.2, 6);
    expect(stats.chainRangeWorldUnits).toBeCloseTo(UPGRADE_TUNING.chainRangeWorldUnits * 1.5, 6);
    expect(stats.sessionTimeOnKillChance).toBeCloseTo(0.1, 6);
  });

  it('caps fork and time-on-kill chance', () => {
    const stats = deriveStats(new Set(), [
      { chainForkChanceFlat: 5, sessionTimeOnKillChanceFlat: 5 },
    ]);
    expect(stats.chainForkChance).toBe(UPGRADE_TUNING.chainForkCap);
    expect(stats.sessionTimeOnKillChance).toBe(UPGRADE_TUNING.sessionTimeOnKillCap);
  });

  it('derives planet weight and value multipliers', () => {
    const stats = deriveStats(new Set(), [
      { planetWeightFraction: 0.5, planetValueFraction: 2, planetDamageFraction: 0.75 },
    ]);
    expect(stats.planetWeightMult).toBeCloseTo(1.5, 6);
    expect(stats.planetValueMult).toBeCloseTo(3, 6);
    expect(stats.planetDamageMult).toBeCloseTo(1.75, 6);
  });

  it('the golden keystone grants a clamped spawn chance', () => {
    const stats = deriveStats(new Set(['golden.spawn']), []);
    expect(stats.goldenSpawnChance).toBeCloseTo(0.08, 6);
  });

  it('caps golden spawn chance at the tuning cap', () => {
    const stats = deriveStats(NONE, [{ goldenSpawnChanceFlat: 5 }]);
    expect(stats.goldenSpawnChance).toBe(UPGRADE_TUNING.goldenSpawnCap);
  });

  it('derives the golden value multiplier from the fraction, defaulting to 1', () => {
    expect(deriveStats(NONE, []).goldenValueMult).toBe(1);
    const stats = deriveStats(new Set(), [{ goldenValueFraction: 1.5 }]);
    expect(stats.goldenValueMult).toBeCloseTo(2.5, 6);
  });

  it('the radioactive keystone grants a clamped spawn chance', () => {
    const stats = deriveStats(new Set(['radioactive.spawn']), []);
    expect(stats.radioactiveSpawnChance).toBeCloseTo(0.06, 6);
  });

  it('caps radioactive spawn chance at the tuning cap', () => {
    const stats = deriveStats(NONE, [{ radioactiveSpawnChanceFlat: 5 }]);
    expect(stats.radioactiveSpawnChance).toBe(UPGRADE_TUNING.radioactiveSpawnCap);
  });

  it('derives the radioactive dot multiplier from the fraction, defaulting to 1', () => {
    expect(deriveStats(NONE, []).radioactiveDotMult).toBe(1);
    const stats = deriveStats(new Set(), [{ radioactiveDotFraction: 1.0 }]);
    expect(stats.radioactiveDotMult).toBeCloseTo(2, 6);
  });

  it('derives star weight, value, and damage multipliers, defaulting to 1', () => {
    expect(deriveStats(NONE, []).starWeightMult).toBe(1);
    expect(deriveStats(NONE, []).starValueMult).toBe(1);
    expect(deriveStats(NONE, []).starDamageMult).toBe(1);
    const stats = deriveStats(new Set(), [
      { starWeightFraction: 0.5, starValueFraction: 1.0, starDamageFraction: 0.5 },
    ]);
    expect(stats.starWeightMult).toBeCloseTo(1.5, 6);
    expect(stats.starValueMult).toBeCloseTo(2, 6);
    expect(stats.starDamageMult).toBeCloseTo(1.5, 6);
  });

  it('the star unlock keystone grants the spawnStars flag; the supernova node grants the supernova flag', () => {
    const stats = deriveStats(new Set(['star.unlock', 'star.supernova']), []);
    expect(stats.flags.has('spawnStars')).toBe(true);
    expect(stats.flags.has('supernova')).toBe(true);
    expect(stats.starDamageMult).toBeCloseTo(1.5, 6);
  });

  it('the moon keystone grants a clamped spawn chance', () => {
    const stats = deriveStats(new Set(['moon.capture']), []);
    expect(stats.moonSpawnChance).toBeCloseTo(0.05, 6);
  });

  it('caps moon spawn chance at the tuning cap', () => {
    const stats = deriveStats(NONE, [{ moonSpawnChanceFlat: 5 }]);
    expect(stats.moonSpawnChance).toBe(UPGRADE_TUNING.moonSpawnCap);
  });

  it('derives the moon duration multiplier from the fraction, defaulting to 1', () => {
    expect(deriveStats(NONE, []).moonDurationMult).toBe(1);
    const stats = deriveStats(new Set(), [{ moonDurationFraction: 1.0 }]);
    expect(stats.moonDurationMult).toBeCloseTo(2, 6);
  });

  it('the comet shower node grants a clamped shower chance, defaulting to 0', () => {
    expect(deriveStats(NONE, []).cometShowerChance).toBe(0);
    const stats = deriveStats(new Set(['comet.shower']), []);
    expect(stats.cometShowerChance).toBeCloseTo(0.25, 6);
  });

  it('clamps comet shower chance to 1', () => {
    const stats = deriveStats(NONE, [{ cometShowerChanceFlat: 5 }]);
    expect(stats.cometShowerChance).toBe(1);
  });

  it('derives no laser damage or spawn chance with no nodes purchased', () => {
    const stats = deriveStats(NONE, []);
    expect(stats.laserDamage).toBe(0);
    expect(stats.laserSpawnChance).toBe(0);
  });

  it('the laser keystone grants a laser-star spawn chance, flat beam damage, and the laser flag', () => {
    const stats = deriveStats(new Set(['laser.beam']), []);
    expect(stats.laserSpawnChance).toBeCloseTo(0.35, 6);
    expect(stats.laserDamage).toBe(6);
    expect(stats.flags.has('laser')).toBe(true);
  });

  it('clamps laser spawn chance to its cap', () => {
    const stats = deriveStats(NONE, [{ laserSpawnChanceFlat: 5 }]);
    expect(stats.laserSpawnChance).toBe(UPGRADE_TUNING.laserSpawnCap);
  });

  it('derives the laser width multiplier from the fraction, defaulting to 1', () => {
    expect(deriveStats(NONE, []).laserWidthMult).toBe(1);
    const stats = deriveStats(new Set(), [{ laserWidthFraction: 0.6 }]);
    expect(stats.laserWidthMult).toBeCloseTo(1.6, 6);
  });

  it('derives no orb chance, damage, or bounces with no nodes purchased', () => {
    const stats = deriveStats(NONE, []);
    expect(stats.orbChance).toBe(0);
    expect(stats.orbDamage).toBe(0);
    expect(stats.orbBounces).toBe(0);
  });

  it('the orb keystone grants chance, damage, bounces, and the orbs flag', () => {
    const stats = deriveStats(new Set(['orb.spark']), []);
    expect(stats.orbChance).toBeCloseTo(0.2, 6);
    expect(stats.orbDamage).toBe(6);
    expect(stats.orbBounces).toBe(2);
    expect(stats.flags.has('orbs')).toBe(true);
  });

  it('caps orb chance at the tuning cap', () => {
    const stats = deriveStats(NONE, [{ orbChanceFlat: 5 }]);
    expect(stats.orbChance).toBe(UPGRADE_TUNING.orbChanceCap);
  });

  it('orb chains stacks bounces and damage on top of the keystone', () => {
    const stats = deriveStats(new Set(['orb.spark', 'orb.chains']), []);
    expect(stats.orbBounces).toBe(4);
    expect(stats.orbDamage).toBe(10);
  });

  it('derives density stats: spawn-rate mult from the fraction, initial spawn count as an integer', () => {
    expect(deriveStats(NONE, []).spawnRateMult).toBe(1);
    expect(deriveStats(NONE, []).initialSpawnCount).toBe(0);
    const stats = deriveStats(new Set(), [{ spawnRateFraction: 0.4, initialSpawnFlat: 5.4 }]);
    expect(stats.spawnRateMult).toBeCloseTo(1.4, 6);
    expect(stats.initialSpawnCount).toBe(5);
    expect(Number.isInteger(stats.initialSpawnCount)).toBe(true);
  });

  it('initial spawn count never goes negative', () => {
    const stats = deriveStats(NONE, [{ initialSpawnFlat: -3 }]);
    expect(stats.initialSpawnCount).toBe(0);
  });

  it('derives laser crit chance and damage with the shared 1.5x baseline and cap', () => {
    const base = deriveStats(NONE, []);
    expect(base.laserCritChance).toBe(0);
    expect(base.laserCritDamageMult).toBe(1.5);
    const stats = deriveStats(new Set(), [{ laserCritChanceFlat: 0.2, laserCritDamageFlat: 0.5 }]);
    expect(stats.laserCritChance).toBeCloseTo(0.2, 6);
    expect(stats.laserCritDamageMult).toBeCloseTo(2, 6);
    const capped = deriveStats(NONE, [{ laserCritChanceFlat: 5 }]);
    expect(capped.laserCritChance).toBe(UPGRADE_TUNING.critChanceCap);
  });

  it('derives orb crit chance and damage with the shared 1.5x baseline and cap', () => {
    const base = deriveStats(NONE, []);
    expect(base.orbCritChance).toBe(0);
    expect(base.orbCritDamageMult).toBe(1.5);
    const stats = deriveStats(new Set(), [{ orbCritChanceFlat: 0.15, orbCritDamageFlat: 1 }]);
    expect(stats.orbCritChance).toBeCloseTo(0.15, 6);
    expect(stats.orbCritDamageMult).toBeCloseTo(2.5, 6);
    const capped = deriveStats(NONE, [{ orbCritChanceFlat: 5 }]);
    expect(capped.orbCritChance).toBe(UPGRADE_TUNING.critChanceCap);
  });

  it('derives the moon cap bonus as a non-negative integer', () => {
    expect(deriveStats(NONE, []).moonCapBonus).toBe(0);
    expect(deriveStats(NONE, [{ moonCapFlat: 2 }]).moonCapBonus).toBe(2);
    expect(deriveStats(NONE, [{ moonCapFlat: -4 }]).moonCapBonus).toBe(0);
  });

  it('derives the field target from the session base plus flat sums', () => {
    expect(deriveStats(NONE, []).fieldTarget).toBe(SESSION_CONFIG.baseFieldTarget);
    const stats = deriveStats(NONE, [{ fieldTargetFlat: 24 }]);
    expect(stats.fieldTarget).toBe(SESSION_CONFIG.baseFieldTarget + 24);
  });

  it('field target never goes negative', () => {
    const stats = deriveStats(NONE, [{ fieldTargetFlat: -500 }]);
    expect(stats.fieldTarget).toBe(0);
  });

  it('derives spawn-on-kill and category respawn chances, defaulting to 0', () => {
    const base = deriveStats(NONE, []);
    expect(base.spawnOnKillChance).toBe(0);
    expect(base.planetRespawnChance).toBe(0);
    expect(base.starRespawnChance).toBe(0);
    const stats = deriveStats(NONE, [
      { spawnOnKillChanceFlat: 0.2, planetRespawnChanceFlat: 0.25, starRespawnChanceFlat: 0.25 },
    ]);
    expect(stats.spawnOnKillChance).toBeCloseTo(0.2, 6);
    expect(stats.planetRespawnChance).toBeCloseTo(0.25, 6);
    expect(stats.starRespawnChance).toBeCloseTo(0.25, 6);
  });

  it('caps spawn-on-kill and category respawn chances at their tuning caps', () => {
    const stats = deriveStats(NONE, [
      { spawnOnKillChanceFlat: 5, planetRespawnChanceFlat: 5, starRespawnChanceFlat: 5 },
    ]);
    expect(stats.spawnOnKillChance).toBe(UPGRADE_TUNING.spawnOnKillCap);
    expect(stats.planetRespawnChance).toBe(UPGRADE_TUNING.categoryRespawnCap);
    expect(stats.starRespawnChance).toBe(UPGRADE_TUNING.categoryRespawnCap);
  });

  it('derives the supernova radius multiplier from the fraction, defaulting to 1', () => {
    expect(deriveStats(NONE, []).supernovaRadiusMult).toBe(1);
    const stats = deriveStats(NONE, [{ supernovaRadiusFraction: 0.5 }]);
    expect(stats.supernovaRadiusMult).toBeCloseTo(1.5, 6);
  });
});
