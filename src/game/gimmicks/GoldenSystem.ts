import { EventBus } from '../../core/EventBus';
import type { GameEvents } from '../../core/events';

export class GoldenSystem {
  constructor(
    private readonly bus: EventBus<GameEvents>,
    private readonly getValueMult: () => number,
  ) {
    bus.on('objectBroken', ({ value, affix }) => {
      if (affix !== 'golden') return;
      const bonus = Math.round(value * (this.getValueMult() - 1));
      this.bus.emit('bonusMatter', { value: bonus });
    });
  }
}
