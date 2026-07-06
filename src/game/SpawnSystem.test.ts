import { describe, expect, it } from 'vitest';
import { CELESTIAL_TIERS } from '../config/celestials';
import { SESSION_CONFIG } from '../config/session';
import { createCelestial, createIdGenerator, type Celestial } from './entities';
import { deterministicUnit } from './random';
import { SpawnSystem } from './SpawnSystem';

function makeSystem(
  random: () => number = () => 0.5,
  getElectricChance: () => number = () => 0,
  getGoldenChance: () => number = () => 0,
  getRadioactiveChance: () => number = () => 0,
  getMoonChance: () => number = () => 0,
  getLaserChance: () => number = () => 0,
): SpawnSystem {
  return new SpawnSystem(
    SESSION_CONFIG,
    random,
    createIdGenerator(),
    getElectricChance,
    getGoldenChance,
    getRadioactiveChance,
    getMoonChance,
    getLaserChance,
  );
}

// Deterministic but well-spread sequence, so a single long update() reliably hits every tier.
function scriptedRandom(): () => number {
  let seed = 0;
  return () => deterministicUnit(seed++ * 1.618);
}

function makeTargetSystem(target: number): SpawnSystem {
  return new SpawnSystem(
    SESSION_CONFIG,
    () => 0.5,
    createIdGenerator(),
    () => 0,
    () => 0,
    () => 0,
    () => 0,
    () => 0,
    () => true,
    () => 1,
    () => 1,
    () => target,
  );
}

