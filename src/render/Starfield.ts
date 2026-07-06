import Phaser from 'phaser';
import { VISUAL } from '../config/visual';
import { deterministicUnit } from '../game/random';
import { haloStreak, lensStar } from './lensing';

export class Starfield {
  private readonly staticGraphics: Phaser.GameObjects.Graphics;
  private readonly lensedGraphics: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.staticGraphics = scene.add.graphics().setDepth(VISUAL.depths.starfield);
    this.lensedGraphics = scene.add.graphics().setDepth(VISUAL.depths.starfield);
  }

  redraw(width: number, height: number, holeRadiusPx: number): void {
    const { starCount, minRadius, maxRadius, minAlpha, maxAlpha, color, lensing } = VISUAL.starfield;
    this.staticGraphics.clear();
    this.lensedGraphics.clear();
    this.lensedGraphics.setPosition(width / 2, height / 2);
    for (let index = 0; index < starCount; index++) {
      const starX = deterministicUnit(index * 3.7) * width;
      const starY = deterministicUnit(index * 9.1) * height;
      const radius = minRadius + deterministicUnit(index * 5.3) * (maxRadius - minRadius);
      const alpha = minAlpha + deterministicUnit(index * 7.9) * (maxAlpha - minAlpha);
      const lensed = lensStar(starX, starY, width / 2, height / 2, holeRadiusPx, lensing);
      if (!lensed.visible) continue;
      if (lensed.arcHalfWidthRadians === 0) {
        this.staticGraphics.fillStyle(color, alpha);
        this.staticGraphics.fillCircle(starX, starY, radius);
      } else {
        this.lensedGraphics.lineStyle(radius * 2, lensing.streakColor, alpha);
        this.lensedGraphics.beginPath();
        this.lensedGraphics.arc(
          0,
          0,
          lensed.radiusPx,
          lensed.angleRadians - lensed.arcHalfWidthRadians,
          lensed.angleRadians + lensed.arcHalfWidthRadians,
        );
        this.lensedGraphics.strokePath();
      }
    }
    for (let index = 0; index < lensing.halo.count; index++) {
      const streak = haloStreak(index, holeRadiusPx, lensing.zoneScale, lensing.halo);
      this.lensedGraphics.lineStyle(1, lensing.streakColor, streak.alpha);
      this.lensedGraphics.beginPath();
      this.lensedGraphics.arc(
        0,
        0,
        streak.radiusPx,
        streak.angleRadians - streak.arcHalfWidthRadians,
        streak.angleRadians + streak.arcHalfWidthRadians,
      );
      this.lensedGraphics.strokePath();
    }
  }

  update(deltaSeconds: number): void {
    this.lensedGraphics.rotation += VISUAL.starfield.lensing.rotationRadiansPerSecond * deltaSeconds;
  }
}
