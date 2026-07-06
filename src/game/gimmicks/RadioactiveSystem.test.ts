import { describe, expect, it } from 'vitest';
import { CELESTIAL_TIERS } from '../../config/celestials';
import { RADIOACTIVE } from '../../config/radioactive';
import { EventBus } from '../../core/EventBus';
import type { GameEvents } from '../../core/events';
import { celestialPosition, createCelestial, type Celestial } from '../entities';
import { RadioactiveSystem } from './RadioactiveSystem';

function breakAt(bus: EventBus<GameEvents>, x: number, y: number, source: GameEvents['objectBroken']['source'] = 'breaker'): void {
  bus.emit('objectBroken', { id: 1, tierId: 'rock', value: 1, x, y, source, affix: 'radioactive' });
}

describe('RadioactiveSystem', () => {
  it('creates a fallout zone when a breaker kill breaks a radioactive entity', () => {
    const bus = new EventBus<GameEvents>();
    const system = new RadioactiveSystem(bus, [], () => 1);
    breakAt(bus, 10, 20);
    expect(system.activeZones).toHaveLength(1);
    expect(system.activeZones[0]).toMatchObject({ x: 10, y: 20, remaining: RADIOACTIVE.durationSeconds });
  });

  it('does not create a zone for a non-radioactive or non-breaker break', () => {
    const bus = new EventBus<GameEvents>();
    const system = new RadioactiveSystem(bus, [], () => 1);
    bus.emit('objectBroken', { id: 1, tierId: 'rock', value: 1, x: 0, y: 0, source: 'breaker', affix: null });
    bus.emit('objectBroken', { id: 2, tierId: 'rock', value: 1, x: 0, y: 0, source: 'chain', affix: 'radioactive' });
    expect(system.activeZones).toHaveLength(0);
  });

  it('a radioactive-sourced break does not create a new zone (no runaway chains)', () => {
    const bus = new EventBus<GameEvents>();
    const system = new RadioactiveSystem(bus, [], () => 1);
    breakAt(bus, 0, 0, 'radioactive');
    expect(system.activeZones).toHaveLength(0);
  });

  it('damages nearby entities every tick and can kill one, emitting objectBroken with source radioactive', () => {
    const bus = new EventBus<GameEvents>();
    const damaged: GameEvents['entityDamaged'][] = [];
    const broken: GameEvents['objectBroken'][] = [];
    bus.on('entityDamaged', (payload) => damaged.push(payload));
    bus.on('objectBroken', (payload) => {
      if (payload.source === 'radioactive') broken.push(payload);
    });
    const victim = createCelestial('rock', 10, 0, 2);
    victim.hp = RADIOACTIVE.baseDotPerTick; // dies on the first tick
    const entities: Celestial[] = [victim];
    const { x, y } = celestialPosition(victim);
    const system = new RadioactiveSystem(bus, entities, () => 1);
    breakAt(bus, x, y);
    system.update(RADIOACTIVE.dotTickInterval);
    expect(damaged).toHaveLength(1);
    expect(damaged[0].amount).toBe(RADIOACTIVE.baseDotPerTick);
    expect(entities).toHaveLength(0);
    expect(broken).toHaveLength(1);
    expect(broken[0].id).toBe(victim.id);
    expect(broken[0].value).toBe(CELESTIAL_TIERS.rock.breakValue);
  });

  it('scales tick damage by the dot mult', () => {
    const bus = new EventBus<GameEvents>();
    const damaged: GameEvents['entityDamaged'][] = [];
    bus.on('entityDamaged', (payload) => damaged.push(payload));
    const victim = createCelestial('smallAsteroid', 10, 0, 2);
    const entities: Celestial[] = [victim];
    const { x, y } = celestialPosition(victim);
    const system = new RadioactiveSystem(bus, entities, () => 2);
    breakAt(bus, x, y);
    system.update(RADIOACTIVE.dotTickInterval);
    expect(damaged[0].amount).toBe(Math.round(RADIOACTIVE.baseDotPerTick * 2));
  });

  it('leaves a distant entity untouched', () => {
    const bus = new EventBus<GameEvents>();
    const damaged: GameEvents['entityDamaged'][] = [];
    bus.on('entityDamaged', (payload) => damaged.push(payload));
    const distant = createCelestial('rock', RADIOACTIVE.falloutRadiusWorldUnits * 10, 0, 2);
    const entities: Celestial[] = [distant];
    const system = new RadioactiveSystem(bus, entities, () => 1);
    breakAt(bus, 0, 0);
    system.update(RADIOACTIVE.dotTickInterval);
    expect(damaged).toHaveLength(0);
    expect(entities).toHaveLength(1);
  });

  it('expires the zone after its duration elapses', () => {
    const bus = new EventBus<GameEvents>();
    const system = new RadioactiveSystem(bus, [], () => 1);
    breakAt(bus, 0, 0);
    expect(system.activeZones).toHaveLength(1);
    system.update(RADIOACTIVE.durationSeconds + 0.01);
    expect(system.activeZones).toHaveLength(0);
  });

  it('reset() clears all active zones immediately', () => {
    const bus = new EventBus<GameEvents>();
    const system = new RadioactiveSystem(bus, [], () => 1);
    breakAt(bus, 0, 0);
    breakAt(bus, 10, 10);
    expect(system.activeZones).toHaveLength(2);
    system.reset();
    expect(system.activeZones).toHaveLength(0);
  });
});
