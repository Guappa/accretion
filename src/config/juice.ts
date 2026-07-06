export interface BurstRecipe {
  baseCount: number;
  countPerValue: number;
  maxCount: number;
  speedMin: number;
  speedMax: number;
  lifeSeconds: number;
  sizeWorldMin: number;
  sizeWorldMax: number;
}

export interface ShakeRecipe {
  valueThreshold: number;
  valueForMaxIntensity: number;
  minIntensity: number;
  maxIntensity: number;
  durationMs: number;
}

export const JUICE = {
  breakShake: {
    valueThreshold: 6,
    valueForMaxIntensity: 40,
    minIntensity: 0.003,
    maxIntensity: 0.012,
    durationMs: 130,
  } satisfies ShakeRecipe,
  critShake: { intensity: 0.006, durationMs: 110 },
  hitStop: { valueThreshold: 6, durationSeconds: 0.08, timeScale: 0.12 },
  sessionEndFlash: { durationMs: 450, red: 139, green: 92, blue: 246 },
  floatingText: {
    poolSize: 24,
    minValue: 1,
    lifeSeconds: 0.9,
    risePx: 48,
    fontSizePx: 15,
    color: '#f8fafc',
    strokeColor: '#0f172a',
    strokeThicknessPx: 3,
  },
  breakBurst: {
    baseCount: 6,
    countPerValue: 1.2,
    maxCount: 26,
    speedMin: 30,
    speedMax: 110,
    lifeSeconds: 2.2,
    sizeWorldMin: 1.5,
    sizeWorldMax: 4,
  } satisfies BurstRecipe,
  consumeBurst: {
    baseCount: 4,
    countPerValue: 0.5,
    maxCount: 10,
    speedMin: 20,
    speedMax: 60,
    lifeSeconds: 0.9,
    sizeWorldMin: 1,
    sizeWorldMax: 3,
  } satisfies BurstRecipe,
  streaks: {
    emitPerSecondAtMax: 22,
    speedMin: 70,
    speedMax: 130,
    lifeSeconds: 0.7,
    sizeWorldMin: 1,
    sizeWorldMax: 2.5,
    stretch: 4,
  },
} as const;
