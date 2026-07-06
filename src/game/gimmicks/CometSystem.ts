import { COMET } from '../../config/comet';
import type { EffectMap } from '../../config/upgrades';
import { EventBus } from '../../core/EventBus';
import type { GameEvents } from '../../core/events';
import { createCelestial, type Celestial } from '../entities';

interface TrackedComet {
  id: number;
  remaining: number;
}

export class CometSystem {
  private flybyTimer = COMET.flybyIntervalSeconds;
  private readonly tracked: TrackedComet[] = [];

  constructor(
    bus: EventBus<GameEvents>,
    private readonly entities: Celestial[],
    private readonly nextId: () => number,
    private readonly getEnabled: () => boolean,
    private readonly getShowerChance: () => number,
    private readonly grantCometBuff: (effects: EffectMap, durationSeconds: number) => void,
    private readonly rng: () => number = Math.random,
  ) {
    bus.on('objectBroken', ({ id, tierId }) => {
      if (tierId !== 'comet') return;
      const index = this.tracked.findIndex((comet) => comet.id === id);
      if (index === -1) return; // Already expired and untracked - the buff was granted (or lost) then.
      this.tracked.splice(index, 1);
      this.grantCometBuff(COMET.buffEffects, COMET.buffDurationSeconds);
    });
  }

  reset(): void {
    this.tracked.length = 0;
    this.flybyTimer = COMET.flybyIntervalSeconds;
  }

  update(deltaSeconds: number, spawnFieldRadius: number): void {
    if (!this.getEnabled()) return;
    // Age existing comets before spawning new ones so a just-spawned comet never eats this same frame's elapsed time.
    for (let index = this.tracked.length - 1; index >= 0; index--) {
      const comet = this.tracked[index];
      comet.remaining -= deltaSeconds;
      if (comet.remaining > 0) continue;
      const entityIndex = this.entities.findIndex((entity) => entity.id === comet.id);
      if (entityIndex !== -1) this.entities.splice(entityIndex, 1); // Absent if already broken/consumed elsewhere - that's fine.
      this.tracked.splice(index, 1);
    }
    this.flybyTimer -= deltaSeconds;
    while (this.flybyTimer <= 0) {
      this.flybyTimer += COMET.flybyIntervalSeconds;
      this.spawnFlyby(spawnFieldRadius);
    }
  }

  private spawnFlyby(spawnFieldRadius: number): void {
    const isShower = this.rng() < this.getShowerChance();
    const count = isShower ? COMET.showerCount : 1;
    const radius = spawnFieldRadius * COMET.spawnRadiusFraction;
    for (let index = 0; index < count; index++) {
      const angle = this.rng() * Math.PI * 2;
      const comet = createCelestial('comet', radius, angle, this.nextId());
      this.entities.push(comet);
      this.tracked.push({ id: comet.id, remaining: COMET.lifetimeSeconds });
    }
  }
}
