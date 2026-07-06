import { describe, expect, it } from 'vitest';
import { formatAmount } from './format';

describe('formatAmount', () => {
  it('shows small values verbatim', () => {
    expect(formatAmount(0)).toBe('0');
    expect(formatAmount(999)).toBe('999');
  });

  it('abbreviates thousands and millions to one decimal', () => {
    expect(formatAmount(1400)).toBe('1.4K');
    expect(formatAmount(2_300_000)).toBe('2.3M');
  });

  it('handles the largest supported unit', () => {
    expect(formatAmount(5_000_000_000_000)).toBe('5.0T');
  });
});
