import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import { GameState } from './GameState';
import { parseSave, SAVE_STORAGE_KEY, serializeSave } from './saveCodec';

export interface SaveStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const AUTOSAVE_INTERVAL_MS = 10_000;

export class SaveSystem {
  constructor(
    private readonly gameState: GameState,
    private readonly bus: EventBus<GameEvents>,
    private readonly storage: SaveStorage,
  ) {}

  load(): boolean {
    const payload = parseSave(this.storage.getItem(SAVE_STORAGE_KEY));
    if (!payload) return false;
    this.gameState.restore(
      payload.matter,
      payload.mass,
      payload.purchasedNodes,
      payload.migrationMultiplier,
      payload.victorySeen,
    );
    return true;
  }

  save(): void {
    const snapshot = this.gameState.snapshot();
    this.storage.setItem(
      SAVE_STORAGE_KEY,
      serializeSave(
        snapshot.matter,
        snapshot.mass,
        snapshot.purchasedNodes,
        this.gameState.migrationMultiplier,
        snapshot.victorySeen,
      ),
    );
  }

  clear(): void {
    this.storage.removeItem(SAVE_STORAGE_KEY);
  }

  exportJson(): string {
    const snapshot = this.gameState.snapshot();
    return serializeSave(
      snapshot.matter,
      snapshot.mass,
      snapshot.purchasedNodes,
      this.gameState.migrationMultiplier,
      snapshot.victorySeen,
    );
  }

  importJson(raw: string): boolean {
    const payload = parseSave(raw);
    if (!payload) return false;
    this.gameState.restore(
      payload.matter,
      payload.mass,
      payload.purchasedNodes,
      payload.migrationMultiplier,
      payload.victorySeen,
    );
    this.save();
    return true;
  }

  startAutosave(intervalMs: number = AUTOSAVE_INTERVAL_MS): void {
    // Node test environment has no window; the sessionEnded hook still covers the critical save point.
    if (typeof window !== 'undefined') window.setInterval(() => this.save(), intervalMs);
    this.bus.on('sessionEnded', () => this.save());
  }
}
