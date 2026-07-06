import type { EffectMap } from '../../config/upgrades';

export type BuffStackPolicy = 'refresh' | 'stack';

interface ActiveBuff {
  source: string;
  effects: EffectMap;
  remainingSeconds: number;
  stackPolicy: BuffStackPolicy;
}

export class BuffSystem {
  private readonly buffs: ActiveBuff[] = [];

  grant(source: string, effects: EffectMap, durationSeconds: number, stackPolicy: BuffStackPolicy): void {
    if (stackPolicy === 'refresh') {
      const existing = this.buffs.find((buff) => buff.source === source);
      if (existing) {
        existing.effects = effects;
        existing.remainingSeconds = durationSeconds;
        return;
      }
    }
    this.buffs.push({ source, effects, remainingSeconds: durationSeconds, stackPolicy });
  }

  update(deltaSeconds: number): boolean {
    let changed = false;
    for (let index = this.buffs.length - 1; index >= 0; index--) {
      this.buffs[index].remainingSeconds -= deltaSeconds;
      if (this.buffs[index].remainingSeconds <= 0) {
        this.buffs.splice(index, 1);
        changed = true;
      }
    }
    return changed;
  }

  clear(source: string): boolean {
    let removed = false;
    for (let index = this.buffs.length - 1; index >= 0; index--) {
      if (this.buffs[index].source === source) {
        this.buffs.splice(index, 1);
        removed = true;
      }
    }
    return removed;
  }

  effectLayers(): readonly EffectMap[] {
    return this.buffs.map((buff) => buff.effects);
  }
}
