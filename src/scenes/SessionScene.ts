import Phaser from 'phaser';
import type { CelestialTierId } from '../config/celestials';
import { GROWTH_STAGES, type GrowthStage } from '../config/progression';
import { SESSION_CONFIG } from '../config/session';
import { stageForMass } from '../config/stages';
import { UPGRADE_TUNING } from '../config/upgrades';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import { growthLevers } from '../game/growth';
import { BreakerSystem } from '../game/BreakerSystem';
import { createCelestial, createIdGenerator, type Celestial } from '../game/entities';
import { ChainLightningSystem } from '../game/gimmicks/ChainLightningSystem';
import { CometSystem } from '../game/gimmicks/CometSystem';
import { GoldenSystem } from '../game/gimmicks/GoldenSystem';
import { LaserSystem } from '../game/gimmicks/LaserSystem';
import { MoonSystem } from '../game/gimmicks/MoonSystem';
import { OrbSystem } from '../game/gimmicks/OrbSystem';
import { RadioactiveSystem } from '../game/gimmicks/RadioactiveSystem';
import { SupernovaSystem } from '../game/gimmicks/SupernovaSystem';
import { GravitySystem } from '../game/GravitySystem';
import { RespawnSystem } from '../game/RespawnSystem';
import { SessionDirector } from '../game/SessionDirector';
import { SpawnSystem } from '../game/SpawnSystem';
import { BuffSystem } from '../game/upgrades/BuffSystem';
import { deriveStats, type DerivedStats } from '../game/upgrades/StatEngine';
import {
  isTierSpawnable,
  tierDamageMultiplier,
  tierMatterMultiplier,
  tierWeightMultiplier,
} from '../game/upgrades/tierScaling';
import { GameState } from '../state/GameState';
import { JUICE } from '../config/juice';
import { HitStopClock } from '../game/juiceMath';
import { VISUAL } from '../config/visual';
import { EntityViewSystem } from '../render/EntityViewSystem';
import { FloatingTextPool } from '../render/FloatingTextPool';
import { JuiceSystem } from '../render/JuiceSystem';
import { LaserRenderer } from '../render/LaserRenderer';
import { LightningRenderer } from '../render/LightningRenderer';
import { ParticlePool } from '../render/particleSimulation';
import { ParticleRenderer } from '../render/ParticleRenderer';
import { Renderer, type Viewport } from '../render/Renderer';
import { Starfield } from '../render/Starfield';
import { TextureFactory } from '../render/TextureFactory';
import type { DebugHooks } from '../ui/debugPanel';

export class SessionScene extends Phaser.Scene {
  private readonly entities: Celestial[] = [];
  private spawnSystem!: SpawnSystem;
  private gravitySystem!: GravitySystem;
  private breakerSystem!: BreakerSystem;
  private director!: SessionDirector;
  private gameRenderer!: Renderer;
  private starfield!: Starfield;
  private textureFactory!: TextureFactory;
  private entityViews!: EntityViewSystem;
  private particlePool!: ParticlePool;
  private particleRenderer!: ParticleRenderer;
  private lightningRenderer!: LightningRenderer;
  private laserRenderer!: LaserRenderer;
  private hitStop!: HitStopClock;
  private floatingTexts!: FloatingTextPool;
  private levers: GrowthStage = GROWTH_STAGES[0];
  // Eased camera scales that chase the discrete growth-stage targets so the view zoom glides instead of snapping.
  private smoothedViewScale = GROWTH_STAGES[0].viewScale;
  private smoothedHorizonScale = GROWTH_STAGES[0].horizonScale;
  private stats!: DerivedStats;
  private readonly buffSystem = new BuffSystem();
  private chainLightning!: ChainLightningSystem;
  private radioactiveSystem!: RadioactiveSystem;
  private supernovaSystem!: SupernovaSystem;
  private moonSystem!: MoonSystem;
  private cometSystem!: CometSystem;
  private laserSystem!: LaserSystem;
  private orbSystem!: OrbSystem;
  // Tracks the Breaker's world position every frame so satellites can orbit it even when EntityViewSystem was constructed earlier.
  private pointerWorld: { x: number; y: number } | null = null;
  private lastPurchaseCount = -1;
  // Promoted from a create() local so debugHooks().spawnStorm can mint ids matching SpawnSystem's sequence.
  private nextId!: () => number;
  // Guards debugHooksOrNull() against F2 hits before create() has initialized the systems debugHooks() reads.
  private created = false;
  // Debug toggle: pauses gravity/drift so a tester can break entities without them sliding into the horizon.
  private driftFrozen = false;
  // Debug toggle: pauses the session countdown so a tester can spawn/break/observe indefinitely without the session ending.
  private timerFrozen = false;

