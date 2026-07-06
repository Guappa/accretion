import type { CelestialTierId } from '../config/celestials';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';

export interface SessionStatsSnapshot {
  sessionNumber: number;
  matterCollected: number;
  damage: number;
  critDamage: number;
  hits: number;
  chainKills: number;
  timeAdded: number;
  golden: number;
  moon: number;
  destroyedByTier: Partial<Record<CelestialTierId, number>>;
}

// Accumulates a single run's stats from the event stream for the end-of-session report; resets each start.
export class SessionStats {
  private sessionNumber = 0;
  private matterCollected = 0;
  private damage = 0;
  private critDamage = 0;
  private hits = 0;
  private chainKills = 0;
  private timeAdded = 0;
  private golden = 0;
  private moon = 0;
  private readonly destroyed = new Map<CelestialTierId, number>();

  constructor(bus: EventBus<GameEvents>) {
    bus.on('sessionStarted', () => this.reset());
    bus.on('entityDamaged', ({ amount }) => {
      this.damage += amount;
      this.hits += 1;
    });
    bus.on('critLanded', ({ amount }) => {
      this.critDamage += amount;
    });
    bus.on('objectBroken', ({ tierId, value, source, affix }) => {
      this.matterCollected += value;
      this.destroyed.set(tierId, (this.destroyed.get(tierId) ?? 0) + 1);
      if (source === 'chain') this.chainKills += 1;
      if (affix === 'golden') this.golden += 1;
      if (source === 'breaker' && affix === 'moon') this.moon += 1;
    });
    bus.on('matterConsumed', ({ value }) => {
      this.matterCollected += value;
    });
    bus.on('bonusMatter', ({ value }) => {
      this.matterCollected += value;
    });
    bus.on('sessionTimeAdded', ({ seconds }) => {
      this.timeAdded += seconds;
    });
  }

  private reset(): void {
    this.sessionNumber += 1;
    this.matterCollected = 0;
    this.damage = 0;
    this.critDamage = 0;
    this.hits = 0;
    this.chainKills = 0;
    this.timeAdded = 0;
    this.golden = 0;
    this.moon = 0;
    this.destroyed.clear();
  }

  snapshot(): SessionStatsSnapshot {
    return {
      sessionNumber: this.sessionNumber,
      matterCollected: this.matterCollected,
      damage: this.damage,
      critDamage: this.critDamage,
      hits: this.hits,
      chainKills: this.chainKills,
      timeAdded: this.timeAdded,
      golden: this.golden,
      moon: this.moon,
      destroyedByTier: Object.fromEntries(this.destroyed),
    };
  }
}
