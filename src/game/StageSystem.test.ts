import { describe, expect, it } from 'vitest';
import { PROGRESSION_STAGES } from '../config/stages';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import { StageSystem } from './StageSystem';

const INTERMEDIATE = PROGRESSION_STAGES[1];
const SUPERMASSIVE = PROGRESSION_STAGES[2];
const GALACTIC = PROGRESSION_STAGES[3];

function setup(initialMass = 0) {
  const bus = new EventBus<GameEvents>();
  const state = { mass: initialMass, endCount: 0 };
  const announcements: GameEvents['stageAdvanced'][] = [];
  bus.on('stageAdvanced', (payload) => announcements.push(payload));
  new StageSystem(
    bus,
    () => state.mass,
    () => {
      state.endCount++;
      bus.emit('sessionEnded', null);
    },
  );
  const breakAt = (mass: number): void => {
    state.mass = mass;
    bus.emit('objectBroken', { id: 1, tierId: 'rock', value: 1, x: 0, y: 0, source: 'breaker', affix: null });
  };
  const consumeAt = (mass: number): void => {
    state.mass = mass;
    bus.emit('matterConsumed', { value: 1, tierId: 'rock', x: 0, y: 0 });
  };
  return { bus, state, announcements, breakAt, consumeAt };
}

describe('StageSystem', () => {
  it('ends the session exactly once when a kill crosses a stage threshold', () => {
    const { bus, state, announcements, breakAt } = setup();
    bus.emit('sessionStarted', { durationSeconds: 60 });
    breakAt(INTERMEDIATE.massThreshold - 1);
    expect(announcements).toHaveLength(0);
    expect(state.endCount).toBe(0);
    breakAt(INTERMEDIATE.massThreshold);
    // Kills can keep landing on the crossing frame; the announcement and early end must not repeat.
    breakAt(INTERMEDIATE.massThreshold + 50);
    expect(announcements).toHaveLength(1);
    expect(state.endCount).toBe(1);
    expect(announcements[0]).toEqual({
      stageId: INTERMEDIATE.id,
      stageName: INTERMEDIATE.name,
      unlockedPaths: INTERMEDIATE.unlockedPaths,
    });
  });

  it('reacts to matterConsumed drift the same as kills', () => {
    const { bus, state, announcements, consumeAt } = setup();
    bus.emit('sessionStarted', { durationSeconds: 60 });
    consumeAt(INTERMEDIATE.massThreshold + 1);
    expect(announcements).toHaveLength(1);
    expect(state.endCount).toBe(1);
  });

  it('stays silent while mass remains below the next threshold', () => {
    const { bus, state, announcements, breakAt } = setup(INTERMEDIATE.massThreshold);
    bus.emit('sessionStarted', { durationSeconds: 60 });
    breakAt(SUPERMASSIVE.massThreshold - 1);
    expect(announcements).toHaveLength(0);
    expect(state.endCount).toBe(0);
  });

  it('re-arms for the next crossing on the following session', () => {
    const { bus, state, announcements, breakAt } = setup();
    bus.emit('sessionStarted', { durationSeconds: 60 });
    breakAt(INTERMEDIATE.massThreshold + 1);
    expect(announcements).toHaveLength(1);
    bus.emit('sessionStarted', { durationSeconds: 60 });
    breakAt(SUPERMASSIVE.massThreshold + 1);
    expect(announcements).toHaveLength(2);
    expect(announcements[1].stageId).toBe(SUPERMASSIVE.id);
    expect(state.endCount).toBe(2);
  });

  it('a multi-stage kill burst announces the highest stage with every newly unlocked path accumulated', () => {
    const { bus, state, announcements, breakAt } = setup();
    bus.emit('sessionStarted', { durationSeconds: 60 });
    breakAt(GALACTIC.massThreshold + 1);
    expect(announcements).toHaveLength(1);
    expect(state.endCount).toBe(1);
    expect(announcements[0].stageId).toBe(GALACTIC.id);
    expect(announcements[0].stageName).toBe(GALACTIC.name);
    expect(announcements[0].unlockedPaths).toEqual([
      ...INTERMEDIATE.unlockedPaths,
      ...SUPERMASSIVE.unlockedPaths,
      ...GALACTIC.unlockedPaths,
    ]);
  });

  it('never re-announces the stage a loaded save already sits in', () => {
    const { bus, state, announcements, breakAt } = setup(SUPERMASSIVE.massThreshold + 10);
    bus.emit('sessionStarted', { durationSeconds: 60 });
    breakAt(SUPERMASSIVE.massThreshold + 20);
    expect(announcements).toHaveLength(0);
    expect(state.endCount).toBe(0);
  });
});
