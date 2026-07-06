import Phaser from 'phaser';
import { CELESTIAL_TIERS } from '../config/celestials';
import { JUICE } from '../config/juice';
import { VISUAL } from '../config/visual';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import { celestialHitRadius, celestialPosition, celestialVelocity, type Celestial } from '../game/entities';
import { MOON } from '../config/moon';
import { RADIOACTIVE } from '../config/radioactive';
import { SUPERNOVA } from '../config/supernova';
import type { FalloutZone } from '../game/gimmicks/RadioactiveSystem';
import type { Satellite } from '../game/gimmicks/MoonSystem';
import type { SupernovaBurst } from '../game/gimmicks/SupernovaSystem';
import { deterministicUnit } from '../game/random';
import type { ParticlePool } from './particleSimulation';
import type { TextureFactory } from './TextureFactory';
import type { Viewport } from './Renderer';
import {
  consumptionScale,
  spaghettificationProximity,
  spaghettificationStretch,
} from './spaghettification';

interface CelestialView {
  sprite: Phaser.GameObjects.Image;
  shade: Phaser.GameObjects.Image;
  crack: Phaser.GameObjects.Image | null;
  flashUntilMs: number;
  textureKey: string;
  streakAccumulator: number;
}

export class EntityViewSystem {
  private readonly views = new Map<number, CelestialView>();
  private readonly freeViews: CelestialView[] = [];
  private readonly healthBars: Phaser.GameObjects.Graphics;
  private readonly electricRings: Phaser.GameObjects.Graphics;
  private readonly goldenGlow: Phaser.GameObjects.Graphics;
  private readonly radioactiveGlow: Phaser.GameObjects.Graphics;
  private readonly radioactiveFallout: Phaser.GameObjects.Graphics;
  private readonly supernovaBursts: Phaser.GameObjects.Graphics;
  private readonly moonGlow: Phaser.GameObjects.Graphics;
  private readonly laserGlow: Phaser.GameObjects.Graphics;
  private readonly satelliteViews: Phaser.GameObjects.Graphics;
  private readonly cometTails: Phaser.GameObjects.Graphics;
  private readonly cometGlow: Phaser.GameObjects.Graphics;
  private readonly orbViews: Phaser.GameObjects.Graphics;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly textureFactory: TextureFactory,
    bus: EventBus<GameEvents>,
    private readonly particlePool: ParticlePool,
    private readonly getFalloutZones: () => readonly FalloutZone[] = () => [],
    private readonly getSupernovaBursts: () => readonly SupernovaBurst[] = () => [],
    private readonly getSatellites: () => readonly Satellite[] = () => [],
    private readonly getBreakerPointerWorld: () => { x: number; y: number } | null = () => null,
    private readonly getOrbs: () => readonly { x: number; y: number }[] = () => [],
  ) {
    this.healthBars = scene.add.graphics().setDepth(VISUAL.depths.healthBars);
    this.electricRings = scene.add.graphics().setDepth(VISUAL.depths.lightning);
    this.goldenGlow = scene.add.graphics().setDepth(VISUAL.depths.goldenGlow);
    this.radioactiveGlow = scene.add.graphics().setDepth(VISUAL.depths.radioactiveGlow);
    this.radioactiveFallout = scene.add.graphics().setDepth(VISUAL.depths.radioactiveFallout);
    this.supernovaBursts = scene.add.graphics().setDepth(VISUAL.depths.supernova);
    this.moonGlow = scene.add.graphics().setDepth(VISUAL.depths.moonGlow);
    this.laserGlow = scene.add.graphics().setDepth(VISUAL.depths.laser);
    this.satelliteViews = scene.add.graphics().setDepth(VISUAL.depths.satellites);
    // Tail sits UNDER the comet body; the head glow shares the affix-glow depth so it reads over the sprite like golden/radioactive.
    this.cometTails = scene.add.graphics().setDepth(VISUAL.depths.cometTail);
    this.cometGlow = scene.add.graphics().setDepth(VISUAL.depths.goldenGlow);
    this.orbViews = scene.add.graphics().setDepth(VISUAL.depths.orbs);
    bus.on('entityDamaged', ({ id }) => {
      const view = this.views.get(id);
      if (view) view.flashUntilMs = scene.time.now + VISUAL.hitFlash.durationSeconds * 1000;
    });
  }

  update(entities: Celestial[], viewport: Viewport, nowMs: number, deltaSeconds: number): void {
    const liveIds = new Set<number>();
    this.healthBars.clear();
    this.electricRings.clear();
    this.goldenGlow.clear();
    this.radioactiveGlow.clear();
    this.radioactiveFallout.clear();
    this.supernovaBursts.clear();
    this.moonGlow.clear();
    this.laserGlow.clear();
    this.satelliteViews.clear();
    this.cometTails.clear();
    this.cometGlow.clear();
    this.orbViews.clear();
    for (const entity of entities) {
      liveIds.add(entity.id);
      const view = this.views.get(entity.id) ?? this.createView(entity);
      this.syncView(entity, view, viewport, nowMs, deltaSeconds);
    }
    for (const [id, view] of this.views) {
      if (liveIds.has(id)) continue;
      view.sprite.setVisible(false);
      view.shade.setVisible(false);
      view.crack?.setVisible(false);
      this.freeViews.push(view);
      this.views.delete(id);
    }
    this.drawFalloutZones(viewport);
    this.drawSupernovaBursts(viewport);
    this.drawSatellites(viewport);
    this.drawOrbs(viewport, nowMs);
  }

  private createView(entity: Celestial): CelestialView {
    const textureKey = this.textureFactory.ensureCelestialTexture(entity);
    const pooled = this.freeViews.pop();
    if (pooled) {
      pooled.textureKey = textureKey;
      pooled.flashUntilMs = 0;
      pooled.streakAccumulator = 0;
      pooled.sprite.setTexture(textureKey).setVisible(true);
      pooled.shade.setVisible(true);
      this.views.set(entity.id, pooled);
      return pooled;
    }
    const sprite = this.scene.add.image(0, 0, textureKey).setDepth(VISUAL.depths.celestials);
    const shade = this.scene.add
      .image(0, 0, this.textureFactory.shadeTextureKey())
      .setDepth(VISUAL.depths.shading);
    const view = { sprite, shade, crack: null, flashUntilMs: 0, textureKey, streakAccumulator: 0 };
    this.views.set(entity.id, view);
    return view;
  }

  private syncView(
    entity: Celestial,
    view: CelestialView,
    viewport: Viewport,
    nowMs: number,
    deltaSeconds: number,
  ): void {
    const { x, y } = celestialPosition(entity);
    const screenX = viewport.centerX + x * viewport.worldScale;
    const screenY = viewport.centerY + y * viewport.worldScale;
    const settings = VISUAL.spaghettification;
    const proximity = spaghettificationProximity(
      entity.orbitRadius,
      viewport.horizonWorldRadius,
      settings.zoneWorldUnits,
    );
    const stretch = spaghettificationStretch(proximity, settings.maxStretch);
    const scale = consumptionScale(proximity, settings.minScale, settings.scaleExponent);
    const diameterPx = celestialHitRadius(entity) * 2 * viewport.worldScale * scale;

    if (proximity > 0) {
      const streaks = JUICE.streaks;
      view.streakAccumulator += deltaSeconds * proximity * entity.sizeScale * streaks.emitPerSecondAtMax;
      while (view.streakAccumulator >= 1) {
        view.streakAccumulator -= 1;
        this.particlePool.spawn({
          x,
          y,
          count: 1,
          speedMin: streaks.speedMin,
          speedMax: streaks.speedMax,
          lifeSeconds: streaks.lifeSeconds,
          sizeWorldMin: streaks.sizeWorldMin,
          sizeWorldMax: streaks.sizeWorldMax,
          tint: CELESTIAL_TIERS[entity.tierId].color,
          stretch: streaks.stretch,
          aim: 'inward',
        });
      }
    }

    view.sprite.setPosition(screenX, screenY);
    // Sprite local x points along the radial axis (rotation = orbitAngle), so width is the stretch axis.
    view.sprite.setRotation(entity.orbitAngle);
    view.sprite.setDisplaySize(diameterPx * stretch, diameterPx / stretch);
    view.shade
      .setPosition(screenX, screenY)
      .setRotation(entity.orbitAngle)
      .setDisplaySize(diameterPx * stretch, diameterPx / stretch);
    if (nowMs < view.flashUntilMs) view.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    else view.sprite.clearTint();

    const hpFraction = entity.hp / CELESTIAL_TIERS[entity.tierId].hp;
    const stageIndex = crackStageIndex(hpFraction);
    if (stageIndex === null) {
      view.crack?.setVisible(false);
    } else {
      view.crack ??= this.scene.add
        .image(0, 0, this.textureFactory.crackTextureKey(entity.tierId, stageIndex))
        .setDepth(VISUAL.depths.cracks);
      view.crack
        .setVisible(true)
        .setTexture(this.textureFactory.crackTextureKey(entity.tierId, stageIndex))
        .setPosition(screenX, screenY)
        .setRotation(entity.orbitAngle)
        .setDisplaySize(diameterPx * stretch, diameterPx / stretch);
    }

    if (hpFraction < 1) this.drawHealthBar(screenX, screenY, diameterPx, hpFraction);
    if (entity.tierId === 'comet') this.drawCometTrail(entity, screenX, screenY, scale, viewport, nowMs);
    if (entity.affix === 'electric') this.drawElectricRing(entity, screenX, screenY, scale, viewport, nowMs);
    if (entity.affix === 'golden') this.drawGoldenGlow(entity, screenX, screenY, scale, viewport, nowMs);
    if (entity.affix === 'radioactive') this.drawRadioactiveGlow(entity, screenX, screenY, scale, viewport, nowMs);
    if (entity.affix === 'moon') this.drawMoonGlow(entity, screenX, screenY, scale, viewport, nowMs);
    if (entity.affix === 'laser') this.drawLaserGlow(screenX, screenY, viewport);
  }

  // Laser stars keep their warm mount glow so an armed star reads as special before it ever fires.
  private drawLaserGlow(screenX: number, screenY: number, viewport: Viewport): void {
    const laser = VISUAL.laser;
    this.laserGlow.fillStyle(laser.mountGlowColor, laser.mountGlowAlpha);
    this.laserGlow.fillCircle(screenX, screenY, laser.mountGlowRadiusWorldUnits * viewport.worldScale);
  }

  private drawFalloutZones(viewport: Viewport): void {
    const fallout = VISUAL.radioactiveFallout;
    const radiusPx = RADIOACTIVE.falloutRadiusWorldUnits * viewport.worldScale;
    for (const zone of this.getFalloutZones()) {
      const screenX = viewport.centerX + zone.x * viewport.worldScale;
      const screenY = viewport.centerY + zone.y * viewport.worldScale;
      const fade = Math.max(zone.remaining / RADIOACTIVE.durationSeconds, 0);
      this.radioactiveFallout.fillStyle(fallout.color, fallout.alpha * fade);
      this.radioactiveFallout.fillCircle(screenX, screenY, radiusPx);
    }
  }

  private drawSupernovaBursts(viewport: Viewport): void {
    const supernova = VISUAL.supernova;
    for (const burst of this.getSupernovaBursts()) {
      const progress = Math.min(burst.elapsed / SUPERNOVA.expandSeconds, 1);
      const fade = 1 - progress;
      const screenX = viewport.centerX + burst.x * viewport.worldScale;
      const screenY = viewport.centerY + burst.y * viewport.worldScale;
      const radiusPx = burst.radiusWorldUnits * progress * viewport.worldScale;
      this.supernovaBursts.fillStyle(supernova.glowColor, supernova.glowAlpha * fade);
      this.supernovaBursts.fillCircle(screenX, screenY, radiusPx);
      this.supernovaBursts.lineStyle(supernova.ringWidthPx, supernova.ringColor, supernova.ringAlpha * fade);
      this.supernovaBursts.strokeCircle(screenX, screenY, radiusPx);
    }
  }

  private drawRadioactiveGlow(
    entity: Celestial,
    screenX: number,
    screenY: number,
    scale: number,
    viewport: Viewport,
    nowMs: number,
  ): void {
    const rad = VISUAL.radioactive;
    const hitRadiusPx = celestialHitRadius(entity) * scale * viewport.worldScale;
    const pulse = rad.alphaBase + rad.alphaPulse * Math.sin((nowMs / 1000) * Math.PI * 2 * rad.pulseHz);
    this.radioactiveGlow.fillStyle(rad.glowColor, rad.glowAlpha * pulse);
    this.radioactiveGlow.fillCircle(screenX, screenY, hitRadiusPx * rad.glowRadiusMult);
    const ringRadiusPx = hitRadiusPx + rad.ringExtraWorldUnits * viewport.worldScale;
    this.radioactiveGlow.lineStyle(rad.ringWidthPx, rad.ringColor, pulse);
    this.radioactiveGlow.strokeCircle(screenX, screenY, ringRadiusPx);
  }

  private drawGoldenGlow(
    entity: Celestial,
    screenX: number,
    screenY: number,
    scale: number,
    viewport: Viewport,
    nowMs: number,
  ): void {
    const gold = VISUAL.golden;
    const hitRadiusPx = celestialHitRadius(entity) * scale * viewport.worldScale;
    const pulse = gold.alphaBase + gold.alphaPulse * Math.sin((nowMs / 1000) * Math.PI * 2 * gold.pulseHz);
    this.goldenGlow.fillStyle(gold.glowColor, gold.glowAlpha * pulse);
    this.goldenGlow.fillCircle(screenX, screenY, hitRadiusPx * gold.glowRadiusMult);
    const ringRadiusPx = hitRadiusPx + gold.ringExtraWorldUnits * viewport.worldScale;
    this.goldenGlow.lineStyle(gold.ringWidthPx, gold.ringColor, pulse);
    this.goldenGlow.strokeCircle(screenX, screenY, ringRadiusPx);
  }

  private drawMoonGlow(
    entity: Celestial,
    screenX: number,
    screenY: number,
    scale: number,
    viewport: Viewport,
    nowMs: number,
  ): void {
    const moon = VISUAL.moon;
    const hitRadiusPx = celestialHitRadius(entity) * scale * viewport.worldScale;
    const pulse = moon.alphaBase + moon.alphaPulse * Math.sin((nowMs / 1000) * Math.PI * 2 * moon.pulseHz);
    this.moonGlow.fillStyle(moon.glowColor, moon.glowAlpha * pulse);
    this.moonGlow.fillCircle(screenX, screenY, hitRadiusPx * moon.glowRadiusMult);
    const ringRadiusPx = hitRadiusPx + moon.ringExtraWorldUnits * viewport.worldScale;
    this.moonGlow.lineStyle(moon.ringWidthPx, moon.ringColor, pulse);
    this.moonGlow.strokeCircle(screenX, screenY, ringRadiusPx);
  }

  private drawCometTrail(
    entity: Celestial,
    screenX: number,
    screenY: number,
    scale: number,
    viewport: Viewport,
    nowMs: number,
  ): void {
    const comet = VISUAL.comet;
    const hitRadiusPx = celestialHitRadius(entity) * scale * viewport.worldScale;

    // World->screen is a uniform scale + translate, so the world velocity direction is the screen direction too.
    const velocity = celestialVelocity(entity);
    const speed = Math.hypot(velocity.x, velocity.y);
    if (speed > 0) {
      const directionX = velocity.x / speed;
      const directionY = velocity.y / speed;
      const tail = comet.tail;
      const tailLengthPx = hitRadiusPx * tail.lengthRadiusMult;
      for (let segment = 1; segment <= tail.segments; segment++) {
        const t = segment / tail.segments;
        // Tail extends opposite the motion, tapering and fading toward the tip.
        const tailX = screenX - directionX * tailLengthPx * t;
        const tailY = screenY - directionY * tailLengthPx * t;
        const radiusPx = hitRadiusPx * (tail.startRadiusMult + (tail.endRadiusMult - tail.startRadiusMult) * t);
        const fade = 1 - t;
        this.cometTails.fillStyle(tail.color, tail.startAlpha * fade);
        this.cometTails.fillCircle(tailX, tailY, radiusPx);
        this.cometTails.fillStyle(tail.innerColor, tail.innerAlpha * fade);
        this.cometTails.fillCircle(tailX, tailY, radiusPx * tail.innerRadiusMult);
      }
    }

    const pulse = comet.alphaBase + comet.alphaPulse * Math.sin((nowMs / 1000) * Math.PI * 2 * comet.pulseHz);
    this.cometGlow.fillStyle(comet.glowColor, comet.glowAlpha * pulse);
    this.cometGlow.fillCircle(screenX, screenY, hitRadiusPx * comet.glowRadiusMult);
  }

  private drawSatellites(viewport: Viewport): void {
    const pointer = this.getBreakerPointerWorld();
    if (!pointer) return;
    const satellite = VISUAL.satellite;
    const pointerScreenX = viewport.centerX + pointer.x * viewport.worldScale;
    const pointerScreenY = viewport.centerY + pointer.y * viewport.worldScale;
    const orbitRadiusPx = MOON.orbitRadiusWorldUnits * viewport.worldScale;
    for (const moon of this.getSatellites()) {
      const screenX = pointerScreenX + Math.cos(moon.angle) * orbitRadiusPx;
      const screenY = pointerScreenY + Math.sin(moon.angle) * orbitRadiusPx;
      this.satelliteViews.fillStyle(satellite.glowColor, satellite.glowAlpha);
      this.satelliteViews.fillCircle(screenX, screenY, satellite.radiusPx * satellite.glowRadiusMult);
      this.satelliteViews.fillStyle(satellite.color, 1);
      this.satelliteViews.fillCircle(screenX, screenY, satellite.radiusPx);
    }
  }

  private drawOrbs(viewport: Viewport, nowMs: number): void {
    const orb = VISUAL.orb;
    const pulse = orb.alphaBase + orb.alphaPulse * Math.sin((nowMs / 1000) * Math.PI * 2 * orb.pulseHz);
    for (const projectile of this.getOrbs()) {
      const screenX = viewport.centerX + projectile.x * viewport.worldScale;
      const screenY = viewport.centerY + projectile.y * viewport.worldScale;
      this.orbViews.fillStyle(orb.glowColor, orb.glowAlpha * pulse);
      this.orbViews.fillCircle(screenX, screenY, orb.radiusPx * orb.glowRadiusMult);
      this.orbViews.fillStyle(orb.color, pulse);
      this.orbViews.fillCircle(screenX, screenY, orb.radiusPx);
    }
  }

  private drawElectricRing(
    entity: Celestial,
    screenX: number,
    screenY: number,
    scale: number,
    viewport: Viewport,
    nowMs: number,
  ): void {
    const ring = VISUAL.lightning.ring;
    const baseRadius = (celestialHitRadius(entity) * scale + ring.spikeWorldUnits) * viewport.worldScale;
    const jitterStep = Math.floor(nowMs / (1000 / ring.jitterHz));
    this.electricRings.lineStyle(
      ring.widthPx,
      ring.color,
      ring.alphaBase + ring.alphaPulse * Math.sin((nowMs / 1000) * Math.PI * 2 * ring.pulseHz),
    );
    this.electricRings.beginPath();
    for (let vertex = 0; vertex < ring.segments; vertex++) {
      const angle = (vertex / ring.segments) * Math.PI * 2;
      // Bidirectional spike so the ring jitters in and out; closePath joins last->first cleanly.
      const spike =
        (deterministicUnit(jitterStep * 7 + vertex * 13 + entity.id * 3) - 0.5) *
        2 *
        ring.spikeWorldUnits *
        viewport.worldScale;
      const radius = baseRadius + spike;
      const x = screenX + Math.cos(angle) * radius;
      const y = screenY + Math.sin(angle) * radius;
      if (vertex === 0) this.electricRings.moveTo(x, y);
      else this.electricRings.lineTo(x, y);
    }
    this.electricRings.closePath();
    this.electricRings.strokePath();
  }

  private drawHealthBar(screenX: number, screenY: number, diameterPx: number, hpFraction: number): void {
    const bar = VISUAL.healthBar;
    const widthPx = diameterPx * bar.widthScale * 0.5;
    const topY = screenY - (diameterPx / 2) * bar.offsetScale;
    this.healthBars.fillStyle(bar.backgroundColor, bar.backgroundAlpha);
    this.healthBars.fillRect(screenX - widthPx / 2, topY, widthPx, bar.heightPx);
    this.healthBars.fillStyle(bar.fillColor, bar.fillAlpha);
    this.healthBars.fillRect(screenX - widthPx / 2, topY, widthPx * hpFraction, bar.heightPx);
  }
}

function crackStageIndex(hpFraction: number): number | null {
  let stage: number | null = null;
  VISUAL.crackStages.forEach((threshold, index) => {
    if (hpFraction <= threshold) stage = index;
  });
  return stage;
}
