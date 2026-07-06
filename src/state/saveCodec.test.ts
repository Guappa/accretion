import { describe, expect, it } from 'vitest';
import { parseSave, serializeSave, SAVE_VERSION } from './saveCodec';

describe('save codec', () => {
  it('round-trips a payload', () => {
    const raw = serializeSave(120, 450, ['hub.size1', 'cl.static'], 1, false);
    const parsed = parseSave(raw);
    expect(parsed).toEqual({
      version: SAVE_VERSION,
      matter: 120,
      mass: 450,
      purchasedNodes: ['hub.size1', 'cl.static'],
      migrationMultiplier: 1,
      victorySeen: false,
    });
  });

  it('round-trips victorySeen true', () => {
    const raw = serializeSave(120, 450, [], 1, true);
    expect(parseSave(raw)?.victorySeen).toBe(true);
  });

  it('defaults victorySeen to false on old saves that lack the field', () => {
    const legacy = JSON.stringify({ version: 1, matter: 5, mass: 5, purchasedNodes: [], migrationMultiplier: 1 });
    expect(parseSave(legacy)?.victorySeen).toBe(false);
  });

  it('defaults victorySeen to false when the field is malformed instead of rejecting the save', () => {
    const malformed = JSON.stringify({
      version: 1,
      matter: 5,
      mass: 5,
      purchasedNodes: [],
      migrationMultiplier: 1,
      victorySeen: 'yes',
    });
    expect(parseSave(malformed)?.victorySeen).toBe(false);
  });

  it('returns null for null, garbage, and non-objects', () => {
    expect(parseSave(null)).toBeNull();
    expect(parseSave('')).toBeNull();
    expect(parseSave('not json {')).toBeNull();
    expect(parseSave('42')).toBeNull();
    expect(parseSave('"string"')).toBeNull();
  });

  it('returns null for wrong field types', () => {
    expect(parseSave(JSON.stringify({ version: 1, matter: 'x', mass: 0, purchasedNodes: [], migrationMultiplier: 1 }))).toBeNull();
    expect(parseSave(JSON.stringify({ version: 1, matter: 0, mass: 0, purchasedNodes: [1, 2], migrationMultiplier: 1 }))).toBeNull();
    expect(parseSave(JSON.stringify({ version: 1, matter: 0, mass: 0, migrationMultiplier: 1 }))).toBeNull();
  });

  it('returns null for unknown versions (fresh-start fallback)', () => {
    expect(parseSave(JSON.stringify({ version: 999, matter: 0, mass: 0, purchasedNodes: [], migrationMultiplier: 1 }))).toBeNull();
    expect(parseSave(JSON.stringify({ version: 0, matter: 0, mass: 0, purchasedNodes: [], migrationMultiplier: 1 }))).toBeNull();
  });

  it('returns null for out-of-range or non-finite values (corrupt/edited import guard)', () => {
    expect(parseSave(JSON.stringify({ version: 1, matter: -1, mass: 0, purchasedNodes: [], migrationMultiplier: 1 }))).toBeNull();
    // 1e999 is beyond double range and parses to Infinity - JSON.stringify(Infinity) would emit "null", so build the raw string directly.
    expect(
      parseSave('{"version":1,"matter":1e999,"mass":0,"purchasedNodes":[],"migrationMultiplier":1}'),
    ).toBeNull();
    expect(
      parseSave('{"version":1,"matter":0,"mass":1e999,"purchasedNodes":[],"migrationMultiplier":1}'),
    ).toBeNull();
    expect(parseSave(JSON.stringify({ version: 1, matter: 0, mass: 0, purchasedNodes: [], migrationMultiplier: 0 }))).toBeNull();
    expect(parseSave(JSON.stringify({ version: 1, matter: 0, mass: 0, purchasedNodes: [], migrationMultiplier: -1 }))).toBeNull();
  });
});
