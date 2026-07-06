import { PROGRESSION_STAGES, stageForMass } from '../config/stages';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';

// Watches mass on every gain and turns a mid-session stage crossing into a session-ending announcement.
export class StageSystem {
  private announcedIndex: number;

  constructor(
    private readonly bus: EventBus<GameEvents>,
    private readonly getMass: () => number,
    private readonly endSession: () => void,
  ) {
    // Seed from the loaded save so a restored high-mass game never re-announces stages it already lives in.
    this.announcedIndex = this.currentIndex();
    bus.on('sessionStarted', () => {
      this.announcedIndex = this.currentIndex();
    });
    bus.on('objectBroken', () => this.check());
    bus.on('matterConsumed', () => this.check());
  }

  private currentIndex(): number {
    return PROGRESSION_STAGES.indexOf(stageForMass(this.getMass()));
  }

  private check(): void {
    const index = this.currentIndex();
    if (index <= this.announcedIndex) return;
    // A kill burst can leap several stages: announce the highest and accumulate every newly crossed stage's paths.
    const unlockedPaths = PROGRESSION_STAGES.slice(this.announcedIndex + 1, index + 1).flatMap(
      (stage) => stage.unlockedPaths,
    );
    this.announcedIndex = index;
    const stage = PROGRESSION_STAGES[index];
    this.bus.emit('stageAdvanced', { stageId: stage.id, stageName: stage.name, unlockedPaths });
    this.endSession();
  }
}
