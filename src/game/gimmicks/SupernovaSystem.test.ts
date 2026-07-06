import { describe, expect, it } from 'vitest';
import { CELESTIAL_TIERS } from '../../config/celestials';
import { SUPERNOVA } from '../../config/supernova';
import { EventBus } from '../../core/EventBus';
import type { GameEvents } from '../../core/events';
import { celestialPosition, createCelestial, type Celestial } from '../entities';
import { SupernovaSystem } from './SupernovaSystem';

function breakStarAt(
  bus: EventBus<GameEvents>,
  x: number,
  y: number,
  source: GameEvents['objectBroken']['source'] = 'breaker',
  tierId: GameEvents['objectBroken']['tierId'] = 'star',
): void {
  bus.emit('objectBroken', { id: 1, tierId, value: 1, x, y, source, affix: null });
}

describe('SupernovaSystem', () => {
  it('a breaker star-break with supernova enabled damages nearby entities and can kill', () => {
    const bus = new EventBus<GameEvents>();
    const damaged: GameEvents['entityDamaged'][] = [];
    const broken: GameEvents['objectBroken'][] = [];
    bus.on('entityDamaged', (payload) => damaged.push(payload));
    bus.on('objectBroken', (payload) => {
      if (payload.source === 'supernova') broken.push(payload);
    });
    const victim = createCelestial('rock', 10, 0, 2);
    victim.hp = 1; // dies to any supernova hit
    const entities: Celestial[] = [victim];
    const { x, y } = celestialPosition(victim);
    const system = new SupernovaSystem(bus, entities, () => true, () => 1);
    breakStarAt(bus, x, y);
    // The proc queues; damage resolves on the next update, mirroring the laser blast drain.
    system.update(0);
    expect(damaged).toHaveLength(1);
    expect(damaged[0].amount).toBe(SUPERNOVA.baseDamage);
    expect(entities).toHaveLength(0);
    expect(broken).toHaveLength(1);
    expect(broken[0].id).toBe(victim.id);
    expect(broken[0].value).toBe(CELESTIAL_TIERS.rock.breakValue);
    expect(system.activeBursts).toHaveLength(1);
  });

  it('scales damage by the damage mult', () => {
    const bus = new EventBus<GameEvents>();
    const damaged: GameEvents['entityDamaged'][] = [];
    bus.on('entityDamaged', (payload) => damaged.push(payload));
    const victim = createCelestial('rock', 10, 0, 2);
    const entities: Celestial[] = [victim];
    const { x, y } = celestialPosition(victim);
    const system = new SupernovaSystem(bus, entities, () => true, () => 1.5);
    breakStarAt(bus, x, y);
    system.update(0);
    expect(damaged[0].amount).toBe(Math.round(SUPERNOVA.baseDamage * 1.5));
  });

  it('leaves a distant entity untouched', () => {
    const bus = new EventBus<GameEvents>();
    const damaged: GameEvents['entityDamaged'][] = [];
    bus.on('entityDamaged', (payload) => damaged.push(payload));
    const distant = createCelestial('rock', SUPERNOVA.radiusWorldUnits * 10, 0, 2);
    const entities: Celestial[] = [distant];
    const system = new SupernovaSystem(bus, entities, () => true, () => 1);
    breakStarAt(bus, 0, 0);
    system.update(0);
    expect(damaged).toHaveLength(0);
    expect(entities).toHaveLength(1);
  });

  it('a radius mult above 1 reaches an entity outside the base radius', () => {
    const bus = new EventBus<GameEvents>();
    const damaged: GameEvents['entityDamaged'][] = [];
    bus.on('entityDamaged', (payload) => damaged.push(payload));
    const fringe = createCelestial('rock', SUPERNOVA.radiusWorldUnits * 1.5, 0, 2);
    const entities: Celestial[] = [fringe];
    const system = new SupernovaSystem(bus, entities, () => true, () => 1, () => 2);
    breakStarAt(bus, 0, 0);
    system.update(0);
    expect(damaged).toHaveLength(1);
    expect(damaged[0].id).toBe(fringe.id);
    expect(system.activeBursts[0].radiusWorldUnits).toBeCloseTo(SUPERNOVA.radiusWorldUnits * 2, 6);
  });

  it('the same fringe entity stays untouched at the default radius mult', () => {
    const bus = new EventBus<GameEvents>();
    const damaged: GameEvents['entityDamaged'][] = [];
    bus.on('entityDamaged', (payload) => damaged.push(payload));
    const fringe = createCelestial('rock', SUPERNOVA.radiusWorldUnits * 1.5, 0, 2);
    const entities: Celestial[] = [fringe];
    const system = new SupernovaSystem(bus, entities, () => true, () => 1);
    breakStarAt(bus, 0, 0);
    system.update(0);
    expect(damaged).toHaveLength(0);
  });

  it('does not burst when the supernova flag is disabled', () => {
    const bus = new EventBus<GameEvents>();
    const damaged: GameEvents['entityDamaged'][] = [];
    bus.on('entityDamaged', (payload) => damaged.push(payload));
    const victim = createCelestial('rock', 10, 0, 2);
    const entities: Celestial[] = [victim];
    const { x, y } = celestialPosition(victim);
    const system = new SupernovaSystem(bus, entities, () => false, () => 1);
    breakStarAt(bus, x, y);
    system.update(0);
    expect(damaged).toHaveLength(0);
    expect(system.activeBursts).toHaveLength(0);
  });

  it('does not burst for a non-star break', () => {
    const bus = new EventBus<GameEvents>();
    const damaged: GameEvents['entityDamaged'][] = [];
    bus.on('entityDamaged', (payload) => damaged.push(payload));
    const victim = createCelestial('rock', 10, 0, 2);
    const entities: Celestial[] = [victim];
    const { x, y } = celestialPosition(victim);
    const system = new SupernovaSystem(bus, entities, () => true, () => 1);
    breakStarAt(bus, x, y, 'breaker', 'gasGiant');
    system.update(0);
    expect(damaged).toHaveLength(0);
    expect(system.activeBursts).toHaveLength(0);
  });

  it('does not burst for a non-breaker star break (e.g. chain)', () => {
    const bus = new EventBus<GameEvents>();
    const damaged: GameEvents['entityDamaged'][] = [];
    bus.on('entityDamaged', (payload) => damaged.push(payload));
    const victim = createCelestial('rock', 10, 0, 2);
    const entities: Celestial[] = [victim];
    const { x, y } = celestialPosition(victim);
    const system = new SupernovaSystem(bus, entities, () => true, () => 1);
    breakStarAt(bus, x, y, 'chain', 'star');
    system.update(0);
    expect(damaged).toHaveLength(0);
    expect(system.activeBursts).toHaveLength(0);
  });

  it('a supernova-sourced star kill does not chain into another burst', () => {
    const bus = new EventBus<GameEvents>();
    const entities: Celestial[] = [];
    const system = new SupernovaSystem(bus, entities, () => true, () => 1);
    breakStarAt(bus, 0, 0, 'supernova', 'star');
    system.update(0);
    expect(system.activeBursts).toHaveLength(0);
  });

  it('expires the burst after expandSeconds elapses', () => {
    const bus = new EventBus<GameEvents>();
    const entities: Celestial[] = [];
    const system = new SupernovaSystem(bus, entities, () => true, () => 1);
    breakStarAt(bus, 0, 0);
    system.update(0);
    expect(system.activeBursts).toHaveLength(1);
    system.update(SUPERNOVA.expandSeconds + 0.01);
    expect(system.activeBursts).toHaveLength(0);
  });

  it('reset() clears active bursts and any pending trigger', () => {
    const bus = new EventBus<GameEvents>();
    const system = new SupernovaSystem(bus, [], () => true, () => 1);
    breakStarAt(bus, 0, 0);
    system.update(0);
    expect(system.activeBursts).toHaveLength(1);
    system.reset();
    expect(system.activeBursts).toHaveLength(0);
    // A trigger queued right before a session reset must not burst into the next session.
    breakStarAt(bus, 0, 0);
    system.reset();
    system.update(0);
    expect(system.activeBursts).toHaveLength(0);
  });
});
