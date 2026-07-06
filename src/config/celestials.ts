export type CelestialTierId =
  | 'rock'
  | 'smallAsteroid'
  | 'ferrousRock'
  | 'metalAsteroid'
  | 'dwarfPlanet'
  | 'planet'
  | 'gasGiant'
  | 'redDwarf'
  | 'star'
  | 'blueGiant'
  | 'comet';

// Broad family a tier belongs to; drives unlock gating and tier-scoped upgrades (the whole planet spectrum shares one unlock).
export type CelestialCategory = 'asteroid' | 'planet' | 'star' | 'comet';

// Affixes are rare modifiers rolled onto a spawned celestial, independent of its base tier.
export type CelestialAffix = 'electric' | 'golden' | 'radioactive' | 'moon' | 'laser';

export interface CelestialTier {
  id: CelestialTierId;
  category: CelestialCategory;
  radius: number;
  hp: number;
  matterValue: number;
  breakValue: number;
  driftRate: number;
  angularSpeed: number;
  color: number;
  sizeVariation: { min: number; max: number };
  metalBearing: boolean;
}

export const CELESTIAL_TIERS: Record<CelestialTierId, CelestialTier> = {
  rock: {
    id: 'rock',
    category: 'asteroid',
    radius: 14,
    hp: 20,
    matterValue: 1,
    breakValue: 3,
    driftRate: 20,
    angularSpeed: 0.25,
    color: 0xf59e0b,
    sizeVariation: { min: 0.75, max: 1.35 },
    metalBearing: false,
  },
  smallAsteroid: {
    id: 'smallAsteroid',
    category: 'asteroid',
    radius: 22,
    hp: 55,
    matterValue: 3,
    breakValue: 6,
    driftRate: 18,
    angularSpeed: 0.175,
    color: 0x38bdf8,
    sizeVariation: { min: 0.8, max: 1.3 },
    metalBearing: false,
  },
  ferrousRock: {
    id: 'ferrousRock',
    category: 'asteroid',
    radius: 14,
    hp: 34,
    matterValue: 2,
    breakValue: 6,
    driftRate: 20,
    angularSpeed: 0.25,
    color: 0xb8c4d0,
    sizeVariation: { min: 0.75, max: 1.35 },
    metalBearing: true,
  },
  metalAsteroid: {
    id: 'metalAsteroid',
    category: 'asteroid',
    radius: 22,
    hp: 90,
    matterValue: 5,
    breakValue: 12,
    driftRate: 18,
    angularSpeed: 0.175,
    color: 0x93c5fd,
    sizeVariation: { min: 0.8, max: 1.3 },
    metalBearing: true,
  },
  // Planet spectrum, smallest to largest: Minis -> Rockies -> Giants. Bigger = tougher, rarer, worth more.
  dwarfPlanet: {
    id: 'dwarfPlanet',
    category: 'planet',
    radius: 36,
    hp: 40,
    matterValue: 15,
    breakValue: 34,
    driftRate: 15,
    angularSpeed: 0.12,
    color: 0x9ca3af,
    sizeVariation: { min: 0.85, max: 1.15 },
    metalBearing: false,
  },
  planet: {
    id: 'planet',
    category: 'planet',
    radius: 48,
    hp: 130,
    matterValue: 40,
    breakValue: 92,
    driftRate: 12,
    angularSpeed: 0.1,
    color: 0x4a90d9,
    sizeVariation: { min: 0.85, max: 1.2 },
    metalBearing: false,
  },
  gasGiant: {
    id: 'gasGiant',
    category: 'planet',
    radius: 70,
    hp: 480,
    matterValue: 150,
    breakValue: 340,
    driftRate: 8,
    angularSpeed: 0.08,
    color: 0xe0a850,
    sizeVariation: { min: 0.9, max: 1.15 },
    metalBearing: false,
  },
  // Star spectrum, one rung above planets: red dwarf -> star -> blue giant. Rarer, tougher, worth far more.
  redDwarf: {
    id: 'redDwarf',
    category: 'star',
    radius: 78,
    hp: 700,
    matterValue: 260,
    breakValue: 600,
    driftRate: 7,
    angularSpeed: 0.07,
    color: 0xdc5a3c,
    sizeVariation: { min: 0.9, max: 1.15 },
    metalBearing: false,
  },
  star: {
    id: 'star',
    category: 'star',
    radius: 92,
    hp: 1400,
    matterValue: 600,
    breakValue: 1400,
    driftRate: 7,
    angularSpeed: 0.06,
    color: 0xfff4c1,
    sizeVariation: { min: 0.9, max: 1.15 },
    metalBearing: false,
  },
  blueGiant: {
    id: 'blueGiant',
    category: 'star',
    radius: 110,
    hp: 3000,
    matterValue: 1500,
    breakValue: 3400,
    driftRate: 7,
    angularSpeed: 0.05,
    color: 0x9ec8ff,
    sizeVariation: { min: 0.9, max: 1.15 },
    metalBearing: false,
  },
  // Never enters the SpawnSystem pool (no session tierWeight) - CometSystem spawns it directly on its own timer.
  // Deliberately fragile (2-3 base ticks): the challenge is catching it mid-streak, not chewing through hp.
  comet: {
    id: 'comet',
    category: 'comet',
    radius: 18,
    hp: 12,
    matterValue: 25,
    breakValue: 70,
    driftRate: 20,
    angularSpeed: 1.8,
    color: 0xf97316,
    sizeVariation: { min: 0.85, max: 1.2 },
    metalBearing: false,
  },
};