  constructor(
    private readonly bus: EventBus<GameEvents>,
    private readonly gameState: GameState,
  ) {
    super('session');
  }

  create(): void {
    this.refreshStats();
    this.nextId = createIdGenerator();
    this.spawnSystem = new SpawnSystem(
      SESSION_CONFIG,
      Math.random,
      this.nextId,
      () => this.stats.electricSpawnChance,
      () => this.stats.goldenSpawnChance,
      () => this.stats.radioactiveSpawnChance,
      () => this.stats.moonSpawnChance,
      () => this.stats.laserSpawnChance,
      (tierId) => isTierSpawnable(tierId, this.stats.flags),
      (tierId) => tierWeightMultiplier(tierId, this.stats),
      // Total density lever: upgrade-ladder mult times the current mass stage's baseline boost.
      () => this.stats.spawnRateMult * stageForMass(this.gameState.currentMass).spawnRateMult,
      // Sustained field target: upgrade ladder plus the stage floor, mirroring how the initial seed composes.
      () => this.stats.fieldTarget + stageForMass(this.gameState.currentMass).initialSpawnBonus,
    );
    new RespawnSystem(
      this.bus,
      Math.random,
      () => ({
        spawnOnKill: this.stats.spawnOnKillChance,
        planetRespawn: this.stats.planetRespawnChance,
        starRespawn: this.stats.starRespawnChance,
      }),
      (category) => this.spawnSystem.queueRespawn(category),
    );
    this.gravitySystem = new GravitySystem(this.bus, (tierId) => tierMatterMultiplier(tierId, this.stats));
    this.breakerSystem = new BreakerSystem(
      this.bus,
      () => this.stats,
      (tierId) => tierMatterMultiplier(tierId, this.stats),
      Math.random,
      (tierId) => tierDamageMultiplier(tierId, this.stats),
    );
    this.director = new SessionDirector(this.bus);
    // Chance-based bonus time on manual breaker kills, rolled per kill against the upgrade-derived chance.
    this.bus.on('objectBroken', ({ source }) => {
      if (source === 'breaker' && Math.random() < this.stats.sessionTimeOnKillChance) {
        const applied = this.director.addTime(UPGRADE_TUNING.sessionTimeOnKillSeconds);
        if (applied > 0) this.bus.emit('sessionTimeAdded', { seconds: applied });
      }
    });
    this.gameRenderer = new Renderer(this);
    const redrawStarfield = (): void => {
      const viewport = this.currentViewport();
      this.starfield.redraw(
        this.scale.width,
        this.scale.height,
        viewport.horizonWorldRadius * viewport.worldScale,
      );
    };
    this.starfield = new Starfield(this);
    redrawStarfield();
    this.scale.on('resize', redrawStarfield);
    this.textureFactory = new TextureFactory(this);
    this.textureFactory.pregenerate();
    this.particlePool = new ParticlePool(VISUAL.particles.poolSize, VISUAL.particles, Math.random);
    this.particleRenderer = new ParticleRenderer(this, VISUAL.particles.poolSize);
    this.lightningRenderer = new LightningRenderer(this, this.bus);
    this.radioactiveSystem = new RadioactiveSystem(this.bus, this.entities, () => this.stats.radioactiveDotMult);
    this.supernovaSystem = new SupernovaSystem(
      this.bus,
      this.entities,
      () => this.stats.flags.has('supernova'),
      () => this.stats.starDamageMult,
      () => this.stats.supernovaRadiusMult,
    );
    this.moonSystem = new MoonSystem(
      this.bus,
      (effects, durationSeconds) => {
        // Same 'moon' source for every capture: 'stack' policy still pushes independent-expiry entries, and one clear('moon') wipes them all on session start.
        this.buffSystem.grant('moon', effects, durationSeconds, 'stack');
        this.refreshStats();
      },
      () => this.stats.moonDurationMult,
      () => this.stats.moonCapBonus,
    );
    this.cometSystem = new CometSystem(
      this.bus,
      this.entities,
      this.nextId,
      () => this.stats.flags.has('comets'),
      () => this.stats.cometShowerChance,
      (effects, durationSeconds) => {
        this.buffSystem.grant('comet', effects, durationSeconds, 'refresh');
        this.refreshStats();
      },
    );
    this.entityViews = new EntityViewSystem(
      this,
      this.textureFactory,
      this.bus,
      this.particlePool,
      () => this.radioactiveSystem.activeZones,
      () => this.supernovaSystem.activeBursts,
      () => this.moonSystem.satellites,
      () => this.pointerWorld,
      () => this.orbSystem.orbs,
    );
    this.hitStop = new HitStopClock(JUICE.hitStop.timeScale);
    this.floatingTexts = new FloatingTextPool(this);
    new JuiceSystem(this, this.bus, this.particlePool, this.floatingTexts, this.hitStop, () =>
      this.currentViewport(),
    );
    this.chainLightning = new ChainLightningSystem(
      this.bus,
      this.entities,
      () => ({
        chainCount: this.stats.chainCount,
        damagePerHop: Math.round(this.stats.damagePerTick * this.stats.chainDamageMult),
        critChance: this.stats.chainCritChance,
        critDamageMult: this.stats.chainCritDamageMult,
        rangeWorldUnits: this.stats.chainRangeWorldUnits,
        forkChance: this.stats.chainForkChance,
      }),
      (tierId) => tierMatterMultiplier(tierId, this.stats),
    );
    // No update() needed - it reacts synchronously to objectBroken, unlike ChainLightningSystem which defers.
    new GoldenSystem(this.bus, () => this.stats.goldenValueMult);
    this.laserSystem = new LaserSystem(
      this.bus,
      this.entities,
      () => ({
        damage: this.stats.laserDamage,
        widthMult: this.stats.laserWidthMult,
        critChance: this.stats.laserCritChance,
        critDamageMult: this.stats.laserCritDamageMult,
      }),
      (tierId) => tierMatterMultiplier(tierId, this.stats),
    );
    this.laserRenderer = new LaserRenderer(this, () => this.laserSystem.blasts);
    this.orbSystem = new OrbSystem(
      this.bus,
      this.entities,
      () => ({
        enabled: this.stats.flags.has('orbs'),
        chance: this.stats.orbChance,
        damage: this.stats.orbDamage,
        bounces: this.stats.orbBounces,
        critChance: this.stats.orbCritChance,
        critDamageMult: this.stats.orbCritDamageMult,
      }),
      (tierId) => tierMatterMultiplier(tierId, this.stats),
    );
    this.levers = growthLevers(this.gameState.snapshot().mass, GROWTH_STAGES);
    // Start the eased scales at the restored stage so a loaded high-mass save doesn't zoom in from stage 0.
    this.smoothedViewScale = this.levers.viewScale;
    this.smoothedHorizonScale = this.levers.horizonScale;
    this.lastPurchaseCount = this.gameState.snapshot().purchasedNodes.length;
    this.gameState.subscribe((snapshot) => {
      const nextLevers = growthLevers(snapshot.mass, GROWTH_STAGES);
      if (nextLevers !== this.levers) {
        this.levers = nextLevers;
        redrawStarfield();
      }
      // Only re-derive stats when the purchased set actually changed - not on every matter/mass notification (e.g. every kill at late-game rates).
      if (snapshot.purchasedNodes.length !== this.lastPurchaseCount) {
        this.lastPurchaseCount = snapshot.purchasedNodes.length;
        this.refreshStats();
      }
    });
    this.created = true;
  }

