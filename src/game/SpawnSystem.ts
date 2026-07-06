import { CELESTIAL_TIERS, type CelestialCategory, type CelestialTierId } from '../config/celestials';
import type { SessionConfig } from '../config/session';
import { createCelestial, type Celestial } from './entities';

// Caps the spawn-rate speedup on huge viewports so massive screens don't spawn absurdly fast.
const SPAWN_MAX_AREA_MULTIPLIER = 8;

export class SpawnSystem {
  private timeUntilSpawn: number;
  private timeUntilRefill = 0;
  // Kill-triggered spawns queue here and drain in update(): objectBroken handlers must never mutate entities mid-iteration.
  private readonly pendingRespawns: (CelestialCategory | null)[] = [];

  constructor(
    private readonly config: SessionConfig,
    private readonly random: () => number,
    private readonly nextId: () => number,
    private readonly getElectricChance: () => number,
    private readonly getGoldenChance: () => number = () => 0,
    private readonly getRadioactiveChance: () => number = () => 0,
    private readonly getMoonChance: () => number = () => 0,
    private readonly getLaserChance: () => number = () => 0,
    private readonly isTierSpawnable: (tierId: CelestialTierId) => boolean = () => true,
    private readonly tierWeightMult: (tierId: CelestialTierId) => number = () => 1,
    private readonly getSpawnRateMult: () => number = () => 1,
    private readonly getFieldTarget: () => number = () => 0,
  ) {
    this.timeUntilSpawn = config.spawnStartInterval;
  }

  update(
    deltaSeconds: number,
    sessionProgress: number,
    entities: Celestial[],
    spawnFieldRadius: number,
  ): void {
    this.drainPendingRespawns(entities, spawnFieldRadius);
    this.timeUntilSpawn -= deltaSeconds;
    // Density stays roughly constant as the visible field grows: more area needs a faster rate, capped so huge screens don't go absurd.
    const areaRatio = Math.min(
      (spawnFieldRadius / this.config.spawnRadius) ** 2,
      SPAWN_MAX_AREA_MULTIPLIER,
    );
    while (this.timeUntilSpawn <= 0) {
      if (entities.length >= this.config.maxEntities) break;
      entities.push(this.spawnAtEdge(this.pickTier(), spawnFieldRadius));
      // Upgrade/stage density levers fold with the area scaling: both shorten the effective interval.
      this.timeUntilSpawn += this.currentInterval(sessionProgress) / (this.getSpawnRateMult() * areaRatio);
    }
    this.maintainFieldTarget(deltaSeconds, entities, spawnFieldRadius);
  }

  // Kill-triggered spawn request; null means a normal tier roll, a category forces a same-family replacement.
  queueRespawn(category: CelestialCategory | null = null): void {
    this.pendingRespawns.push(category);
  }

  // Clears timers and queued respawns so nothing from the prior session bleeds into the next.
  reset(): void {
    this.timeUntilSpawn = this.config.spawnStartInterval;
    this.timeUntilRefill = 0;
    this.pendingRespawns.length = 0;
  }

  // Instantly populates the field at session start so later stages open into an already-busy sky.
  seedInitialField(count: number, entities: Celestial[], spawnFieldRadius: number): void {
    for (let i = 0; i < count; i++) {
      if (entities.length >= this.config.maxEntities) return;
      // Mid-field band [0.45, 1.0]: close enough to matter immediately, never inside the horizon.
      const radius = (0.45 + this.random() * 0.55) * spawnFieldRadius;
      const seeded = createCelestial(this.pickTier(), radius, this.random() * Math.PI * 2, this.nextId());
      this.rollAffix(seeded);
      entities.push(seeded);
    }
  }

