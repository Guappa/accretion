import { describe, expect, it } from 'vitest';
import { CELESTIAL_TIERS } from '../../config/celestials';
import { LASER } from '../../config/laser';
import { EventBus } from '../../core/EventBus';
import type { GameEvents } from '../../core/events';
import { createCelestial, type Celestial } from '../entities';
import { LaserSystem, type LaserStats } from './LaserSystem';

const STATS: LaserStats = { damage: 10, widthMult: 1, critChance: 0, critDamageMult: 1.5 };
const ORIGIN = { x: 150, y: 90 };

// Deterministic rng: returns the given values in order, repeating the last one when exhausted.
function sequenceRng(values: number[]): () => number {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
}

// Places a rock relative to the blast origin: alongBeam down the blast direction, perpOffset sideways.
function placeRelative(alongBeam: number, perpOffset: number, blastAngle: number, id: number): Celestial {
  const x = ORIGIN.x + alongBeam * Math.cos(blastAngle) - perpOffset * Math.sin(blastAngle);
  const y = ORIGIN.y + alongBeam * Math.sin(blastAngle) + perpOffset * Math.cos(blastAngle);
  const target = createCelestial('rock', Math.hypot(x, y), Math.atan2(y, x), id);
  target.sizeScale = 1;
  return target;
}

function breakLaserStar(bus: EventBus<GameEvents>, x = ORIGIN.x, y = ORIGIN.y): void {
  bus.emit('objectBroken', { id: 99, tierId: 'star', value: 0, x, y, source: 'breaker', affix: 'laser' });
}

function collectDamage(bus: EventBus<GameEvents>): GameEvents['entityDamaged'][] {
  const damaged: GameEvents['entityDamaged'][] = [];
  bus.on('entityDamaged', (payload) => damaged.push(payload));
  return damaged;
}

