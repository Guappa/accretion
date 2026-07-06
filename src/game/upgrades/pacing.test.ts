import { describe, expect, it } from 'vitest';
import { CELESTIAL_TIERS } from '../../config/celestials';
import { ENDGAME } from '../../config/endgame';
import { SESSION_CONFIG } from '../../config/session';
import { PROGRESSION_STAGES, stageForMass } from '../../config/stages';
import { UPGRADE_NODES } from '../../config/upgrades';
import { canPurchase, nodeCost } from './costModel';
import { deriveStats } from './StatEngine';

// Calibrated income model: damage throughput times observed matter-per-damage at base content.
const MATTER_PER_DAMAGE = 0.15;
const MAX_SESSIONS_PER_UPGRADE = 3;
// Pacing law: each stage must hold the player 10+ sessions and victory must land past session 30.
const MIN_SESSIONS_BETWEEN_STAGES = 10;
const MIN_VICTORY_SESSION = 30;
// Victory targets the 40-55 band; the full clear is the longer tail that mops up the tree afterwards.
const TOTAL_SESSIONS_MAX = 75;
const TOTAL_SESSIONS_MIN = 35;

// Planets lift effective matter/damage, but their value/weight ranks doubled in the staged rework;
// the per-multiplier share drops so the modeled channel still tracks the planets' small field population.
const PLANET_SHARE = 0.25;
// Stars sit a rung above planets (rarer, tougher, worth far more), so their income share outweighs a planet's.
const STAR_SHARE = 1.5;
// Lasers are one-shot procs now: breaking a laser star fires a single full-field blast, so the
// channel is a handful of corridor hits per session (proc count times targets caught), not DPS.
const LASER_BLAST_HITS_PER_SESSION = 8;

// About half the on-screen field is consumed per session; calibrated to the 2026-07 playtest where
// near-base play reached 250 mass in 3 sessions, so session-one income must land around 85 matter.
const FIELD_TURNOVER_PER_SESSION = 0.5;

// Average matter value of the drifting asteroid field, straight from the spawn weight table.
const AVERAGE_FIELD_MATTER_VALUE = (() => {
  let weightSum = 0;
  let valueSum = 0;
  for (const tier of Object.values(CELESTIAL_TIERS)) {
    if (tier.category !== 'asteroid') continue;
    const weight = SESSION_CONFIG.tierWeights[tier.id] ?? 0;
    weightSum += weight;
    valueSum += weight * tier.matterValue;
  }
  return valueSum / weightSum;
})();

function incomePerSession(purchased: ReadonlySet<string>, mass: number): number {
  const stage = stageForMass(mass);
  const stats = deriveStats(purchased, []);
  const ticks = stats.sessionDurationSeconds / stats.tickIntervalSeconds;
  const critMult = 1 + stats.critChance * (stats.critDamageMult - 1);
  const chainBonus = 1 + stats.chainCount * stats.chainDamageMult * 0.25;
  const planetBonus = stats.flags.has('spawnPlanets')
    ? 1 + PLANET_SHARE * stats.planetWeightMult * stats.planetValueMult
    : 1;
  const starBonus = stats.flags.has('spawnStars')
    ? 1 + STAR_SHARE * stats.starWeightMult * stats.starValueMult
    : 1;
  // Laser income needs BOTH keystones: the laser flag arms stars, but stars must spawn at all.
  // Width widens the corridor (more targets per blast) and the laser crit roll lifts each hit.
  const laserCritMult = 1 + stats.laserCritChance * (stats.laserCritDamageMult - 1);
  const laserBonus = stats.flags.has('laser') && stats.flags.has('spawnStars')
    ? stats.laserDamage * stats.laserWidthMult * laserCritMult * LASER_BLAST_HITS_PER_SESSION
    : 0;
  // Orbs launch off a fraction of breaker kills (proxied by ticks) and each hits its bounce chain once per launch.
  const orbBonus = stats.flags.has('orbs')
    ? stats.orbChance * stats.orbDamage * (stats.orbBounces + 1) * ticks
    : 0;
  // Field channel: seeded entities plus refill-to-target turnover drift into the hole and pay full
  // matterValue with no breaker involvement, so density purchases raise income like they do in real play.
  const seededField = SESSION_CONFIG.baseInitialSpawn + stats.initialSpawnCount + stage.initialSpawnBonus;
  const fieldIncome =
    (seededField + stats.fieldTarget) *
    FIELD_TURNOVER_PER_SESSION *
    stats.spawnRateMult *
    stage.spawnRateMult *
    (1 + stats.spawnOnKillChance) *
    planetBonus *
    starBonus *
    AVERAGE_FIELD_MATTER_VALUE;
  return Math.max(
    1,
    Math.round(
      ticks * stats.damagePerTick * critMult * chainBonus * planetBonus * starBonus * MATTER_PER_DAMAGE +
        laserBonus * MATTER_PER_DAMAGE +
        orbBonus * MATTER_PER_DAMAGE +
        fieldIncome,
    ),
  );
}

