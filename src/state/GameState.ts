export interface GameStateSnapshot {
  matter: number;
  mass: number;
  purchasedNodes: readonly string[];
  victorySeen: boolean;
}

export class GameState {
  private matter = 0;
  private mass = 0;
  private readonly purchasedNodes = new Set<string>();
  private migrationMultiplierValue = 1;
  private victorySeenValue = false;
  private readonly listeners = new Set<(snapshot: GameStateSnapshot) => void>();

  collectMatter(amount: number): void {
    if (amount <= 0) return;
    const scaled = Math.round(amount * this.migrationMultiplierValue);
    this.matter += scaled;
    this.mass += scaled;
    this.notify();
  }

  spendMatter(amount: number): boolean {
    if (amount <= 0 || amount > this.matter) return false;
    this.matter -= amount;
    this.notify();
    return true;
  }

  // Affordability only - prerequisites and mass gates are canPurchase's job (UI must check first).
  purchaseNode(nodeId: string, cost: number): boolean {
    if (this.purchasedNodes.has(nodeId) || cost > this.matter) return false;
    this.matter -= cost;
    this.purchasedNodes.add(nodeId);
    this.notify();
    return true;
  }

  hasNode(nodeId: string): boolean {
    return this.purchasedNodes.has(nodeId);
  }

  setMigrationMultiplier(multiplier: number): void {
    this.migrationMultiplierValue = multiplier;
  }

  get migrationMultiplier(): number {
    return this.migrationMultiplierValue;
  }

  // Full-state overwrite for save/load - replaces the wallet, purchases, and multiplier in one notify.
  restore(
    matter: number,
    mass: number,
    purchasedNodes: readonly string[],
    migrationMultiplier: number,
    victorySeen = false,
  ): void {
    this.matter = matter;
    this.mass = mass;
    this.purchasedNodes.clear();
    for (const nodeId of purchasedNodes) this.purchasedNodes.add(nodeId);
    this.migrationMultiplierValue = migrationMultiplier;
    this.victorySeenValue = victorySeen;
    this.notify();
  }

  // One-time flip when lifetime mass crosses the win goal - never re-triggers once seen.
  markVictorySeen(): void {
    this.victorySeenValue = true;
    this.notify();
  }

  // Cheap read for hot paths (snapshot clones and sorts the purchase list every call).
  get currentMass(): number {
    return this.mass;
  }

  // Debug + future tuning: raise mass without touching the matter wallet.
  addMass(amount: number): void {
    if (amount <= 0) return;
    this.mass += amount;
    this.notify();
  }

  // Debug + future Migration: clears owned nodes, keeps the wallet intact.
  resetPurchases(): void {
    this.purchasedNodes.clear();
    this.notify();
  }

  snapshot(): GameStateSnapshot {
    return {
      matter: this.matter,
      mass: this.mass,
      purchasedNodes: [...this.purchasedNodes].sort(),
      victorySeen: this.victorySeenValue,
    };
  }

  subscribe(listener: (snapshot: GameStateSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const snapshot = this.snapshot();
    this.listeners.forEach((listener) => listener(snapshot));
  }
}
