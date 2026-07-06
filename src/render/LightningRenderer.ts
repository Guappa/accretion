import Phaser from 'phaser';
import { VISUAL } from '../config/visual';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import type { Viewport } from './Renderer';

interface BoltSlot {
  active: boolean;
  life: number;
  count: number;
  points: Float32Array;
}

export class LightningRenderer {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly slots: BoltSlot[] = [];

  constructor(
    scene: Phaser.Scene,
    bus: EventBus<GameEvents>,
    private readonly rng: () => number = Math.random,
  ) {
    this.graphics = scene.add.graphics().setDepth(VISUAL.depths.lightning);
    const config = VISUAL.lightning;
    for (let slot = 0; slot < config.poolSize; slot++) {
      this.slots.push({
        active: false,
        life: 0,
        count: 0,
        points: new Float32Array(2 * (config.segmentsMax + 1)),
      });
    }
    bus.on('lightningBolt', ({ fromX, fromY, toX, toY }) => {
      this.spawnBolt(fromX, fromY, toX, toY);
    });
  }

  private spawnBolt(fromX: number, fromY: number, toX: number, toY: number): void {
    const slot = this.slots.find((candidate) => !candidate.active);
    if (!slot) return; // Pool full: drop the bolt rather than allocate.
    const config = VISUAL.lightning;
    const segments =
      config.segmentsMin + Math.floor(this.rng() * (config.segmentsMax - config.segmentsMin + 1));
    const dx = toX - fromX;
    const dy = toY - fromY;
    const length = Math.hypot(dx, dy) || 1;
    const perpX = -dy / length;
    const perpY = dx / length;
    slot.points[0] = fromX;
    slot.points[1] = fromY;
    for (let index = 1; index < segments; index++) {
      const t = index / segments;
      const jitter = (this.rng() - 0.5) * 2 * config.jitterWorldUnits;
      slot.points[index * 2] = fromX + dx * t + perpX * jitter;
      slot.points[index * 2 + 1] = fromY + dy * t + perpY * jitter;
    }
    slot.points[segments * 2] = toX;
    slot.points[segments * 2 + 1] = toY;
    slot.count = segments + 1;
    slot.life = config.boltLifeSeconds;
    slot.active = true;
  }

  update(deltaSeconds: number, viewport: Viewport): void {
    const config = VISUAL.lightning;
    for (const slot of this.slots) {
      if (!slot.active) continue;
      slot.life -= deltaSeconds;
      if (slot.life <= 0) slot.active = false;
    }
    this.graphics.clear();
    for (const slot of this.slots) {
      if (!slot.active) continue;
      this.graphics.lineStyle(config.boltWidthPx, config.boltColor, slot.life / config.boltLifeSeconds);
      this.graphics.beginPath();
      this.graphics.moveTo(
        viewport.centerX + slot.points[0] * viewport.worldScale,
        viewport.centerY + slot.points[1] * viewport.worldScale,
      );
      for (let index = 1; index < slot.count; index++) {
        this.graphics.lineTo(
          viewport.centerX + slot.points[index * 2] * viewport.worldScale,
          viewport.centerY + slot.points[index * 2 + 1] * viewport.worldScale,
        );
      }
      this.graphics.strokePath();
    }
  }
}
