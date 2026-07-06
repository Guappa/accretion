export type UpgradePathId =
  | 'hub'
  | 'chainLightning'
  | 'planets'
  | 'stars'
  | 'golden'
  | 'radioactive'
  | 'comet'
  | 'laser'
  | 'orb'
  | 'moon';

export type EffectKey =
  | 'breakerRadiusFraction'
  | 'tickIntervalFraction'
  | 'damagePerTickFlat'
  | 'critChanceFlat'
  | 'critDamageFlat'
  | 'sessionSecondsFlat'
  | 'electricSpawnChanceFlat'
  | 'chainCountFlat'
  | 'chainDamageMultFlat'
  | 'chainCritChanceFlat'
  | 'chainCritDamageFlat'
  | 'chainForkChanceFlat'
  | 'chainRangeFraction'
  | 'sessionTimeOnKillChanceFlat'
  | 'planetWeightFraction'
  | 'planetValueFraction'
  | 'planetDamageFraction'
  | 'goldenSpawnChanceFlat'
  | 'goldenValueFraction'
  | 'radioactiveSpawnChanceFlat'
  | 'radioactiveDotFraction'
  | 'starWeightFraction'
  | 'starValueFraction'
  | 'starDamageFraction'
  | 'moonSpawnChanceFlat'
  | 'moonDurationFraction'
  | 'cometShowerChanceFlat'
  | 'laserSpawnChanceFlat'
  | 'laserDamageFlat'
  | 'laserWidthFraction'
  | 'orbChanceFlat'
  | 'orbDamageFlat'
  | 'orbBounceFlat'
  | 'spawnRateFraction'
  | 'initialSpawnFlat'
  | 'fieldTargetFlat'
  | 'spawnOnKillChanceFlat'
  | 'planetRespawnChanceFlat'
  | 'starRespawnChanceFlat'
  | 'laserCritChanceFlat'
  | 'laserCritDamageFlat'
  | 'orbCritChanceFlat'
  | 'orbCritDamageFlat'
  | 'moonCapFlat'
  | 'supernovaRadiusFraction';

export type EffectMap = Partial<Record<EffectKey, number>>;

export type BehaviorFlag =
  | 'chainLightning'
  | 'spawnPlanets'
  | 'spawnStars'
  | 'supernova'
  | 'comets'
  | 'laser'
  | 'orbs';

export interface UpgradeNode {
  id: string;
  pathId: UpgradePathId;
  clusterId: string;
  gx: number;
  gy: number;
  icon: string;
  name: string;
  description: string;
  baseCost: number;
  prerequisites: string[];
  effects: EffectMap;
  flags?: BehaviorFlag[];
  keystone?: boolean;
  massRequirement?: number; // One-off per-node gate on top of the stage table (src/config/stages.ts), which mass-gates whole paths.
  placeholder?: boolean; // Hard-blocks purchase until the mechanic ships; never gated by mass/matter.
}

// Nodes are authored without prices; the per-path geometric curve below assigns them at module definition.
type AuthoredUpgradeNode = Omit<UpgradeNode, 'baseCost'> & { costOverride?: number };

export interface PathPriceCurve {
  bandStart: number;
  growthPerRank: number;
}

// Balance patches tune these two numbers per path instead of 113 hand-authored prices.
export const PATH_PRICE_CURVES: Record<UpgradePathId, PathPriceCurve> = {
  hub: { bandStart: 20, growthPerRank: 1.11 },
  chainLightning: { bandStart: 70, growthPerRank: 1.18 },
  planets: { bandStart: 1900, growthPerRank: 1.2 },
  stars: { bandStart: 18000, growthPerRank: 1.18 },
  golden: { bandStart: 180, growthPerRank: 1.5 },
  radioactive: { bandStart: 1700, growthPerRank: 1.65 },
  comet: { bandStart: 1700, growthPerRank: 2.05 },
  laser: { bandStart: 22000, growthPerRank: 1.28 },
  orb: { bandStart: 150000, growthPerRank: 1.14 },
  moon: { bandStart: 1800, growthPerRank: 1.7 },
};

// 2 significant digits under 10k, 3 above, so computed prices still look designed.
function roundPretty(value: number): number {
  const significantDigits = value >= 10_000 ? 3 : 2;
  const magnitude = 10 ** (Math.floor(Math.log10(value)) - significantDigits + 1);
  return Math.round(value / magnitude) * magnitude;
}

function assignCurvedCosts(authored: AuthoredUpgradeNode[]): UpgradeNode[] {
  const byId = new Map(authored.map((node) => [node.id, node]));
  const depthCache = new Map<string, number>();
  const depthOf = (id: string): number => {
    const cached = depthCache.get(id);
    if (cached !== undefined) return cached;
    const node = byId.get(id);
    if (!node) throw new Error(`Unknown prerequisite: ${id}`);
    const depth = node.prerequisites.length === 0 ? 0 : 1 + Math.max(...node.prerequisites.map(depthOf));
    depthCache.set(id, depth);
    return depth;
  };
  const rankWithinPath = new Map<string, number>();
  for (const pathId of Object.keys(PATH_PRICE_CURVES) as UpgradePathId[]) {
    authored
      .filter((node) => node.pathId === pathId)
      // Stable sort: prerequisite depth orders the curve, declaration order breaks ties.
      .sort((a, b) => depthOf(a.id) - depthOf(b.id))
      .forEach((node, rank) => rankWithinPath.set(node.id, rank));
  }
  return authored.map(({ costOverride, ...node }) => {
    const curve = PATH_PRICE_CURVES[node.pathId];
    const rank = rankWithinPath.get(node.id) ?? 0;
    return { ...node, baseCost: costOverride ?? roundPretty(curve.bandStart * curve.growthPerRank ** rank) };
  });
}

export interface UpgradeCluster {
  id: string;
  pathId: UpgradePathId;
  color: number;
  originGx: number;
  originGy: number;
}

