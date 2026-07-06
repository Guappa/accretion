import { describe, expect, it } from 'vitest';
import { BuffSystem } from './BuffSystem';

describe('BuffSystem', () => {
  it('grants layers and expires them', () => {
    const buffs = new BuffSystem();
    buffs.grant('moon', { tickIntervalFraction: -0.2 }, 1, 'refresh');
    expect(buffs.effectLayers()).toHaveLength(1);
    expect(buffs.update(0.5)).toBe(false);
    expect(buffs.update(0.6)).toBe(true);
    expect(buffs.effectLayers()).toHaveLength(0);
  });

  it('refresh policy resets the timer instead of stacking', () => {
    const buffs = new BuffSystem();
    buffs.grant('moon', { tickIntervalFraction: -0.2 }, 1, 'refresh');
    buffs.update(0.8);
    buffs.grant('moon', { tickIntervalFraction: -0.2 }, 1, 'refresh');
    expect(buffs.effectLayers()).toHaveLength(1);
    buffs.update(0.8);
    expect(buffs.effectLayers()).toHaveLength(1);
  });

  it('stack policy accumulates layers from the same source', () => {
    const buffs = new BuffSystem();
    buffs.grant('moon', { tickIntervalFraction: -0.1 }, 1, 'stack');
    buffs.grant('moon', { tickIntervalFraction: -0.1 }, 1, 'stack');
    expect(buffs.effectLayers()).toHaveLength(2);
  });

  it('clear removes all buffs from a source and reports whether it removed anything', () => {
    const buffs = new BuffSystem();
    buffs.grant('moon', { tickIntervalFraction: -0.1 }, 1, 'stack');
    buffs.grant('moon', { tickIntervalFraction: -0.1 }, 1, 'stack');
    buffs.grant('debug', { damagePerTickFlat: 5 }, 1, 'refresh');
    expect(buffs.clear('moon')).toBe(true);
    expect(buffs.effectLayers()).toHaveLength(1);
    expect(buffs.clear('moon')).toBe(false);
  });
});
