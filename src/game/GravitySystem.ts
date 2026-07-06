import { CELESTIAL_TIERS, type CelestialTierId } from '../config/celestials';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import { celestialPosition, type Celestial } from './entities';

export class GravitySystem {
  constructor(
    private readonly bus: EventBus<GameEvents>,
    private readonly valueMult: (tierId: CelestialTierId) => number = () => 1,
  ) {}

  update(deltaSeconds: number, entities: Celestial[], horizonRadius: number): void {
    for (let index = entities.length - 1; index >= 0; index--) {
      const entity = entities[index];
      const tier = CELESTIAL_TIERS[entity.tierId];
      entity.orbitAngle += tier.angularSpeed * deltaSeconds;
      entity.orbitRadius -= tier.driftRate * deltaSeconds;
      if (entity.orbitRadius <= horizonRadius) {
        entities.splice(index, 1);
        const { x, y } = celestialPosition(entity);
        this.bus.emit('matterConsumed', {
          value: Math.round(tier.matterValue * this.valueMult(entity.tierId)),
          tierId: entity.tierId,
          x,
          y,
        });
      }
    }
  }
}
