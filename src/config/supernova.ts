export interface SupernovaConfig {
  radiusWorldUnits: number;
  baseDamage: number;
  expandSeconds: number;
}

export const SUPERNOVA: SupernovaConfig = {
  radiusWorldUnits: 260,
  baseDamage: 400,
  expandSeconds: 0.6,
};
