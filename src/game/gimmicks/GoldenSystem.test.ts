import { describe, expect, it } from 'vitest';
import { EventBus } from '../../core/EventBus';
import type { GameEvents } from '../../core/events';
import { GoldenSystem } from './GoldenSystem';

describe('GoldenSystem', () => {
  it('emits bonusMatter for a golden break, rounded to the mult minus baseline', () => {
    const bus = new EventBus<GameEvents>();
    const bonuses: GameEvents['bonusMatter'][] = [];
    bus.on('bonusMatter', (payload) => bonuses.push(payload));
    new GoldenSystem(bus, () => 2.5);
    bus.emit('objectBroken', { id: 1, tierId: 'rock', value: 10, x: 0, y: 0, source: 'breaker', affix: 'golden' });
    expect(bonuses).toHaveLength(1);
    expect(bonuses[0].value).toBe(Math.round(10 * (2.5 - 1)));
  });

  it('emits nothing for a non-golden break', () => {
    const bus = new EventBus<GameEvents>();
    const bonuses: GameEvents['bonusMatter'][] = [];
    bus.on('bonusMatter', (payload) => bonuses.push(payload));
    new GoldenSystem(bus, () => 2.5);
    bus.emit('objectBroken', { id: 1, tierId: 'rock', value: 10, x: 0, y: 0, source: 'breaker', affix: null });
    bus.emit('objectBroken', { id: 2, tierId: 'rock', value: 10, x: 0, y: 0, source: 'breaker', affix: 'electric' });
    expect(bonuses).toHaveLength(0);
  });

  it('emits nothing when the value mult is exactly 1 (no golden.value purchased)', () => {
    const bus = new EventBus<GameEvents>();
    const bonuses: GameEvents['bonusMatter'][] = [];
    bus.on('bonusMatter', (payload) => bonuses.push(payload));
    new GoldenSystem(bus, () => 1);
    bus.emit('objectBroken', { id: 1, tierId: 'rock', value: 10, x: 0, y: 0, source: 'breaker', affix: 'golden' });
    expect(bonuses).toHaveLength(1);
    expect(bonuses[0].value).toBe(0);
  });
});