  private refreshStats(): void {
    this.stats = deriveStats(
      new Set(this.gameState.snapshot().purchasedNodes),
      this.buffSystem.effectLayers(),
    );
  }

  beginSession(): void {
    this.entities.length = 0;
    // Clear every transient gimmick's in-flight state so nothing from the prior run bleeds into this one (satellites, zones, bursts, pending chains, moon buffs, comet flybys).
    this.moonSystem.reset();
    this.radioactiveSystem.reset();
    this.supernovaSystem.reset();
    this.chainLightning.reset();
    this.cometSystem.reset();
    this.laserSystem.reset();
    this.orbSystem.reset();
    this.spawnSystem.reset();
    // Re-derive so a satellite/comet buff cleared here doesn't linger in this.stats until the next expiry/purchase.
    const clearedMoon = this.buffSystem.clear('moon');
    const clearedComet = this.buffSystem.clear('comet');
    if (clearedMoon || clearedComet) this.refreshStats();
    // Pre-populate the field: upgrade-bought seeds plus the stage's baseline, so late-game sessions open into mayhem.
    const stageFloor = stageForMass(this.gameState.currentMass);
    this.spawnSystem.seedInitialField(
      SESSION_CONFIG.baseInitialSpawn + this.stats.initialSpawnCount + stageFloor.initialSpawnBonus,
      this.entities,
      this.currentViewport().spawnFieldRadius,
    );
    this.director.start(this.stats.sessionDurationSeconds);
  }

