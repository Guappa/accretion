import Phaser from 'phaser';
import { CELESTIAL_TIERS, type CelestialTierId } from '../config/celestials';
import { VISUAL } from '../config/visual';
import { deterministicUnit } from '../game/random';
import type { Celestial } from '../game/entities';
import { celestialVariantIndex, celestialVariantKey } from './textureKeys';

type CanvasContext = CanvasRenderingContext2D;

export class TextureFactory {
  constructor(private readonly scene: Phaser.Scene) {}

  pregenerate(): void {
    const variants = VISUAL.textures.variantsPerTier;
    for (const tierId of Object.keys(CELESTIAL_TIERS) as CelestialTierId[]) {
      for (let index = 0; index < variants; index++) this.ensureVariant(tierId, index);
      for (let stage = 0; stage < VISUAL.crackStages.length; stage++) {
        this.crackTextureKey(tierId, stage);
      }
    }
    this.shadeTextureKey();
  }

  ensureCelestialTexture(entity: Celestial): string {
    const index = celestialVariantIndex(entity.id, VISUAL.textures.variantsPerTier);
    return this.ensureVariant(entity.tierId, index);
  }

  crackTextureKey(tierId: CelestialTierId, stageIndex: number): string {
    const key = `cracks-${tierId}-${stageIndex}`;
    if (this.scene.textures.exists(key)) return key;
    const sizePx = VISUAL.textures.baseSizePx;
    const canvasTexture = this.scene.textures.createCanvas(key, sizePx, sizePx);
    if (!canvasTexture) return key;
    paintCracks(canvasTexture.getContext(), sizePx, stageIndex, hashString(tierId));
    canvasTexture.refresh();
    return key;
  }

  private ensureVariant(tierId: CelestialTierId, variantIndex: number): string {
    const key = celestialVariantKey(tierId, variantIndex);
    if (this.scene.textures.exists(key)) return key;
    const sizePx = VISUAL.textures.baseSizePx;
    const canvasTexture = this.scene.textures.createCanvas(key, sizePx, sizePx);
    if (!canvasTexture) return key;
    const seed = hashString(tierId) + variantIndex * 131.7;
    TIER_PAINTERS[tierId](canvasTexture.getContext(), sizePx, seed);
    canvasTexture.refresh();
    return key;
  }

  shadeTextureKey(): string {
    const key = 'entity-shade';
    if (this.scene.textures.exists(key)) return key;
    const sizePx = VISUAL.textures.baseSizePx;
    const canvasTexture = this.scene.textures.createCanvas(key, sizePx, sizePx);
    if (!canvasTexture) return key;
    const context = canvasTexture.getContext();
    const shadow = context.createLinearGradient(0, 0, sizePx, 0);
    shadow.addColorStop(0, 'rgba(5, 3, 15, 0)');
    shadow.addColorStop(0.55, 'rgba(5, 3, 15, 0)');
    shadow.addColorStop(1, 'rgba(5, 3, 15, 0.65)');
    context.fillStyle = shadow;
    context.fillRect(0, 0, sizePx, sizePx);
    const center = sizePx / 2;
    const mask = context.createRadialGradient(center, center, sizePx * 0.3, center, center, sizePx * 0.48);
    mask.addColorStop(0, 'rgba(0, 0, 0, 1)');
    mask.addColorStop(1, 'rgba(0, 0, 0, 0)');
    context.globalCompositeOperation = 'destination-in';
    context.fillStyle = mask;
    context.fillRect(0, 0, sizePx, sizePx);
    context.globalCompositeOperation = 'source-over';
    canvasTexture.refresh();
    return key;
  }
}

const TIER_PAINTERS: Record<CelestialTierId, (context: CanvasContext, sizePx: number, seed: number) => void> = {
  rock: paintRock,
  smallAsteroid: paintAsteroid,
  ferrousRock: paintFerrousRock,
  metalAsteroid: paintMetalAsteroid,
  dwarfPlanet: paintMini,
  planet: paintRocky,
  gasGiant: paintGiant,
  redDwarf: paintRedDwarf,
  star: paintYellowStar,
  blueGiant: paintBlueGiant,
  comet: paintComet,
};

