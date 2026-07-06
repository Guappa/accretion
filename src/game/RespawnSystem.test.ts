import { describe, expect, it } from 'vitest';
import type { CelestialCategory, CelestialTierId } from '../config/celestials';
import { EventBus } from '../core/EventBus';
import type { GameEvents, KillSource } from '../core/events';
import { RespawnSystem, type RespawnChances } from './RespawnSystem';

function breakEvent(tierId: CelestialTierId, source: KillSource = 'breaker'): GameEvents['objectBroken'] {
  return { id: 1, tierId, value: 3, x: 0, y: 0, source, affix: null };
}

function makeHarness(chances: RespawnChances, random: () => number) {
  const bus = new EventBus<GameEvents>();
  const queued: (CelestialCategory | null)[] = [];
  new RespawnSystem(bus, random, () => chances, (category) => queued.push(category));
  return { bus, queued };
}

const NO_CHANCES: RespawnChances = { spawnOnKill: 0, planetRespawn: 0, starRespawn: 0 };

describe('RespawnSystem', () => {
  it('queues a normal respawn when the spawn-on-kill roll lands under the chance', () => {
    const { bus, queued } = makeHarness({ ...NO_CHANCES, spawnOnKill: 0.2 }, () => 0.1);
    bus.emit('objectBroken', breakEvent('rock'));
    expect(queued).toEqual([null]);
  });

  it('does not queue when the roll lands at or above the chance', () => {
    const { bus, queued } = makeHarness({ ...NO_CHANCES, spawnOnKill: 0.2 }, () => 0.9);
    bus.emit('objectBroken', breakEvent('rock'));
    expect(queued).toHaveLength(0);
  });

  it('counts kills from any source - laser and chain mayhem feed the engine too', () => {
    const { bus, queued } = makeHarness({ ...NO_CHANCES, spawnOnKill: 0.5 }, () => 0.1);
    bus.emit('objectBroken', breakEvent('rock', 'laser'));
    bus.emit('objectBroken', breakEvent('rock', 'chain'));
    bus.emit('objectBroken', breakEvent('rock', 'orb'));
    expect(queued).toEqual([null, null, null]);
  });

  it('queues a forced planet respawn only for planet-category kills', () => {
    const { bus, queued } = makeHarness({ ...NO_CHANCES, planetRespawn: 0.5 }, () => 0.1);
    bus.emit('objectBroken', breakEvent('gasGiant'));
    bus.emit('objectBroken', breakEvent('rock'));
    bus.emit('objectBroken', breakEvent('star'));
    expect(queued).toEqual(['planet']);
  });

  it('queues a forced star respawn only for star-category kills', () => {
    const { bus, queued } = makeHarness({ ...NO_CHANCES, starRespawn: 0.5 }, () => 0.1);
    bus.emit('objectBroken', breakEvent('redDwarf'));
    bus.emit('objectBroken', breakEvent('planet'));
    expect(queued).toEqual(['star']);
  });

  it('one kill can queue both a spawn-on-kill and a category respawn', () => {
    const { bus, queued } = makeHarness(
      { spawnOnKill: 0.5, planetRespawn: 0.5, starRespawn: 0.5 },
      () => 0.1,
    );
    bus.emit('objectBroken', breakEvent('planet'));
    expect(queued).toEqual([null, 'planet']);
  });
});
