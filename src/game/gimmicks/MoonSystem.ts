import type { EffectMap } from '../../config/upgrades';
import { MOON } from '../../config/moon';
import { EventBus } from '../../core/EventBus';
import type { GameEvents } from '../../core/events';

export interface Satellite {
  angle: number;
  remaining: number;
}

export class MoonSystem {
  private readonly items: Satellite[] = [];

  constructor(
    bus: EventBus<GameEvents>,
    private readonly grantMoonBuff: (effects: EffectMap, durationSeconds: number) => void,
    private readonly getDurationMult: () => number,
    private readonly getCapBonus: () => number = () => 0,
  ) {
    bus.on('objectBroken', ({ source, affix }) => {
      if (source !== 'breaker' || affix !== 'moon') return;
      const cap = MOON.satelliteCap + this.getCapBonus();
      if (this.items.length >= cap) return;
      const durationSeconds = MOON.baseDurationSeconds * this.getDurationMult();
      // Spread captures evenly around the orbit by count so they never all land on the same angle.
      const angle = (this.items.length / cap) * Math.PI * 2;
      this.items.push({ angle, remaining: durationSeconds });
      this.grantMoonBuff(MOON.buffEffects, durationSeconds);
    });
  }

  get satellites(): readonly Satellite[] {
    return this.items;
  }

  get count(): number {
    return this.items.length;
  }

  reset(): void {
    this.items.length = 0;
  }

  update(deltaSeconds: number): void {
    for (let index = this.items.length - 1; index >= 0; index--) {
      const satellite = this.items[index];
      satellite.angle += MOON.orbitSpeed * deltaSeconds;
      satellite.remaining -= deltaSeconds;
      if (satellite.remaining <= 0) this.items.splice(index, 1);
    }
  }
}
