export interface GrowthStage {
  massThreshold: number;
  horizonScale: number;
  viewScale: number;
}

export const GROWTH_STAGES: readonly GrowthStage[] = [
  { massThreshold: 0, horizonScale: 1, viewScale: 1 },
  { massThreshold: 60, horizonScale: 1.12, viewScale: 0.97 },
  { massThreshold: 300, horizonScale: 1.28, viewScale: 0.93 },
  { massThreshold: 1200, horizonScale: 1.5, viewScale: 0.89 },
  { massThreshold: 5000, horizonScale: 1.8, viewScale: 0.84 },
  { massThreshold: 20000, horizonScale: 2.2, viewScale: 0.78 },
];