  // The predecessor's refill law: when the field runs below target, refill at an interval that shrinks as the target grows, so heavy clearing can never leave the screen empty.
  private maintainFieldTarget(
    deltaSeconds: number,
    entities: Celestial[],
    spawnFieldRadius: number,
  ): void {
    const target = Math.min(this.getFieldTarget(), this.config.maxEntities);
    if (entities.length >= target) {
      // At/above target only the drip runs; keep the timer primed so a big clear starts refilling within one interval.
      this.timeUntilRefill = this.refillInterval(target);
      return;
    }
    this.timeUntilRefill -= deltaSeconds;
    while (this.timeUntilRefill <= 0 && entities.length < target) {
      entities.push(this.spawnAtEdge(this.pickTier(), spawnFieldRadius));
      this.timeUntilRefill += this.refillInterval(target);
    }
  }

  private refillInterval(target: number): number {
    const { baseSeconds, perTargetRate } = this.config.refill;
    return baseSeconds / (1 + target * perTargetRate) / this.getSpawnRateMult();
  }

  private drainPendingRespawns(entities: Celestial[], spawnFieldRadius: number): void {
    for (const category of this.pendingRespawns) {
      // A saturated field drops the backlog rather than banking a burst for later.
      if (entities.length >= this.config.maxEntities) break;
      const tierId = category === null ? this.pickTier() : this.pickTierInCategory(category);
      entities.push(this.spawnAtEdge(tierId, spawnFieldRadius));
    }
    this.pendingRespawns.length = 0;
  }

  private spawnAtEdge(tierId: CelestialTierId, spawnFieldRadius: number): Celestial {
    const spawned = createCelestial(tierId, spawnFieldRadius, this.random() * Math.PI * 2, this.nextId());
    this.rollAffix(spawned);
    return spawned;
  }

  // Roll order golden -> radioactive -> moon -> laser -> electric, first hit wins; laser is star-only, electric stays metal-bearing-only. A spawn carries at most one affix.
  private rollAffix(spawned: Celestial): void {
    if (this.random() < this.getGoldenChance()) {
      spawned.affix = 'golden';
    } else if (this.random() < this.getRadioactiveChance()) {
      spawned.affix = 'radioactive';
    } else if (this.random() < this.getMoonChance()) {
      spawned.affix = 'moon';
    } else if (CELESTIAL_TIERS[spawned.tierId].category === 'star' && this.random() < this.getLaserChance()) {
      spawned.affix = 'laser';
    } else if (CELESTIAL_TIERS[spawned.tierId].metalBearing && this.random() < this.getElectricChance()) {
      spawned.affix = 'electric';
    }
  }

  private currentInterval(sessionProgress: number): number {
    const { spawnStartInterval, spawnEndInterval } = this.config;
    return spawnStartInterval + (spawnEndInterval - spawnStartInterval) * sessionProgress;
  }

  private pickTier(): CelestialTierId {
    return this.pickWeighted(() => true) ?? this.fallbackTier();
  }

  private pickTierInCategory(category: CelestialCategory): CelestialTierId {
    // A forced-category respawn only fires after that category was broken, so its tiers are spawnable; fall back to a normal roll just in case.
    return this.pickWeighted((tierId) => CELESTIAL_TIERS[tierId].category === category) ?? this.pickTier();
  }

  private pickWeighted(filter: (tierId: CelestialTierId) => boolean): CelestialTierId | null {
    const weighted = (Object.entries(this.config.tierWeights) as [CelestialTierId, number][])
      .filter(([tierId]) => this.isTierSpawnable(tierId) && filter(tierId))
      .map(([tierId, weight]) => [tierId, weight * this.tierWeightMult(tierId)] as [CelestialTierId, number]);
    if (weighted.length === 0) return null;
    const totalWeight = weighted.reduce((sum, [, weight]) => sum + weight, 0);
    let roll = this.random() * totalWeight;
    for (const [tierId, weight] of weighted) {
      roll -= weight;
      if (roll <= 0) return tierId;
    }
    return weighted[weighted.length - 1][0];
  }

  private fallbackTier(): CelestialTierId {
    const tierIds = Object.keys(this.config.tierWeights) as CelestialTierId[];
    return tierIds[0];
  }
}
