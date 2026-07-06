import { describe, expect, it } from 'vitest';
import { CELESTIAL_TIERS } from '../../config/celestials';
import { EventBus } from '../../core/EventBus';
import type { GameEvents } from '../../core/events';
import { BreakerSystem, type BreakerLiveStats } from '../BreakerSystem';
import { celestialPosition, createCelestial, type Celestial } from '../entities';
import { ChainLightningSystem, type ChainStats } from './ChainLightningSystem';

const STATS: ChainStats = {
  chainCount: 2, damagePerHop: 5, critChance: 0, critDamageMult: 2, rangeWorldUnits: 150, forkChance: 0,
};

function breakAt(bus: EventBus<GameEvents>, entity: Celestial): void {
  const { x, y } = celestialPosition(entity);
  bus.emit('objectBroken', {
    id: entity.id, tierId: entity.tierId, value: 1, x, y, source: 'breaker', affix: 'electric',
  });
}

describe('ChainLightningSystem', () => {
  it('chains to the nearest targets, hop by hop, emitting bolts', () => {
    const bus = new EventBus<GameEvents>();
    const bolts: GameEvents['lightningBolt'][] = [];
    bus.on('lightningBolt', (payload) => bolts.push(payload));
    const near = createCelestial('rock', 120, 0, 2);
    const far = createCelestial('rock', 160, 0, 3);
    const entities = [far, near];
    const system = new ChainLightningSystem(bus, entities, () => STATS, undefined, () => 0.99);
    breakAt(bus, createCelestial('rock', 100, 0, 1));
    system.update();
    expect(bolts).toHaveLength(2);
    expect(near.hp).toBe(CELESTIAL_TIERS.rock.hp - STATS.damagePerHop);
    expect(far.hp).toBe(CELESTIAL_TIERS.rock.hp - STATS.damagePerHop);
  });

  it('does nothing for non-electric or chain-sourced breaks or zero chainCount', () => {
    const bus = new EventBus<GameEvents>();
    const bolts: GameEvents['lightningBolt'][] = [];
    bus.on('lightningBolt', (payload) => bolts.push(payload));
    const bystander = createCelestial('rock', 120, 0, 2);
    const system = new ChainLightningSystem(bus, [bystander], () => STATS, undefined, () => 0.99);
    bus.emit('objectBroken', { id: 1, tierId: 'rock', value: 1, x: 100, y: 0, source: 'breaker', affix: null });
    bus.emit('objectBroken', { id: 1, tierId: 'rock', value: 1, x: 100, y: 0, source: 'chain', affix: 'electric' });
    system.update();
    expect(bolts).toHaveLength(0);
    const zeroed = new EventBus<GameEvents>();
    const zeroBolts: GameEvents['lightningBolt'][] = [];
    zeroed.on('lightningBolt', (payload) => zeroBolts.push(payload));
    const zeroSystem = new ChainLightningSystem(
      zeroed,
      [createCelestial('rock', 120, 0, 5)],
      () => ({ ...STATS, chainCount: 0 }),
      undefined,
      () => 0.99,
    );
    breakAt(zeroed, createCelestial('rock', 100, 0, 4));
    zeroSystem.update();
    expect(zeroBolts).toHaveLength(0);
  });

  it('chain kills pay out as chain-sourced and never re-chain', () => {
    const bus = new EventBus<GameEvents>();
    const broken: GameEvents['objectBroken'][] = [];
    const bolts: GameEvents['lightningBolt'][] = [];
    bus.on('objectBroken', (payload) => {
      if (payload.source === 'chain') broken.push(payload);
    });
    bus.on('lightningBolt', (payload) => bolts.push(payload));
    const victim = createCelestial('rock', 120, 0, 2);
    victim.hp = 3;
    victim.affix = 'electric';
    const entities = [victim];
    const system = new ChainLightningSystem(bus, entities, () => ({ ...STATS, chainCount: 5 }), undefined, () => 0.99);
    breakAt(bus, createCelestial('rock', 100, 0, 1));
    system.update();
    expect(entities).toHaveLength(0);
    expect(broken).toHaveLength(1);
    expect(broken[0].source).toBe('chain');
    expect(bolts).toHaveLength(1);
  });

  it('chain crits multiply hop damage and emit critLanded', () => {
    const bus = new EventBus<GameEvents>();
    const crits: GameEvents['critLanded'][] = [];
    bus.on('critLanded', (payload) => crits.push(payload));
    const target = createCelestial('rock', 120, 0, 2);
    const system = new ChainLightningSystem(bus, [target], () => ({ ...STATS, chainCount: 1, critChance: 1 }), undefined, () => 0);
    breakAt(bus, createCelestial('rock', 100, 0, 1));
    system.update();
    expect(target.hp).toBe(CELESTIAL_TIERS.rock.hp - 10);
    expect(crits).toHaveLength(1);
  });

  it('stops when nothing is in range', () => {
    const bus = new EventBus<GameEvents>();
    const bolts: GameEvents['lightningBolt'][] = [];
    bus.on('lightningBolt', (payload) => bolts.push(payload));
    const system = new ChainLightningSystem(bus, [createCelestial('rock', 600, 0, 2)], () => STATS, undefined, () => 0.99);
    breakAt(bus, createCelestial('rock', 100, 0, 1));
    system.update();
    expect(bolts).toHaveLength(0);
  });

  it('defers chain resolution past the breaker tick loop, never touching a stale index', () => {
    const bus = new EventBus<GameEvents>();
    const broken: GameEvents['objectBroken'][] = [];
    const bolts: GameEvents['lightningBolt'][] = [];
    bus.on('objectBroken', (payload) => broken.push(payload));
    bus.on('lightningBolt', (payload) => bolts.push(payload));

    // Positions: far outside chain range, neighbor within chain range of the electric rock, electric rock at the pointer.
    const far = createCelestial('rock', 500, 0, 1); // (500, 0)
    const neighbor = createCelestial('rock', 200, 0, 2); // (200, 0)
    neighbor.hp = 3;
    const electric = createCelestial('rock', 100, 0, 3); // (100, 0)
    electric.affix = 'electric';
    const farStartingHp = far.hp;
    // Electric pushed LAST (top/reverse-loop-first index); far pushed first (low index, processed last by the breaker's reverse loop).
    const entities: Celestial[] = [far, neighbor, electric];

    const breakerStats: BreakerLiveStats = {
      breakerRadius: 5,
      tickIntervalSeconds: 1,
      damagePerTick: 999,
      critChance: 0,
      critDamageMult: 1,
    };
    const chainStats: ChainStats = {
      chainCount: 1,
      damagePerHop: 5,
      critChance: 0,
      critDamageMult: 2,
      rangeWorldUnits: 150,
      forkChance: 0,
    };
    const breaker = new BreakerSystem(bus, () => breakerStats, undefined, () => 0.99);
    const chain = new ChainLightningSystem(bus, entities, () => chainStats, undefined, () => 0.99);
    breaker.setPointer(100, 0);

    expect(() => {
      breaker.update(1, entities);
      chain.update();
    }).not.toThrow();

    expect(entities).not.toContain(electric);
    expect(entities).not.toContain(neighbor);
    expect(entities).toContain(far);
    expect(far.hp).toBe(farStartingHp);
    const chainBroken = broken.filter((payload) => payload.source === 'chain');
    expect(chainBroken).toHaveLength(1);
    expect(bolts).toHaveLength(1);
  });

  it('forks to two targets when the fork roll passes', () => {
    const bus = new EventBus<GameEvents>();
    const bolts: GameEvents['lightningBolt'][] = [];
    bus.on('lightningBolt', (payload) => bolts.push(payload));
    const a = createCelestial('rock', 110, 0.1, 2);
    const b = createCelestial('rock', 115, -0.1, 3);
    const entities = [a, b];
    // system.update() drains the queued origin into chain() — the constructor's handler only enqueues.
    const system = new ChainLightningSystem(bus, entities, () => ({ chainCount: 1, damagePerHop: 5, critChance: 0, critDamageMult: 2, rangeWorldUnits: 150, forkChance: 1 }), undefined, () => 0);
    const { x, y } = celestialPosition(createCelestial('rock', 100, 0, 1));
    bus.emit('objectBroken', { id: 1, tierId: 'rock', value: 1, x, y, source: 'breaker', affix: 'electric' });
    system.update();
    expect(bolts).toHaveLength(2);
    expect(a.hp).toBeLessThan(CELESTIAL_TIERS.rock.hp);
    expect(b.hp).toBeLessThan(CELESTIAL_TIERS.rock.hp);
  });

  it('does not fork when the roll fails', () => {
    const bus = new EventBus<GameEvents>();
    const bolts: GameEvents['lightningBolt'][] = [];
    bus.on('lightningBolt', (payload) => bolts.push(payload));
    const entities = [createCelestial('rock', 110, 0.1, 2), createCelestial('rock', 115, -0.1, 3)];
    const system = new ChainLightningSystem(bus, entities, () => ({ chainCount: 1, damagePerHop: 5, critChance: 0, critDamageMult: 2, rangeWorldUnits: 150, forkChance: 0 }), undefined, () => 0.99);
    bus.emit('objectBroken', { id: 1, tierId: 'rock', value: 1, x: 100, y: 0, source: 'breaker', affix: 'electric' });
    system.update();
    expect(bolts).toHaveLength(1);
  });

  it('scales chain-kill value by the tier matter multiplier', () => {
    const bus = new EventBus<GameEvents>();
    const broken: GameEvents['objectBroken'][] = [];
    bus.on('objectBroken', (payload) => {
      if (payload.source === 'chain') broken.push(payload);
    });
    const planet = createCelestial('planet', 120, 0, 2);
    planet.hp = 3;
    const system = new ChainLightningSystem(
      bus,
      [planet],
      () => ({ ...STATS, chainCount: 1 }),
      (tierId) => (tierId === 'planet' ? 2 : 1),
      () => 0.99,
    );
    breakAt(bus, createCelestial('rock', 100, 0, 1));
    system.update();
    expect(broken).toHaveLength(1);
    expect(broken[0].value).toBe(Math.round(CELESTIAL_TIERS.planet.breakValue * 2));
  });

  it('reset() drops queued origins so a later update() fires no chain', () => {
    const bus = new EventBus<GameEvents>();
    const bolts: GameEvents['lightningBolt'][] = [];
    bus.on('lightningBolt', (payload) => bolts.push(payload));
    const system = new ChainLightningSystem(bus, [createCelestial('rock', 120, 0, 2)], () => STATS, undefined, () => 0.99);
    breakAt(bus, createCelestial('rock', 100, 0, 1));
    system.reset();
    system.update();
    expect(bolts).toHaveLength(0);
  });
});
