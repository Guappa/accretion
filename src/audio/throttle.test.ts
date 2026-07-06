import { describe, expect, it } from 'vitest';
import { SfxGate } from './throttle';

describe('SfxGate', () => {
  it('allows the first play and blocks repeats inside the gap', () => {
    const gate = new SfxGate(6, 3);
    expect(gate.tryAcquire('hit', 40, 1000)).toBe(true);
    expect(gate.tryAcquire('hit', 40, 1020)).toBe(false);
    expect(gate.tryAcquire('hit', 40, 1041)).toBe(true);
  });

  it('tracks gaps per sound name independently', () => {
    const gate = new SfxGate(6, 3);
    expect(gate.tryAcquire('hit', 40, 1000)).toBe(true);
    expect(gate.tryAcquire('break', 40, 1010)).toBe(true);
  });

  it('blocks when the concurrency cap is reached and frees on release', () => {
    const gate = new SfxGate(2, 3);
    expect(gate.tryAcquire('a', 0, 0)).toBe(true);
    expect(gate.tryAcquire('b', 0, 10)).toBe(true);
    expect(gate.tryAcquire('c', 0, 20)).toBe(false);
    gate.release();
    expect(gate.tryAcquire('c', 0, 30)).toBe(true);
  });

  it('attenuates gain only above the busy threshold', () => {
    const gate = new SfxGate(8, 3);
    gate.tryAcquire('a', 0, 0);
    gate.tryAcquire('b', 0, 1);
    gate.tryAcquire('c', 0, 2);
    expect(gate.attenuatedGain(0.1)).toBeCloseTo(0.1, 6);
    gate.tryAcquire('d', 0, 3);
    expect(gate.attenuatedGain(0.1)).toBeCloseTo(0.075, 6);
  });
});
