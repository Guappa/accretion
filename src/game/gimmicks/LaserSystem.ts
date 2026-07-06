import type { CelestialTierId } from '../../config/celestials';
import { LASER } from '../../config/laser';
import { EventBus } from '../../core/EventBus';
import type { GameEvents } from '../../core/events';
import { celestialHitRadius, celestialPosition, type Celestial } from '../entities';
import { applyDamage } from './resolveDamage';

export interface LaserStats {
  damage: number;
  widthMult: number;
  critChance: number;
  critDamageMult: number;
}

export interface LaserBlast {
  x: number;
  y: number;
  angle: number;
  widthMult: number;
  remaining: number;
}

export class LaserSystem {
  // Procs queue like ChainLightningSystem's: a full-field blast splices many entities, which would corrupt BreakerSystem's in-flight reverse loop if fired synchronously.
  private readonly pendingOrigins: { x: number; y: number }[] = [];
  private readonly blastList: LaserBlast[] = [];

  constructor(
    private readonly bus: EventBus<GameEvents>,
    private readonly entities: Celestial[],
    private readonly getStats: () => LaserStats,
    private readonly valueMult: (tierId: CelestialTierId) => number = () => 1,
    private readonly rng: () => number = Math.random,
  ) {
    bus.on('objectBroken', ({ source, affix, x, y }) => {
      // Only a manual breaker kill procs a blast - a laser kill of another laser star must not chain one.
      if (source !== 'breaker' || affix !== 'laser') return;
      this.pendingOrigins.push({ x, y });
    });
  }

  get blasts(): readonly LaserBlast[] {
    return this.blastList;
  }

  reset(): void {
    this.pendingOrigins.length = 0;
    this.blastList.length = 0;
  }

  update(deltaSeconds: number): void {
    for (let index = this.blastList.length - 1; index >= 0; index--) {
      const blast = this.blastList[index];
      blast.remaining -= deltaSeconds;
      if (blast.remaining <= 0) this.blastList.splice(index, 1);
    }
    while (this.pendingOrigins.length > 0) {
      const origin = this.pendingOrigins.shift();
      if (origin) this.fireBlast(origin.x, origin.y);
    }
  }

  private fireBlast(originX: number, originY: number): void {
    const stats = this.getStats();
    const angle = this.rng() * 2 * Math.PI;
    this.blastList.push({
      x: originX,
      y: originY,
      angle,
      widthMult: stats.widthMult,
      remaining: LASER.blastFadeSeconds,
    });
    const halfWidth = LASER.beamHalfWidthWorldUnits * stats.widthMult;
    const beamDirX = Math.cos(angle);
    const beamDirY = Math.sin(angle);
    // Reverse iteration keeps the pass copy-safe: applyDamage splices dead targets out of this same array.
    for (let index = this.entities.length - 1; index >= 0; index--) {
      const entity = this.entities[index];
      const { x, y } = celestialPosition(entity);
      // Infinite line through the origin: only perpendicular distance matters, so both directions hit.
      const perpDistance = Math.abs((x - originX) * beamDirY - (y - originY) * beamDirX);
      if (perpDistance > halfWidth + celestialHitRadius(entity)) continue;
      // Per-hit crit roll, mirroring BreakerSystem: rng under the chance multiplies the hit and announces it.
      const isCrit = this.rng() < stats.critChance;
      const amount = Math.round(isCrit ? stats.damage * stats.critDamageMult : stats.damage);
      applyDamage(this.bus, this.entities, entity, amount, 'laser', this.valueMult);
      if (isCrit) this.bus.emit('critLanded', { id: entity.id, tierId: entity.tierId, amount, x, y });
    }
  }
}
