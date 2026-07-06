import { RADIOACTIVE } from '../../config/radioactive';
import { EventBus } from '../../core/EventBus';
import type { GameEvents } from '../../core/events';
import { celestialPosition, type Celestial } from '../entities';
import { applyDamage } from './resolveDamage';

export interface FalloutZone {
  x: number;
  y: number;
  remaining: number;
  tickTimer: number;
}

export class RadioactiveSystem {
  private readonly zones: FalloutZone[] = [];

  constructor(
    private readonly bus: EventBus<GameEvents>,
    private readonly entities: Celestial[],
    private readonly getDotMult: () => number,
  ) {
    bus.on('objectBroken', ({ source, affix, x, y }) => {
      // Only a manual breaker kill seeds a new zone - fallout kills use 'radioactive' and must not chain into more zones.
      if (source !== 'breaker' || affix !== 'radioactive') return;
      this.zones.push({ x, y, remaining: RADIOACTIVE.durationSeconds, tickTimer: RADIOACTIVE.dotTickInterval });
    });
  }

  get activeZones(): readonly FalloutZone[] {
    return this.zones;
  }

  reset(): void {
    this.zones.length = 0;
  }

  update(deltaSeconds: number): void {
    for (let index = this.zones.length - 1; index >= 0; index--) {
      const zone = this.zones[index];
      zone.remaining -= deltaSeconds;
      zone.tickTimer -= deltaSeconds;
      while (zone.tickTimer <= 0) {
        this.applyTick(zone);
        zone.tickTimer += RADIOACTIVE.dotTickInterval;
      }
      if (zone.remaining <= 0) this.zones.splice(index, 1);
    }
  }

  private applyTick(zone: FalloutZone): void {
    const amount = Math.round(RADIOACTIVE.baseDotPerTick * this.getDotMult());
    for (let index = this.entities.length - 1; index >= 0; index--) {
      const entity = this.entities[index];
      const { x, y } = celestialPosition(entity);
      const distance = Math.hypot(x - zone.x, y - zone.y);
      if (distance > RADIOACTIVE.falloutRadiusWorldUnits) continue;
      applyDamage(this.bus, this.entities, entity, amount, 'radioactive');
    }
  }
}
