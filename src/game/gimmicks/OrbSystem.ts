import type { CelestialTierId } from '../../config/celestials';
import { ORB } from '../../config/orb';
import { EventBus } from '../../core/EventBus';
import type { GameEvents } from '../../core/events';
import { celestialHitRadius, celestialPosition, type Celestial } from '../entities';
import { applyDamage } from './resolveDamage';

export interface OrbStats {
  enabled: boolean;
  chance: number;
  damage: number;
  bounces: number;
  critChance: number;
  critDamageMult: number;
}

interface PendingSpawn {
  x: number;
  y: number;
  bounces: number;
  sourceId: number;
}

// A live projectile: current position, the entity it is flying at, remaining bounce budget, and every id it has already hit (never re-targeted).
interface LiveOrb {
  x: number;
  y: number;
  target: Celestial;
  bouncesLeft: number;
  hitIds: Set<number>;
}

export class OrbSystem {
  // Spawns queue here instead of launching synchronously, so a launch's own future splices never corrupt BreakerSystem's in-flight reverse loop over the same entities array.
  private readonly pendingSpawns: PendingSpawn[] = [];
  private readonly liveOrbs: LiveOrb[] = [];

  constructor(
    private readonly bus: EventBus<GameEvents>,
    private readonly entities: Celestial[],
    private readonly getStats: () => OrbStats,
    private readonly valueMult: (tierId: CelestialTierId) => number = () => 1,
    private readonly rng: () => number = Math.random,
  ) {
    bus.on('objectBroken', ({ source, x, y, id }) => {
      // Only breaker kills launch orbs - an orb-sourced kill must never spawn another orb, or a lucky chain could run forever.
      if (source !== 'breaker') return;
      const stats = this.getStats();
      if (!stats.enabled || this.rng() >= stats.chance) return;
      this.pendingSpawns.push({ x, y, bounces: stats.bounces, sourceId: id });
    });
  }

  get orbs(): readonly { x: number; y: number }[] {
    return this.liveOrbs;
  }

  reset(): void {
    this.pendingSpawns.length = 0;
    this.liveOrbs.length = 0;
  }

  update(deltaSeconds: number): void {
    this.drainSpawns();
    for (let index = this.liveOrbs.length - 1; index >= 0; index--) {
      this.advanceOrb(index, deltaSeconds);
    }
  }

  private drainSpawns(): void {
    while (this.pendingSpawns.length > 0) {
      const spawn = this.pendingSpawns.shift();
      if (!spawn) continue;
      const hitIds = new Set<number>([spawn.sourceId]);
      const target = this.nearestTarget(spawn.x, spawn.y, hitIds);
      if (!target) continue; // Nothing in range to fly at - the orb has nowhere to go, so it never launches.
      this.liveOrbs.push({ x: spawn.x, y: spawn.y, target, bouncesLeft: spawn.bounces, hitIds });
    }
  }

  private advanceOrb(index: number, deltaSeconds: number): void {
    const orb = this.liveOrbs[index];
    let travelBudget = ORB.speedWorldUnitsPerSecond * deltaSeconds;
    for (;;) {
      if (!this.entities.includes(orb.target)) {
        // Target vanished mid-flight (consumed, broken by another system) - chase the next nearest un-hit entity instead.
        const replacement = this.nearestTarget(orb.x, orb.y, orb.hitIds);
        if (!replacement) {
          this.liveOrbs.splice(index, 1);
          return;
        }
        orb.target = replacement;
      }
      const { x: targetX, y: targetY } = celestialPosition(orb.target);
      const dx = targetX - orb.x;
      const dy = targetY - orb.y;
      const distance = Math.hypot(dx, dy);
      const hitRadius = celestialHitRadius(orb.target);
      if (distance <= hitRadius || distance <= travelBudget) {
        // Arrival: snap exactly onto the target rather than overshooting past it.
        travelBudget -= distance;
        orb.x = targetX;
        orb.y = targetY;
        const next = this.resolveHit(orb);
        if (!next) {
          this.liveOrbs.splice(index, 1);
          return;
        }
        orb.target = next;
        if (travelBudget <= 0) return;
        continue; // Leftover travel budget this frame carries into the next leg of the bounce.
      }
      orb.x += (dx / distance) * travelBudget;
      orb.y += (dy / distance) * travelBudget;
      return;
    }
  }

  // Applies the hit, kills/pays out if it broke the target, and returns the next bounce target (or null if the orb should expire).
  private resolveHit(orb: LiveOrb): Celestial | null {
    const stats = this.getStats();
    const target = orb.target;
    // Per-hit crit roll, mirroring BreakerSystem: rng under the chance multiplies the hit and announces it.
    const isCrit = this.rng() < stats.critChance;
    const amount = Math.round(isCrit ? stats.damage * stats.critDamageMult : stats.damage);
    orb.hitIds.add(target.id);
    applyDamage(this.bus, this.entities, target, amount, 'orb', this.valueMult);
    if (isCrit) this.bus.emit('critLanded', { id: target.id, tierId: target.tierId, amount, x: orb.x, y: orb.y });
    if (orb.bouncesLeft <= 0) return null;
    const next = this.nearestTarget(orb.x, orb.y, orb.hitIds);
    if (!next) return null;
    orb.bouncesLeft -= 1;
    return next;
  }

  private nearestTarget(fromX: number, fromY: number, excluded: ReadonlySet<number>): Celestial | null {
    let best: Celestial | null = null;
    let bestDistance = ORB.searchRangeWorldUnits;
    for (const entity of this.entities) {
      if (excluded.has(entity.id)) continue;
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