  update(_time: number, deltaMs: number): void {
    const realDeltaSeconds = deltaMs / 1000;
    const gameDeltaSeconds = this.hitStop.scale(realDeltaSeconds);
    // Ease the camera scales toward the current stage on real time (not hit-stop) so growth-stage flips glide instead of jumping.
    const zoomEase = 1 - Math.exp(-VISUAL.cameraZoomSmoothingPerSecond * realDeltaSeconds);
    this.smoothedViewScale += (this.levers.viewScale - this.smoothedViewScale) * zoomEase;
    this.smoothedHorizonScale += (this.levers.horizonScale - this.smoothedHorizonScale) * zoomEase;
    const viewport = this.currentViewport();
    const pointer = {
      x: (this.input.activePointer.x - viewport.centerX) / viewport.worldScale,
      y: (this.input.activePointer.y - viewport.centerY) / viewport.worldScale,
    };
    this.pointerWorld = pointer;
    this.starfield.update(realDeltaSeconds);
    // Satellites advance/expire every frame in lockstep with their buffs, even while the session-end overlay is up, so none bleed into the next session.
    this.moonSystem.update(gameDeltaSeconds);
    if (this.buffSystem.update(gameDeltaSeconds)) this.refreshStats();
    if (this.director.running) {
      this.breakerSystem.setPointer(pointer.x, pointer.y);
      this.spawnSystem.update(
        gameDeltaSeconds,
        this.director.progress,
        this.entities,
        viewport.spawnFieldRadius,
      );
      this.breakerSystem.update(gameDeltaSeconds, this.entities);
      this.chainLightning.update();
      this.radioactiveSystem.update(gameDeltaSeconds);
      this.supernovaSystem.update(gameDeltaSeconds);
      this.laserSystem.update(gameDeltaSeconds);
      this.orbSystem.update(gameDeltaSeconds);
      // Comets only fly mid-session - they must not streak through while the session-end overlay is up.
      this.cometSystem.update(gameDeltaSeconds, viewport.spawnFieldRadius);
      // Debug freeze: skip drift/consumption while frozen so entities stay put for break testing.
      if (!this.driftFrozen) this.gravitySystem.update(gameDeltaSeconds, this.entities, viewport.horizonWorldRadius);
    }
    // Debug freeze: skip the countdown while frozen so the session can't end during open-ended testing.
    if (!this.timerFrozen) this.director.update(gameDeltaSeconds);
    this.particlePool.update(gameDeltaSeconds, viewport.horizonWorldRadius);
    this.entityViews.update(this.entities, viewport, this.time.now, gameDeltaSeconds);
    this.particleRenderer.update(this.particlePool, viewport);
    this.lightningRenderer.update(gameDeltaSeconds, viewport);
    this.laserRenderer.update(viewport);
    this.floatingTexts.update(realDeltaSeconds);
    this.gameRenderer.draw(
      pointer,
      viewport,
      this.director.running,
      gameDeltaSeconds,
      this.breakerSystem.tickProgress,
      this.stats.breakerRadius,
    );
  }