describe('LaserSystem', () => {
  it('breaking a laser star fires exactly one blast hitting entities on both sides of the line and sparing out-of-corridor ones', () => {
    const bus = new EventBus<GameEvents>();
    const damaged = collectDamage(bus);
    const ahead = placeRelative(200, 0, 0, 1);
    const behind = placeRelative(-200, 0, 0, 2);
    const offLine = placeRelative(50, LASER.beamHalfWidthWorldUnits + CELESTIAL_TIERS.rock.radius + 5, 0, 3);
    const system = new LaserSystem(bus, [ahead, behind, offLine], () => STATS, undefined, sequenceRng([0]));
    breakLaserStar(bus);
    system.update(0);
    expect(system.blasts).toHaveLength(1);
    expect(damaged.map((hit) => hit.id).sort()).toEqual([1, 2]);
    for (const hit of damaged) expect(hit.amount).toBe(STATS.damage);
    // A second update fires nothing new - the blast was a one-time occurrence on proc.
    system.update(0);
    expect(damaged).toHaveLength(2);
  });

  it('non-breaker sources and non-laser affixes do not proc a blast', () => {
    const bus = new EventBus<GameEvents>();
    const damaged = collectDamage(bus);
    const target = placeRelative(100, 0, 0, 1);
    const system = new LaserSystem(bus, [target], () => STATS, undefined, sequenceRng([0]));
    bus.emit('objectBroken', { id: 90, tierId: 'star', value: 0, x: ORIGIN.x, y: ORIGIN.y, source: 'chain', affix: 'laser' });
    bus.emit('objectBroken', { id: 91, tierId: 'rock', value: 0, x: ORIGIN.x, y: ORIGIN.y, source: 'breaker', affix: 'electric' });
    system.update(0);
    expect(system.blasts).toHaveLength(0);
    expect(damaged).toHaveLength(0);
  });

  it('the crit roll applies per entity, multiplying the hit and emitting critLanded', () => {
    const bus = new EventBus<GameEvents>();
    const damaged = collectDamage(bus);
    const crits: GameEvents['critLanded'][] = [];
    bus.on('critLanded', (payload) => crits.push(payload));
    const first = placeRelative(100, 0, 0, 1);
    const second = placeRelative(220, 0, 0, 2);
    const stats: LaserStats = { damage: 10, widthMult: 1, critChance: 0.5, critDamageMult: 2 };
    // Draws: angle 0, then per-entity crit rolls in reverse entity order - second crits, first does not.
    const rng = sequenceRng([0, 0.4, 0.9]);
    const system = new LaserSystem(bus, [first, second], () => stats, undefined, rng);
    breakLaserStar(bus);
    system.update(0);
    expect(damaged).toHaveLength(2);
    expect(damaged[0]).toMatchObject({ id: 2, amount: 20 });
    expect(damaged[1]).toMatchObject({ id: 1, amount: 10 });
    expect(crits).toHaveLength(1);
    expect(crits[0]).toMatchObject({ id: 2, amount: 20 });
  });

  it('a kill emits objectBroken with source laser, the value multiplier, and the victim affix', () => {
    const bus = new EventBus<GameEvents>();
    const broken: GameEvents['objectBroken'][] = [];
    bus.on('objectBroken', (payload) => {
      if (payload.source === 'laser') broken.push(payload);
    });
    const victim = placeRelative(100, 0, 0, 1);
    victim.hp = 1;
    victim.affix = 'golden';
    const entities: Celestial[] = [victim];
    const system = new LaserSystem(bus, entities, () => STATS, (tierId) => (tierId === 'rock' ? 2 : 1), sequenceRng([0]));
    breakLaserStar(bus);
    system.update(0);
    expect(entities).toEqual([]);
    expect(broken).toHaveLength(1);
    expect(broken[0].source).toBe('laser');
    expect(broken[0].value).toBe(Math.round(CELESTIAL_TIERS.rock.breakValue * 2));
    expect(broken[0].affix).toBe('golden');
  });

  it('a blast that kills another laser star does not chain a second blast', () => {
    const bus = new EventBus<GameEvents>();
    const damaged = collectDamage(bus);
    const otherLaserStar = placeRelative(150, 0, 0, 1);
    otherLaserStar.affix = 'laser';
    otherLaserStar.hp = 1;
    const bystander = placeRelative(150, 200, 0, 2);
    const entities: Celestial[] = [otherLaserStar, bystander];
    const system = new LaserSystem(bus, entities, () => STATS, undefined, sequenceRng([0]));
    breakLaserStar(bus);
    system.update(0);
    expect(entities).toEqual([bystander]);
    expect(system.blasts).toHaveLength(1);
    // If the laser-sourced kill had queued a proc, this update would fire it and hit the bystander.
    system.update(0);
    expect(system.blasts).toHaveLength(1);
    expect(damaged).toHaveLength(1);
  });

  it('a wider widthMult widens the hit corridor to catch an entity otherwise out of range', () => {
    const perpOffset = LASER.beamHalfWidthWorldUnits + CELESTIAL_TIERS.rock.radius + 5;
    const narrowBus = new EventBus<GameEvents>();
    const narrowDamaged = collectDamage(narrowBus);
    const narrow = new LaserSystem(narrowBus, [placeRelative(100, perpOffset, 0, 1)], () => STATS, undefined, sequenceRng([0]));
    breakLaserStar(narrowBus);
    narrow.update(0);
    expect(narrowDamaged).toHaveLength(0);
    const wideBus = new EventBus<GameEvents>();
    const wideDamaged = collectDamage(wideBus);
    const wide = new LaserSystem(wideBus, [placeRelative(100, perpOffset, 0, 1)], () => ({ ...STATS, widthMult: 4 }), undefined, sequenceRng([0]));
    breakLaserStar(wideBus);
    wide.update(0);
    expect(wideDamaged).toHaveLength(1);
  });

  it('the blast visual ages with update() and is pruned when its fade elapses', () => {
    const bus = new EventBus<GameEvents>();
    const system = new LaserSystem(bus, [], () => STATS, undefined, sequenceRng([0.25]));
    breakLaserStar(bus);
    system.update(0);
    expect(system.blasts).toHaveLength(1);
    expect(system.blasts[0]).toMatchObject({ x: ORIGIN.x, y: ORIGIN.y, widthMult: STATS.widthMult });
    expect(system.blasts[0].angle).toBeCloseTo(0.25 * 2 * Math.PI, 6);
    expect(system.blasts[0].remaining).toBe(LASER.blastFadeSeconds);
    system.update(LASER.blastFadeSeconds * 0.4);
    expect(system.blasts[0].remaining).toBeCloseTo(LASER.blastFadeSeconds * 0.6, 6);
    system.update(LASER.blastFadeSeconds * 0.6);
    expect(system.blasts).toHaveLength(0);
  });

  it('reset() clears fading blasts and any pending proc', () => {
    const bus = new EventBus<GameEvents>();
    const damaged = collectDamage(bus);
    const target = placeRelative(100, 0, 0, 1);
    const system = new LaserSystem(bus, [target], () => STATS, undefined, sequenceRng([0]));
    breakLaserStar(bus);
    system.update(0);
    expect(system.blasts).toHaveLength(1);
    system.reset();
    expect(system.blasts).toHaveLength(0);
    // A proc queued right before a session reset must not fire into the next session.
    breakLaserStar(bus);
    system.reset();
    system.update(0);
    expect(system.blasts).toHaveLength(0);
    expect(damaged).toHaveLength(1);
  });
});