// Greedy full-clear sim under the staged economy: static prices, mass accruing with income,
// stage-locked paths opening as mass crosses their thresholds.
interface SimResult {
  totalSessions: number;
  maxStall: number;
  purchasedCount: number;
  stageCrossingSessions: number[];
  victorySession: number;
}

function simulateFullClear(onStall?: (sessions: number, purchasedCount: number) => void): SimResult {
  const purchased = new Set<string>();
  let matter = 0;
  let mass = 0;
  let totalSessions = 0;
  let maxStall = 0;
  const stageCrossingSessions = PROGRESSION_STAGES.map(() => -1);
  stageCrossingSessions[0] = 0;
  let victorySession = -1;
  const runSession = (): void => {
    const income = incomePerSession(purchased, mass);
    matter += income;
    mass += income;
    totalSessions++;
    for (let i = 1; i < PROGRESSION_STAGES.length; i++) {
      if (stageCrossingSessions[i] === -1 && mass >= PROGRESSION_STAGES[i].massThreshold) {
        stageCrossingSessions[i] = totalSessions;
      }
    }
    if (victorySession === -1 && mass >= ENDGAME.victoryMassGoal) victorySession = totalSessions;
  };
  while (purchased.size < UPGRADE_NODES.length) {
    let sessionsThisUpgrade = 0;
    // Inner loop runs sessions until the cheapest purchasable node is bought (break).
    for (;;) {
      const affordable = UPGRADE_NODES.filter(
        (node) => canPurchase(node, purchased, matter, mass).allowed,
      ).sort((a, b) => nodeCost(a, purchased, mass) - nodeCost(b, purchased, mass));
      const cheapest = affordable[0];
      if (cheapest) {
        matter -= nodeCost(cheapest, purchased, mass);
        purchased.add(cheapest.id);
        break;
      }
      runSession();
      sessionsThisUpgrade++;
      maxStall = Math.max(maxStall, sessionsThisUpgrade);
      onStall?.(sessionsThisUpgrade, purchased.size);
    }
  }
  // Victory can land after the last purchase: play out maxed-build sessions until the goal falls.
  while (victorySession === -1 && totalSessions < 500) runSession();
  return { totalSessions, maxStall, purchasedCount: purchased.size, stageCrossingSessions, victorySession };
}

describe('pacing law: staged full-clear economy', () => {
  it('greedy play never stalls more than 3 sessions before the next purchase', () => {
    simulateFullClear((sessions, purchasedCount) => {
      expect(
        sessions,
        `stalled saving for the next node after ${purchasedCount} purchases`,
      ).toBeLessThanOrEqual(MAX_SESSIONS_PER_UPGRADE);
    });
  });

  it('the entire tree full-clears - every node is purchased in one playthrough', () => {
    const result = simulateFullClear();
    expect(result.purchasedCount).toBe(UPGRADE_NODES.length);
  });

  it(`a full clear lands inside the ${TOTAL_SESSIONS_MIN}-${TOTAL_SESSIONS_MAX} session band`, () => {
    const result = simulateFullClear();
    expect(result.totalSessions).toBeLessThanOrEqual(TOTAL_SESSIONS_MAX);
    // A full clear still costs real play time - a trivially instant tree means prices collapsed.
    expect(result.totalSessions).toBeGreaterThanOrEqual(TOTAL_SESSIONS_MIN);
  });

  it(`every stage crossing lands ${MIN_SESSIONS_BETWEEN_STAGES}+ sessions after the previous one`, () => {
    const result = simulateFullClear();
    for (let i = 1; i < PROGRESSION_STAGES.length; i++) {
      expect(result.stageCrossingSessions[i], `stage ${PROGRESSION_STAGES[i].id} never crossed`).toBeGreaterThan(0);
      expect(
        result.stageCrossingSessions[i] - result.stageCrossingSessions[i - 1],
        `gap into ${PROGRESSION_STAGES[i].id}`,
      ).toBeGreaterThanOrEqual(MIN_SESSIONS_BETWEEN_STAGES);
    }
  });

  it(`victory lands at session ${MIN_VICTORY_SESSION} or later`, () => {
    const result = simulateFullClear();
    expect(result.victorySession, 'victory never crossed').toBeGreaterThan(0);
    expect(result.victorySession).toBeGreaterThanOrEqual(MIN_VICTORY_SESSION);
  });
});