export interface UpgradeTuning {
  pathInflation: number;
  massCostFactor: number;
  critChanceCap: number;
  electricSpawnCap: number;
  sessionSecondsCap: number;
  chainRangeWorldUnits: number;
  chainForkCap: number;
  sessionTimeOnKillCap: number;
  sessionTimeOnKillSeconds: number;
  goldenSpawnCap: number;
  radioactiveSpawnCap: number;
  moonSpawnCap: number;
  laserSpawnCap: number;
  orbChanceCap: number;
  spawnOnKillCap: number;
  categoryRespawnCap: number;
}

export const UPGRADE_TUNING: UpgradeTuning = {
  // Both zeroed for the full-clear economy: every node sells at its static baseCost; the levers stay for build 2.
  pathInflation: 0,
  massCostFactor: 0,
  critChanceCap: 0.6,
  electricSpawnCap: 0.5,
  sessionSecondsCap: 14,
  chainRangeWorldUnits: 150,
  chainForkCap: 0.6,
  sessionTimeOnKillCap: 0.5,
  sessionTimeOnKillSeconds: 1.5,
  goldenSpawnCap: 0.25,
  radioactiveSpawnCap: 0.25,
  moonSpawnCap: 0.15,
  laserSpawnCap: 0.8,
  orbChanceCap: 0.5,
  spawnOnKillCap: 0.6,
  categoryRespawnCap: 0.5,
};

export const UPGRADE_CLUSTERS: UpgradeCluster[] = [
  { id: 'hubCore', pathId: 'hub', color: 0x8b5cf6, originGx: 1, originGy: 1 },
  { id: 'clSpark', pathId: 'chainLightning', color: 0x22d3ee, originGx: 5, originGy: 1 },
  // Locked future paths below: visible clusters that tease upcoming mechanics (pull-forward rule), hard-blocked by placeholder.
  { id: 'planets', pathId: 'planets', color: 0x60a5fa, originGx: 2, originGy: -3 },
  { id: 'stars', pathId: 'stars', color: 0xfbbf24, originGx: 6, originGy: -1 },
  { id: 'golden', pathId: 'golden', color: 0xffd700, originGx: -2, originGy: 0 },
  { id: 'radioactive', pathId: 'radioactive', color: 0x84cc16, originGx: -3, originGy: 3 },
  { id: 'comet', pathId: 'comet', color: 0xf97316, originGx: -2, originGy: 5 },
  { id: 'laser', pathId: 'laser', color: 0xef4444, originGx: 2, originGy: 7 },
  { id: 'orb', pathId: 'orb', color: 0xa855f7, originGx: 6, originGy: 6 },
  { id: 'moon', pathId: 'moon', color: 0xcbd5e1, originGx: 9, originGy: 2 },
];