  private currentViewport(): Viewport {
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;
    const worldScale = (Math.min(centerX, centerY) / SESSION_CONFIG.spawnRadius) * this.smoothedViewScale;
    const horizonWorldRadius = SESSION_CONFIG.horizonRadius * this.smoothedHorizonScale;
    // Distance from center to the screen corner in world units: a disc this size circumscribes the visible rect, so entities fill the whole screen including corners.
    // Constrain the spawn field to the SHORTER viewport axis (height in landscape) so entities never spawn off-screen; the game is played in landscape on every device.
    const spawnFieldRadius = Math.min(centerX, centerY) / worldScale;
    return { centerX, centerY, worldScale, horizonWorldRadius, spawnFieldRadius };
  }

  // Same weighted-random tier pick SpawnSystem uses internally, duplicated here since it's private there.
  private pickStormTier(): CelestialTierId {
    const weighted = Object.entries(SESSION_CONFIG.tierWeights) as [CelestialTierId, number][];
    const totalWeight = weighted.reduce((sum, [, weight]) => sum + weight, 0);
    let roll = Math.random() * totalWeight;
    for (const [tierId, weight] of weighted) {
      roll -= weight;
      if (roll <= 0) return tierId;
    }
    return weighted[weighted.length - 1][0];
  }

  // Null until create() runs so an early F2 press can't touch uninitialized systems.
  debugHooksOrNull(): DebugHooks | null {
    return this.created ? this.debugHooks() : null;
  }

  debugHooks(): DebugHooks {
    return {
      spawnStorm: (count: number): void => {
        // Storm spawns in the outer field (not next to the hole) so entities persist long enough to test large breaks.
        const minRadius = SESSION_CONFIG.spawnRadius * 0.55;
        for (let i = 0; i < count; i++) {
          const tierId = this.pickStormTier();
          const radius = minRadius + Math.random() * (SESSION_CONFIG.spawnRadius - minRadius);
          const angle = Math.random() * Math.PI * 2;
          this.entities.push(createCelestial(tierId, radius, angle, this.nextId()));
        }
      },
      setSessionTimer: (seconds: number): void => {
        this.director.setRemaining(seconds);
      },
      applyDebugBuff: (effects): void => {
        this.buffSystem.grant('debug', effects, 99999, 'refresh');
        this.refreshStats();
      },
      clearDebugBuff: (): void => {
        if (this.buffSystem.clear('debug')) this.refreshStats();
      },
      setDriftFrozen: (frozen: boolean): void => {
        this.driftFrozen = frozen;
      },
      setTimerFrozen: (frozen: boolean): void => {
        this.timerFrozen = frozen;
      },
      fps: (): number => this.game.loop.actualFps,
    };
  }
}
