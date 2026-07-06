import { describe, expect, it } from 'vitest';
import { GameState } from './GameState';

describe('GameState', () => {
  it('adds matter to both ledgers', () => {
    const state = new GameState();
    state.collectMatter(50);
    expect(state.snapshot()).toEqual({ matter: 50, mass: 50, purchasedNodes: [], victorySeen: false });
  });

  it('spending reduces matter but never mass', () => {
    const state = new GameState();
    state.collectMatter(100);
    expect(state.spendMatter(60)).toBe(true);
    expect(state.snapshot()).toEqual({ matter: 40, mass: 100, purchasedNodes: [], victorySeen: false });
  });

  it('rejects spending more than the matter balance', () => {
    const state = new GameState();
    state.collectMatter(10);
    expect(state.spendMatter(11)).toBe(false);
    expect(state.snapshot()).toEqual({ matter: 10, mass: 10, purchasedNodes: [], victorySeen: false });
  });

  it('notifies subscribers on change and stops after unsubscribe', () => {
    const state = new GameState();
    const seen: number[] = [];
    const unsubscribe = state.subscribe(({ matter }) => seen.push(matter));
    state.collectMatter(5);
    unsubscribe();
    state.collectMatter(5);
    expect(seen).toEqual([5]);
  });

  it('ignores non-positive collectMatter amounts', () => {
    const state = new GameState();
    state.collectMatter(100);
    state.collectMatter(-50);
    state.collectMatter(0);
    expect(state.snapshot()).toEqual({ matter: 100, mass: 100, purchasedNodes: [], victorySeen: false });
  });

  it('rejects non-positive spendMatter amounts', () => {
    const state = new GameState();
    state.collectMatter(100);
    expect(state.spendMatter(-10)).toBe(false);
    expect(state.spendMatter(0)).toBe(false);
    expect(state.snapshot()).toEqual({ matter: 100, mass: 100, purchasedNodes: [], victorySeen: false });
  });

  it('allows spending exactly the full matter balance', () => {
    const state = new GameState();
    state.collectMatter(100);
    expect(state.spendMatter(100)).toBe(true);
    expect(state.snapshot()).toEqual({ matter: 0, mass: 100, purchasedNodes: [], victorySeen: false });
  });

  it('does not notify listeners on a failed spend', () => {
    const state = new GameState();
    state.collectMatter(100);
    let notifications = 0;
    state.subscribe(() => notifications++);
    state.spendMatter(200);
    state.spendMatter(-5);
    expect(notifications).toBe(0);
  });

  it('purchases a node: spends matter, records it, keeps mass', () => {
    const state = new GameState();
    state.collectMatter(100);
    expect(state.purchaseNode('hub.size1', 40)).toBe(true);
    const snapshot = state.snapshot();
    expect(snapshot.matter).toBe(60);
    expect(snapshot.mass).toBe(100);
    expect(snapshot.purchasedNodes).toEqual(['hub.size1']);
    expect(state.hasNode('hub.size1')).toBe(true);
  });

  it('rejects double purchase and insufficient matter', () => {
    const state = new GameState();
    state.collectMatter(50);
    expect(state.purchaseNode('hub.size1', 40)).toBe(true);
    expect(state.purchaseNode('hub.size1', 40)).toBe(false);
    expect(state.purchaseNode('hub.tick1', 40)).toBe(false);
  });

  it('snapshot node list is sorted and stable', () => {
    const state = new GameState();
    state.collectMatter(100);
    state.purchaseNode('b.node', 1);
    state.purchaseNode('a.node', 1);
    expect(state.snapshot().purchasedNodes).toEqual(['a.node', 'b.node']);
  });

  it('migration multiplier scales collection', () => {
    const state = new GameState();
    state.setMigrationMultiplier(2);
    state.collectMatter(10);
    expect(state.snapshot().matter).toBe(20);
    expect(state.snapshot().mass).toBe(20);
  });

  it('restore replaces all state and notifies once', () => {
    const state = new GameState();
    let notifications = 0;
    state.subscribe(() => notifications++);
    state.restore(50, 900, ['cl.static'], 2);
    expect(notifications).toBe(1);
    expect(state.snapshot()).toEqual({ matter: 50, mass: 900, purchasedNodes: ['cl.static'], victorySeen: false });
    expect(state.migrationMultiplier).toBe(2);
    state.collectMatter(10);
    expect(state.snapshot().matter).toBe(70);
  });

  it('restore accepts victorySeen and defaults it to false when omitted', () => {
    const state = new GameState();
    state.restore(50, 900, ['cl.static'], 2, true);
    expect(state.snapshot().victorySeen).toBe(true);
    const other = new GameState();
    other.restore(50, 900, [], 2);
    expect(other.snapshot().victorySeen).toBe(false);
  });

  it('markVictorySeen sets the flag and notifies', () => {
    const state = new GameState();
    let notifications = 0;
    state.subscribe(() => notifications++);
    state.markVictorySeen();
    expect(state.snapshot().victorySeen).toBe(true);
    expect(notifications).toBe(1);
  });

  it('addMass raises mass only', () => {
    const state = new GameState();
    state.addMass(500);
    expect(state.snapshot()).toEqual({ matter: 0, mass: 500, purchasedNodes: [], victorySeen: false });
  });

  it('resetPurchases clears nodes without touching wallet', () => {
    const state = new GameState();
    state.collectMatter(100);
    state.purchaseNode('hub.size1', 10);
    state.resetPurchases();
    expect(state.snapshot()).toEqual({ matter: 90, mass: 100, purchasedNodes: [], victorySeen: false });
  });
});
