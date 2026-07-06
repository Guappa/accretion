import { describe, expect, it } from 'vitest';
import { CELESTIAL_TIERS } from '../config/celestials';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import { BreakerSystem, type BreakerLiveStats } from './BreakerSystem';
import { celestialPosition, createCelestial, type Celestial } from './entities';

const STATS: BreakerLiveStats = {
  breakerRadius: 50,
  tickIntervalSeconds: 0.1,
  damagePerTick: 5,
  critChance: 0,
  critDamageMult: 1.5,
};

function makeSystem(bus = new EventBus<GameEvents>(), stats: BreakerLiveStats = STATS, rng: () => number = () => 0.99) {
  return new BreakerSystem(bus, () => stats, undefined, rng);
}

describe('BreakerSystem', () => {
  it('damages entities inside the ring on each tick', () => {
    const system = makeSystem();
    const rock = createCelestial('rock', 100, 0, 1);
    const { x, y } = celestialPosition(rock);
    system.setPointer(x, y);
    system.update(STATS.tickIntervalSeconds, [rock]);
    expect(rock.hp).toBe(CELESTIAL_TIERS.rock.hp - STATS.damagePerTick);
  });

  it('ignores entities outside the ring', () => {
    const system = makeSystem();
    const rock = createCelestial('rock', 100, 0, 1);
    system.setPointer(-400, -400);
    system.update(STATS.tickIntervalSeconds, [rock]);
    expect(rock.hp).toBe(CELESTIAL_TIERS.rock.hp);
  });

  it('deals no damage before the pointer has ever moved', () => {
    const system = makeSystem();
    const rock = createCelestial('rock', 100, 0, 1);
    system.update(STATS.tickIntervalSeconds, [rock]);
    expect(rock.hp).toBe(CELESTIAL_TIERS.rock.hp);
  });

  it('removes a broken entity and emits objectBroken with source and affix', () => {
    const bus = new EventBus<GameEvents>();
    const broken: GameEvents['objectBroken'][] = [];
    bus.on('objectBroken', (payload) => broken.push(payload));
    const system = makeSystem(bus, { ...STATS, damagePerTick: 999 });
    const rock = createCelestial('rock', 100, Math.PI / 3, 9);
    const entities: Celestial[] = [rock];
    const { x, y } = celestialPosition(rock);
    system.setPointer(x, y);
    system.update(STATS.tickIntervalSeconds, entities);
    expect(entities).toHaveLength(0);
    expect(broken).toEqual([
      { id: 9, tierId: 'rock', value: CELESTIAL_TIERS.rock.breakValue, x, y, source: 'breaker', affix: null },
    ]);
  });

  it('crits multiply damage and emit critLanded', () => {
    const bus = new EventBus<GameEvents>();
    const crits: GameEvents['critLanded'][] = [];
    const damaged: GameEvents['entityDamaged'][] = [];
    bus.on('critLanded', (payload) => crits.push(payload));
    bus.on('entityDamaged', (payload) => damaged.push(payload));
    const system = makeSystem(bus, { ...STATS, critChance: 0.5, critDamageMult: 2 }, () => 0.1);
    const rock = createCelestial('rock', 100, 0, 7);
    const { x, y } = celestialPosition(rock);
    system.setPointer(x, y);
    system.update(STATS.tickIntervalSeconds, [rock]);
    expect(rock.hp).toBe(CELESTIAL_TIERS.rock.hp - 10);
    expect(damaged[0].amount).toBe(10);
    expect(crits).toEqual([{ id: 7, tierId: 'rock', amount: 10, x, y }]);
  });

  it('no crit when the roll misses', () => {
    const bus = new EventBus<GameEvents>();
    const crits: GameEvents['critLanded'][] = [];
    bus.on('critLanded', (payload) => crits.push(payload));
    const system = makeSystem(bus, { ...STATS, critChance: 0.5 }, () => 0.9);
    const rock = createCelestial('rock', 100, 0, 1);
    const { x, y } = celestialPosition(rock);
    system.setPointer(x, y);
    system.update(STATS.tickIntervalSeconds, [rock]);
    expect(crits).toHaveLength(0);
  });

  it('live stats retune the tick interval mid-run', () => {
    let interval = 1;
    const system = new BreakerSystem(
      new EventBus<GameEvents>(),
      () => ({ ...STATS, tickIntervalSeconds: interval }),
      undefined,
      () => 0.99,
    );
    const rock = createCelestial('rock', 100, 0, 1);
    const { x, y } = celestialPosition(rock);
    system.setPointer(x, y);
    system.update(0.5, [rock]);
    expect(rock.hp).toBe(CELESTIAL_TIERS.rock.hp);
    interval = 0.25;
    system.update(0.5, [rock]);
    expect(rock.hp).toBeLessThan(CELESTIAL_TIERS.rock.hp);
  });

  it('emits entityDamaged for the killing tick, before objectBroken', () => {
    const bus = new EventBus<GameEvents>();
    const order: string[] = [];
    bus.on('entityDamaged', () => order.push('damaged'));
    bus.on('objectBroken', () => order.push('broken'));
    const system = makeSystem(bus, { ...STATS, damagePerTick: CELESTIAL_TIERS.rock.hp });
    const rock = createCelestial('rock', 100, 0, 1);
    const { x, y } = celestialPosition(rock);
    system.setPointer(x, y);
    system.update(STATS.tickIntervalSeconds, [rock]);
    expect(order).toEqual(['damaged', 'broken']);
  });

  it('scales break value by the tier matter multiplier', () => {
    const bus = new EventBus<GameEvents>();
    const broken: GameEvents['objectBroken'][] = [];
    bus.on('objectBroken', (payload) => broken.push(payload));
    const system = new BreakerSystem(
      bus,
      () => ({ ...STATS, damagePerTick: 999 }),
      (tierId) => (tierId === 'planet' ? 2 : 1),
    );
    const planet = createCelestial('planet', 100, 0, 1);
    const { x, y } = celestialPosition(planet);
    system.setPointer(x, y);
    system.update(STATS.tickIntervalSeconds, [planet]);
    expect(broken).toHaveLength(1);
    expect(broken[0].value).toBe(CELESTIAL_TIERS.planet.breakValue * 2);
  });

  it('applies the tier damage multiplier so planets take bonus damage', () => {
    const bus = new EventBus<GameEvents>();
    const damaged: GameEvents['entityDamaged'][] = [];
    bus.on('entityDamaged', (payload) => damaged.push(payload));
    // valueMult default, rng constant, damageMult doubles planet damage.
    const system = new BreakerSystem(bus, () => STATS, undefined, () => 0.99, (tierId) =>
      tierId === 'planet' ? 2 : 1,
    );
    const planet = createCelestial('planet', 100, 0, 1);
    const { x, y } = celestialPosition(planet);
    system.setPointer(x, y);
    system.update(STATS.tickIntervalSeconds, [planet]);
    expect(damaged[0].amount).toBe(STATS.damagePerTick * 2);
    expect(planet.hp).toBe(CELESTIAL_TIERS.planet.hp - STATS.damagePerTick * 2);
  });

  it('tickProgress starts at 0, advances, and wraps on tick', () => {
    const system = makeSystem();
    expect(system.tickProgress).toBe(0);
    system.setPointer(0, 0);
    system.update(STATS.tickIntervalSeconds / 2, []);
    expect(system.tickProgress).toBeCloseTo(0.5, 6);
    system.update(STATS.tickIntervalSeconds / 2, []);
    expect(system.tickProgress).toBeCloseTo(0, 6);
  });
});
