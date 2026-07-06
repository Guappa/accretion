import { CELESTIAL_TIERS, type CelestialAffix, type CelestialTierId } from '../config/celestials';
import { deterministicUnit } from './random';

export interface Celestial {
  id: number;
  tierId: CelestialTierId;
  orbitRadius: number;
  orbitAngle: number;
  hp: number;
  sizeScale: number;
  affix: CelestialAffix | null;
}

export function createCelestial(
  tierId: CelestialTierId,
  orbitRadius: number,
  orbitAngle: number,
  id: number,
): Celestial {
  const tier = CELESTIAL_TIERS[tierId];
  const { min, max } = tier.sizeVariation;
  const sizeScale = min + deterministicUnit(id * 7.13) * (max - min);
  return { id, tierId, orbitRadius, orbitAngle, hp: tier.hp, sizeScale, affix: null };
}

export function createIdGenerator(): () => number {
  let nextId = 1;
  return () => nextId++;
}

export function celestialPosition(entity: Celestial): { x: number; y: number } {
  return {
    x: Math.cos(entity.orbitAngle) * entity.orbitRadius,
    y: Math.sin(entity.orbitAngle) * entity.orbitRadius,
  };
}

export function celestialHitRadius(entity: Celestial): number {
  return CELESTIAL_TIERS[entity.tierId].radius * entity.sizeScale;
}

// Analytic world-space velocity of the polar motion model (angle += angularSpeed*dt, radius -= driftRate*dt) - lets renderers aim trails without tracking state.
export function celestialVelocity(entity: Celestial): { x: number; y: number } {
  const tier = CELESTIAL_TIERS[entity.tierId];
  const tangentialSpeed = tier.angularSpeed * entity.orbitRadius;
  const cos = Math.cos(entity.orbitAngle);
  const sin = Math.sin(entity.orbitAngle);
  return {
    x: -sin * tangentialSpeed - cos * tier.driftRate,
    y: cos * tangentialSpeed - sin * tier.driftRate,
  };
}
