import { SESSION_CONFIG } from '../config/session';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';

export class SessionDirector {
  private elapsedSeconds = 0;
  private durationSeconds = 0;
  private active = false;
  private addedSeconds = 0;

  constructor(private readonly bus: EventBus<GameEvents>) {}

  start(durationSeconds: number): void {
    this.elapsedSeconds = 0;
    this.durationSeconds = durationSeconds;
    this.addedSeconds = 0;
    this.active = true;
    this.bus.emit('sessionStarted', { durationSeconds: this.durationSeconds });
  }

  update(deltaSeconds: number): void {
    if (!this.active) return;
    this.elapsedSeconds += deltaSeconds;
    if (this.elapsedSeconds >= this.durationSeconds) {
      this.finish();
      return;
    }
    this.bus.emit('sessionTick', {
      remainingSeconds: this.remainingSeconds,
      progress: this.progress,
    });
  }

  // Stage crossings cut the session short through the same end path as the natural timeout.
  endEarly(): void {
    if (!this.active) return;
    this.finish();
  }

  private finish(): void {
    this.active = false;
    this.bus.emit('sessionEnded', null);
  }

  // Returns the seconds actually granted after the per-session cap, so callers report honest numbers.
  addTime(seconds: number): number {
    if (!this.active) return 0; // no clock to extend when no session is running
    // Old-game rule: total bonus time per session caps at a fraction of the session's own duration, else time-on-kill loops forever.
    const cap = this.durationSeconds * SESSION_CONFIG.maxAddedTimeFraction;
    const headroom = Math.max(cap - this.addedSeconds, 0);
    const added = Math.min(Math.max(seconds, 0), headroom);
    if (added <= 0) return 0;
    this.addedSeconds += added;
    this.elapsedSeconds = Math.max(this.elapsedSeconds - added, 0);
    return added;
  }

  setRemaining(seconds: number): void {
    if (!this.active) return; // only meaningful mid-session; inactive director has no clock to rewind
    this.elapsedSeconds = this.durationSeconds - Math.min(Math.max(seconds, 0), this.durationSeconds);
  }

  get running(): boolean {
    return this.active;
  }

  get progress(): number {
    if (this.durationSeconds <= 0) return 0; // avoid 0/0 NaN before start() sets a duration
    return Math.min(this.elapsedSeconds / this.durationSeconds, 1);
  }

  get remainingSeconds(): number {
    return Math.max(this.durationSeconds - this.elapsedSeconds, 0);
  }
}
