import { describe, expect, it, vi } from 'vitest';
import { MOON } from '../../config/moon';
import { EventBus } from '../../core/EventBus';
import type { GameEvents } from '../../core/events';
import { MoonSystem } from './MoonSystem';

function breakMoon(bus: EventBus<GameEvents>, source: GameEvents['objectBroken']['source'] = 'breaker'): void {
  bus.emit('objectBroken', { id: 1, tierId: 'rock', value: 1, x: 0, y: 0, source, affix: 'moon' });
}

describe('MoonSystem', () => {
  it('grants a buff and adds a satellite when the Breaker breaks a moon', () => {
    const bus = new EventBus<GameEvents>();
    const grantMoonBuff = vi.fn();
    const system = new MoonSystem(bus, grantMoonBuff, () => 1);
    breakMoon(bus);
    expect(grantMoonBuff).toHaveBeenCalledTimes(1);
    expect(grantMoonBuff).toHaveBeenCalledWith(MOON.buffEffects, MOON.baseDurationSeconds);
    expect(system.satellites).toHaveLength(1);
    expect(system.count).toBe(1);
  });

  it('does nothing for a non-moon or non-breaker break', () => {
    const bus = new EventBus<GameEvents>();
    const grantMoonBuff = vi.fn();
    const system = new MoonSystem(bus, grantMoonBuff, () => 1);
    bus.emit('objectBroken', { id: 1, tierId: 'rock', value: 1, x: 0, y: 0, source: 'breaker', affix: null });
    breakMoon(bus, 'chain');
    expect(grantMoonBuff).not.toHaveBeenCalled();
    expect(system.satellites).toHaveLength(0);
  });

  it('respects the satellite cap', () => {
    const bus = new EventBus<GameEvents>();
    const grantMoonBuff = vi.fn();
    const system = new MoonSystem(bus, grantMoonBuff, () => 1);
    for (let i = 0; i < MOON.satelliteCap + 3; i++) breakMoon(bus);
    expect(system.satellites).toHaveLength(MOON.satelliteCap);
    expect(grantMoonBuff).toHaveBeenCalledTimes(MOON.satelliteCap);
  });

  it('a cap bonus raises the satellite ceiling above the config cap', () => {
    const bus = new EventBus<GameEvents>();
    const grantMoonBuff = vi.fn();
    const system = new MoonSystem(bus, grantMoonBuff, () => 1, () => 2);
    for (let i = 0; i < MOON.satelliteCap + 5; i++) breakMoon(bus);
    expect(system.satellites).toHaveLength(MOON.satelliteCap + 2);
    expect(grantMoonBuff).toHaveBeenCalledTimes(MOON.satelliteCap + 2);
  });

  it('scales duration with the duration mult', () => {
    const bus = new EventBus<GameEvents>();
    const grantMoonBuff = vi.fn();
    const system = new MoonSystem(bus, grantMoonBuff, () => 2);
    breakMoon(bus);
    expect(grantMoonBuff).toHaveBeenCalledWith(MOON.buffEffects, MOON.baseDurationSeconds * 2);
    expect(system.satellites[0].remaining).toBeCloseTo(MOON.baseDurationSeconds * 2, 6);
  });

  it('advances orbit angle and expires satellites after their duration elapses', () => {
    const bus = new EventBus<GameEvents>();
    const system = new MoonSystem(bus, vi.fn(), () => 1);
    breakMoon(bus);
    const initialAngle = system.satellites[0].angle;
    system.update(1);
    expect(system.satellites[0].angle).toBeCloseTo(initialAngle + MOON.orbitSpeed, 6);
    system.update(MOON.baseDurationSeconds);
    expect(system.satellites).toHaveLength(0);
    expect(system.count).toBe(0);
  });

  it('reset() clears all satellites immediately', () => {
    const bus = new EventBus<GameEvents>();
    const system = new MoonSystem(bus, vi.fn(), () => 1);
    breakMoon(bus);
    breakMoon(bus);
    expect(system.satellites).toHaveLength(2);
    system.reset();
    expect(system.satellites).toHaveLength(0);
    expect(system.count).toBe(0);
  });
});
