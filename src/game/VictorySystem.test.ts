import { describe, expect, it } from 'vitest';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import { VictorySystem } from './VictorySystem';

const GOAL = 1000;

function setup(mass: number, victorySeen: boolean) {
  const bus = new EventBus<GameEvents>();
  const marked: boolean[] = [];
  const victories: number[] = [];
  bus.on('victoryAchieved', ({ mass: achievedMass }) => victories.push(achievedMass));
  new VictorySystem(bus, () => ({ mass, victorySeen }), () => marked.push(true), GOAL);
  return { bus, marked, victories };
}

describe('VictorySystem', () => {
  it('does not emit when mass is below the goal', () => {
    const { bus, marked, victories } = setup(999, false);
    bus.emit('sessionEnded', null);
    expect(victories).toEqual([]);
    expect(marked).toEqual([]);
  });

  it('emits victoryAchieved and marks seen when mass meets the goal', () => {
    const { bus, marked, victories } = setup(1000, false);
    bus.emit('sessionEnded', null);
    expect(victories).toEqual([1000]);
    expect(marked).toEqual([true]);
  });

  it('emits when mass exceeds the goal', () => {
    const { bus, marked, victories } = setup(5000, false);
    bus.emit('sessionEnded', null);
    expect(victories).toEqual([5000]);
    expect(marked).toEqual([true]);
  });

  it('never re-emits once victory has already been seen', () => {
    const { bus, marked, victories } = setup(5000, true);
    bus.emit('sessionEnded', null);
    expect(victories).toEqual([]);
    expect(marked).toEqual([]);
  });

  it('does not check mid-run - only on sessionEnded', () => {
    const { bus, marked, victories } = setup(5000, false);
    bus.emit('sessionStarted', { durationSeconds: 25 });
    bus.emit('sessionTick', { remainingSeconds: 10, progress: 0.5 });
    expect(victories).toEqual([]);
    expect(marked).toEqual([]);
    bus.emit('sessionEnded', null);
    expect(victories).toEqual([5000]);
    expect(marked).toEqual([true]);
  });
});
