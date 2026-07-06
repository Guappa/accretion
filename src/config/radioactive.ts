export interface RadioactiveConfig {
  falloutRadiusWorldUnits: number;
  baseDotPerTick: number;
  dotTickInterval: number;
  durationSeconds: number;
}

export const RADIOACTIVE: RadioactiveConfig = {
  falloutRadiusWorldUnits: 90,
  baseDotPerTick: 5,
  dotTickInterval: 0.5,
  durationSeconds: 4,
};
