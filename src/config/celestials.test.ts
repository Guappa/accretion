import { describe, expect, it } from 'vitest';
import { CELESTIAL_TIERS } from './celestials';
import { SESSION_CONFIG } from './session';
import type { CelestialTierId } from './celestials';

describe('CELESTIAL_TIERS', () => {
  it('breaking always yields more total value than swallowing whole', () => {
    for (const tier of Object.values(CELESTIAL_TIERS)) {
      expect(tier.breakValue).toBeGreaterThan(tier.matterValue);
    }
  });

  it('drift is slow enough that a full field cannot self-clear in one session (the hole must not play itself)', () => {
    const allTiers = Object.keys(CELESTIAL_TIERS) as CelestialTierId[];
    expect(allTiers.length).toBeGreaterThan(0);
    const travelDistance = SESSION_CONFIG.spawnRadius - SESSION_CONFIG.horizonRadius;
    for (const tierId of allTiers) {
      const travelSeconds = travelDistance / CELESTIAL_TIERS[tierId].driftRate;
      // A periphery-spawned object must OUTLAST a base session, so active breaking - not passive drift - clears the field.
      expect(travelSeconds).toBeGreaterThan(SESSION_CONFIG.baseDurationSeconds);
      // But drift must stay meaningful (a slow trickle still reaches the hole), not glacial.
      expect(travelSeconds).toBeLessThan(SESSION_CONFIG.baseDurationSeconds * 4);
    }
  });

  it('size variation bounds are sane for every tier', () => {
    for (const tier of Object.values(CELESTIAL_TIERS)) {
      expect(tier.sizeVariation.min).toBeGreaterThan(0);
      expect(tier.sizeVariation.min).toBeLessThanOrEqual(1);
      expect(tier.sizeVariation.max).toBeGreaterThanOrEqual(1);
      expect(tier.sizeVariation.max).toBeLessThan(2);
    }
  });

  it('metal-bearing tiers are tougher and better paying than their base counterparts', () => {
    expect(CELESTIAL_TIERS.ferrousRock.hp).toBeGreaterThan(CELESTIAL_TIERS.rock.hp);
    expect(CELESTIAL_TIERS.ferrousRock.breakValue).toBeGreaterThan(CELESTIAL_TIERS.rock.breakValue);
    expect(CELESTIAL_TIERS.metalAsteroid.hp).toBeGreaterThan(CELESTIAL_TIERS.smallAsteroid.hp);
    expect(CELESTIAL_TIERS.metalAsteroid.breakValue).toBeGreaterThan(CELESTIAL_TIERS.smallAsteroid.breakValue);
    expect(CELESTIAL_TIERS.ferrousRock.metalBearing).toBe(true);
    expect(CELESTIAL_TIERS.rock.metalBearing).toBe(false);
  });

  it('spawn weights include the metal tiers and sum to a stable total', () => {
    // pickTier normalizes by total weight, so this isn't required to be exactly 1 - it just pins the total so a future edit notices drift.
    const weights = Object.values(SESSION_CONFIG.tierWeights);
    expect(weights.reduce((sum, weight) => sum + (weight ?? 0), 0)).toBeCloseTo(1.116, 6);
    expect(SESSION_CONFIG.tierWeights.ferrousRock).toBeGreaterThan(0);
  });
});

describe('planet spectrum', () => {
  it('planets are bigger and far more valuable than asteroids; giants are the tough targets', () => {
    const planet = CELESTIAL_TIERS.planet;
    expect(planet.radius).toBeGreaterThan(CELESTIAL_TIERS.metalAsteroid.radius);
    expect(planet.hp).toBeGreaterThan(CELESTIAL_TIERS.metalAsteroid.hp);
    // Planets pay far more than asteroids (the reward for the tougher target).
    expect(planet.matterValue).toBeGreaterThanOrEqual(CELESTIAL_TIERS.metalAsteroid.matterValue * 5);
    // Gas giants stay a genuinely tough, high-payoff target.
    expect(CELESTIAL_TIERS.gasGiant.hp).toBeGreaterThan(CELESTIAL_TIERS.metalAsteroid.hp * 3);
  });

  it('escalates Minis -> Rockies -> Giants in size, health, and value', () => {
    const mini = CELESTIAL_TIERS.dwarfPlanet;
    const rocky = CELESTIAL_TIERS.planet;
    const giant = CELESTIAL_TIERS.gasGiant;
    for (const key of ['radius', 'hp', 'matterValue', 'breakValue'] as const) {
      expect(mini[key]).toBeLessThan(rocky[key]);
      expect(rocky[key]).toBeLessThan(giant[key]);
    }
  });

  it('classifies asteroids, planets, and stars by category', () => {
    expect(CELESTIAL_TIERS.rock.category).toBe('asteroid');
    expect(CELESTIAL_TIERS.metalAsteroid.category).toBe('asteroid');
    for (const id of ['dwarfPlanet', 'planet', 'gasGiant'] as const) {
      expect(CELESTIAL_TIERS[id].category).toBe('planet');
    }
    for (const id of ['redDwarf', 'star', 'blueGiant'] as const) {
      expect(CELESTIAL_TIERS[id].category).toBe('star');
    }
  });
});

describe('star spectrum', () => {
  it('stars are bigger and far more valuable than any planet, the tier above the planet spectrum', () => {
    const redDwarf = CELESTIAL_TIERS.redDwarf;
    expect(redDwarf.radius).toBeGreaterThan(CELESTIAL_TIERS.gasGiant.radius);
    expect(redDwarf.hp).toBeGreaterThan(CELESTIAL_TIERS.gasGiant.hp);
    expect(redDwarf.matterValue).toBeGreaterThan(CELESTIAL_TIERS.gasGiant.matterValue);
    expect(redDwarf.breakValue).toBeGreaterThan(CELESTIAL_TIERS.gasGiant.breakValue);
  });

  it('escalates red dwarf -> star -> blue giant in size, health, and value', () => {
    const redDwarf = CELESTIAL_TIERS.redDwarf;
    const star = CELESTIAL_TIERS.star;
    const blueGiant = CELESTIAL_TIERS.blueGiant;
    for (const key of ['radius', 'hp', 'matterValue', 'breakValue'] as const) {
      expect(redDwarf[key]).toBeLessThan(star[key]);
      expect(star[key]).toBeLessThan(blueGiant[key]);
    }
  });

  it('stars are not metal-bearing', () => {
    for (const id of ['redDwarf', 'star', 'blueGiant'] as const) {
      expect(CELESTIAL_TIERS[id].metalBearing).toBe(false);
    }
  });
});
