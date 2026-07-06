import { describe, expect, it } from 'vitest';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import { GameState } from './GameState';
import { SaveSystem, type SaveStorage } from './SaveSystem';
import { SAVE_STORAGE_KEY } from './saveCodec';

function memoryStorage(): SaveStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

describe('SaveSystem', () => {
  it('save then load restores the wallet and purchases', () => {
    const storage = memoryStorage();
    const bus = new EventBus<GameEvents>();
    const original = new GameState();
    original.collectMatter(200);
    original.purchaseNode('hub.size1', 12);
    new SaveSystem(original, bus, storage).save();

    const revived = new GameState();
    expect(new SaveSystem(revived, bus, storage).load()).toBe(true);
    expect(revived.snapshot()).toEqual(original.snapshot());
  });

  it('save then load restores victorySeen', () => {
    const storage = memoryStorage();
    const bus = new EventBus<GameEvents>();
    const original = new GameState();
    original.markVictorySeen();
    new SaveSystem(original, bus, storage).save();

    const revived = new GameState();
    expect(new SaveSystem(revived, bus, storage).load()).toBe(true);
    expect(revived.snapshot().victorySeen).toBe(true);
  });

  it('load returns false on empty or corrupt storage (fresh start)', () => {
    const storage = memoryStorage();
    const bus = new EventBus<GameEvents>();
    const state = new GameState();
    const saves = new SaveSystem(state, bus, storage);
    expect(saves.load()).toBe(false);
    storage.setItem(SAVE_STORAGE_KEY, '{corrupt');
    expect(saves.load()).toBe(false);
    expect(state.snapshot()).toEqual({ matter: 0, mass: 0, purchasedNodes: [], victorySeen: false });
  });

  it('saves on sessionEnded', () => {
    const storage = memoryStorage();
    const bus = new EventBus<GameEvents>();
    const state = new GameState();
    const saves = new SaveSystem(state, bus, storage);
    saves.startAutosave(1_000_000);
    state.collectMatter(33);
    bus.emit('sessionEnded', null);
    expect(storage.data.get(SAVE_STORAGE_KEY)).toContain('"matter":33');
  });

  it('export/import round-trips and clear removes the key', () => {
    const storage = memoryStorage();
    const bus = new EventBus<GameEvents>();
    const state = new GameState();
    state.collectMatter(77);
    const saves = new SaveSystem(state, bus, storage);
    const exported = saves.exportJson();
    const fresh = new GameState();
    const freshSaves = new SaveSystem(fresh, bus, storage);
    expect(freshSaves.importJson(exported)).toBe(true);
    expect(fresh.snapshot().matter).toBe(77);
    expect(freshSaves.importJson('nope')).toBe(false);
    saves.save();
    saves.clear();
    expect(storage.data.has(SAVE_STORAGE_KEY)).toBe(false);
  });
});
