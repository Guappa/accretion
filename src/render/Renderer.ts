import Phaser from 'phaser';
import { VISUAL } from '../config/visual';

export interface Viewport {
  centerX: number;
  centerY: number;
  worldScale: number;
  horizonWorldRadius: number;
  spawnFieldRadius: number;
}

export class Renderer {
  private readonly voidGraphics: Phaser.GameObjects.Graphics;
  private readonly ringGraphics: Phaser.GameObjects.Graphics;
  private readonly photonGraphics: Phaser.GameObjects.Graphics;
  private readonly photonRing: Phaser.GameObjects.Image;
  private readonly dopplerArc: Phaser.GameObjects.Image | null;
  private accretionAngle = 0;
  private shimmerSeconds = 0;

  constructor(scene: Phaser.Scene) {
    // Void sits above the ADD-blend glow layers so no light leaks inside the horizon.
    this.voidGraphics = scene.add.graphics().setDepth(VISUAL.depths.blackHoleVoid);
    this.ringGraphics = scene.add.graphics().setDepth(VISUAL.depths.breakerRing);
    this.photonGraphics = scene.add
      .graphics()
      .setDepth(VISUAL.depths.blackHole)
      .setBlendMode(Phaser.BlendModes.ADD);
    ensureBlackHoleTextures(scene);
    this.photonRing = scene.add
      .image(0, 0, 'hole-photon-ring')
      .setDepth(VISUAL.depths.blackHole)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.dopplerArc = scene.textures.exists('hole-doppler-arc')
      ? scene.add
          .image(0, 0, 'hole-doppler-arc')
          .setDepth(VISUAL.depths.blackHole)
          .setBlendMode(Phaser.BlendModes.ADD)
      : null;
  }

  draw(
    pointer: { x: number; y: number },
    viewport: Viewport,
    showRing: boolean,
    deltaSeconds: number,
    tickProgress: number,
    breakerRadiusWorld: number,
  ): void {
    this.accretionAngle += VISUAL.blackHole.accretion.spinRadiansPerSecond * deltaSeconds;
    this.voidGraphics.clear();
    this.photonGraphics.clear();
    const ring = VISUAL.blackHole.photonRing;
    this.shimmerSeconds += deltaSeconds;
    const horizonRadiusPx = viewport.horizonWorldRadius * viewport.worldScale;
    const displayPx = ((horizonRadiusPx * ring.ringScale) / ring.textureRadiusFraction) * 2;
    const shimmer = Math.sin(this.shimmerSeconds * Math.PI * 2 * ring.shimmerHz);
    const pulsedPx = displayPx * (1 + ring.scalePulse * shimmer);
    this.photonRing
      .setPosition(viewport.centerX, viewport.centerY)
      .setDisplaySize(pulsedPx, pulsedPx)
      .setAlpha(ring.baseAlpha + ring.shimmerAlpha * shimmer);
    if (this.dopplerArc) {
      this.dopplerArc
        .setPosition(viewport.centerX, viewport.centerY)
        .setDisplaySize(displayPx, displayPx)
        .setAlpha(ring.doppler.alpha + ring.shimmerAlpha * shimmer * 0.5)
        .setRotation(this.dopplerArc.rotation + ring.doppler.spinRadiansPerSecond * deltaSeconds);
    }
    this.drawBlackHole(viewport);
    this.ringGraphics.clear();
    if (showRing) {
      const centerX = viewport.centerX + pointer.x * viewport.worldScale;
      const centerY = viewport.centerY + pointer.y * viewport.worldScale;
      const ring = VISUAL.breakerRing;
      this.ringGraphics.lineStyle(ring.width, ring.color, ring.alpha);
      this.ringGraphics.strokeCircle(centerX, centerY, breakerRadiusWorld * viewport.worldScale);
      const telegraph = VISUAL.breakerRing.telegraph;
      if (tickProgress > 0) {
        this.ringGraphics.lineStyle(telegraph.width, telegraph.color, telegraph.alpha);
        this.ringGraphics.beginPath();
        this.ringGraphics.arc(
          centerX,
          centerY,
          breakerRadiusWorld * viewport.worldScale,
          -Math.PI / 2,
          -Math.PI / 2 + tickProgress * Math.PI * 2,
        );
        this.ringGraphics.strokePath();
      }
    }
  }

