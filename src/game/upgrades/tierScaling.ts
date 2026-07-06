import { CELESTIAL_TIERS, type CelestialCategory, type CelestialTierId } from '../../config/celestials';
import type { BehaviorFlag } from '../../config/upgrades';
import type { DerivedStats } from './StatEngine';

// Categories absent from this map always spawn; a category here spawns only once its flag is unlocked.
const CATEGORY_UNLOCK_FLAG: Partial<Record<CelestialCategory, BehaviorFlag>> = {
  planet: 'spawnPlanets',
  star: 'spawnStars',
};

function isPlanet(tierId: CelestialTierId): boolean {
  return CELESTIAL_TIERS[tierId].category === 'planet';
}

function isStar(tierId: CelestialTierId): boolean {
  return CELESTIAL_TIERS[tierId].category === 'star';
}

export function isTierSpawnable(tierId: CelestialTierId, flags: ReadonlySet<BehaviorFlag>): boolean {
  const required = CATEGORY_UNLOCK_FLAG[CELESTIAL_TIERS[tierId].category];
  return required === undefined || flags.has(required);
}

export function tierWeightMultiplier(tierId: CelestialTierId, stats: DerivedStats): number {
  if (isPlanet(tierId)) return stats.planetWeightMult;
  if (isStar(tierId)) return stats.starWeightMult;
  return 1;
}

export function tierMatterMultiplier(tierId: CelestialTierId, stats: DerivedStats): number {
  if (isPlanet(tierId)) return stats.planetValueMult;
  if (isStar(tierId)) return stats.starValueMult;
  return 1;
}

export function tierDamageMultiplier(tierId: CelestialTierId, stats: DerivedStats): number {
  if (isPlanet(tierId)) return stats.planetDamageMult;
  if (isStar(tierId)) return stats.starDamageMult;
  return 1;
}
