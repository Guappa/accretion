import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';

export interface VictoryCheckSnapshot {
  mass: number;
  victorySeen: boolean;
}

// Checked at session end, not mid-run, so crossing the goal never interrupts an active feed.
export class VictorySystem {
  constructor(
    bus: EventBus<GameEvents>,
    getSnapshot: () => VictoryCheckSnapshot,
    markSeen: () => void,
    goal: number,
  ) {
    bus.on('sessionEnded', () => {
      const { mass, victorySeen } = getSnapshot();
      if (victorySeen || mass < goal) return;
      markSeen();
      bus.emit('victoryAchieved', { mass });
    });
  }
}