describe('SpawnSystem', () => {
  it('spawns nothing before the first interval elapses', () => {
    const entities: Celestial[] = [];
    makeSystem().update(SESSION_CONFIG.spawnStartInterval - 0.01, 0, entities, SESSION_CONFIG.spawnRadius);
    expect(entities).toHaveLength(0);
  });

  it('spawns at the periphery once the interval elapses', () => {
    const entities: Celestial[] = [];
    makeSystem().update(SESSION_CONFIG.spawnStartInterval + 0.01, 0, entities, SESSION_CONFIG.spawnRadius);
    expect(entities).toHaveLength(1);
    expect(entities[0].orbitRadius).toBe(SESSION_CONFIG.spawnRadius);
  });

  it('spawns faster at full escalation than at session start', () => {
    const early: Celestial[] = [];
    const late: Celestial[] = [];
    const simulatedSeconds = 10;
    const tickSeconds = 0.05;
    const earlySystem = makeSystem();
    const lateSystem = makeSystem();
    for (let elapsed = 0; elapsed < simulatedSeconds; elapsed += tickSeconds) {
      earlySystem.update(tickSeconds, 0, early, SESSION_CONFIG.spawnRadius);
      lateSystem.update(tickSeconds, 1, late, SESSION_CONFIG.spawnRadius);
    }
    expect(late.length).toBeGreaterThan(early.length);
  });

  it('respects tier weights via the injected random source', () => {
    const config = { ...SESSION_CONFIG, tierWeights: { rock: 0.7, smallAsteroid: 0.3 } };
    const system = new SpawnSystem(config, () => 0.99, createIdGenerator(), () => 0);
    const entities: Celestial[] = [];
    system.update(config.spawnStartInterval + 0.01, 0, entities, config.spawnRadius);
    expect(entities[0].tierId).toBe('smallAsteroid');
  });

  it('rolls the electric affix only on metal-bearing tiers', () => {
    const entities: Celestial[] = [];
    const system = makeSystem(scriptedRandom(), () => 1);
    system.update(300, 0, entities, SESSION_CONFIG.spawnRadius);
    const metalSpawns = entities.filter((e) => CELESTIAL_TIERS[e.tierId].metalBearing);
    const nonMetalSpawns = entities.filter((e) => !CELESTIAL_TIERS[e.tierId].metalBearing);
    // Sanity: the scripted sequence must actually hit both metal and non-metal tiers.
    expect(metalSpawns.length).toBeGreaterThan(0);
    expect(nonMetalSpawns.length).toBeGreaterThan(0);
    for (const entity of metalSpawns) expect(entity.affix).toBe('electric');
    for (const entity of nonMetalSpawns) expect(entity.affix).toBeNull();
  });

  it('never rolls electric at chance 0', () => {
    const entities: Celestial[] = [];
    const system = makeSystem(scriptedRandom(), () => 0);
    system.update(300, 0, entities, SESSION_CONFIG.spawnRadius);
    const metalSpawns = entities.filter((e) => CELESTIAL_TIERS[e.tierId].metalBearing);
    expect(metalSpawns.length).toBeGreaterThan(0);
    for (const entity of entities) expect(entity.affix).toBeNull();
  });

  it('rolls the golden affix on any tier, metal-bearing or not', () => {
    const entities: Celestial[] = [];
    const system = makeSystem(scriptedRandom(), () => 0, () => 1);
    system.update(300, 0, entities, SESSION_CONFIG.spawnRadius);
    const nonMetalSpawns = entities.filter((e) => !CELESTIAL_TIERS[e.tierId].metalBearing);
    expect(nonMetalSpawns.length).toBeGreaterThan(0);
    for (const entity of entities) expect(entity.affix).toBe('golden');
  });

  it('golden takes precedence over electric when both roll', () => {
    const entities: Celestial[] = [];
    const system = makeSystem(scriptedRandom(), () => 1, () => 1);
    system.update(300, 0, entities, SESSION_CONFIG.spawnRadius);
    const metalSpawns = entities.filter((e) => CELESTIAL_TIERS[e.tierId].metalBearing);
    expect(metalSpawns.length).toBeGreaterThan(0);
    for (const entity of entities) expect(entity.affix).toBe('golden');
  });

  it('never rolls golden at chance 0', () => {
    const entities: Celestial[] = [];
    const system = makeSystem(scriptedRandom(), () => 0, () => 0);
    system.update(300, 0, entities, SESSION_CONFIG.spawnRadius);
    for (const entity of entities) expect(entity.affix).toBeNull();
  });

  it('rolls the radioactive affix on any tier, metal-bearing or not', () => {
    const entities: Celestial[] = [];
    const system = makeSystem(scriptedRandom(), () => 0, () => 0, () => 1);
    system.update(300, 0, entities, SESSION_CONFIG.spawnRadius);
    const nonMetalSpawns = entities.filter((e) => !CELESTIAL_TIERS[e.tierId].metalBearing);
    expect(nonMetalSpawns.length).toBeGreaterThan(0);
    for (const entity of entities) expect(entity.affix).toBe('radioactive');
  });

  it('never rolls radioactive at chance 0', () => {
    const entities: Celestial[] = [];
    const system = makeSystem(scriptedRandom(), () => 0, () => 0, () => 0);
    system.update(300, 0, entities, SESSION_CONFIG.spawnRadius);
    for (const entity of entities) expect(entity.affix).toBeNull();
  });

  it('golden takes precedence over radioactive when both roll', () => {
    const entities: Celestial[] = [];
    const system = makeSystem(scriptedRandom(), () => 0, () => 1, () => 1);
    system.update(300, 0, entities, SESSION_CONFIG.spawnRadius);
    for (const entity of entities) expect(entity.affix).toBe('golden');
  });

  it('radioactive takes precedence over electric when both roll (and golden does not)', () => {
    const entities: Celestial[] = [];
    const system = makeSystem(scriptedRandom(), () => 1, () => 0, () => 1);
    system.update(300, 0, entities, SESSION_CONFIG.spawnRadius);
    const metalSpawns = entities.filter((e) => CELESTIAL_TIERS[e.tierId].metalBearing);
    expect(metalSpawns.length).toBeGreaterThan(0);
    for (const entity of entities) expect(entity.affix).toBe('radioactive');
  });

  it('spawns more entities over a fixed duration at a larger field radius (area-scaled rate)', () => {
    const near: Celestial[] = [];
    const far: Celestial[] = [];
    const simulatedSeconds = 10;
    const tickSeconds = 0.05;
    const nearSystem = makeSystem();
    const farSystem = makeSystem();
    for (let elapsed = 0; elapsed < simulatedSeconds; elapsed += tickSeconds) {
      nearSystem.update(tickSeconds, 0, near, SESSION_CONFIG.spawnRadius);
      farSystem.update(tickSeconds, 0, far, SESSION_CONFIG.spawnRadius * 2);
    }
    expect(far.length).toBeGreaterThan(near.length);
  });

  it('never exceeds maxEntities even when driven for a long time at a large field radius', () => {
    const entities: Celestial[] = [];
    const system = makeSystem();
    const simulatedSeconds = 600;
    const tickSeconds = 0.05;
    for (let elapsed = 0; elapsed < simulatedSeconds; elapsed += tickSeconds) {
      system.update(tickSeconds, 1, entities, SESSION_CONFIG.spawnRadius * 2);
      expect(entities.length).toBeLessThanOrEqual(SESSION_CONFIG.maxEntities);
    }
  });

  it('never spawns planets while locked, spawns them once unlocked', () => {
    const cfg = { ...SESSION_CONFIG, tierWeights: { rock: 1, planet: 1 } };
    const locked = new SpawnSystem(cfg, () => 0.99, createIdGenerator(), () => 0, () => 0, () => 0, () => 0, () => 0, (t) => t !== 'planet', () => 1);
    const lockedEntities: Celestial[] = [];
    for (let i = 0; i < 40; i++) locked.update(cfg.spawnStartInterval, 0, lockedEntities, cfg.spawnRadius);
    expect(lockedEntities.some((e) => e.tierId === 'planet')).toBe(false);

    // Unlocked + a roll that lands in the planet bucket → planet can spawn.
    const unlocked = new SpawnSystem(
      cfg,
      () => 0.99,
      createIdGenerator(),
      () => 0,
      () => 0,
      () => 0,
      () => 0,
      () => 0,
      (t) => t === 'planet' || t === 'rock',
      () => 1,
    );
    const unlockedEntities: Celestial[] = [];
    for (let i = 0; i < 40; i++) unlocked.update(cfg.spawnStartInterval, 0, unlockedEntities, cfg.spawnRadius);
    expect(unlockedEntities.some((e) => e.tierId === 'planet')).toBe(true);
  });

  it('rolls the moon affix on any tier, metal-bearing or not', () => {
    const entities: Celestial[] = [];
    const system = makeSystem(scriptedRandom(), () => 0, () => 0, () => 0, () => 1);
    system.update(300, 0, entities, SESSION_CONFIG.spawnRadius);
    const nonMetalSpawns = entities.filter((e) => !CELESTIAL_TIERS[e.tierId].metalBearing);
    expect(nonMetalSpawns.length).toBeGreaterThan(0);
    for (const entity of entities) expect(entity.affix).toBe('moon');
  });

  it('never rolls moon at chance 0', () => {
    const entities: Celestial[] = [];
    const system = makeSystem(scriptedRandom(), () => 0, () => 0, () => 0, () => 0);
    system.update(300, 0, entities, SESSION_CONFIG.spawnRadius);
    for (const entity of entities) expect(entity.affix).toBeNull();
  });

  it('golden and radioactive both take precedence over moon when they roll', () => {
    const entities: Celestial[] = [];
    const system = makeSystem(scriptedRandom(), () => 0, () => 1, () => 0, () => 1);
    system.update(300, 0, entities, SESSION_CONFIG.spawnRadius);
    for (const entity of entities) expect(entity.affix).toBe('golden');

    const entities2: Celestial[] = [];
    const system2 = makeSystem(scriptedRandom(), () => 0, () => 0, () => 1, () => 1);
    system2.update(300, 0, entities2, SESSION_CONFIG.spawnRadius);
    for (const entity of entities2) expect(entity.affix).toBe('radioactive');
  });

  it('moon takes precedence over electric when both roll (and golden/radioactive do not)', () => {
    const entities: Celestial[] = [];
    const system = makeSystem(scriptedRandom(), () => 1, () => 0, () => 0, () => 1);
    system.update(300, 0, entities, SESSION_CONFIG.spawnRadius);
    const metalSpawns = entities.filter((e) => CELESTIAL_TIERS[e.tierId].metalBearing);
    expect(metalSpawns.length).toBeGreaterThan(0);
    for (const entity of entities) expect(entity.affix).toBe('moon');
  });

  it('rolls the laser affix only on star-category tiers, even at chance 1', () => {
    const cfg = { ...SESSION_CONFIG, tierWeights: { rock: 1, star: 1 } };
    const system = new SpawnSystem(cfg, scriptedRandom(), createIdGenerator(), () => 0, () => 0, () => 0, () => 0, () => 1);
    const entities: Celestial[] = [];
    system.update(300, 0, entities, cfg.spawnRadius);
    const starSpawns = entities.filter((e) => CELESTIAL_TIERS[e.tierId].category === 'star');
    const nonStarSpawns = entities.filter((e) => CELESTIAL_TIERS[e.tierId].category !== 'star');
    // Sanity: the scripted sequence must actually hit both star and non-star tiers.
    expect(starSpawns.length).toBeGreaterThan(0);
    expect(nonStarSpawns.length).toBeGreaterThan(0);
    for (const entity of starSpawns) expect(entity.affix).toBe('laser');
    for (const entity of nonStarSpawns) expect(entity.affix).toBeNull();
  });

  it('never rolls laser at chance 0', () => {
    const cfg = { ...SESSION_CONFIG, tierWeights: { star: 1 } };
    const system = new SpawnSystem(cfg, scriptedRandom(), createIdGenerator(), () => 0, () => 0, () => 0, () => 0, () => 0);
    const entities: Celestial[] = [];
    system.update(300, 0, entities, cfg.spawnRadius);
    expect(entities.length).toBeGreaterThan(0);
    for (const entity of entities) expect(entity.affix).toBeNull();
  });

  it('a spawn-rate mult above 1 spawns more entities over the same duration', () => {
    const baseline: Celestial[] = [];
    const boosted: Celestial[] = [];
    const simulatedSeconds = 10;
    const tickSeconds = 0.05;
    const baselineSystem = makeSystem();
    const boostedSystem = new SpawnSystem(
      SESSION_CONFIG,
      () => 0.5,
      createIdGenerator(),
      () => 0,
      () => 0,
      () => 0,
      () => 0,
      () => 0,
      () => true,
      () => 1,
      () => 2,
    );
    for (let elapsed = 0; elapsed < simulatedSeconds; elapsed += tickSeconds) {
      baselineSystem.update(tickSeconds, 0, baseline, SESSION_CONFIG.spawnRadius);
      boostedSystem.update(tickSeconds, 0, boosted, SESSION_CONFIG.spawnRadius);
    }
    // Mult 2 halves the effective interval, so the boosted field should roughly double.
    expect(boosted.length).toBeGreaterThan(baseline.length * 1.5);
  });

  it('seedInitialField spawns the requested count inside the mid-field band', () => {
    const entities: Celestial[] = [];
    const system = makeSystem(scriptedRandom());
    const fieldRadius = SESSION_CONFIG.spawnRadius;
    system.seedInitialField(20, entities, fieldRadius);
    expect(entities).toHaveLength(20);
    for (const entity of entities) {
      expect(entity.orbitRadius).toBeGreaterThanOrEqual(0.45 * fieldRadius);
      expect(entity.orbitRadius).toBeLessThanOrEqual(fieldRadius);
    }
  });

  it('seedInitialField respects maxEntities', () => {
    const cfg = { ...SESSION_CONFIG, maxEntities: 10 };
    const system = new SpawnSystem(cfg, scriptedRandom(), createIdGenerator(), () => 0);
    const entities: Celestial[] = [];
    system.seedInitialField(50, entities, cfg.spawnRadius);
    expect(entities).toHaveLength(10);
  });

  it('seedInitialField rolls affixes like a normal spawn', () => {
    const entities: Celestial[] = [];
    const system = makeSystem(scriptedRandom(), () => 0, () => 1);
    system.seedInitialField(15, entities, SESSION_CONFIG.spawnRadius);
    for (const entity of entities) expect(entity.affix).toBe('golden');
  });

  it('below target, a bigger field target refills at a shorter effective interval', () => {
    const small: Celestial[] = [];
    const large: Celestial[] = [];
    const smallSystem = makeTargetSystem(20);
    const largeSystem = makeTargetSystem(80);
    const tickSeconds = 0.05;
    for (let elapsed = 0; elapsed < 1; elapsed += tickSeconds) {
      smallSystem.update(tickSeconds, 0, small, SESSION_CONFIG.spawnRadius);
      largeSystem.update(tickSeconds, 0, large, SESSION_CONFIG.spawnRadius);
    }
    // Both stay below their targets over this window, so every spawn is refill-driven.
    expect(small.length).toBeGreaterThan(0);
    expect(small.length).toBeLessThan(20);
    expect(large.length).toBeLessThan(80);
    expect(large.length).toBeGreaterThan(small.length);
  });

  it('at or above the target only the session drip runs', () => {
    const seed = (): Celestial[] =>
      Array.from({ length: 10 }, (_, i) => createCelestial('rock', SESSION_CONFIG.spawnRadius, 0, i + 1));
    const dripOnly = seed();
    const atTarget = seed();
    const dripOnlySystem = makeTargetSystem(0);
    const atTargetSystem = makeTargetSystem(10);
    const tickSeconds = 0.05;
    for (let elapsed = 0; elapsed < 10; elapsed += tickSeconds) {
      dripOnlySystem.update(tickSeconds, 0, dripOnly, SESSION_CONFIG.spawnRadius);
      atTargetSystem.update(tickSeconds, 0, atTarget, SESSION_CONFIG.spawnRadius);
    }
    expect(atTarget.length).toBe(dripOnly.length);
  });

  it('the refill dies down once the target is reached', () => {
    const entities: Celestial[] = [];
    const system = makeTargetSystem(15);
    const tickSeconds = 0.05;
    for (let elapsed = 0; elapsed < 5; elapsed += tickSeconds) {
      system.update(tickSeconds, 0, entities, SESSION_CONFIG.spawnRadius);
    }
    // 5 seconds is ample to hit a 15-target refill; only the slow drip can push past it afterward.
    expect(entities.length).toBeGreaterThanOrEqual(15);
    expect(entities.length).toBeLessThanOrEqual(15 + 5);
  });

  it('queued respawns drain on the next update at edge placement', () => {
    const system = makeSystem();
    system.queueRespawn();
    system.queueRespawn();
    system.queueRespawn();
    const entities: Celestial[] = [];
    system.update(0.01, 0, entities, SESSION_CONFIG.spawnRadius);
    expect(entities).toHaveLength(3);
    for (const entity of entities) expect(entity.orbitRadius).toBe(SESSION_CONFIG.spawnRadius);
    // The queue drained: a second tiny update spawns nothing new.
    system.update(0.01, 0, entities, SESSION_CONFIG.spawnRadius);
    expect(entities).toHaveLength(3);
  });

  it('queued respawns respect maxEntities', () => {
    const cfg = { ...SESSION_CONFIG, maxEntities: 5 };
    const system = new SpawnSystem(cfg, () => 0.5, createIdGenerator(), () => 0);
    for (let i = 0; i < 10; i++) system.queueRespawn();
    const entities: Celestial[] = [];
    system.update(0.01, 0, entities, cfg.spawnRadius);
    expect(entities).toHaveLength(5);
  });

  it('queued respawns roll affixes like a normal spawn', () => {
    const system = makeSystem(scriptedRandom(), () => 0, () => 1);
    for (let i = 0; i < 5; i++) system.queueRespawn();
    const entities: Celestial[] = [];
    system.update(0.01, 0, entities, SESSION_CONFIG.spawnRadius);
    for (const entity of entities) expect(entity.affix).toBe('golden');
  });

  it('forced-category respawns spawn only tiers of that category, weighted within it', () => {
    const cfg = { ...SESSION_CONFIG, tierWeights: { rock: 10, dwarfPlanet: 1, gasGiant: 1, star: 5 } };
    const system = new SpawnSystem(cfg, scriptedRandom(), createIdGenerator(), () => 0);
    for (let i = 0; i < 60; i++) system.queueRespawn('planet');
    const entities: Celestial[] = [];
    system.update(0.01, 0, entities, cfg.spawnRadius);
    expect(entities).toHaveLength(60);
    for (const entity of entities) expect(CELESTIAL_TIERS[entity.tierId].category).toBe('planet');
    // Both planet tiers appear: the in-category weights still drive the roll.
    expect(new Set(entities.map((entity) => entity.tierId)).size).toBeGreaterThan(1);
  });

  it('a forced-category respawn with no spawnable tier in that category falls back to a normal roll', () => {
    const cfg = { ...SESSION_CONFIG, tierWeights: { rock: 1, star: 1 } };
    const system = new SpawnSystem(cfg, scriptedRandom(), createIdGenerator(), () => 0, () => 0, () => 0, () => 0, () => 0, (t) => t !== 'star');
    system.queueRespawn('star');
    const entities: Celestial[] = [];
    system.update(0.01, 0, entities, cfg.spawnRadius);
    expect(entities).toHaveLength(1);
    expect(entities[0].tierId).toBe('rock');
  });

  it('reset clears queued respawns and re-arms the drip timer', () => {
    const system = makeSystem();
    system.queueRespawn();
    system.update(SESSION_CONFIG.spawnStartInterval - 0.2, 0, [], SESSION_CONFIG.spawnRadius);
    system.reset();
    const entities: Celestial[] = [];
    system.update(0.19, 0, entities, SESSION_CONFIG.spawnRadius);
    expect(entities).toHaveLength(0);
  });

  it('golden, radioactive, and moon all take precedence over laser when they roll', () => {
    const cfg = { ...SESSION_CONFIG, tierWeights: { star: 1 } };
    const expectations: [() => number, () => number, () => number, string][] = [
      [() => 1, () => 0, () => 0, 'golden'],
      [() => 0, () => 1, () => 0, 'radioactive'],
      [() => 0, () => 0, () => 1, 'moon'],
    ];
    for (const [golden, radioactive, moon, expected] of expectations) {
      const system = new SpawnSystem(cfg, scriptedRandom(), createIdGenerator(), () => 0, golden, radioactive, moon, () => 1);
      const entities: Celestial[] = [];
      system.update(300, 0, entities, cfg.spawnRadius);
      expect(entities.length).toBeGreaterThan(0);
      for (const entity of entities) expect(entity.affix).toBe(expected);
    }
  });
});
