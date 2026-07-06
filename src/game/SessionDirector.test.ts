import { describe, expect, it } from 'vitest';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import { SessionDirector } from './SessionDirector';

describe('SessionDirector', () => {
  it('tracks progress and remaining time while running', () => {
    const director = new SessionDirector(new EventBus<GameEvents>());
    director.start(60);
    director.update(15);
    expect(director.running).toBe(true);
    expect(director.progress).toBeCloseTo(0.25);
    expect(director.remainingSeconds).toBeCloseTo(45);
  });

  it('emits sessionEnded exactly once when time expires', () => {
    const bus = new EventBus<GameEvents>();
    let endedCount = 0;
    bus.on('sessionEnded', () => endedCount++);
    const director = new SessionDirector(bus);
    director.start(60);
    director.update(61);
    director.update(1);
    expect(endedCount).toBe(1);
    expect(director.running).toBe(false);
  });

  it('emits sessionStarted and resets on start', () => {
    const bus = new EventBus<GameEvents>();
    const started: number[] = [];
    bus.on('sessionStarted', ({ durationSeconds }) => started.push(durationSeconds));
    const director = new SessionDirector(bus);
    director.start(60);
    director.update(61);
    director.start(60);
    expect(started).toEqual([60, 60]);
    expect(director.progress).toBe(0);
    expect(director.running).toBe(true);
  });

  it('emits sessionTick with remaining time while running', () => {
    const bus = new EventBus<GameEvents>();
    const ticks: number[] = [];
    bus.on('sessionTick', ({ remainingSeconds }) => ticks.push(remainingSeconds));
    const director = new SessionDirector(bus);
    director.start(60);
    director.update(10);
    director.update(10);
    expect(ticks).toEqual([50, 40]);
  });

  it('does nothing before start', () => {
    const director = new SessionDirector(new EventBus<GameEvents>());
    director.update(10);
    expect(director.running).toBe(false);
    expect(director.progress).toBe(0);
  });

  it('setRemaining overrides remaining time while running, clamped to duration', () => {
    const director = new SessionDirector(new EventBus<GameEvents>());
    director.start(10);
    director.update(2);
    director.setRemaining(1);
    expect(director.remainingSeconds).toBeCloseTo(1);
    director.setRemaining(999);
    expect(director.remainingSeconds).toBeCloseTo(10);
  });

  it('setRemaining is a no-op when not running', () => {
    const director = new SessionDirector(new EventBus<GameEvents>());
    director.setRemaining(5);
    expect(director.remainingSeconds).toBe(0);
  });

  it('addTime extends remaining time while running', () => {
    const director = new SessionDirector(new EventBus<GameEvents>());
    director.start(10);
    director.update(4);
    director.addTime(3);
    expect(director.remainingSeconds).toBeCloseTo(9);
  });

  it('addTime clamps remaining time to the started duration', () => {
    const director = new SessionDirector(new EventBus<GameEvents>());
    director.start(10);
    director.update(4);
    director.addTime(999);
    expect(director.remainingSeconds).toBe(10);
  });

  it('addTime is a no-op when not running', () => {
    const director = new SessionDirector(new EventBus<GameEvents>());
    expect(director.addTime(5)).toBe(0);
    expect(director.remainingSeconds).toBe(0);
  });

  it('endEarly stops the session and emits sessionEnded exactly once', () => {
    const bus = new EventBus<GameEvents>();
    let endedCount = 0;
    bus.on('sessionEnded', () => endedCount++);
    const director = new SessionDirector(bus);
    director.start(60);
    director.update(10);
    director.endEarly();
    // The natural timeout path must not double-fire after an early end.
    director.endEarly();
    director.update(999);
    expect(endedCount).toBe(1);
    expect(director.running).toBe(false);
  });

  it('endEarly is a no-op before start', () => {
    const bus = new EventBus<GameEvents>();
    let endedCount = 0;
    bus.on('sessionEnded', () => endedCount++);
    new SessionDirector(bus).endEarly();
    expect(endedCount).toBe(0);
  });

  it('caps cumulative bonus time at maxAddedTimeFraction of the duration and reports the applied amount', () => {
    const director = new SessionDirector(new EventBus<GameEvents>());
    director.start(10);
    // Cap is 10 * 0.5 = 5 bonus seconds per session: 3 fits, then only 2 of the next 3, then nothing.
    director.update(6);
    expect(director.addTime(3)).toBe(3);
    director.update(3);
    expect(director.addTime(3)).toBe(2);
    director.update(2);
    expect(director.addTime(3)).toBe(0);
    // A fresh session resets the bonus budget.
    director.start(10);
    expect(director.addTime(3)).toBe(3);
  });
});
