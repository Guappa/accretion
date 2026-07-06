import type { BurstRecipe, ShakeRecipe } from '../config/juice';

export function burstCount(recipe: BurstRecipe, value: number): number {
  return Math.min(recipe.maxCount, Math.round(recipe.baseCount + recipe.countPerValue * value));
}

export function clampOutsideRadius(
  x: number,
  y: number,
  minRadius: number,
): { x: number; y: number } {
  const distance = Math.hypot(x, y);
  if (distance >= minRadius) return { x, y };
  if (distance === 0) return { x: 0, y: -minRadius };
  const scale = minRadius / distance;
  return { x: x * scale, y: y * scale };
}

export function shakeIntensity(recipe: ShakeRecipe, value: number): number | null {
  if (value < recipe.valueThreshold) return null;
  const range = recipe.valueForMaxIntensity - recipe.valueThreshold;
  const progress = Math.min((value - recipe.valueThreshold) / range, 1);
  return recipe.minIntensity + (recipe.maxIntensity - recipe.minIntensity) * progress;
}

export class HitStopClock {
  private remainingSeconds = 0;

  constructor(private readonly timeScale: number) {}

  trigger(durationSeconds: number): void {
    this.remainingSeconds = Math.max(this.remainingSeconds, durationSeconds);
  }

  scale(realDeltaSeconds: number): number {
    if (this.remainingSeconds <= 0) return realDeltaSeconds;
    this.remainingSeconds -= realDeltaSeconds;
    return realDeltaSeconds * this.timeScale;
  }
}