function silhouette(context: CanvasContext, sizePx: number, seed: number, vertexCount: number): void {
  const center = sizePx / 2;
  const baseRadius = sizePx * 0.42;
  context.beginPath();
  for (let index = 0; index < vertexCount; index++) {
    const jitter = 0.72 + 0.28 * deterministicUnit(seed * 31 + index);
    const angle = (index / vertexCount) * Math.PI * 2;
    const x = center + Math.cos(angle) * baseRadius * jitter;
    const y = center + Math.sin(angle) * baseRadius * jitter;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.closePath();
}

function applyVolumeShading(
  context: CanvasContext,
  sizePx: number,
  seed: number,
  vertexCount: number,
): void {
  const center = sizePx / 2;
  context.save();
  silhouette(context, sizePx, seed, vertexCount);
  context.clip();
  const highlight = context.createRadialGradient(
    center - sizePx * 0.18,
    center - sizePx * 0.18,
    sizePx * 0.02,
    center - sizePx * 0.18,
    center - sizePx * 0.18,
    sizePx * 0.4,
  );
  highlight.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
  highlight.addColorStop(1, 'rgba(255, 255, 255, 0)');
  context.fillStyle = highlight;
  context.fillRect(0, 0, sizePx, sizePx);
  const limb = context.createRadialGradient(center, center, sizePx * 0.16, center, center, sizePx * 0.5);
  limb.addColorStop(0, 'rgba(0, 0, 0, 0)');
  limb.addColorStop(0.7, 'rgba(0, 0, 0, 0.14)');
  limb.addColorStop(1, 'rgba(5, 3, 15, 0.6)');
  context.fillStyle = limb;
  context.fillRect(0, 0, sizePx, sizePx);
  context.restore();
}

function shadedFill(context: CanvasContext, sizePx: number, lightColor: string, darkColor: string): void {
  const center = sizePx / 2;
  const gradient = context.createRadialGradient(
    center - sizePx * 0.15,
    center - sizePx * 0.15,
    sizePx * 0.05,
    center,
    center,
    sizePx * 0.5,
  );
  gradient.addColorStop(0, lightColor);
  gradient.addColorStop(1, darkColor);
  context.fillStyle = gradient;
  context.fill();
}

function hashString(text: string): number {
  let hash = 0;
  for (let index = 0; index < text.length; index++) {
    hash = hash * 31 + text.charCodeAt(index);
  }
  return hash % 10007;
}

function paintRock(context: CanvasContext, sizePx: number, seed: number): void {
  silhouette(context, sizePx, seed, 9);
  shadedFill(context, sizePx, '#e8a33d', '#7a4a12');
  context.save();
  context.clip();
  const craterCount = 4 + Math.floor(deterministicUnit(seed * 5.7) * 4);
  for (let index = 0; index < craterCount; index++) {
    const craterX = sizePx * (0.2 + 0.6 * deterministicUnit(seed * 13 + index));
    const craterY = sizePx * (0.2 + 0.6 * deterministicUnit(seed * 17 + index));
    const craterRadius = sizePx * (0.04 + 0.06 * deterministicUnit(seed * 23 + index));
    context.fillStyle = 'rgba(48, 27, 6, 0.55)';
    context.beginPath();
    context.arc(craterX, craterY, craterRadius, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = 'rgba(255, 205, 130, 0.35)';
    context.lineWidth = 1;
    context.beginPath();
    context.arc(craterX, craterY, craterRadius, Math.PI * 1.1, Math.PI * 1.9);
    context.stroke();
  }
  context.restore();
  applyVolumeShading(context, sizePx, seed, 9);
  silhouette(context, sizePx, seed, 9);
  context.strokeStyle = 'rgba(245, 158, 11, 0.9)';
  context.lineWidth = 2;
  context.stroke();
}

function paintAsteroid(context: CanvasContext, sizePx: number, seed: number): void {
  silhouette(context, sizePx, seed, 8);
  shadedFill(context, sizePx, '#9bd7f7', '#1d5e86');
  context.save();
  context.clip();
  const striationCount = 3 + Math.floor(deterministicUnit(seed * 3.3) * 3);
  for (let index = 0; index < striationCount; index++) {
    const offset = sizePx * (0.15 + 0.7 * deterministicUnit(seed * 41 + index));
    context.strokeStyle = 'rgba(220, 245, 255, 0.35)';
    context.lineWidth = 1 + deterministicUnit(seed * 43 + index) * 1.5;
    context.beginPath();
    context.moveTo(0, offset);
    context.lineTo(sizePx, offset - sizePx * 0.25);
    context.stroke();
  }
  context.restore();
  applyVolumeShading(context, sizePx, seed, 8);
  silhouette(context, sizePx, seed, 8);
  context.strokeStyle = 'rgba(56, 189, 248, 0.9)';
  context.lineWidth = 2;
  context.stroke();
}

// Short bright diagonal strokes read as specular highlights, signaling metal at a glance.
function paintSpecularGlints(context: CanvasContext, sizePx: number, seed: number): void {
  const glintCount = 3 + Math.floor(deterministicUnit(seed * 6.1) * 3);
  context.strokeStyle = 'rgba(240, 248, 255, 0.5)';
  for (let index = 0; index < glintCount; index++) {
    const x = sizePx * (0.2 + 0.6 * deterministicUnit(seed * 53 + index));
    const y = sizePx * (0.2 + 0.6 * deterministicUnit(seed * 59 + index));
    const length = sizePx * (0.06 + 0.05 * deterministicUnit(seed * 61 + index));
    const angle = Math.PI / 4 + (deterministicUnit(seed * 67 + index) - 0.5) * 0.6;
    context.lineWidth = 1 + deterministicUnit(seed * 71 + index);
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    context.stroke();
  }
}

function paintFerrousRock(context: CanvasContext, sizePx: number, seed: number): void {
  silhouette(context, sizePx, seed, 9);
  shadedFill(context, sizePx, '#d7dee6', '#4b5563');
  context.save();
  context.clip();
  paintSpecularGlints(context, sizePx, seed);
  context.restore();
  applyVolumeShading(context, sizePx, seed, 9);
  silhouette(context, sizePx, seed, 9);
  context.strokeStyle = 'rgba(184, 196, 208, 0.9)';
  context.lineWidth = 2;
  context.stroke();
}

function paintMetalAsteroid(context: CanvasContext, sizePx: number, seed: number): void {
  silhouette(context, sizePx, seed, 8);
  shadedFill(context, sizePx, '#c3d3f7', '#3b4a6b');
  context.save();
  context.clip();
  paintSpecularGlints(context, sizePx, seed);
  context.restore();
  applyVolumeShading(context, sizePx, seed, 8);
  silhouette(context, sizePx, seed, 8);
  context.strokeStyle = 'rgba(147, 197, 253, 0.9)';
  context.lineWidth = 2;
  context.stroke();
}

// Planet-spectrum flavors: the variant seed picks one within a tier's set, so each planet reads unique
// while its tier (Minis / Rockies / Giants) stays recognizable. Only Giants carry rings.
interface PlanetType {
  light: string;
  mid: string;
  dark: string;
  banded: boolean;
  ring: string | null;
}

// Minis - Dwarf Planets & Exomoons: small, muted, no rings.
const MINI_TYPES: readonly PlanetType[] = [
  { light: '#dbe2ea', mid: '#8b96a4', dark: '#39424f', banded: false, ring: null }, // rocky grey dwarf
  { light: '#e6dccb', mid: '#a58a63', dark: '#4a3821', banded: false, ring: null }, // tan dwarf
  { light: '#eafcff', mid: '#9fd0dc', dark: '#3f6470', banded: false, ring: null }, // icy exomoon
];

// Rockies - Terrestrial & Super-Earths: oceans, continents, deserts; no rings.
const ROCKY_TYPES: readonly PlanetType[] = [
  { light: '#cfe8ff', mid: '#3f86d6', dark: '#122f66', banded: false, ring: null }, // ocean earth
  { light: '#d2f2c4', mid: '#4dab55', dark: '#14532d', banded: false, ring: null }, // lush earth
  { light: '#f7d7a2', mid: '#c9772f', dark: '#61280f', banded: true, ring: null }, // desert / mars
  { light: '#f6b8a0', mid: '#c14f38', dark: '#5e1f13', banded: true, ring: null }, // red super-earth
  { light: '#e4faff', mid: '#74cbdb', dark: '#155e75', banded: false, ring: null }, // icy ocean world
];

// Giants - Gas & Ice Giants: banded, ringed, the largest bodies.
const GIANT_TYPES: readonly PlanetType[] = [
  { light: '#ffe7b8', mid: '#e0a850', dark: '#7a4a12', banded: true, ring: 'rgba(255, 236, 200, 0.55)' }, // amber gas giant
  { light: '#b3ccff', mid: '#4a6fd0', dark: '#1c2c73', banded: true, ring: 'rgba(200, 216, 255, 0.6)' }, // blue gas giant
  { light: '#e6ccff', mid: '#9a5fd6', dark: '#4a1f7a', banded: true, ring: 'rgba(228, 212, 255, 0.55)' }, // violet gas giant
  { light: '#d6f5ff', mid: '#67b8d8', dark: '#155e75', banded: true, ring: 'rgba(210, 245, 255, 0.6)' }, // cyan ice giant
];

// A thin tilted ring, faded at the tips; drawn once behind the body and again clipped to the near
// side so it reads as passing in front of the lower hemisphere.
function strokePlanetRing(
  context: CanvasContext,
  center: number,
  bodyRadius: number,
  color: string,
  tilt: number,
): void {
  context.save();
  context.translate(center, center);
  context.rotate(tilt);
  const span = bodyRadius * 1.55;
  const fade = context.createLinearGradient(-span, 0, span, 0);
  fade.addColorStop(0, 'rgba(255, 255, 255, 0)');
  fade.addColorStop(0.5, color);
  fade.addColorStop(1, 'rgba(255, 255, 255, 0)');
  context.strokeStyle = fade;
  context.lineWidth = bodyRadius * 0.16;
  context.beginPath();
  context.ellipse(0, 0, span, bodyRadius * 0.44, 0, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

function paintOrb(
  context: CanvasContext,
  sizePx: number,
  seed: number,
  types: readonly PlanetType[],
): void {
  const center = sizePx / 2;
  const type = types[Math.floor(deterministicUnit(seed * 1.7) * types.length)];
  // Shrink the body when a ring needs room to fit inside the fixed texture canvas.
  const bodyRadius = sizePx * (type.ring ? 0.33 : 0.42);
  const ringTilt = -0.55 + deterministicUnit(seed * 7.1) * 0.4;

  if (type.ring) strokePlanetRing(context, center, bodyRadius, type.ring, ringTilt);

  // Spherical body: light source upper-left, dark limb lower-right.
  context.beginPath();
  context.arc(center, center, bodyRadius, 0, Math.PI * 2);
  const body = context.createRadialGradient(
    center - bodyRadius * 0.4,
    center - bodyRadius * 0.4,
    bodyRadius * 0.1,
    center,
    center,
    bodyRadius * 1.02,
  );
  body.addColorStop(0, type.light);
  body.addColorStop(0.5, type.mid);
  body.addColorStop(1, type.dark);
  context.fillStyle = body;
  context.fill();

  context.save();
  context.clip();
  if (type.banded) {
    const bandCount = 3 + Math.floor(deterministicUnit(seed * 2.1) * 3);
    for (let index = 0; index < bandCount; index++) {
      const cy = center + (deterministicUnit(seed * 19 + index) - 0.5) * bodyRadius * 1.9;
      const halfHeight = bodyRadius * (0.06 + 0.1 * deterministicUnit(seed * 23 + index));
      context.fillStyle = index % 2 === 0 ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.12)';
      context.beginPath();
      context.ellipse(center, cy, bodyRadius * 1.1, halfHeight, 0, 0, Math.PI * 2);
      context.fill();
    }
  }
  // Soft specular sheen near the light source.
  const sheen = context.createRadialGradient(
    center - bodyRadius * 0.42,
    center - bodyRadius * 0.42,
    0,
    center - bodyRadius * 0.42,
    center - bodyRadius * 0.42,
    bodyRadius * 0.6,
  );
  sheen.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
  sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
  context.fillStyle = sheen;
  context.fillRect(0, 0, sizePx, sizePx);
  // Terminator: darken the far lower-right hemisphere.
  const limb = context.createRadialGradient(
    center - bodyRadius * 0.4,
    center - bodyRadius * 0.4,
    bodyRadius * 0.2,
    center,
    center,
    bodyRadius * 1.05,
  );
  limb.addColorStop(0, 'rgba(0, 0, 0, 0)');
  limb.addColorStop(0.6, 'rgba(0, 0, 0, 0)');
  limb.addColorStop(1, 'rgba(5, 3, 15, 0.55)');
  context.fillStyle = limb;
  context.fillRect(0, 0, sizePx, sizePx);
  context.restore();

  // Rim light picks the body off the black background.
  context.beginPath();
  context.arc(center, center, bodyRadius, 0, Math.PI * 2);
  context.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  context.lineWidth = 1.5;
  context.stroke();

  // Front pass: redraw the ring over the near (lower) hemisphere so it crosses in front.
  if (type.ring) {
    context.save();
    context.beginPath();
    context.rect(0, center, sizePx, sizePx - center);
    context.clip();
    strokePlanetRing(context, center, bodyRadius, type.ring, ringTilt);
    context.restore();
  }
}

function paintMini(context: CanvasContext, sizePx: number, seed: number): void {
  paintOrb(context, sizePx, seed, MINI_TYPES);
}

function paintRocky(context: CanvasContext, sizePx: number, seed: number): void {
  paintOrb(context, sizePx, seed, ROCKY_TYPES);
}

function paintGiant(context: CanvasContext, sizePx: number, seed: number): void {
  paintOrb(context, sizePx, seed, GIANT_TYPES);
}

// Star spectrum flavors: bright, self-lit bodies with a soft corona and flare spikes - no rings, no
// shading gradient (a star casts light, it doesn't receive it), distinct at a glance from any planet.
interface StarType {
  core: string;
  mid: string;
  edge: string;
  corona: string;
}

const RED_DWARF_TYPES: readonly StarType[] = [
  { core: '#fff2e0', mid: '#ff8c42', edge: '#a8341c', corona: 'rgba(255, 120, 60, 0.35)' },
  { core: '#ffe9d6', mid: '#f2703a', edge: '#8f2a12', corona: 'rgba(255, 140, 80, 0.35)' },
];

const STAR_TYPES: readonly StarType[] = [
  { core: '#ffffff', mid: '#fff3b0', edge: '#e0a850', corona: 'rgba(255, 244, 200, 0.4)' },
  { core: '#fffdf5', mid: '#ffe27a', edge: '#d6900f', corona: 'rgba(255, 235, 160, 0.4)' },
];

const BLUE_GIANT_TYPES: readonly StarType[] = [
  { core: '#ffffff', mid: '#bcdcff', edge: '#3f6fd6', corona: 'rgba(150, 200, 255, 0.4)' },
  { core: '#f5faff', mid: '#9ec8ff', edge: '#2f4fb0', corona: 'rgba(170, 210, 255, 0.4)' },
];

function paintStellarBody(
  context: CanvasContext,
  sizePx: number,
  seed: number,
  types: readonly StarType[],
): void {
  const center = sizePx / 2;
  const type = types[Math.floor(deterministicUnit(seed * 1.7) * types.length)];
  const bodyRadius = sizePx * 0.32;

  // Outer corona: additive glow reads as radiant light spilling past the body's edge.
  context.save();
  context.globalCompositeOperation = 'lighter';
  const corona = context.createRadialGradient(center, center, bodyRadius * 0.5, center, center, sizePx * 0.5);
  corona.addColorStop(0, type.corona);
  corona.addColorStop(1, 'rgba(0, 0, 0, 0)');
  context.fillStyle = corona;
  context.fillRect(0, 0, sizePx, sizePx);

  // Flare spikes sell "star" over "planet" at a glance, drawn under the body so they read as passing behind it.
  const spikeCount = 4 + Math.floor(deterministicUnit(seed * 4.3) * 2);
  for (let index = 0; index < spikeCount; index++) {
    const angle = (index / spikeCount) * Math.PI * 2 + deterministicUnit(seed * 11 + index) * 0.4;
    const length = sizePx * (0.34 + 0.1 * deterministicUnit(seed * 17 + index));
    const tipX = center + Math.cos(angle) * length;
    const tipY = center + Math.sin(angle) * length;
    const flare = context.createLinearGradient(center, center, tipX, tipY);
    flare.addColorStop(0, type.corona);
    flare.addColorStop(1, 'rgba(255, 255, 255, 0)');
    context.strokeStyle = flare;
    context.lineWidth = sizePx * 0.02;
    context.beginPath();
    context.moveTo(center, center);
    context.lineTo(tipX, tipY);
    context.stroke();
  }
  context.restore();

  // Body: bright core fading to the tier's edge color - lit evenly since a star is its own light source.
  context.beginPath();
  context.arc(center, center, bodyRadius, 0, Math.PI * 2);
  const body = context.createRadialGradient(center, center, 0, center, center, bodyRadius);
  body.addColorStop(0, type.core);
  body.addColorStop(0.55, type.mid);
  body.addColorStop(1, type.edge);
  context.fillStyle = body;
  context.fill();

  // Rim light for edge definition against the black background.
  context.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  context.lineWidth = 1.5;
  context.stroke();
}

function paintRedDwarf(context: CanvasContext, sizePx: number, seed: number): void {
  paintStellarBody(context, sizePx, seed, RED_DWARF_TYPES);
}

function paintYellowStar(context: CanvasContext, sizePx: number, seed: number): void {
  paintStellarBody(context, sizePx, seed, STAR_TYPES);
}

function paintBlueGiant(context: CanvasContext, sizePx: number, seed: number): void {
  paintStellarBody(context, sizePx, seed, BLUE_GIANT_TYPES);
}

// A small, hot glowing head - white core burning out to orange - so a comet reads instantly at a glance mid-streak.
function paintComet(context: CanvasContext, sizePx: number, seed: number): void {
  const center = sizePx / 2;
  const bodyRadius = sizePx * (0.25 + 0.06 * deterministicUnit(seed * 3.7));

  context.save();
  context.globalCompositeOperation = 'lighter';
  const glow = context.createRadialGradient(center, center, bodyRadius * 0.4, center, center, sizePx * 0.5);
  glow.addColorStop(0, 'rgba(255, 210, 150, 0.55)');
  glow.addColorStop(1, 'rgba(249, 115, 22, 0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, sizePx, sizePx);
  context.restore();

  context.beginPath();
  context.arc(center, center, bodyRadius, 0, Math.PI * 2);
  const body = context.createRadialGradient(center, center, 0, center, center, bodyRadius);
  body.addColorStop(0, '#ffffff');
  body.addColorStop(0.45, '#ffd27a');
  body.addColorStop(1, '#f97316');
  context.fillStyle = body;
  context.fill();

  context.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  context.lineWidth = 1.5;
  context.stroke();
}

// Cracks radiate from near-center; later stages add more and longer branches.
function paintCracks(context: CanvasContext, sizePx: number, stageIndex: number, seed: number): void {
  const center = sizePx / 2;
  const crackCount = 2 + stageIndex * 2;
  const maxLength = sizePx * (0.18 + 0.11 * stageIndex);
  context.strokeStyle = 'rgba(10, 6, 4, 0.85)';
  context.lineWidth = 1.5;
  for (let index = 0; index < crackCount; index++) {
    const angle = deterministicUnit(seed + index * 7.7) * Math.PI * 2;
    let x = center + Math.cos(angle) * sizePx * 0.06;
    let y = center + Math.sin(angle) * sizePx * 0.06;
    context.beginPath();
    context.moveTo(x, y);
    const segments = 3 + stageIndex;
    for (let segment = 0; segment < segments; segment++) {
      const wobble = (deterministicUnit(seed * 3 + index * 11 + segment) - 0.5) * 1.2;
      const step = maxLength / segments;
      x += Math.cos(angle + wobble) * step;
      y += Math.sin(angle + wobble) * step;
      context.lineTo(x, y);
    }
    context.stroke();
  }
}