  private drawBlackHole(viewport: Viewport): void {
    const horizonRadiusPx = viewport.horizonWorldRadius * viewport.worldScale;
    this.voidGraphics.fillStyle(VISUAL.blackHole.voidColor, 1);
    this.voidGraphics.fillCircle(viewport.centerX, viewport.centerY, horizonRadiusPx);
    const accretion = VISUAL.blackHole.accretion;
    this.photonGraphics.lineStyle(accretion.width, accretion.color, accretion.alpha);
    for (let index = 0; index < accretion.arcCount; index++) {
      const startAngle = this.accretionAngle + (index / accretion.arcCount) * Math.PI * 2;
      this.photonGraphics.beginPath();
      this.photonGraphics.arc(
        viewport.centerX,
        viewport.centerY,
        horizonRadiusPx * accretion.radiusScale,
        startAngle,
        startAngle + accretion.arcSpanRadians,
      );
      this.photonGraphics.strokePath();
    }
  }
}

function ensureBlackHoleTextures(scene: Phaser.Scene): void {
  const ring = VISUAL.blackHole.photonRing;
  const sizePx = ring.textureSizePx;
  const half = sizePx / 2;
  if (!scene.textures.exists('hole-photon-ring')) {
    const canvasTexture = scene.textures.createCanvas('hole-photon-ring', sizePx, sizePx);
    if (canvasTexture) {
      paintRingGradient(canvasTexture.getContext(), half, [
        [0, 'rgba(255, 150, 80, 0)'],
        [0.5, 'rgba(255, 160, 90, 0.1)'],
        [0.585, 'rgba(255, 205, 150, 0.55)'],
        [0.625, 'rgba(255, 247, 238, 1)'],
        [0.665, 'rgba(255, 196, 130, 0.55)'],
        [0.8, 'rgba(255, 140, 70, 0.1)'],
        [1, 'rgba(255, 120, 60, 0)'],
      ]);
      canvasTexture.refresh();
    }
  }
  if (!scene.textures.exists('hole-doppler-arc')) {
    const canvasTexture = scene.textures.createCanvas('hole-doppler-arc', sizePx, sizePx);
    if (canvasTexture) {
      const context = canvasTexture.getContext();
      if (typeof context.createConicGradient === 'function') {
        paintRingGradient(context, half, [
          [0, 'rgba(255, 200, 150, 0)'],
          [0.585, 'rgba(255, 235, 210, 0.6)'],
          [0.625, 'rgba(255, 255, 252, 1)'],
          [0.67, 'rgba(255, 225, 180, 0.5)'],
          [1, 'rgba(255, 200, 150, 0)'],
        ]);
        const mask = context.createConicGradient(0, half, half);
        mask.addColorStop(0, 'rgba(0, 0, 0, 0)');
        mask.addColorStop(0.3, 'rgba(0, 0, 0, 0)');
        mask.addColorStop(0.42, 'rgba(0, 0, 0, 1)');
        mask.addColorStop(0.58, 'rgba(0, 0, 0, 1)');
        mask.addColorStop(0.7, 'rgba(0, 0, 0, 0)');
        mask.addColorStop(1, 'rgba(0, 0, 0, 0)');
        context.globalCompositeOperation = 'destination-in';
        context.fillStyle = mask;
        context.fillRect(0, 0, sizePx, sizePx);
        context.globalCompositeOperation = 'source-over';
        canvasTexture.refresh();
      } else {
        scene.textures.remove('hole-doppler-arc');
      }
    }
  }
}

function paintRingGradient(
  context: CanvasRenderingContext2D,
  half: number,
  stops: Array<[number, string]>,
): void {
  const gradient = context.createRadialGradient(half, half, 0, half, half, half);
  for (const [offset, color] of stops) gradient.addColorStop(offset, color);
  context.fillStyle = gradient;
  context.fillRect(0, 0, half * 2, half * 2);
}
