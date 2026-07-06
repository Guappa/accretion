import { CELESTIAL_TIERS, type CelestialTierId } from '../config/celestials';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import { celestialHitRadius, celestialPosition, type Celestial } from './entities';

export interface BreakerLiveStats {
  breakerRadius: number;
  tickIntervalSeconds: number;
  damagePerTick: number;
  critChance: number;
  critDamageMult: number;
}

export class BreakerSystem {
  private pointer: { x: number; y: number } | null = null;
  private timeUntilTick: number | null = null;

  constructor(
    private readonly bus: EventBus<GameEvents>,
    private readonly getStats: () => BreakerLiveStats,
    private readonly valueMult: (tierId: CelestialTierId) => number = () => 1,
    private readonly rng: () => number = Math.random,
    // Kept last so it can't be confused positionally with rng/valueMult (all () => number).
    private readonly damageMult: (tierId: CelestialTierId) => number = () => 1,
  ) {}

  setPointer(x: number, y: number): void {
    this.pointer = { x, y };
  }

  get tickProgress(): number {
    if (!this.pointer || this.timeUntilTick === null) return 0;
    const interval = this.getStats().tickIntervalSeconds;
    return Math.min(Math.max(1 - this.timeUntilTick / interval, 0), 1);
  }

  update(deltaSeconds: number, entities: Celestial[]): void {
    if (!this.pointer) return;
    const stats = this.getStats();
    this.timeUntilTick ??= stats.tickIntervalSeconds;
    this.timeUntilTick -= deltaSeconds;
    while (this.timeUntilTick <= 0) {
      this.damageTick(entities, this.pointer, stats);
      this.timeUntilTick += stats.tickIntervalSeconds;
    }
  }

  private damageTick(entities: Celestial[], pointer: { x: number; y: number }, stats: BreakerLiveStats): void {
    for (let index = entities.length - 1; index >= 0; index--) {
      const entity = entities[index];
      const { x, y } = celestialPosition(entity);
      const distance = Math.hypot(x - pointer.x, y - pointer.y);
      if (distance > stats.breakerRadius + celestialHitRadius(entity)) continue;
      const isCrit = this.rng() < stats.critChance;
      const baseAmount = isCrit ? stats.damagePerTick * stats.critDamageMult : stats.damagePerTick;
      const amount = Math.round(baseAmount * this.damageMult(entity.tierId));
      entity.hp -= amount;
      this.bus.emit('entityDamaged', { id: entity.id, tierId: entity.tierId, amount, x, y });
      if (isCrit) this.bus.emit('critLanded', { id: entity.id, tierId: entity.tierId, amount, x, y });
      if (entity.hp <= 0) {
        entities.splice(index, 1);
        this.bus.emit('objectBroken', {
          id: entity.id,
          tierId: entity.tierId,
          value: Math.round(CELESTIAL_TIERS[entity.tierId].breakValue * this.valueMult(entity.tierId)),
          x,
          y,
          source: 'breaker',
          affix: entity.affix,
        });
      }
    }
  }
}
