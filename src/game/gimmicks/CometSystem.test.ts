import { describe, expect, it, vi } from 'vitest';
import { COMET } from '../../config/comet';
import { EventBus } from '../../core/EventBus';
import type { GameEvents } from '../../core/events';
import { createIdGenerator, type Celestial } from '../entities';
import { CometSystem } from './CometSystem';

const SPAWN_FIELD_RADIUS = 500;

function makeSystem(
  entities: Celestial[],
  getEnabled: () => boolean,
  getShowerChance: () => number,
  grantCometBuff = vi.fn(),
  rng: () => number = () => 0.999,
): { bus: EventBus<GameEvents>; system: CometSystem; grantCometBuff: ReturnType<typeof vi.fn> } {
  const bus = new EventBus<GameEvents>();
  const system = new CometSystem(bus, entities, createIdGenerator(), getEnabled, getShowerChance, grantCometBuff, rng);
  return { bus, system, grantCometBuff };
}

describe('CometSystem', () => {
  it('never spawns while disabled', () => {
    const entities: Celestial[] = [];
    const { system } = makeSystem(entities, () => false, () => 0);
    system.update(COMET.flybyIntervalSeconds * 3, SPAWN_FIELD_RADIUS);
    expect(entities).toHaveLength(0);
  });

  it('spawns a single comet once the flyby timer elapses', () => {
    const entities: Celestial[] = [];
    const { system } = makeSystem(entities, () => true, () => 0);
    system.update(COMET.flybyIntervalSeconds - 0.01, SPAWN_FIELD_RADIUS);
    expect(entities).toHaveLength(0);
    system.update(0.02, SPAWN_FIELD_RADIUS);
    expect(entities).toHaveLength(1);
    expect(entities[0].tierId).toBe('comet');
  });

  it('rolls a shower of showerCount comets when the rng beats the shower chance', () => {
    const entities: Celestial[] = [];
    const rollsBelowThreshold = () => 0.01; // always beats any positive shower chance
    const { system } = makeSystem(entities, () => true, () => 0.5, vi.fn(), rollsBelowThreshold);
    system.update(COMET.flybyIntervalSeconds, SPAWN_FIELD_RADIUS);
    expect(entities).toHaveLength(COMET.showerCount);
    expect(entities.every((entity) => entity.tierId === 'comet')).toBe(true);
  });

  it('does not shower when the rng fails the shower chance roll', () => {
    const entities: Celestial[] = [];
    const rollsAboveThreshold = () => 0.99;
    const { system } = makeSystem(entities, () => true, () => 0.5, vi.fn(), rollsAboveThreshold);
    system.update(COMET.flybyIntervalSeconds, SPAWN_FIELD_RADIUS);
    expect(entities).toHaveLength(1);
  });

  it('removes an expired comet from entities after its lifetime elapses', () => {
    const entities: Celestial[] = [];
    const { system } = makeSystem(entities, () => true, () => 0);
    system.update(COMET.flybyIntervalSeconds, SPAWN_FIELD_RADIUS);
    expect(entities).toHaveLength(1);
    system.update(COMET.lifetimeSeconds - 0.01, SPAWN_FIELD_RADIUS);
    expect(entities).toHaveLength(1);
    system.update(0.02, SPAWN_FIELD_RADIUS);
    expect(entities).toHaveLength(0);
  });

  it('handles an already-broken comet gracefully when its lifetime timer elapses', () => {
    const entities: Celestial[] = [];
    const { bus, system } = makeSystem(entities, () => true, () => 0);
    system.update(COMET.flybyIntervalSeconds, SPAWN_FIELD_RADIUS);
    const comet = entities[0];
    entities.length = 0; // simulate the breaker consuming it elsewhere before it expires
    bus.emit('objectBroken', { id: comet.id, tierId: 'comet', value: 1, x: 0, y: 0, source: 'breaker', affix: null });
    expect(() => system.update(COMET.lifetimeSeconds + 1, SPAWN_FIELD_RADIUS)).not.toThrow();
    expect(entities).toHaveLength(0);
  });

  it('grants the crit buff when a comet is broken, regardless of source', () => {
    const entities: Celestial[] = [];
    const grantCometBuff = vi.fn();
    const { bus, system } = makeSystem(entities, () => true, () => 0, grantCometBuff);
    system.update(COMET.flybyIntervalSeconds, SPAWN_FIELD_RADIUS);
    const comet = entities[0];
    bus.emit('objectBroken', { id: comet.id, tierId: 'comet', value: 1, x: 0, y: 0, source: 'chain', affix: null });
    expect(grantCometBuff).toHaveBeenCalledTimes(1);
    expect(grantCometBuff).toHaveBeenCalledWith(COMET.buffEffects, COMET.buffDurationSeconds);
  });

  it('ignores a break of a non-comet tier', () => {
    const entities: Celestial[] = [];
    const grantCometBuff = vi.fn();
    const { bus } = makeSystem(entities, () => true, () => 0, grantCometBuff);
    bus.emit('objectBroken', { id: 999, tierId: 'rock', value: 1, x: 0, y: 0, source: 'breaker', affix: null });
    expect(grantCometBuff).not.toHaveBeenCalled();
  });

  it('does not grant the buff twice for the same comet (break then expiry)', () => {
    const entities: Celestial[] = [];
    const grantCometBuff = vi.fn();
    const { bus, system } = makeSystem(entities, () => true, () => 0, grantCometBuff);
    system.update(COMET.flybyIntervalSeconds, SPAWN_FIELD_RADIUS);
    const comet = entities[0];
    bus.emit('objectBroken', { id: comet.id, tierId: 'comet', value: 1, x: 0, y: 0, source: 'breaker', affix: null });
    entities.length = 0; // the breaker already removed it from the live entity list
    system.update(COMET.lifetimeSeconds + 1, SPAWN_FIELD_RADIUS);
    expect(grantCometBuff).toHaveBeenCalledTimes(1);
  });

  it('reset() clears the flyby timer and tracked comets so a stale expiry cannot fire post-reset', () => {
    const entities: Celestial[] = [];
    const { system } = makeSystem(entities, () => true, () => 0);
    system.update(COMET.flybyIntervalSeconds, SPAWN_FIELD_RADIUS);
    expect(entities).toHaveLength(1);
    system.reset();
    entities.length = 0;
    system.update(COMET.flybyIntervalSeconds - 0.01, SPAWN_FIELD_RADIUS);
    expect(entities).toHaveLength(0);
  });
});
