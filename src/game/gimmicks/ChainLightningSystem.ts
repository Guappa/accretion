import type { CelestialTierId } from '../../config/celestials';
import { EventBus } from '../../core/EventBus';
import type { GameEvents } from '../../core/events';
import { celestialPosition, type Celestial } from '../entities';
import { applyDamage } from './resolveDamage';

export interface ChainStats {
  chainCount: number;
  damagePerHop: number;
  critChance: number;
  critDamageMult: number;
  rangeWorldUnits: number;
  forkChance: number;
}

export class ChainLightningSystem {
  // Breaks queue here instead of chaining synchronously, so a chain's own splices never corrupt BreakerSystem's in-flight reverse loop over the same entities array.
  private readonly pendingOrigins: { x: number; y: number; sourceId: number }[] = [];

  constructor(
    private readonly bus: EventBus<GameEvents>,
    private readonly entities: Celestial[],
    private readonly getStats: () => ChainStats,
    private readonly valueMult: (tierId: CelestialTierId) => number = () => 1,
    private readonly rng: () => number = Math.random,
  ) {
    bus.on('objectBroken', ({ source, affix, x, y, id }) => {
      if (source !== 'breaker' || affix !== 'electric') return;
      this.pendingOrigins.push({ x, y, sourceId: id });
    });
  }

  reset(): void {
    this.pendingOrigins.length = 0;
  }

  update(): void {
    while (this.pendingOrigins.length > 0) {
      const origin = this.pendingOrigins.shift();
      if (origin) this.chain(origin.x, origin.y, origin.sourceId);
    }
  }

  private chain(startX: number, startY: number, sourceId: number): void {
    const stats = this.getStats();
    if (stats.chainCount <= 0) return;
    const chained = new Set<number>([sourceId]);
    let fromX = startX;
    let fromY = startY;
    for (let hop = 0; hop < stats.chainCount; hop++) {
      const target = this.nearestTarget(fromX, fromY, chained, stats.rangeWorldUnits);
      if (!target) return;
      this.hitTarget(target, fromX, fromY, stats, chained);
      // Fork roll: chained already excludes the primary, so a second nearestTarget call naturally finds a distinct un-hit target.
      // Short-circuit so forkChance: 0 consumes no rng draw.
      if (stats.forkChance > 0 && this.rng() < stats.forkChance) {
        const forkTarget = this.nearestTarget(fromX, fromY, chained, stats.rangeWorldUnits);
        if (forkTarget) this.hitTarget(forkTarget, fromX, fromY, stats, chained);
      }
      // Continue the chain from the primary target's position, not the fork's — the fork is a side branch.
      const { x, y } = celestialPosition(target);
      fromX = x;
      fromY = y;
    }
  }

  // Shared per-hop logic for both the primary chain target and a forked secondary target.
  private hitTarget(
    target: Celestial,
    fromX: number,
    fromY: number,
    stats: ChainStats,
    chained: Set<number>,
  ): void {
    const { x, y } = celestialPosition(target);
    const isCrit = this.rng() < stats.critChance;
    const amount = isCrit ? Math.round(stats.damagePerHop * stats.critDamageMult) : stats.damagePerHop;
    chained.add(target.id);
    this.bus.emit('lightningBolt', { fromX, fromY, toX: x, toY: y });
    applyDamage(this.bus, this.entities, target, amount, 'chain', this.valueMult);
    if (isCrit) this.bus.emit('critLanded', { id: target.id, tierId: target.tierId, amount, x, y });
  }

  private nearestTarget(
    fromX: number,
    fromY: number,
    chained: ReadonlySet<number>,
    rangeWorldUnits: number,
  ): Celestial | null {
    let best: Celestial | null = null;
    let bestDistance = rangeWorldUnits;
    for (const entity of this.entities) {
      if (chained.has(entity.id)) continue;
      const { x, y } = celestialPosition(entity);
      const distance = Math.hypot(x - fromX, y - fromY);
      if (distance <= bestDistance) {
        best = entity;
        bestDistance = distance;
      }
    }
    return best;
  }
}
