import { describe, expect, it } from 'vitest';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import { CELESTIAL_TIERS } from '../config/celestials';
import { createCelestial, type Celestial } from './entities';
import { GravitySystem } from './GravitySystem';

describe('GravitySystem', () => {
  it('drifts entities inward and advances their orbit', () => {
    const system = new GravitySystem(new EventBus<GameEvents>());
    const entities = [createCelestial('rock', 500, 0, 1)];
    system.update(1, entities, 70);
    expect(entities[0].orbitRadius).toBe(500 - CELESTIAL_TIERS.rock.driftRate);
    expect(entities[0].orbitAngle).toBeCloseTo(CELESTIAL_TIERS.rock.angularSpeed);
  });

  it('consumes entities crossing the event horizon and emits their value', () => {
    const bus = new EventBus<GameEvents>();
    const consumed: GameEvents['matterConsumed'][] = [];
    bus.on('matterConsumed', (payload) => consumed.push(payload));
    const system = new GravitySystem(bus);
    const entities: Celestial[] = [createCelestial('smallAsteroid', 71, 0, 1)];
    system.update(1, entities, 70);
    expect(entities).toHaveLength(0);
    expect(consumed).toHaveLength(1);
    expect(consumed[0].value).toBe(CELESTIAL_TIERS.smallAsteroid.matterValue);
    expect(consumed[0].tierId).toBe('smallAsteroid');
    expect(Number.isFinite(consumed[0].x)).toBe(true);
    expect(Number.isFinite(consumed[0].y)).toBe(true);
  });

  it('scales consumed matter by the tier matter multiplier', () => {
    const bus = new EventBus<GameEvents>();
    const consumed: GameEvents['matterConsumed'][] = [];
    bus.on('matterConsumed', (payload) => consumed.push(payload));
    const system = new GravitySystem(bus, (tierId) => (tierId === 'planet' ? 3 : 1));
    const entities: Celestial[] = [createCelestial('planet', 1, 0, 1)];
    system.update(1, entities, 70);
    expect(entities).toHaveLength(0);
    expect(consumed).toHaveLength(1);
    expect(consumed[0].value).toBe(CELESTIAL_TIERS.planet.matterValue * 3);
  });

  it('a larger horizon consumes from further away', () => {
    const bus = new EventBus<GameEvents>();
    const consumed: number[] = [];
    bus.on('matterConsumed', ({ value }) => consumed.push(value));
    const system = new GravitySystem(bus);
    const entities: Celestial[] = [createCelestial('rock', 100, 0, 1)];
    system.update(0.01, entities, 70);
    expect(entities).toHaveLength(1);
    system.update(0.01, entities, 120);
    expect(entities).toHaveLength(0);
    expect(consumed).toHaveLength(1);
  });
});
