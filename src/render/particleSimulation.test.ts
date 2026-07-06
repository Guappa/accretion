import { describe, expect, it } from 'vitest';
import { ParticlePool, type ParticlePhysics, type ParticleSpawn } from './particleSimulation';

const PHYSICS: ParticlePhysics = {
  pullStrength: 14000,
  minPullDistance: 50,
  dragPerSecond: 1.4,
  tangentialFactor: 0.55,
};

function fixedRng(): number {
  return 0.5;
}

function makeSpawn(overrides: Partial<ParticleSpawn> = {}): ParticleSpawn {
  return {
    x: 200,
    y: 0,
    count: 1,
    speedMin: 40,
    speedMax: 80,
    lifeSeconds: 2,
    sizeWorldMin: 1,
    sizeWorldMax: 3,
    tint: 0xffffff,
    stretch: 1,
    aim: 'scatter',
    ...overrides,
  };
}

describe('ParticlePool', () => {
  it('activates exactly the requested count', () => {
    const pool = new ParticlePool(16, PHYSICS, fixedRng);
    pool.spawn(makeSpawn({ count: 5 }));
    expect(pool.activeCount()).toBe(5);
  });

  it('drops spawns beyond capacity instead of growing', () => {
    const pool = new ParticlePool(8, PHYSICS, fixedRng);
    pool.spawn(makeSpawn({ count: 20 }));
    expect(pool.activeCount()).toBe(8);
  });

  it('expires particles when life runs out', () => {
    const pool = new ParticlePool(8, PHYSICS, fixedRng);
    pool.spawn(makeSpawn({ count: 3, lifeSeconds: 0.1 }));
    pool.update(0.2, 0);
    expect(pool.activeCount()).toBe(0);
  });

  it('absorbs particles that cross the horizon', () => {
    const pool = new ParticlePool(8, PHYSICS, fixedRng);
    pool.spawn(makeSpawn({ count: 1, x: 60, y: 0, lifeSeconds: 100 }));
    pool.update(0.016, 70);
    expect(pool.activeCount()).toBe(0);
  });

  it('gravity pulls particles toward the hole over time', () => {
    const pool = new ParticlePool(8, PHYSICS, fixedRng);
    pool.spawn(makeSpawn({ count: 1, x: 200, y: 0, lifeSeconds: 100 }));
    const slot = pool.active.indexOf(1);
    const startDistance = Math.hypot(pool.x[slot], pool.y[slot]);
    for (let step = 0; step < 120; step++) pool.update(1 / 60, 0);
    const endDistance = Math.hypot(pool.x[slot], pool.y[slot]);
    expect(endDistance).toBeLessThan(startDistance);
  });

  it('inward aim moves toward the hole immediately', () => {
    const pool = new ParticlePool(8, PHYSICS, fixedRng);
    pool.spawn(makeSpawn({ count: 1, x: 200, y: 0, aim: 'inward', lifeSeconds: 100 }));
    const slot = pool.active.indexOf(1);
    pool.update(0.05, 0);
    expect(Math.hypot(pool.x[slot], pool.y[slot])).toBeLessThan(200);
  });

  it('reuses slots after expiry', () => {
    const pool = new ParticlePool(4, PHYSICS, fixedRng);
    pool.spawn(makeSpawn({ count: 4, lifeSeconds: 0.05 }));
    pool.update(0.1, 0);
    pool.spawn(makeSpawn({ count: 4, lifeSeconds: 1 }));
    expect(pool.activeCount()).toBe(4);
  });

  it('never produces NaN positions at the origin', () => {
    const pool = new ParticlePool(4, PHYSICS, fixedRng);
    pool.spawn(makeSpawn({ count: 1, x: 0, y: 0, lifeSeconds: 100 }));
    pool.update(0.016, 0);
    for (let slot = 0; slot < pool.capacity; slot++) {
      expect(Number.isNaN(pool.x[slot])).toBe(false);
      expect(Number.isNaN(pool.vx[slot])).toBe(false);
    }
  });
});
