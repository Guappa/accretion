import { deterministicUnit } from '../game/random';

export interface LensingConfig {
  zoneScale: number;
  deflectionStrength: number;
  maxArcRadians: number;
  hideBelowScale: number;
}

export interface LensedStar {
  radiusPx: number;
  angleRadians: number;
  arcHalfWidthRadians: number;
  visible: boolean;
}

export function lensStar(
  starX: number,
  starY: number,
  centerX: number,
  centerY: number,
  holeRadiusPx: number,
  lensing: LensingConfig,
): LensedStar {
  const deltaX = starX - centerX;
  const deltaY = starY - centerY;
  const distance = Math.hypot(deltaX, deltaY);
  const angleRadians = Math.atan2(deltaY, deltaX);
  const zoneRadius = holeRadiusPx * lensing.zoneScale;
  if (distance >= zoneRadius) {
    return { radiusPx: distance, angleRadians, arcHalfWidthRadians: 0, visible: true };
  }
  if (distance <= holeRadiusPx * lensing.hideBelowScale) {
    return { radiusPx: distance, angleRadians, arcHalfWidthRadians: 0, visible: false };
  }
  const proximity = 1 - (distance - holeRadiusPx) / (zoneRadius - holeRadiusPx);
  const squared = proximity * proximity;
  return {
    radiusPx: distance + holeRadiusPx * lensing.deflectionStrength * squared,
    angleRadians,
    arcHalfWidthRadians: (lensing.maxArcRadians / 2) * squared,
    visible: true,
  };
}

export interface HaloConfig {
  count: number;
  minAlpha: number;
  maxAlpha: number;
}

export interface HaloStreak {
  radiusPx: number;
  angleRadians: number;
  arcHalfWidthRadians: number;
  alpha: number;
}

export function haloStreak(
  index: number,
  holeRadiusPx: number,
  zoneScale: number,
  halo: HaloConfig,
): HaloStreak {
  const innerRadius = holeRadiusPx * 1.08;
  const outerRadius = holeRadiusPx * zoneScale * 0.95;
  const bandUnit = deterministicUnit(index * 12.9 + 3.1) ** 1.8;
  const radiusPx = innerRadius + bandUnit * (outerRadius - innerRadius);
  const proximity = 1 - (radiusPx - innerRadius) / (outerRadius - innerRadius);
  return {
    radiusPx,
    angleRadians: deterministicUnit(index * 7.7 + 1.3) * Math.PI * 2,
    arcHalfWidthRadians: 0.08 + deterministicUnit(index * 5.1 + 9.7) * 0.35 * (0.4 + 0.6 * proximity),
    alpha: halo.minAlpha + (halo.maxAlpha - halo.minAlpha) * proximity * (0.5 + 0.5 * deterministicUnit(index * 3.3 + 6.9)),
  };
}
