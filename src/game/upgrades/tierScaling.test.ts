import { describe, expect, it } from 'vitest';
import type { BehaviorFlag } from '../../config/upgrades';
import { deriveStats } from './StatEngine';
import {
  isTierSpawnable,
  tierDamageMultiplier,
  tierMatterMultiplier,
  tierWeightMultiplier,
} from './tierScaling';

describe('tierScaling', () => {
  it('gates the whole planet spectrum behind the spawnPlanets flag; asteroids always spawn', () => {
    const none = new Set<BehaviorFlag>();
    const unlocked = new Set<BehaviorFlag>(['spawnPlanets']);
    expect(isTierSpawnable('rock', none)).toBe(true);
    for (const id of ['dwarfPlanet', 'planet', 'gasGiant'] as const) {
      expect(isTierSpawnable(id, none)).toBe(false);
      expect(isTierSpawnable(id, unlocked)).toBe(true);
    }
  });

  it('applies planet weight/value/damage multipliers to every planet tier, not asteroids', () => {
    const stats = deriveStats(new Set(), [
      { planetWeightFraction: 1, planetValueFraction: 0.5, planetDamageFraction: 1 },
    ]);
    for (const id of ['dwarfPlanet', 'planet', 'gasGiant'] as const) {
      expect(tierWeightMultiplier(id, stats)).toBeCloseTo(2, 6);
      expect(tierMatterMultiplier(id, stats)).toBeCloseTo(1.5, 6);
      expect(tierDamageMultiplier(id, stats)).toBeCloseTo(2, 6);
    }
    expect(tierWeightMultiplier('rock', stats)).toBe(1);
    expect(tierMatterMultiplier('metalAsteroid', stats)).toBe(1);
    expect(tierDamageMultiplier('rock', stats)).toBe(1);
  });

  it('gates the whole star spectrum behind the spawnStars flag; planets and asteroids are unaffected', () => {
    const none = new Set<BehaviorFlag>();
    const unlocked = new Set<BehaviorFlag>(['spawnStars']);
    expect(isTierSpawnable('rock', none)).toBe(true);
    expect(isTierSpawnable('planet', new Set(['spawnPlanets']))).toBe(true);
    for (const id of ['redDwarf', 'star', 'blueGiant'] as const) {
      expect(isTierSpawnable(id, none)).toBe(false);
      expect(isTierSpawnable(id, unlocked)).toBe(true);
    }
  });

  it('applies star weight/value/damage multipliers to every star tier, not planets or asteroids', () => {
    const stats = deriveStats(new Set(), [
      { starWeightFraction: 1, starValueFraction: 0.5, starDamageFraction: 1 },
    ]);
    for (const id of ['redDwarf', 'star', 'blueGiant'] as const) {
      expect(tierWeightMultiplier(id, stats)).toBeCloseTo(2, 6);
      expect(tierMatterMultiplier(id, stats)).toBeCloseTo(1.5, 6);
      expect(tierDamageMultiplier(id, stats)).toBeCloseTo(2, 6);
    }
    expect(tierWeightMultiplier('planet', stats)).toBe(1);
    expect(tierMatterMultiplier('gasGiant', stats)).toBe(1);
    expect(tierDamageMultiplier('rock', stats)).toBe(1);
  });
});