export const UPGRADE_NODES: UpgradeNode[] = assignCurvedCosts([
  // Hub opens the stage 1 floor band; every rank is chunky enough to feel in the very next session.
  { id: 'hub.size1', pathId: 'hub', clusterId: 'hubCore', gx: 1, gy: 0, icon: 'size', name: 'Breaker Size I', description: '+20% Breaker radius', prerequisites: [], effects: { breakerRadiusFraction: 0.2 } },
  { id: 'hub.tick1', pathId: 'hub', clusterId: 'hubCore', gx: 2, gy: 1, icon: 'tick', name: 'Tick Rate I', description: '-12% tick interval', prerequisites: [], effects: { tickIntervalFraction: -0.12 } },
  { id: 'hub.damage1', pathId: 'hub', clusterId: 'hubCore', gx: 1, gy: 2, icon: 'damage', name: 'Base Damage I', description: '+3 damage per tick', prerequisites: [], effects: { damagePerTickFlat: 3 } },
  { id: 'hub.crit1', pathId: 'hub', clusterId: 'hubCore', gx: 0, gy: 1, icon: 'crit', name: 'Crit Chance I', description: '+10% crit chance', prerequisites: [], effects: { critChanceFlat: 0.1 } },
  { id: 'hub.critDamage1', pathId: 'hub', clusterId: 'hubCore', gx: 0, gy: 2, icon: 'critDamage', name: 'Crit Damage I', description: '+50% crit damage', prerequisites: ['hub.crit1'], effects: { critDamageFlat: 0.5 } },
  // Not a core-adjacent root (it sits diagonal to the core), so its visible neighbor Tick Rate I gates it.
  { id: 'hub.time1', pathId: 'hub', clusterId: 'hubCore', gx: 2, gy: 2, icon: 'time', name: 'Session Time I', description: '+4s session time', prerequisites: ['hub.tick1'], effects: { sessionSecondsFlat: 4 } },
  // Rank II: each extends outward from its rank-I node so the drawn prereq edge stays one cell long.
  { id: 'hub.size2', pathId: 'hub', clusterId: 'hubCore', gx: 1, gy: -1, icon: 'size', name: 'Breaker Size II', description: '+20% Breaker radius', prerequisites: ['hub.size1'], effects: { breakerRadiusFraction: 0.2 } },
  { id: 'hub.tick2', pathId: 'hub', clusterId: 'hubCore', gx: 3, gy: 1, icon: 'tick', name: 'Tick Rate II', description: '-12% tick interval', prerequisites: ['hub.tick1'], effects: { tickIntervalFraction: -0.12 } },
  // Damage II sits under Session Time I, not Damage I - the prereq follows the visible chain, so it gates on time1.
  { id: 'hub.damage2', pathId: 'hub', clusterId: 'hubCore', gx: 2, gy: 3, icon: 'damage', name: 'Base Damage II', description: '+5 damage per tick', prerequisites: ['hub.time1'], effects: { damagePerTickFlat: 5 } },
  { id: 'hub.crit2', pathId: 'hub', clusterId: 'hubCore', gx: 0, gy: 0, icon: 'crit', name: 'Crit Chance II', description: '+10% crit chance', prerequisites: ['hub.crit1'], effects: { critChanceFlat: 0.1 } },
  { id: 'hub.critDamage2', pathId: 'hub', clusterId: 'hubCore', gx: -1, gy: 2, icon: 'critDamage', name: 'Crit Damage II', description: '+50% crit damage', prerequisites: ['hub.critDamage1'], effects: { critDamageFlat: 0.5 } },
  { id: 'hub.time2', pathId: 'hub', clusterId: 'hubCore', gx: 3, gy: 2, icon: 'time', name: 'Session Time II', description: '+4s session time', prerequisites: ['hub.time1'], effects: { sessionSecondsFlat: 4 } },
  // Rank III: one more step outward on the Size and Damage axes.
  { id: 'hub.size3', pathId: 'hub', clusterId: 'hubCore', gx: 1, gy: -2, icon: 'size', name: 'Breaker Size III', description: '+20% Breaker radius', prerequisites: ['hub.size2'], effects: { breakerRadiusFraction: 0.2 } },
  { id: 'hub.damage3', pathId: 'hub', clusterId: 'hubCore', gx: 2, gy: 4, icon: 'damage', name: 'Base Damage III', description: '+8 damage per tick', prerequisites: ['hub.damage2'], effects: { damagePerTickFlat: 8 } },
  // Session Time II's own extension: a chance to refund session time on a kill.
  { id: 'hub.timeOnKill', pathId: 'hub', clusterId: 'hubCore', gx: 3, gy: 3, icon: 'timeOnKill', name: 'Overtime', description: '8% chance a Breaker kill extends session time, up to +50% of the session', prerequisites: ['hub.time2'], effects: { sessionTimeOnKillChanceFlat: 0.08 } },
  { id: 'hub.size4', pathId: 'hub', clusterId: 'hubCore', gx: 1, gy: -3, icon: 'size', name: 'Breaker Size IV', description: '+20% Breaker radius', prerequisites: ['hub.size3'], effects: { breakerRadiusFraction: 0.2 } },
  { id: 'hub.tick3', pathId: 'hub', clusterId: 'hubCore', gx: 3, gy: 0, icon: 'tick', name: 'Tick Rate III', description: '-12% tick interval', prerequisites: ['hub.tick2'], effects: { tickIntervalFraction: -0.12 } },
  { id: 'hub.damage4', pathId: 'hub', clusterId: 'hubCore', gx: 2, gy: 5, icon: 'damage', name: 'Base Damage IV', description: '+12 damage per tick', prerequisites: ['hub.damage3'], effects: { damagePerTickFlat: 12 } },
  { id: 'hub.crit3', pathId: 'hub', clusterId: 'hubCore', gx: -1, gy: 0, icon: 'crit', name: 'Crit Chance III', description: '+10% crit chance', prerequisites: ['hub.crit2'], effects: { critChanceFlat: 0.1 } },
  { id: 'hub.critDamage3', pathId: 'hub', clusterId: 'hubCore', gx: -2, gy: 2, icon: 'critDamage', name: 'Crit Damage III', description: '+50% crit damage', prerequisites: ['hub.critDamage2'], effects: { critDamageFlat: 0.5 } },
  // Time3 sits under Overtime, so Overtime is its prereq - the connection a player sees is the one that gates.
  { id: 'hub.time3', pathId: 'hub', clusterId: 'hubCore', gx: 3, gy: 4, icon: 'time', name: 'Session Time III', description: '+4s session time', prerequisites: ['hub.timeOnKill'], effects: { sessionSecondsFlat: 4 } },
  // Rank IV/V caps: the hub mirrors the reference's deepest families (damage/rate/crit) without filler ranks.
  { id: 'hub.tick4', pathId: 'hub', clusterId: 'hubCore', gx: 3, gy: -1, icon: 'tick', name: 'Tick Rate IV', description: '-12% tick interval', prerequisites: ['hub.tick3'], effects: { tickIntervalFraction: -0.12 } },
  { id: 'hub.damage5', pathId: 'hub', clusterId: 'hubCore', gx: 1, gy: 5, icon: 'damage', name: 'Base Damage V', description: '+18 damage per tick', prerequisites: ['hub.damage4'], effects: { damagePerTickFlat: 18 } },
  { id: 'hub.crit4', pathId: 'hub', clusterId: 'hubCore', gx: -1, gy: -1, icon: 'crit', name: 'Crit Chance IV', description: '+10% crit chance', prerequisites: ['hub.crit3'], effects: { critChanceFlat: 0.1 } },
  { id: 'hub.critDamage4', pathId: 'hub', clusterId: 'hubCore', gx: -3, gy: 2, icon: 'critDamage', name: 'Crit Damage IV', description: '+50% crit damage', prerequisites: ['hub.critDamage3'], effects: { critDamageFlat: 0.5 } },
  // Density ladder: the reference's late-game mayhem family - raw spawn pressure, stage-1 path so it feeds every later stage.
  { id: 'hub.density1', pathId: 'hub', clusterId: 'hubCore', gx: 0, gy: -1, icon: 'density', name: 'Dense Field I', description: '+30% spawn rate', prerequisites: ['hub.size2'], effects: { spawnRateFraction: 0.3 } },
  { id: 'hub.density2', pathId: 'hub', clusterId: 'hubCore', gx: 0, gy: -2, icon: 'density', name: 'Dense Field II', description: '+30% spawn rate', prerequisites: ['hub.density1'], effects: { spawnRateFraction: 0.3 } },
  { id: 'hub.density3', pathId: 'hub', clusterId: 'hubCore', gx: 0, gy: -3, icon: 'density', name: 'Dense Field III', description: '+30% spawn rate', prerequisites: ['hub.density2'], effects: { spawnRateFraction: 0.3 } },
  { id: 'hub.density4', pathId: 'hub', clusterId: 'hubCore', gx: 0, gy: -4, icon: 'density', name: 'Dense Field IV', description: '+30% spawn rate', prerequisites: ['hub.density3'], effects: { spawnRateFraction: 0.3 } },
  { id: 'hub.field1', pathId: 'hub', clusterId: 'hubCore', gx: -1, gy: -2, icon: 'field', name: 'Seeded Field I', description: '+8 starting entities each session', prerequisites: ['hub.density2'], effects: { initialSpawnFlat: 8 } },
  { id: 'hub.field2', pathId: 'hub', clusterId: 'hubCore', gx: -1, gy: -3, icon: 'field', name: 'Seeded Field II', description: '+8 starting entities each session', prerequisites: ['hub.field1'], effects: { initialSpawnFlat: 8 } },
  { id: 'hub.field3', pathId: 'hub', clusterId: 'hubCore', gx: -1, gy: -4, icon: 'field', name: 'Seeded Field III', description: '+8 starting entities each session', prerequisites: ['hub.field2'], effects: { initialSpawnFlat: 8 } },
  // Crowded Space ladder (predecessor's maxAsteroids): raises the sustained field target the spawner actively refills toward.
  { id: 'hub.crowd1', pathId: 'hub', clusterId: 'hubCore', gx: -2, gy: -2, icon: 'crowd', name: 'Crowded Space I', description: '+12 entities sustained in the field', prerequisites: ['hub.field1'], effects: { fieldTargetFlat: 12 } },
  { id: 'hub.crowd2', pathId: 'hub', clusterId: 'hubCore', gx: -2, gy: -3, icon: 'crowd', name: 'Crowded Space II', description: '+12 entities sustained in the field', prerequisites: ['hub.crowd1'], effects: { fieldTargetFlat: 12 } },
  { id: 'hub.crowd3', pathId: 'hub', clusterId: 'hubCore', gx: -2, gy: -4, icon: 'crowd', name: 'Crowded Space III', description: '+12 entities sustained in the field', prerequisites: ['hub.crowd2'], effects: { fieldTargetFlat: 12 } },
  // Gravity Pull ladder (predecessor's spawnOnKill): every kill can immediately pull in a fresh entity.
  { id: 'hub.pull1', pathId: 'hub', clusterId: 'hubCore', gx: -2, gy: -1, icon: 'pull', name: 'Gravity Pull I', description: '20% chance any kill pulls in a fresh entity', prerequisites: ['hub.crowd1'], effects: { spawnOnKillChanceFlat: 0.2 } },
  { id: 'hub.pull2', pathId: 'hub', clusterId: 'hubCore', gx: -2, gy: 0, icon: 'pull', name: 'Gravity Pull II', description: '+20% chance any kill pulls in a fresh entity', prerequisites: ['hub.pull1'], effects: { spawnOnKillChanceFlat: 0.2 } },
  { id: 'hub.pull3', pathId: 'hub', clusterId: 'hubCore', gx: -3, gy: 0, icon: 'pull', name: 'Gravity Pull III', description: '+20% chance any kill pulls in a fresh entity', prerequisites: ['hub.pull2'], effects: { spawnOnKillChanceFlat: 0.2 } },
  // Every branch entry gates on its trunk's hub-side node (UPGRADE_TRUNKS): you unlock your way out to a path.
  { id: 'cl.static', pathId: 'chainLightning', clusterId: 'clSpark', gx: 0, gy: 1, icon: 'static', name: 'Static Charge', description: 'Metal-bearing entities can spawn electric; breaking one fires chain lightning', prerequisites: ['hub.tick1'], effects: { electricSpawnChanceFlat: 0.25, chainCountFlat: 1, chainDamageMultFlat: 0.6 }, flags: ['chainLightning'], keystone: true },
  { id: 'cl.chain1', pathId: 'chainLightning', clusterId: 'clSpark', gx: 0, gy: 0, icon: 'chain', name: 'Chain +2', description: 'The chain jumps to two more targets', prerequisites: ['cl.static'], effects: { chainCountFlat: 2 } },
  { id: 'cl.damage1', pathId: 'chainLightning', clusterId: 'clSpark', gx: 1, gy: 1, icon: 'chainDamage', name: 'Amplitude I', description: '+40% chain damage', prerequisites: ['cl.static'], effects: { chainDamageMultFlat: 0.4 } },
  { id: 'cl.crit1', pathId: 'chainLightning', clusterId: 'clSpark', gx: 1, gy: 2, icon: 'chainCrit', name: 'Charged Edge', description: '+15% chain crit chance', prerequisites: ['cl.damage1'], effects: { chainCritChanceFlat: 0.15 } },
  { id: 'cl.critDamage1', pathId: 'chainLightning', clusterId: 'clSpark', gx: 2, gy: 2, icon: 'chainCritDamage', name: 'Overload', description: '+50% chain crit damage', prerequisites: ['cl.crit1'], effects: { chainCritDamageFlat: 0.5 } },
  // Keystone extension: a chance for the chain to fork and hit an extra branch.
  { id: 'cl.fork', pathId: 'chainLightning', clusterId: 'clSpark', gx: 0, gy: 2, icon: 'fork', name: 'Fork', description: '20% chance the chain forks to an extra target', prerequisites: ['cl.static'], effects: { chainForkChanceFlat: 0.2 }, keystone: true },
  // Reach I is diagonal to the keystone; its visible neighbor is Chain +2, so that is what gates it.
  { id: 'cl.range1', pathId: 'chainLightning', clusterId: 'clSpark', gx: 1, gy: 0, icon: 'range', name: 'Reach I', description: '+35% chain range', prerequisites: ['cl.chain1'], effects: { chainRangeFraction: 0.35 } },
  { id: 'cl.chain2', pathId: 'chainLightning', clusterId: 'clSpark', gx: 0, gy: -1, icon: 'chain', name: 'Chain Cascade', description: 'The chain jumps to two more targets', prerequisites: ['cl.chain1'], effects: { chainCountFlat: 2 } },
  { id: 'cl.damage2', pathId: 'chainLightning', clusterId: 'clSpark', gx: 2, gy: 1, icon: 'chainDamage', name: 'Amplitude II', description: '+40% chain damage', prerequisites: ['cl.damage1'], effects: { chainDamageMultFlat: 0.4 } },
  { id: 'cl.crit2', pathId: 'chainLightning', clusterId: 'clSpark', gx: 1, gy: 3, icon: 'chainCrit', name: 'Charged Edge II', description: '+15% chain crit chance', prerequisites: ['cl.crit1'], effects: { chainCritChanceFlat: 0.15 } },
  { id: 'cl.critDamage2', pathId: 'chainLightning', clusterId: 'clSpark', gx: 3, gy: 2, icon: 'chainCritDamage', name: 'Overload II', description: '+50% chain crit damage', prerequisites: ['cl.critDamage1'], effects: { chainCritDamageFlat: 0.5 } },
  { id: 'cl.range2', pathId: 'chainLightning', clusterId: 'clSpark', gx: 2, gy: 0, icon: 'range', name: 'Reach II', description: '+35% chain range', prerequisites: ['cl.range1'], effects: { chainRangeFraction: 0.35 } },
  { id: 'cl.fork2', pathId: 'chainLightning', clusterId: 'clSpark', gx: 0, gy: 3, icon: 'fork', name: 'Fork II', description: '+20% chance the chain forks to an extra target', prerequisites: ['cl.fork'], effects: { chainForkChanceFlat: 0.2 } },
  // Electric saturation caps the electric spawn ladder; it caps the Reach arm, so Reach II gates it, not the keystone.
  { id: 'cl.electric2', pathId: 'chainLightning', clusterId: 'clSpark', gx: 2, gy: -1, icon: 'static', name: 'Saturated Charge', description: '+25% electric spawn chance', prerequisites: ['cl.range2'], effects: { electricSpawnChanceFlat: 0.25 } },
  { id: 'cl.chain3', pathId: 'chainLightning', clusterId: 'clSpark', gx: 0, gy: -2, icon: 'chain', name: 'Chain Storm', description: 'The chain jumps to two more targets', prerequisites: ['cl.chain2'], effects: { chainCountFlat: 2 } },
  { id: 'cl.damage3', pathId: 'chainLightning', clusterId: 'clSpark', gx: 3, gy: 1, icon: 'chainDamage', name: 'Amplitude III', description: '+40% chain damage', prerequisites: ['cl.damage2'], effects: { chainDamageMultFlat: 0.4 } },
  // Golden branch is live: any tier can roll golden (takes precedence over electric), then a value multiplier on top.
  { id: 'golden.spawn', pathId: 'golden', clusterId: 'golden', gx: 0, gy: 0, icon: 'golden', name: 'Golden Asteroids', description: 'Any entity can spawn golden, a rare high-value affix', prerequisites: ['hub.crit2'], effects: { goldenSpawnChanceFlat: 0.08 }, keystone: true },
  { id: 'golden.value', pathId: 'golden', clusterId: 'golden', gx: 0, gy: -1, icon: 'golden', name: 'Gold Value', description: '+150% matter from golden entities', prerequisites: ['golden.spawn'], effects: { goldenValueFraction: 1.5 } },
  { id: 'golden.spawn2', pathId: 'golden', clusterId: 'golden', gx: -1, gy: 0, icon: 'golden', name: 'Golden Rush', description: '+8% golden spawn chance', prerequisites: ['golden.spawn'], effects: { goldenSpawnChanceFlat: 0.08 } },
  { id: 'golden.value2', pathId: 'golden', clusterId: 'golden', gx: 0, gy: -2, icon: 'golden', name: 'Gold Value II', description: '+100% matter from golden entities', prerequisites: ['golden.value'], effects: { goldenValueFraction: 1.0 } },
  { id: 'golden.value3', pathId: 'golden', clusterId: 'golden', gx: 0, gy: -3, icon: 'golden', name: 'Gold Value III', description: '+100% matter from golden entities', prerequisites: ['golden.value2'], effects: { goldenValueFraction: 1.0 } },
  // Planets open stage 2: the band jump from stage 1 prices is deliberate (the reference's x10 threshold shelves).
  { id: 'planet.unlock', pathId: 'planets', clusterId: 'planets', gx: 0, gy: 0, icon: 'planet', name: 'Unlock Planets', description: 'Your hole can now pull the planet spectrum: dwarf worlds up to ringed gas giants, each tougher and worth far more', prerequisites: ['hub.size3'], effects: {}, flags: ['spawnPlanets'], keystone: true },
  { id: 'planet.density', pathId: 'planets', clusterId: 'planets', gx: 0, gy: -1, icon: 'planet', name: 'Planet Density', description: '+50% planet spawn weight', prerequisites: ['planet.unlock'], effects: { planetWeightFraction: 0.5 } },
  // The planets spine runs unlock -> density -> value -> power straight up the column; each rung gates the next it touches.
  { id: 'planet.value', pathId: 'planets', clusterId: 'planets', gx: 0, gy: -2, icon: 'planet', name: 'Planet Value', description: '+100% matter from planets', prerequisites: ['planet.density'], effects: { planetValueFraction: 1.0 } },
  { id: 'planet.power', pathId: 'planets', clusterId: 'planets', gx: 0, gy: -3, icon: 'planet', name: 'Planetcracker', description: '+75% Breaker damage to planets', prerequisites: ['planet.value'], effects: { planetDamageFraction: 0.75 } },
  { id: 'planet.density2', pathId: 'planets', clusterId: 'planets', gx: -1, gy: -1, icon: 'planet', name: 'Planet Density II', description: '+50% planet spawn weight', prerequisites: ['planet.density'], effects: { planetWeightFraction: 0.5 } },
  { id: 'planet.value2', pathId: 'planets', clusterId: 'planets', gx: 1, gy: -2, icon: 'planet', name: 'Planet Value II', description: '+100% matter from planets', prerequisites: ['planet.value'], effects: { planetValueFraction: 1.0 } },
  { id: 'planet.power2', pathId: 'planets', clusterId: 'planets', gx: 0, gy: -4, icon: 'planet', name: 'Planetcracker II', description: '+75% Breaker damage to planets', prerequisites: ['planet.power'], effects: { planetDamageFraction: 0.75 } },
  { id: 'planet.density3', pathId: 'planets', clusterId: 'planets', gx: -1, gy: -2, icon: 'planet', name: 'Planet Density III', description: '+50% planet spawn weight', prerequisites: ['planet.density2'], effects: { planetWeightFraction: 0.5 } },
  { id: 'planet.value3', pathId: 'planets', clusterId: 'planets', gx: 1, gy: -3, icon: 'planet', name: 'Planet Value III', description: '+100% matter from planets', prerequisites: ['planet.value2'], effects: { planetValueFraction: 1.0 } },
  // Fission ladder (predecessor's planetSpawnOnKill): a broken planet can immediately seed a replacement planet.
  { id: 'planet.fission1', pathId: 'planets', clusterId: 'planets', gx: 1, gy: -1, icon: 'respawn', name: 'Fission I', description: '25% chance a broken planet spawns a new planet', prerequisites: ['planet.density'], effects: { planetRespawnChanceFlat: 0.25 } },
  { id: 'planet.fission2', pathId: 'planets', clusterId: 'planets', gx: 1, gy: 0, icon: 'respawn', name: 'Fission II', description: '+25% chance a broken planet spawns a new planet', prerequisites: ['planet.fission1'], effects: { planetRespawnChanceFlat: 0.25 } },
  // Radioactive branch is live: any entity can roll radioactive; breaking one leaves a fallout zone that DoTs nearby entities.
  { id: 'radioactive.spawn', pathId: 'radioactive', clusterId: 'radioactive', gx: 0, gy: 0, icon: 'radioactive', name: 'Radioactive Spawns', description: 'Entities can spawn radioactive; breaking one leaves a fallout zone that deals damage over time nearby', prerequisites: ['hub.critDamage2'], effects: { radioactiveSpawnChanceFlat: 0.06 }, keystone: true },
  { id: 'radioactive.dot', pathId: 'radioactive', clusterId: 'radioactive', gx: -1, gy: 0, icon: 'radioactive', name: 'Fallout DoT', description: '+100% fallout damage', prerequisites: ['radioactive.spawn'], effects: { radioactiveDotFraction: 1.0 } },
  { id: 'radioactive.spawn2', pathId: 'radioactive', clusterId: 'radioactive', gx: 0, gy: 1, icon: 'radioactive', name: 'Fallout Zones', description: '+6% radioactive spawn chance', prerequisites: ['radioactive.spawn'], effects: { radioactiveSpawnChanceFlat: 0.06 } },
  { id: 'radioactive.dot2', pathId: 'radioactive', clusterId: 'radioactive', gx: -2, gy: 0, icon: 'radioactive', name: 'Fallout DoT II', description: '+100% fallout damage', prerequisites: ['radioactive.dot'], effects: { radioactiveDotFraction: 1.0 } },
  { id: 'radioactive.dot3', pathId: 'radioactive', clusterId: 'radioactive', gx: -3, gy: 0, icon: 'radioactive', name: 'Fallout DoT III', description: '+100% fallout damage', prerequisites: ['radioactive.dot2'], effects: { radioactiveDotFraction: 1.0 } },
  // Comet branch is live: a mass-free keystone unlocks periodic flybys (no direct income effect - a luxury/timing node), then a shower-chance spur.
  { id: 'comet.flyby', pathId: 'comet', clusterId: 'comet', gx: 0, gy: 0, icon: 'comet', name: 'Comet Flybys', description: 'Comets periodically streak through, offering a bonus if destroyed in time', prerequisites: ['hub.crit1'], effects: {}, flags: ['comets'], keystone: true },
  { id: 'comet.shower', pathId: 'comet', clusterId: 'comet', gx: -1, gy: 0, icon: 'comet', name: 'Comet Shower', description: 'A chance for a flyby to become a full comet shower', prerequisites: ['comet.flyby'], effects: { cometShowerChanceFlat: 0.25 } },
  { id: 'comet.shower2', pathId: 'comet', clusterId: 'comet', gx: -2, gy: 0, icon: 'comet', name: 'Comet Shower II', description: '+25% additional chance a flyby becomes a shower', prerequisites: ['comet.shower'], effects: { cometShowerChanceFlat: 0.25 } },
  { id: 'comet.shower3', pathId: 'comet', clusterId: 'comet', gx: -3, gy: 0, icon: 'comet', name: 'Comet Shower III', description: '+25% additional chance a flyby becomes a shower', prerequisites: ['comet.shower2'], effects: { cometShowerChanceFlat: 0.25 } },
  // Stars open stage 3: another price shelf on top of the stage 2 band.
  { id: 'star.unlock', pathId: 'stars', clusterId: 'stars', gx: 0, gy: 0, icon: 'star', name: 'Unlock Stars', description: 'Your hole can now pull stars: tougher and worth far more than any planet', prerequisites: ['hub.tick2'], effects: {}, flags: ['spawnStars'], keystone: true },
  { id: 'star.supernova', pathId: 'stars', clusterId: 'stars', gx: 0, gy: -1, icon: 'star', name: 'Supernova', description: 'Destroyed stars trigger a supernova burst that damages nearby entities', prerequisites: ['star.unlock'], effects: { starDamageFraction: 0.5 }, flags: ['supernova'] },
  // The star-value column climbs through Supernova, so Supernova gates it - the visible rung above unlock.
  { id: 'star.value', pathId: 'stars', clusterId: 'stars', gx: 0, gy: -2, icon: 'star', name: 'Star Value', description: '+100% matter from stars', prerequisites: ['star.supernova'], effects: { starValueFraction: 1.0 } },
  { id: 'star.density', pathId: 'stars', clusterId: 'stars', gx: 1, gy: 0, icon: 'star', name: 'Star Density', description: '+50% star spawn weight', prerequisites: ['star.unlock'], effects: { starWeightFraction: 0.5 } },
  { id: 'star.power', pathId: 'stars', clusterId: 'stars', gx: 0, gy: 1, icon: 'star', name: 'Starcracker', description: '+75% Breaker damage to stars', prerequisites: ['star.unlock'], effects: { starDamageFraction: 0.75 } },
  { id: 'star.nova', pathId: 'stars', clusterId: 'stars', gx: 1, gy: -1, icon: 'star', name: 'Nova Reach', description: '+50% supernova blast radius', prerequisites: ['star.supernova'], effects: { supernovaRadiusFraction: 0.5 } },
  { id: 'star.value2', pathId: 'stars', clusterId: 'stars', gx: 0, gy: -3, icon: 'star', name: 'Star Value II', description: '+100% matter from stars', prerequisites: ['star.value'], effects: { starValueFraction: 1.0 } },
  { id: 'star.density2', pathId: 'stars', clusterId: 'stars', gx: 2, gy: 0, icon: 'star', name: 'Star Density II', description: '+50% star spawn weight', prerequisites: ['star.density'], effects: { starWeightFraction: 0.5 } },
  // Power2 sits by Density II because Cracker's own neighbors are taken, so Density II is the gate a player can see.
  { id: 'star.power2', pathId: 'stars', clusterId: 'stars', gx: 2, gy: 1, icon: 'star', name: 'Starcracker II', description: '+75% Breaker damage to stars', prerequisites: ['star.density2'], effects: { starDamageFraction: 0.75 } },
  { id: 'star.value3', pathId: 'stars', clusterId: 'stars', gx: 0, gy: -4, icon: 'star', name: 'Star Value III', description: '+100% matter from stars', prerequisites: ['star.value2'], effects: { starValueFraction: 1.0 } },
  // Nebula ladder (predecessor's starSpawnOnKill): a broken star can immediately ignite a replacement star.
  { id: 'star.nebula1', pathId: 'stars', clusterId: 'stars', gx: 1, gy: -2, icon: 'respawn', name: 'Nebula I', description: '25% chance a broken star ignites a new star', prerequisites: ['star.nova'], effects: { starRespawnChanceFlat: 0.25 } },
  { id: 'star.nebula2', pathId: 'stars', clusterId: 'stars', gx: 1, gy: -3, icon: 'respawn', name: 'Nebula II', description: '+25% chance a broken star ignites a new star', prerequisites: ['star.nebula1'], effects: { starRespawnChanceFlat: 0.25 } },
  // Laser branch is live: stars can spawn laser-equipped; breaking one fires a single blast across the whole field; spurs scale damage, width, and crits.
  { id: 'laser.beam', pathId: 'laser', clusterId: 'laser', gx: 0, gy: 0, icon: 'laser', name: 'Star Lasers', description: 'Stars can spawn laser-equipped - breaking one fires a beam across the entire field, damaging everything in its path', prerequisites: ['hub.damage3'], effects: { laserSpawnChanceFlat: 0.35, laserDamageFlat: 6 }, flags: ['laser'], keystone: true },
  { id: 'laser.width', pathId: 'laser', clusterId: 'laser', gx: 0, gy: 1, icon: 'laser', name: 'Beam Width', description: 'Widens the blast so it catches more targets', prerequisites: ['laser.beam'], effects: { laserWidthFraction: 0.6 } },
  { id: 'laser.damage2', pathId: 'laser', clusterId: 'laser', gx: -1, gy: 0, icon: 'laser', name: 'Beam Damage', description: '+6 blast damage', prerequisites: ['laser.beam'], effects: { laserDamageFlat: 6 } },
  { id: 'laser.crit', pathId: 'laser', clusterId: 'laser', gx: 1, gy: 0, icon: 'crit', name: 'Focusing Lens', description: '+20% blast crit chance', prerequisites: ['laser.beam'], effects: { laserCritChanceFlat: 0.2 } },
  { id: 'laser.width2', pathId: 'laser', clusterId: 'laser', gx: 0, gy: 2, icon: 'laser', name: 'Beam Width II', description: 'Further widens the blast', prerequisites: ['laser.width'], effects: { laserWidthFraction: 0.5 } },
  { id: 'laser.critDamage', pathId: 'laser', clusterId: 'laser', gx: 1, gy: 1, icon: 'critDamage', name: 'Coherent Burn', description: '+100% blast crit damage', prerequisites: ['laser.crit'], effects: { laserCritDamageFlat: 1.0 } },
  { id: 'laser.damage3', pathId: 'laser', clusterId: 'laser', gx: -2, gy: 0, icon: 'laser', name: 'Beam Damage II', description: '+9 blast damage', prerequisites: ['laser.damage2'], effects: { laserDamageFlat: 9 } },
  { id: 'laser.width3', pathId: 'laser', clusterId: 'laser', gx: 0, gy: 3, icon: 'laser', name: 'Beam Width III', description: 'The widest possible blast', prerequisites: ['laser.width2'], effects: { laserWidthFraction: 0.5 } },
  // Orbs open stage 4: the endgame band, priced against a fully stacked income.
  { id: 'orb.spark', pathId: 'orb', clusterId: 'orb', gx: 0, gy: 0, icon: 'orb', name: 'Orbital Spark', description: 'Breaker kills have a chance to launch a bouncing orb that chains between nearby targets', prerequisites: ['hub.timeOnKill'], effects: { orbChanceFlat: 0.2, orbDamageFlat: 6, orbBounceFlat: 2 }, flags: ['orbs'], keystone: true },
  { id: 'orb.chains', pathId: 'orb', clusterId: 'orb', gx: 0, gy: 1, icon: 'orb', name: 'Orb Chains', description: 'Orbs bounce to more targets and hit harder', prerequisites: ['orb.spark'], effects: { orbBounceFlat: 2, orbDamageFlat: 4 } },
  { id: 'orb.chance2', pathId: 'orb', clusterId: 'orb', gx: 1, gy: 0, icon: 'orb', name: 'Orbital Frequency', description: '+15% chance a Breaker kill launches an orb', prerequisites: ['orb.spark'], effects: { orbChanceFlat: 0.15 } },
  { id: 'orb.damage2', pathId: 'orb', clusterId: 'orb', gx: -1, gy: 0, icon: 'orb', name: 'Orb Damage', description: '+6 orb damage', prerequisites: ['orb.spark'], effects: { orbDamageFlat: 6 } },
  { id: 'orb.crit', pathId: 'orb', clusterId: 'orb', gx: 1, gy: 1, icon: 'crit', name: 'Unstable Core', description: '+20% orb crit chance', prerequisites: ['orb.chains'], effects: { orbCritChanceFlat: 0.2 } },
  { id: 'orb.damage3', pathId: 'orb', clusterId: 'orb', gx: -1, gy: 1, icon: 'orb', name: 'Orb Damage II', description: '+9 orb damage', prerequisites: ['orb.damage2'], effects: { orbDamageFlat: 9 } },
  { id: 'orb.critDamage', pathId: 'orb', clusterId: 'orb', gx: 1, gy: 2, icon: 'critDamage', name: 'Core Rupture', description: '+100% orb crit damage', prerequisites: ['orb.crit'], effects: { orbCritDamageFlat: 1.0 } },
  { id: 'orb.bounce2', pathId: 'orb', clusterId: 'orb', gx: 0, gy: 2, icon: 'orb', name: 'Orb Chains II', description: 'Orbs bounce to 2 more targets', prerequisites: ['orb.chains'], effects: { orbBounceFlat: 2 } },
  { id: 'orb.chance3', pathId: 'orb', clusterId: 'orb', gx: 2, gy: 0, icon: 'orb', name: 'Orbital Frequency II', description: '+15% chance a Breaker kill launches an orb', prerequisites: ['orb.chance2'], effects: { orbChanceFlat: 0.15 } },
  // Moon branch is live: any entity can roll a moon affix; breaking one (Breaker only) captures a satellite that orbits and buffs the Breaker for a duration.
  { id: 'moon.capture', pathId: 'moon', clusterId: 'moon', gx: 0, gy: 0, icon: 'moon', name: 'Moon Capture', description: 'Entities can spawn with a moon affix; breaking one captures a satellite that orbits and buffs the Breaker', prerequisites: ['hub.time2'], effects: { moonSpawnChanceFlat: 0.05 }, keystone: true },
  { id: 'moon.duration', pathId: 'moon', clusterId: 'moon', gx: 1, gy: 0, icon: 'moon', name: 'Satellite Duration', description: '+100% captured-satellite duration', prerequisites: ['moon.capture'], effects: { moonDurationFraction: 1.0 } },
  { id: 'moon.capture2', pathId: 'moon', clusterId: 'moon', gx: 0, gy: -1, icon: 'moon', name: 'Moon Capture II', description: '+5% moon spawn chance', prerequisites: ['moon.capture'], effects: { moonSpawnChanceFlat: 0.05 } },
  { id: 'moon.duration2', pathId: 'moon', clusterId: 'moon', gx: 2, gy: 0, icon: 'moon', name: 'Satellite Duration II', description: '+75% captured-satellite duration', prerequisites: ['moon.duration'], effects: { moonDurationFraction: 0.75 } },
  { id: 'moon.cap', pathId: 'moon', clusterId: 'moon', gx: 1, gy: -1, icon: 'moon', name: 'Constellation', description: '+3 max orbiting satellites', prerequisites: ['moon.capture2'], effects: { moonCapFlat: 3 } },
]);

