import { describe, expect, it } from 'vitest';
import { CELESTIAL_TIERS } from '../../config/celestials';
import { ORB } from '../../config/orb';
import { EventBus } from '../../core/EventBus';
import type { GameEvents } from '../../core/events';
import { createCelestial, type Celestial } from '../entities';
import { OrbSystem, type OrbStats } from './OrbSystem';

const ENABLED: OrbStats = { enabled: true, chance: 1, damage: 6, bounces: 2, critChance: 0, critDamageMult: 1.5 };
const DISABLED: OrbStats = { ...ENABLED, enabled: false };

// A break at the origin, matching how BreakerSystem/LaserSystem/ChainLightningSystem emit objectBroken.
function breakAt(bus: EventBus<GameEvents>, id: number, x = 0, y = 0): void {
  bus.emit('objectBroken', { id, tierId: 'rock', value: 1, x, y, source: 'breaker', affix: null });
}

// Time to fully close a given world-unit distance at the orb's travel speed, with a little headroom.
function secondsToTravel(distance: number): number {
  return distance / ORB.speedWorldUnitsPerSecond;
}

describe('OrbSystem', () => {
  it('does nothing when disabled', () => {
    const bus = new EventBus<GameEvents>();
    const damaged: GameEvents['entityDamaged'][] = [];
    bus.on('entityDamaged', (payload) => damaged.push(payload));
    const target = createCelestial('rock', 100, 0, 2);
    target.sizeScale = 1;
    const entities: Celestial[] = [target];
    const system = new OrbSystem(bus, entities, () => DISABLED, undefined, () => 0);
    breakAt(bus, 1);
    system.update(1);
    expect(damaged).toHaveLength(0);
    expect(system.orbs).toHaveLength(0);
  });

  it('does nothing on a failed chance roll', () => {
    const bus = new EventBus<GameEvents>();
    const target = createCelestial('rock', 100, 0, 2);
    const entities: Celestial[] = [target];
    // rng returns 0.99, which fails a chance of anything below 0.99 - here chance is 1 so bump rng past it via a stats override.
    const system = new OrbSystem(bus, entities, () => ({ ...ENABLED, chance: 0.1 }), undefined, () => 0.99);
    breakAt(bus, 1);
    system.update(1);
    expect(system.orbs).toHaveLength(0);
  });

  it('only launches from breaker-sourced kills, never from its own orb kills', () => {
    const bus = new EventBus<GameEvents>();
    const target = createCelestial('rock', 100, 0, 2);
    const entities: Celestial[] = [target];
    const system = new OrbSystem(bus, entities, () => ENABLED, undefined, () => 0);
    bus.emit('objectBroken', { id: 1, tierId: 'rock', value: 1, x: 0, y: 0, source: 'chain', affix: null });
    bus.emit('objectBroken', { id: 1, tierId: 'rock', value: 1, x: 0, y: 0, source: 'orb', affix: null });
    system.update(1);
    expect(system.orbs).toHaveLength(0);
  });

  it('spawns an orb targeting the nearest entity on a breaker kill with chance 1', () => {
    const bus = new EventBus<GameEvents>();
    const near = createCelestial('rock', 100, 0, 2);
    const far = createCelestial('rock', 180, 0, 3);
    const entities: Celestial[] = [far, near];
    const system = new OrbSystem(bus, entities, () => ENABLED, undefined, () => 0);
    breakAt(bus, 1);
    system.update(0);
    expect(system.orbs).toHaveLength(1);
    expect(system.orbs[0].x).toBe(0);
    expect(system.orbs[0].y).toBe(0);
  });

  it('travels rather than resolving instantly - a small dt leaves the target undamaged', () => {
    const bus = new EventBus<GameEvents>();
    const damaged: GameEvents['entityDamaged'][] = [];
    bus.on('entityDamaged', (payload) => damaged.push(payload));
    const target = createCelestial('rock', 100, 0, 2);
    target.sizeScale = 1;
    const entities: Celestial[] = [target];
    const system = new OrbSystem(bus, entities, () => ENABLED, undefined, () => 0);
    breakAt(bus, 1);
    system.update(0.05); // Travels 13 world units of the 100 - nowhere near the rock's radius-14 hit threshold.
    expect(damaged).toHaveLength(0);
    expect(system.orbs).toHaveLength(1);
    expect(system.orbs[0].x).toBeGreaterThan(0);
    expect(system.orbs[0].x).toBeLessThan(100);
  });

  it('hits the target after enough delta time, applying damage', () => {
    const bus = new EventBus<GameEvents>();
    const damaged: GameEvents['entityDamaged'][] = [];
    bus.on('entityDamaged', (payload) => damaged.push(payload));
    const target = createCelestial('rock', 100, 0, 2);
    target.sizeScale = 1;
    const entities: Celestial[] = [target];
    const system = new OrbSystem(bus, entities, () => ({ ...ENABLED, bounces: 0 }), undefined, () => 0);
    breakAt(bus, 1);
    system.update(secondsToTravel(100) + 0.1);
    expect(damaged).toHaveLength(1);
    expect(damaged[0].amount).toBe(6);
    expect(target.hp).toBe(CELESTIAL_TIERS.rock.hp - 6);
    // Bounce cap of 0 means the orb expires after its first hit.
    expect(system.orbs).toHaveLength(0);
  });

  it('bounces to a second entity and respects the bounce cap', () => {
    const bus = new EventBus<GameEvents>();
    const damaged: GameEvents['entityDamaged'][] = [];
    bus.on('entityDamaged', (payload) => damaged.push(payload));
    const first = createCelestial('rock', 100, 0, 2);
    first.sizeScale = 1;
    first.hp = 999;
    const second = createCelestial('rock', 100, 0.3, 3);
    second.sizeScale = 1;
    second.hp = 999;
    const third = createCelestial('rock', 100, -0.3, 4);
    third.sizeScale = 1;
    third.hp = 999;
    const entities: Celestial[] = [first, second, third];
    const system = new OrbSystem(bus, entities, () => ({ ...ENABLED, bounces: 1 }), undefined, () => 0);
    breakAt(bus, 1);
    // Drive far enough in one big step to resolve both the initial hit and the single bounce.
    system.update(secondsToTravel(400) + 1);
    expect(damaged.length).toBeGreaterThanOrEqual(2);
    expect(damaged).toHaveLength(2);
    expect(system.orbs).toHaveLength(0);
    const hitIds = damaged.map((payload) => payload.id);
    expect(new Set(hitIds).size).toBe(2); // Never re-hits the same target twice.
  });

  it('an orb kill emits objectBroken with source orb and the value multiplier applied', () => {
    const bus = new EventBus<GameEvents>();
    const broken: GameEvents['objectBroken'][] = [];
    bus.on('objectBroken', (payload) => {
      if (payload.source === 'orb') broken.push(payload);
    });
    const target = createCelestial('rock', 100, 0, 2);
    target.sizeScale = 1;
    target.hp = 1;
    target.affix = 'golden';
    const entities: Celestial[] = [target];
    const system = new OrbSystem(bus, entities, () => ({ ...ENABLED, bounces: 0 }), (tierId) => (tierId === 'rock' ? 2 : 1), () => 0);
    breakAt(bus, 1);
    system.update(secondsToTravel(100) + 0.1);
    expect(entities).toHaveLength(0);
    expect(broken).toHaveLength(1);
    expect(broken[0].value).toBe(Math.round(CELESTIAL_TIERS.rock.breakValue * 2));
    expect(broken[0].affix).toBe('golden');
  });

  it('an orb-sourced kill does not itself spawn another orb', () => {
    const bus = new EventBus<GameEvents>();
    const target = createCelestial('rock', 100, 0, 2);
    target.sizeScale = 1;
    target.hp = 1;
    const entities: Celestial[] = [target];
    const system = new OrbSystem(bus, entities, () => ({ ...ENABLED, bounces: 0 }), undefined, () => 0);
    breakAt(bus, 1);
    system.update(secondsToTravel(100) + 0.1);
    expect(entities).toHaveLength(0);
    // The kill above emitted objectBroken with source 'orb'; if that re-triggered launch, a fresh orb would appear.
    system.update(1);
    expect(system.orbs).toHaveLength(0);
  });

  it('retargets when the current target dies mid-flight from another source', () => {
    const bus = new EventBus<GameEvents>();
    const damaged: GameEvents['entityDamaged'][] = [];
    bus.on('entityDamaged', (payload) => damaged.push(payload));
    const near = createCelestial('rock', 100, 0, 2);
    near.sizeScale = 1;
    const backup = createCelestial('rock', 140, 0.3, 3);
    backup.sizeScale = 1;
    const entities: Celestial[] = [near, backup];
    const system = new OrbSystem(bus, entities, () => ({ ...ENABLED, bounces: 0 }), undefined, () => 0);
    breakAt(bus, 1);
    system.update(0.05); // Orb is mid-flight toward `near`.
    // `near` vanishes (e.g. consumed by gravity) before the orb arrives.
    const index = entities.indexOf(near);
    entities.splice(index, 1);
    system.update(secondsToTravel(200));
    expect(damaged).toHaveLength(1);
    expect(damaged[0].id).toBe(backup.id);
  });

  it('expires gracefully when the target dies mid-flight and nothing else is in range', () => {
    const bus = new EventBus<GameEvents>();
    const damaged: GameEvents['entityDamaged'][] = [];
    bus.on('entityDamaged', (payload) => damaged.push(payload));
    const near = createCelestial('rock', 100, 0, 2);
    near.sizeScale = 1;
    const entities: Celestial[] = [near];
    const system = new OrbSystem(bus, entities, () => ({ ...ENABLED, bounces: 0 }), undefined, () => 0);
    breakAt(bus, 1);
    system.update(0.05);
    entities.length = 0;
    expect(() => system.update(secondsToTravel(200))).not.toThrow();
    expect(system.orbs).toHaveLength(0);
    expect(damaged).toHaveLength(0);
  });

  it('does not spawn when nothing is within search range', () => {
    const bus = new EventBus<GameEvents>();
    const farAway = createCelestial('rock', ORB.searchRangeWorldUnits + 50, 0, 2);
    const entities: Celestial[] = [farAway];
    const system = new OrbSystem(bus, entities, () => ENABLED, undefined, () => 0);
    breakAt(bus, 1);
    system.update(1);
    expect(system.orbs).toHaveLength(0);
  });

  it('a crit roll under the chance multiplies orb damage and emits critLanded', () => {
    const bus = new EventBus<GameEvents>();
    const damaged: GameEvents['entityDamaged'][] = [];
    const crits: GameEvents['critLanded'][] = [];
    bus.on('entityDamaged', (payload) => damaged.push(payload));
    bus.on('critLanded', (payload) => crits.push(payload));
    const target = createCelestial('rock', 100, 0, 2);
    target.sizeScale = 1;
    const entities: Celestial[] = [target];
    // rng 0 passes both the launch roll and the crit roll deterministically.
    const stats: OrbStats = { ...ENABLED, bounces: 0, critChance: 0.5, critDamageMult: 2 };
    const system = new OrbSystem(bus, entities, () => stats, undefined, () => 0);
    breakAt(bus, 1);
    system.update(secondsToTravel(100) + 0.1);
    expect(damaged).toHaveLength(1);
    expect(damaged[0].amount).toBe(12);
    expect(crits).toHaveLength(1);
    expect(crits[0].id).toBe(target.id);
    expect(crits[0].amount).toBe(12);
  });

  it('a crit roll at or above the chance deals normal damage and emits no critLanded', () => {
    const bus = new EventBus<GameEvents>();
    const damaged: GameEvents['entityDamaged'][] = [];
    const crits: GameEvents['critLanded'][] = [];
    bus.on('entityDamaged', (payload) => damaged.push(payload));
    bus.on('critLanded', (payload) => crits.push(payload));
    const target = createCelestial('rock', 100, 0, 2);
    target.sizeScale = 1;
    const entities: Celestial[] = [target];
    // rng 0.6: passes the launch roll (chance 1) but misses the 0.5 crit chance.
    const stats: OrbStats = { ...ENABLED, bounces: 0, critChance: 0.5, critDamageMult: 2 };
    const system = new OrbSystem(bus, entities, () => stats, undefined, () => 0.6);
    breakAt(bus, 1);
    system.update(secondsToTravel(100) + 0.1);
    expect(damaged).toHaveLength(1);
    expect(damaged[0].amount).toBe(6);
    expect(crits).toHaveLength(0);
  });

  it('reset() clears live orbs and pending spawns', () => {
    const bus = new EventBus<GameEvents>();
    const damaged: GameEvents['entityDamaged'][] = [];
    bus.on('entityDamaged', (payload) => damaged.push(payload));
    const target = createCelestial('rock', 100, 0, 2);
    target.sizeScale = 1;
    const entities: Celestial[] = [target];
    const system = new OrbSystem(bus, entities, () => ENABLED, undefined, () => 0);
    breakAt(bus, 1);
    system.reset();
    system.update(secondsToTravel(200));
    expect(system.orbs).toHaveLength(0);
    expect(damaged).toHaveLength(0);
  });
});
