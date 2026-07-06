import { describe, expect, it } from 'vitest';
import { CELESTIAL_TIERS } from '../config/celestials';
import { SESSION_CONFIG } from '../config/session';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import { GameState } from '../state/GameState';
import { celestialPosition, createCelestial } from './entities';
import { BreakerSystem } from './BreakerSystem';
import { GravitySystem } from './GravitySystem';

describe('sessionSeam', () => {
  it('breaking pays instantly and leaves nothing behind to consume', () => {
    const bus = new EventBus<GameEvents>();
    const brokenPayloads: GameEvents['objectBroken'][] = [];
    const consumedValues: number[] = [];
    bus.on('objectBroken', (payload) => brokenPayloads.push(payload));
    bus.on('matterConsumed', ({ value }) => consumedValues.push(value));

    const gameState = new GameState();
    bus.on('objectBroken', ({ value }) => gameState.collectMatter(value));
    bus.on('matterConsumed', ({ value }) => gameState.collectMatter(value));

    const breaker = new BreakerSystem(
      bus,
      () => ({
        breakerRadius: SESSION_CONFIG.breaker.ringRadius,
        tickIntervalSeconds: SESSION_CONFIG.breaker.tickInterval,
        damagePerTick: SESSION_CONFIG.breaker.damagePerTick,
        critChance: 0,
        critDamageMult: 1.5,
      }),
      undefined,
      () => 0.99,
    );
    const gravity = new GravitySystem(bus);

    const rock = createCelestial('rock', 300, 0, 1);
    const entities = [rock];

    const stepSeconds = 0.1;
    for (let elapsed = 0; elapsed < 20; elapsed += stepSeconds) {
      const trackedRock = entities.find((entity) => entity.id === rock.id);
      if (trackedRock) {
        const { x, y } = celestialPosition(trackedRock);
        breaker.setPointer(x, y);
      }
      breaker.update(stepSeconds, entities);
      gravity.update(stepSeconds, entities, SESSION_CONFIG.horizonRadius);
    }

    expect(brokenPayloads).toHaveLength(1);
    expect(brokenPayloads[0].value).toBe(CELESTIAL_TIERS.rock.breakValue);
    expect(consumedValues).toHaveLength(0);
    expect(entities).toHaveLength(0);
    expect(gameState.snapshot().matter).toBe(CELESTIAL_TIERS.rock.breakValue);
  });

  it('an unbroken object drifting across the horizon pays its base value', () => {
    const bus = new EventBus<GameEvents>();
    const consumed: GameEvents['matterConsumed'][] = [];
    bus.on('matterConsumed', (payload) => consumed.push(payload));

    const gravity = new GravitySystem(bus);
    const entities = [createCelestial('rock', 300, 0, 1)];

    const stepSeconds = 0.1;
    for (let elapsed = 0; elapsed < 20; elapsed += stepSeconds) {
      gravity.update(stepSeconds, entities, SESSION_CONFIG.horizonRadius);
    }

    expect(entities).toHaveLength(0);
    expect(consumed).toHaveLength(1);
    expect(consumed[0].value).toBe(CELESTIAL_TIERS.rock.matterValue);
    expect(consumed[0].tierId).toBe('rock');
  });
});
