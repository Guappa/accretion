export function spaghettificationProximity(
  orbitRadius: number,
  horizonWorldRadius: number,
  zoneWorldUnits: number,
): number {
  const distanceToHorizon = orbitRadius - horizonWorldRadius;
  if (distanceToHorizon >= zoneWorldUnits) return 0;
  return 1 - Math.max(distanceToHorizon, 0) / zoneWorldUnits;
}

export function spaghettificationStretch(proximity: number, maxStretch: number): number {
  return 1 + (maxStretch - 1) * proximity;
}

export function consumptionScale(proximity: number, minScale: number, exponent: number): number {
  const clamped = Math.min(Math.max(proximity, 0), 1);
  return minScale + (1 - minScale) * Math.pow(1 - clamped, exponent);
}
