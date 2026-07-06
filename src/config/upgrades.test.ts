import { describe, expect, it } from 'vitest';
import { UPGRADE_CLUSTERS, UPGRADE_NODE_MAP, UPGRADE_NODES, UPGRADE_TRUNKS, UPGRADE_EXPANSION_SLOTS, UPGRADE_TUNING } from './upgrades';
import { massRequirementForPath } from './stages';
import { TREE_UI } from './treeUi';

describe('upgrade tree content invariants', () => {
  it('node ids are unique and the map covers them all', () => {
    expect(UPGRADE_NODE_MAP.size).toBe(UPGRADE_NODES.length);
  });

  it('the tree carries the staged-rework content depth', () => {
    expect(UPGRADE_NODES.length).toBeGreaterThanOrEqual(113);
  });

  it('expansion slots are empty - every path shipped, so the lock-square teasers are gone', () => {
    expect(UPGRADE_EXPANSION_SLOTS).toHaveLength(0);
  });

  it('every prerequisite refers to an existing node', () => {
    for (const node of UPGRADE_NODES) {
      for (const prerequisite of node.prerequisites) {
        expect(UPGRADE_NODE_MAP.has(prerequisite)).toBe(true);
      }
    }
  });

  it('every node belongs to a defined cluster of the same path', () => {
    for (const node of UPGRADE_NODES) {
      const cluster = UPGRADE_CLUSTERS.find((candidate) => candidate.id === node.clusterId);
      expect(cluster).toBeDefined();
      expect(cluster?.pathId).toBe(node.pathId);
    }
  });

  it('no two nodes in a cluster share a grid cell', () => {
    for (const cluster of UPGRADE_CLUSTERS) {
      const cells = UPGRADE_NODES.filter((node) => node.clusterId === cluster.id).map(
        (node) => `${node.gx},${node.gy}`,
      );
      expect(new Set(cells).size).toBe(cells.length);
    }
  });

  it('costs are positive and tuning is sane', () => {
    for (const node of UPGRADE_NODES) expect(node.baseCost).toBeGreaterThan(0);
    // Zero is the intended full-clear setting (static prices); negative would refund purchases.
    expect(UPGRADE_TUNING.pathInflation).toBeGreaterThanOrEqual(0);
    expect(UPGRADE_TUNING.critChanceCap).toBeLessThanOrEqual(1);
    expect(UPGRADE_TUNING.electricSpawnCap).toBeLessThanOrEqual(1);
    expect(UPGRADE_TUNING.chainRangeWorldUnits).toBeGreaterThan(0);
  });

  it('the chain lightning keystone exists with the binding flags', () => {
    const keystone = UPGRADE_NODE_MAP.get('cl.static');
    expect(keystone?.keystone).toBe(true);
    expect(keystone?.flags).toContain('chainLightning');
    expect(keystone?.effects.electricSpawnChanceFlat).toBeGreaterThan(0);
    expect(keystone?.effects.chainCountFlat).toBe(1);
  });

  it('the first chain upgrade lands the chain in the 2-3 band', () => {
    const chainOne = UPGRADE_NODE_MAP.get('cl.chain1');
    const total = 1 + (chainOne?.effects.chainCountFlat ?? 0);
    expect(total).toBeGreaterThanOrEqual(2);
    expect(total).toBeLessThanOrEqual(3);
  });

  it('every node icon has a glyph', () => {
    for (const node of UPGRADE_NODES) {
      expect(TREE_UI.iconGlyphs[node.icon], node.icon).toBeTruthy();
    }
  });

  it('trunk and expansion-slot references resolve to existing nodes', () => {
    for (const trunk of UPGRADE_TRUNKS) {
      expect(UPGRADE_NODE_MAP.has(trunk.from)).toBe(true);
      expect(UPGRADE_NODE_MAP.has(trunk.to)).toBe(true);
    }
    for (const slot of UPGRADE_EXPANSION_SLOTS) {
      expect(UPGRADE_NODE_MAP.has(slot.attachedTo)).toBe(true);
    }
  });

  it('expansion slots do not collide with any node on the absolute grid', () => {
    const occupied = new Set(
      UPGRADE_NODES.map((node) => {
        const cluster = UPGRADE_CLUSTERS.find((candidate) => candidate.id === node.clusterId);
        return `${(cluster?.originGx ?? 0) + node.gx},${(cluster?.originGy ?? 0) + node.gy}`;
      }),
    );
    for (const slot of UPGRADE_EXPANSION_SLOTS) {
      const anchor = UPGRADE_NODE_MAP.get(slot.attachedTo);
      const cluster = UPGRADE_CLUSTERS.find((candidate) => candidate.id === anchor?.clusterId);
      const cell = `${(cluster?.originGx ?? 0) + (anchor?.gx ?? 0) + slot.dgx},${(cluster?.originGy ?? 0) + (anchor?.gy ?? 0) + slot.dgy}`;
      expect(occupied.has(cell)).toBe(false);
    }
  });

  it('no node occupies the black hole core cell', () => {
    for (const node of UPGRADE_NODES) {
      const cluster = UPGRADE_CLUSTERS.find((candidate) => candidate.id === node.clusterId);
      const gx = (cluster?.originGx ?? 0) + node.gx;
      const gy = (cluster?.originGy ?? 0) + node.gy;
      expect(gx === TREE_UI.core.gx && gy === TREE_UI.core.gy).toBe(false);
    }
  });

  it('no two nodes anywhere in the tree share an absolute grid cell', () => {
    const cells = UPGRADE_NODES.map((node) => {
      const cluster = UPGRADE_CLUSTERS.find((candidate) => candidate.id === node.clusterId);
      return `${(cluster?.originGx ?? 0) + node.gx},${(cluster?.originGy ?? 0) + node.gy}`;
    });
    expect(new Set(cells).size).toBe(cells.length);
  });

  it('no placeholder nodes remain - every path has shipped', () => {
    // planets, stars, golden, radioactive, moon, comet, laser, and now orb have all gone live.
    for (const node of UPGRADE_NODES) {
      expect(node.placeholder).toBeUndefined();
    }
  });

  it('laser branch is live (not placeholder) and the keystone grants the laser-star spawn chance plus the flag', () => {
    const beam = UPGRADE_NODE_MAP.get('laser.beam')!;
    expect(beam.placeholder).toBeUndefined();
    expect(beam.keystone).toBe(true);
    expect(beam.flags).toContain('laser');
    expect(beam.effects.laserSpawnChanceFlat).toBeGreaterThan(0);
    expect(beam.effects.laserDamageFlat).toBeGreaterThan(0);
    const width = UPGRADE_NODE_MAP.get('laser.width')!;
    expect(width.placeholder).toBeUndefined();
    expect(width.prerequisites).toContain('laser.beam');
    expect(width.effects.laserWidthFraction).toBe(0.6);
  });

  it('planets branch is live (not placeholder) and unlock is a mass-gated keystone with the spawn flag', () => {
    const unlock = UPGRADE_NODE_MAP.get('planet.unlock')!;
    expect(unlock.placeholder).toBeUndefined();
    expect(unlock.flags).toContain('spawnPlanets');
    // The mass gate moved to the stage table - the whole planets path is stage-locked, not this one node.
    expect(massRequirementForPath(unlock.pathId)).toBeGreaterThan(0);
    for (const id of ['planet.unlock', 'planet.density', 'planet.value']) {
      expect(UPGRADE_NODE_MAP.get(id)!.placeholder).toBeUndefined();
    }
    expect(UPGRADE_NODE_MAP.get('planet.density')!.effects.planetWeightFraction).toBe(0.5);
    expect(UPGRADE_NODE_MAP.get('planet.value')!.effects.planetValueFraction).toBe(1.0);
  });

  it('golden branch is live (not placeholder) and the spawn node is a keystone granting golden spawn chance', () => {
    const spawn = UPGRADE_NODE_MAP.get('golden.spawn')!;
    expect(spawn.placeholder).toBeUndefined();
    expect(spawn.keystone).toBe(true);
    expect(spawn.effects.goldenSpawnChanceFlat).toBeGreaterThan(0);
    const value = UPGRADE_NODE_MAP.get('golden.value')!;
    expect(value.placeholder).toBeUndefined();
    expect(value.prerequisites).toContain('golden.spawn');
    expect(value.effects.goldenValueFraction).toBe(1.5);
  });

  it('radioactive branch is live (not placeholder) and the spawn node is a keystone granting radioactive spawn chance', () => {
    const spawn = UPGRADE_NODE_MAP.get('radioactive.spawn')!;
    expect(spawn.placeholder).toBeUndefined();
    expect(spawn.keystone).toBe(true);
    expect(spawn.effects.radioactiveSpawnChanceFlat).toBeGreaterThan(0);
    const dot = UPGRADE_NODE_MAP.get('radioactive.dot')!;
    expect(dot.placeholder).toBeUndefined();
    expect(dot.prerequisites).toContain('radioactive.spawn');
    expect(dot.effects.radioactiveDotFraction).toBe(1.0);
  });

  it('stars branch is live (not placeholder) and the unlock node is a mass-gated keystone granting the spawn and supernova flags', () => {
    const unlock = UPGRADE_NODE_MAP.get('star.unlock')!;
    expect(unlock.placeholder).toBeUndefined();
    expect(unlock.keystone).toBe(true);
    expect(unlock.flags).toContain('spawnStars');
    // The mass gate moved to the stage table - the whole stars path is stage-locked, not this one node.
    expect(massRequirementForPath(unlock.pathId)).toBeGreaterThan(0);
    const supernova = UPGRADE_NODE_MAP.get('star.supernova')!;
    expect(supernova.placeholder).toBeUndefined();
    expect(supernova.prerequisites).toContain('star.unlock');
    expect(supernova.flags).toContain('supernova');
    expect(supernova.effects.starDamageFraction).toBeGreaterThan(0);
    const value = UPGRADE_NODE_MAP.get('star.value')!;
    expect(value.placeholder).toBeUndefined();
    expect(value.prerequisites).toContain('star.unlock');
    expect(value.effects.starValueFraction).toBe(1.0);
  });

  it('moon branch is live (not placeholder) and the capture node is a keystone granting moon spawn chance', () => {
    const capture = UPGRADE_NODE_MAP.get('moon.capture')!;
    expect(capture.placeholder).toBeUndefined();
    expect(capture.keystone).toBe(true);
    expect(capture.effects.moonSpawnChanceFlat).toBeGreaterThan(0);
    const duration = UPGRADE_NODE_MAP.get('moon.duration')!;
    expect(duration.placeholder).toBeUndefined();
    expect(duration.prerequisites).toContain('moon.capture');
    expect(duration.effects.moonDurationFraction).toBe(1.0);
  });

  it('comet branch is live (not placeholder) and the flyby node is a keystone granting the comets flag', () => {
    const flyby = UPGRADE_NODE_MAP.get('comet.flyby')!;
    expect(flyby.placeholder).toBeUndefined();
    expect(flyby.keystone).toBe(true);
    expect(flyby.flags).toContain('comets');
    const shower = UPGRADE_NODE_MAP.get('comet.shower')!;
    expect(shower.placeholder).toBeUndefined();
    expect(shower.prerequisites).toContain('comet.flyby');
    expect(shower.effects.cometShowerChanceFlat).toBe(0.25);
  });

  it('the density/respawn engine family is live: crowded space, gravity pull, fission, nebula', () => {
    for (const id of ['hub.crowd1', 'hub.crowd2', 'hub.crowd3']) {
      expect(UPGRADE_NODE_MAP.get(id)!.effects.fieldTargetFlat).toBe(12);
    }
    for (const id of ['hub.pull1', 'hub.pull2', 'hub.pull3']) {
      expect(UPGRADE_NODE_MAP.get(id)!.effects.spawnOnKillChanceFlat).toBeCloseTo(0.2, 6);
    }
    for (const id of ['planet.fission1', 'planet.fission2']) {
      expect(UPGRADE_NODE_MAP.get(id)!.effects.planetRespawnChanceFlat).toBeCloseTo(0.25, 6);
    }
    for (const id of ['star.nebula1', 'star.nebula2']) {
      expect(UPGRADE_NODE_MAP.get(id)!.effects.starRespawnChanceFlat).toBeCloseTo(0.25, 6);
    }
    // Full ladders land on their caps (epsilon absorbs float summing), so no purchased rank is wasted.
    expect(0.2 * 3).toBeLessThanOrEqual(UPGRADE_TUNING.spawnOnKillCap + 1e-9);
    expect(0.25 * 2).toBeLessThanOrEqual(UPGRADE_TUNING.categoryRespawnCap + 1e-9);
  });

  it('orb branch is live (not placeholder) and the spark node is a keystone granting the orbs flag', () => {
    const spark = UPGRADE_NODE_MAP.get('orb.spark')!;
    expect(spark.placeholder).toBeUndefined();
    expect(spark.keystone).toBe(true);
    expect(spark.flags).toContain('orbs');
    expect(spark.effects.orbChanceFlat).toBeGreaterThan(0);
    expect(spark.effects.orbDamageFlat).toBeGreaterThan(0);
    expect(spark.effects.orbBounceFlat).toBe(2);
    const chains = UPGRADE_NODE_MAP.get('orb.chains')!;
    expect(chains.placeholder).toBeUndefined();
    expect(chains.prerequisites).toContain('orb.spark');
    expect(chains.effects.orbBounceFlat).toBe(2);
  });
});
