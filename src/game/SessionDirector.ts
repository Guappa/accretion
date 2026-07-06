import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';

export class SessionDirector {
  private elapsedSeconds = 0;
  private durationSeconds = 0;
  private active = false;

  constructor(private readonly bus: EventBus<GameEvents>) {}

  start(durationSeconds: number): void {
    this.elapsedSeconds = 0;
    this.durationSeconds = durationSeconds;
    this.active = true;
    this.bus.emit('sessionStarted', { durationSeconds: this.durationSeconds });
  }

  update(deltaSeconds: number): void {
    if (!this.active) return;
    this.elapsedSeconds += deltaSeconds;
    if (this.elapsedSeconds >= this.durationSeconds) {
      this.active = false;
      this.bus.emit('sessionEnded', null);
      return;
    }
    this.bus.emit('sessionTick', {
      remainingSeconds: this.remainingSeconds,
      progress: this.progress,
    });
  }

  addTime(seconds: number): void {
    if (!this.active) return; // no clock to extend when no session is running
    const added = Math.max(seconds, 0); // guard against a negative shortening the session
    this.elapsedSeconds = Math.max(this.elapsedSeconds - added, 0);
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
