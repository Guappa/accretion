import Phaser from 'phaser';
import { CELESTIAL_TIERS, type CelestialTierId } from '../config/celestials';
import { JUICE, type BurstRecipe } from '../config/juice';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import { burstCount, clampOutsideRadius, shakeIntensity, type HitStopClock } from '../game/juiceMath';
import type { ParticlePool } from './particleSimulation';
import type { FloatingTextPool } from './FloatingTextPool';
import type { Viewport } from './Renderer';

export class JuiceSystem {
  constructor(
    private readonly scene: Phaser.Scene,
    bus: EventBus<GameEvents>,
    private readonly particlePool: ParticlePool,
    private readonly floatingTexts: FloatingTextPool,
    private readonly hitStop: HitStopClock,
    private readonly getViewport: () => Viewport,
  ) {
    bus.on('objectBroken', ({ tierId, value, x, y }) => this.onBreak(tierId, value, x, y));
    bus.on('matterConsumed', ({ tierId, value, x, y }) => this.onConsume(tierId, value, x, y));
    bus.on('critLanded', () =>
      this.scene.cameras.main.shake(JUICE.critShake.durationMs, JUICE.critShake.intensity),
    );
    bus.on('sessionEnded', () => {
      const flash = JUICE.sessionEndFlash;
      this.scene.cameras.main.flash(flash.durationMs, flash.red, flash.green, flash.blue);
    });
  }

  private onBreak(tierId: CelestialTierId, value: number, x: number, y: number): void {
    this.burst(JUICE.breakBurst, tierId, value, x, y);
    this.spawnValueText(value, x, y);
    const intensity = shakeIntensity(JUICE.breakShake, value);
    if (intensity !== null) this.scene.cameras.main.shake(JUICE.breakShake.durationMs, intensity);
    if (value >= JUICE.hitStop.valueThreshold) this.hitStop.trigger(JUICE.hitStop.durationSeconds);
  }

  private onConsume(tierId: CelestialTierId, value: number, x: number, y: number): void {
    // Consumed matter reports a position at/inside the absorb radius; push the burst just outside it so particles get rendered frames before the pool despawns them.
    const horizonWorldRadius = this.getViewport().horizonWorldRadius;
    const spawnPoint = clampOutsideRadius(x, y, horizonWorldRadius * 1.06);
    this.burst(JUICE.consumeBurst, tierId, value, spawnPoint.x, spawnPoint.y);
    this.spawnValueText(value, spawnPoint.x, spawnPoint.y);
  }

  private burst(recipe: BurstRecipe, tierId: CelestialTierId, value: number, x: number, y: number): void {
    this.particlePool.spawn({
      x,
      y,
      count: burstCount(recipe, value),
      speedMin: recipe.speedMin,
      speedMax: recipe.speedMax,
      lifeSeconds: recipe.lifeSeconds,
      sizeWorldMin: recipe.sizeWorldMin,
      sizeWorldMax: recipe.sizeWorldMax,
      tint: CELESTIAL_TIERS[tierId].color,
      stretch: 1,
      aim: 'scatter',
    });
  }

  private spawnValueText(value: number, worldX: number, worldY: number): void {
    if (value < JUICE.floatingText.minValue) return;
    const viewport = this.getViewport();
    this.floatingTexts.spawn(
      viewport.centerX + worldX * viewport.worldScale,
      viewport.centerY + worldY * viewport.worldScale,
      `+${value}`,
    );
  }
}
