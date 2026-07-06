import { describe, expect, it } from 'vitest';
import { CELESTIAL_TIERS } from '../config/celestials';
import {
  celestialHitRadius,
  celestialPosition,
  celestialVelocity,
  createCelestial,
  createIdGenerator,
} from './entities';

describe('createCelestial', () => {
  it('initializes hp from tier config', () => {
    const rock = createCelestial('rock', 500, 0, 1);
    expect(rock.hp).toBe(CELESTIAL_TIERS.rock.hp);
    expect(rock.tierId).toBe('rock');
    expect(rock.orbitRadius).toBe(500);
  });

  it('assigns a deterministic sizeScale within tier bounds', () => {
    const { min, max } = CELESTIAL_TIERS.rock.sizeVariation;
    for (let id = 1; id <= 50; id++) {
      const rock = createCelestial('rock', 500, 0, id);
      expect(rock.sizeScale).toBeGreaterThanOrEqual(min);
      expect(rock.sizeScale).toBeLessThanOrEqual(max);
    }
    expect(createCelestial('rock', 500, 0, 3).sizeScale).toBeCloseTo(0.9809813678512, 10);
  });

  it('celestialHitRadius scales the tier radius', () => {
    const rock = createCelestial('rock', 500, 0, 3);
    expect(celestialHitRadius(rock)).toBeCloseTo(CELESTIAL_TIERS.rock.radius * rock.sizeScale);
  });
});

describe('createIdGenerator', () => {
  it('produces sequential unique ids', () => {
    const nextId = createIdGenerator();
    expect([nextId(), nextId(), nextId()]).toEqual([1, 2, 3]);
  });
});

describe('celestialPosition', () => {
  it('converts polar orbit coordinates to cartesian around the origin', () => {
    const entity = createCelestial('rock', 100, Math.PI / 2, 1);
    const { x, y } = celestialPosition(entity);
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(100);
  });
});

describe('celestialVelocity', () => {
  it('matches a finite-difference step of the gravity motion model', () => {
    const entity = createCelestial('comet', 400, 0.7, 1);
    const tier = CELESTIAL_TIERS.comet;
    const dt = 0.0001;
    const before = celestialPosition(entity);
    const stepped = {
      ...entity,
      orbitAngle: entity.orbitAngle + tier.angularSpeed * dt,
      orbitRadius: entity.orbitRadius - tier.driftRate * dt,
    };
    const after = celestialPosition(stepped);
    const velocity = celestialVelocity(entity);
    expect(velocity.x).toBeCloseTo((after.x - before.x) / dt, 1);
    expect(velocity.y).toBeCloseTo((after.y - before.y) / dt, 1);
  });

  it('the tangential component dominates the radial one for the comet tier (it streaks, not falls)', () => {
    const entity = createCelestial('comet', 400, 1.2, 1);
    const tier = CELESTIAL_TIERS.comet;
    const tangentialSpeed = tier.angularSpeed * entity.orbitRadius;
    expect(tangentialSpeed).toBeGreaterThan(tier.driftRate * 10);
    const speed = Math.hypot(celestialVelocity(entity).x, celestialVelocity(entity).y);
    expect(speed).toBeCloseTo(Math.hypot(tangentialSpeed, tier.driftRate), 6);
  });

  it('the velocity always has an inward radial component (tail points outward-behind)', () => {
    for (const angle of [0, 1, 2.5, 4, 5.5]) {
      const entity = createCelestial('comet', 300, angle, 1);
      const velocity = celestialVelocity(entity);
      const radialDot = velocity.x * Math.cos(angle) + velocity.y * Math.sin(angle);
      expect(radialDot).toBeCloseTo(-CELESTIAL_TIERS.comet.driftRate, 6);
    }
  });
});
