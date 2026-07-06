import { CELESTIAL_TIERS, type CelestialCategory } from '../config/celestials';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';

export interface RespawnChances {
  spawnOnKill: number;
  planetRespawn: number;
  starRespawn: number;
}

// Rolls the predecessor's kill-triggered spawn family (Gravity Pull / Fission / Nebula) on every objectBroken, any source - laser/orb/chain mayhem feeds itself.
export class RespawnSystem {
  constructor(
    bus: EventBus<GameEvents>,
    private readonly random: () => number,
    private readonly getChances: () => RespawnChances,
    private readonly queueRespawn: (category: CelestialCategory | null) => void,
  ) {
    bus.on('objectBroken', ({ tierId }) => {
      const chances = this.getChances();
      if (this.random() < chances.spawnOnKill) this.queueRespawn(null);
      const category = CELESTIAL_TIERS[tierId].category;
      if (category === 'planet' && this.random() < chances.planetRespawn) this.queueRespawn('planet');
      if (category === 'star' && this.random() < chances.starRespawn) this.queueRespawn('star');
    });
  }
}