export const UPGRADE_NODE_MAP: ReadonlyMap<string, UpgradeNode> = new Map(
  UPGRADE_NODES.map((node) => [node.id, node]),
);

export interface UpgradeTrunk {
  from: string;
  to: string;
}

export interface ExpansionSlot {
  attachedTo: string;
  dgx: number;
  dgy: number;
  label: string;
}

// Trunks are real gates: each branch entry lists its trunk's from-node as a prerequisite, so the drawn line is the unlock.
export const UPGRADE_TRUNKS: UpgradeTrunk[] = [
  { from: 'hub.tick1', to: 'cl.static' },
  // Trunks from the hub out to each path cluster, radiating in a distinct compass direction.
  { from: 'hub.size3', to: 'planet.unlock' },
  { from: 'hub.tick2', to: 'star.unlock' },
  { from: 'hub.crit2', to: 'golden.spawn' },
  { from: 'hub.critDamage2', to: 'radioactive.spawn' },
  { from: 'hub.crit1', to: 'comet.flyby' },
  { from: 'hub.damage3', to: 'laser.beam' },
  { from: 'hub.timeOnKill', to: 'orb.spark' },
  { from: 'hub.time2', to: 'moon.capture' },
];

// Empty: every path has shipped, so the lock-square teasers were removed; the type/rendering stay so a future path can add one back.
export const UPGRADE_EXPANSION_SLOTS: ExpansionSlot[] = [];
