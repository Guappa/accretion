import Phaser from 'phaser';
import { LASER } from '../config/laser';
import { VISUAL } from '../config/visual';
import type { LaserBlast } from '../game/gimmicks/LaserSystem';
import type { Viewport } from './Renderer';

export class LaserRenderer {
  private readonly graphics: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    private readonly getBlasts: () => readonly LaserBlast[],
  ) {
    this.graphics = scene.add.graphics().setDepth(VISUAL.depths.laser);
  }

  update(viewport: Viewport): void {
    this.graphics.clear();
    const blasts = this.getBlasts();
    if (blasts.length === 0) return;
    const laser = VISUAL.laser;
    // Extend far past the screen bounds both ways so the flash reads as a full-field line, not a segment.
    const reachPx = laser.blastReachWorldUnits * viewport.worldScale;
    for (const blast of blasts) {
      const fade = Math.max(blast.remaining / LASER.blastFadeSeconds, 0);
      const centerX = viewport.centerX + blast.x * viewport.worldScale;
      const centerY = viewport.centerY + blast.y * viewport.worldScale;
      const directionX = Math.cos(blast.angle);
      const directionY = Math.sin(blast.angle);
      const startX = centerX - directionX * reachPx;
      const startY = centerY - directionY * reachPx;
      const endX = centerX + directionX * reachPx;
      const endY = centerY + directionY * reachPx;
      // Two stacked passes: a soft glow under a thin bright core, so the flash reads hot without becoming a slab.
      // Glow widens with the width upgrade so the visual matches the hit corridor.
      this.graphics.lineStyle(laser.glowWidthPx * blast.widthMult, laser.glowColor, laser.glowAlpha * fade);
      this.graphics.lineBetween(startX, startY, endX, endY);
      this.graphics.lineStyle(laser.coreWidthPx, laser.coreColor, laser.coreAlpha * fade);
      this.graphics.lineBetween(startX, startY, endX, endY);
    }
  }
}
