import Phaser from 'phaser';
import { VISUAL } from '../config/visual';
import type { ParticlePool } from './particleSimulation';
import type { Viewport } from './Renderer';

const GLOW_TEXTURE_KEY = 'particle-glow';

export class ParticleRenderer {
  private readonly images: Phaser.GameObjects.Image[] = [];

  constructor(scene: Phaser.Scene, capacity: number) {
    ensureGlowTexture(scene);
    for (let slot = 0; slot < capacity; slot++) {
      this.images.push(
        scene.add
          .image(0, 0, GLOW_TEXTURE_KEY)
          .setDepth(VISUAL.depths.particles)
          .setVisible(false),
      );
    }
  }

  update(pool: ParticlePool, viewport: Viewport): void {
    for (let slot = 0; slot < pool.capacity; slot++) {
      const image = this.images[slot];
      if (!pool.active[slot]) {
        if (image.visible) image.setVisible(false);
        continue;
      }
      const screenX = viewport.centerX + pool.x[slot] * viewport.worldScale;
      const screenY = viewport.centerY + pool.y[slot] * viewport.worldScale;
      const sizePx = pool.sizeWorld[slot] * 2 * viewport.worldScale;
      const stretch = pool.stretch[slot];
      image
        .setVisible(true)
        .setPosition(screenX, screenY)
        .setTint(pool.tint[slot])
        .setAlpha(pool.life[slot] / pool.maxLife[slot]);
      if (stretch > 1) {
        image
          .setRotation(Math.atan2(pool.vy[slot], pool.vx[slot]))
          .setDisplaySize(sizePx * stretch, sizePx);
      } else {
        image.setRotation(0).setDisplaySize(sizePx, sizePx);
      }
    }
  }
}

function ensureGlowTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(GLOW_TEXTURE_KEY)) return;
  const sizePx = VISUAL.particles.textureSizePx;
  const canvasTexture = scene.textures.createCanvas(GLOW_TEXTURE_KEY, sizePx, sizePx);
  if (!canvasTexture) return;
  const context = canvasTexture.getContext();
  const center = sizePx / 2;
  const gradient = context.createRadialGradient(center, center, 0, center, center, center);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.35, 'rgba(255, 255, 255, 0.9)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, sizePx, sizePx);
  canvasTexture.refresh();
}
