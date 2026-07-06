import { CELESTIAL_TIERS } from '../../config/celestials';
import { SUPERNOVA } from '../../config/supernova';
import { EventBus } from '../../core/EventBus';
import type { GameEvents } from '../../core/events';
import { celestialPosition, type Celestial } from '../entities';
import { applyDamage } from './resolveDamage';

export interface SupernovaBurst {
  x: number;
  y: number;
  elapsed: number;
  radiusWorldUnits: number;
}

export class SupernovaSystem {
  // Triggers queue like LaserSystem's: a burst splices many entities, which would corrupt BreakerSystem's in-flight reverse loop if fired synchronously.
  private readonly pendingOrigins: { x: number; y: number }[] = [];
  private readonly bursts: SupernovaBurst[] = [];

  constructor(
    private readonly bus: EventBus<GameEvents>,
    private readonly entities: Celestial[],
    private readonly getEnabled: () => boolean,
    private readonly getDamageMult: () => number,
    private readonly getRadiusMult: () => number = () => 1,
  ) {
    bus.on('objectBroken', ({ source, tierId, x, y }) => {
      // Only a manual breaker kill of a star seeds a burst - a supernova-sourced kill must not chain another one.
      if (source !== 'breaker' || CELESTIAL_TIERS[tierId].category !== 'star' || !this.getEnabled()) return;
      this.pendingOrigins.push({ x, y });
    });
  }

  get activeBursts(): readonly SupernovaBurst[] {
    return this.bursts;
  }

  reset(): void {
    this.pendingOrigins.length = 0;
    this.bursts.length = 0;
  }

  update(deltaSeconds: number): void {
    while (this.pendingOrigins.length > 0) {
      const origin = this.pendingOrigins.shift();
      if (origin) this.trigger(origin.x, origin.y);
    }
    for (let index = this.bursts.length - 1; index >= 0; index--) {
      const burst = this.bursts[index];
      burst.elapsed += deltaSeconds;
      if (burst.elapsed >= SUPERNOVA.expandSeconds) this.bursts.splice(index, 1);
    }
  }

  private trigger(x: number, y: number): void {
    const amount = Math.round(SUPERNOVA.baseDamage * this.getDamageMult());
    const radius = SUPERNOVA.radiusWorldUnits * this.getRadiusMult();
    // The burst stores its scaled radius so the render expands exactly as far as the damage reached.
    this.bursts.push({ x, y, elapsed: 0, radiusWorldUnits: radius });
    // Reverse iteration keeps the pass copy-safe: applyDamage splices dead targets out of this same array.
    for (let index = this.entities.length - 1; index >= 0; index--) {
      const entity = this.entities[index];
      const pos = celestialPosition(entity);
      if (Math.hypot(pos.x - x, pos.y - y) > radius) continue;
      applyDamage(this.bus, this.entities, entity, amount, 'supernova');
    }
  }
}
