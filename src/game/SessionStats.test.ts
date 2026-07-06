import { describe, expect, it } from 'vitest';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import { SessionStats } from './SessionStats';

describe('SessionStats', () => {
  it('accumulates a run from the event stream', () => {
    const bus = new EventBus<GameEvents>();
    const stats = new SessionStats(bus);
    bus.emit('sessionStarted', { durationSeconds: 25 });
    bus.emit('entityDamaged', { id: 1, tierId: 'rock', amount: 10, x: 0, y: 0 });
    bus.emit('critLanded', { id: 1, tierId: 'rock', amount: 10, x: 0, y: 0 });
    bus.emit('objectBroken', { id: 1, tierId: 'rock', value: 3, x: 0, y: 0, source: 'breaker', affix: null });
    bus.emit('objectBroken', { id: 2, tierId: 'planet', value: 70, x: 0, y: 0, source: 'chain', affix: null });
    bus.emit('sessionTimeAdded', { seconds: 1.5 });
    bus.emit('matterConsumed', { value: 1, tierId: 'rock', x: 0, y: 0 });

    const snap = stats.snapshot();
    expect(snap.sessionNumber).toBe(1);
    expect(snap.damage).toBe(10);
    expect(snap.critDamage).toBe(10);
    expect(snap.hits).toBe(1);
    expect(snap.chainKills).toBe(1);
    expect(snap.timeAdded).toBeCloseTo(1.5, 6);
    expect(snap.matterCollected).toBe(74);
    expect(snap.destroyedByTier.rock).toBe(1);
    expect(snap.destroyedByTier.planet).toBe(1);
    expect(snap.golden).toBe(0);
  });

  it('counts moon breaks from the Breaker', () => {
    const bus = new EventBus<GameEvents>();
    const stats = new SessionStats(bus);
    bus.emit('sessionStarted', { durationSeconds: 25 });
    bus.emit('objectBroken', { id: 1, tierId: 'rock', value: 1, x: 0, y: 0, source: 'breaker', affix: 'moon' });
    bus.emit('objectBroken', { id: 2, tierId: 'rock', value: 1, x: 0, y: 0, source: 'breaker', affix: null });

    const snap = stats.snapshot();
    expect(snap.moon).toBe(1);
  });

  it('counts golden breaks and folds bonusMatter into matterCollected', () => {
    const bus = new EventBus<GameEvents>();
    const stats = new SessionStats(bus);
    bus.emit('sessionStarted', { durationSeconds: 25 });
    bus.emit('objectBroken', { id: 1, tierId: 'rock', value: 10, x: 0, y: 0, source: 'breaker', affix: 'golden' });
    bus.emit('bonusMatter', { value: 15 });
    bus.emit('objectBroken', { id: 2, tierId: 'rock', value: 10, x: 0, y: 0, source: 'breaker', affix: null });

    const snap = stats.snapshot();
    expect(snap.golden).toBe(1);
    expect(snap.matterCollected).toBe(35);
  });

  it('resets counters and bumps the session number on the next start', () => {
    const bus = new EventBus<GameEvents>();
    const stats = new SessionStats(bus);
    bus.emit('sessionStarted', { durationSeconds: 25 });
    bus.emit('entityDamaged', { id: 1, tierId: 'rock', amount: 10, x: 0, y: 0 });
    bus.emit('sessionStarted', { durationSeconds: 25 });

    const snap = stats.snapshot();
    expect(snap.sessionNumber).toBe(2);
    expect(snap.damage).toBe(0);
    expect(snap.hits).toBe(0);
    expect(snap.destroyedByTier.rock).toBeUndefined();
    expect(snap.moon).toBe(0);
  });
});
