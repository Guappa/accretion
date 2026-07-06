import { describe, expect, it } from 'vitest';
import { PROGRESSION_STAGES } from '../../config/stages';
import { UPGRADE_NODE_MAP, UPGRADE_NODES } from '../../config/upgrades';
import { canPurchase, nodeCost } from './costModel';

// Derived from the stage table so threshold retunes never silently break the gating intent.
const [, intermediateStage, supermassiveStage, galacticCoreStage] = PROGRESSION_STAGES;

const staticCharge = UPGRADE_NODE_MAP.get('cl.static')!;
const chainOne = UPGRADE_NODE_MAP.get('cl.chain1')!;
const hubSize1 = UPGRADE_NODE_MAP.get('hub.size1')!;
const planetUnlock = UPGRADE_NODE_MAP.get('planet.unlock')!;
const starUnlock = UPGRADE_NODE_MAP.get('star.unlock')!;
const orbSpark = UPGRADE_NODE_MAP.get('orb.spark')!;
const allHubNodeIds = ['hub.size1', 'hub.tick1', 'hub.damage1', 'hub.crit1', 'hub.critDamage1', 'hub.time1'];

describe('nodeCost', () => {
  it('hub node price is flat regardless of purchases and mass', () => {
    const purchased = new Set(['cl.static', 'cl.chain1', 'hub.size1']);
    expect(nodeCost(hubSize1, purchased, 100000)).toBe(hubSize1.baseCost);
  });

  it('a path node with zero path purchases and zero mass costs base cost', () => {
    expect(nodeCost(staticCharge, new Set(), 0)).toBe(staticCharge.baseCost);
  });

  it('hub purchases do not inflate path prices', () => {
    expect(nodeCost(staticCharge, new Set(allHubNodeIds), 0)).toBe(staticCharge.baseCost);
  });

  // Full-clear economy: prices are static per node so the whole tree is affordable in one run; inflation is a zeroed placeholder for build 2.
  it('same-path purchases no longer raise prices - every node sells at its static base cost', () => {
    expect(nodeCost(chainOne, new Set(['cl.static', 'cl.damage1']), 0)).toBe(chainOne.baseCost);
    expect(nodeCost(chainOne, new Set(['planet.unlock']), 0)).toBe(chainOne.baseCost);
  });

  // Mass scaling is likewise zeroed: a late-game wallet buys early nodes at the printed price.
  it('mass does not scale any node price', () => {
    expect(nodeCost(staticCharge, new Set(), 1_000_000)).toBe(staticCharge.baseCost);
    expect(nodeCost(hubSize1, new Set(), 1_000_000)).toBe(hubSize1.baseCost);
  });

  it('every node costs exactly its base cost with no purchases', () => {
    for (const node of UPGRADE_NODES) {
      expect(nodeCost(node, new Set(), 0), node.id).toBe(node.baseCost);
    }
  });
});

describe('canPurchase', () => {
  it('rejects an owned node', () => {
    expect(canPurchase(staticCharge, new Set(['cl.static']), 9999, 0).reason).toBe('owned');
  });

  it('rejects missing prerequisites', () => {
    expect(canPurchase(chainOne, new Set(), 9999, 0).reason).toBe('prerequisite');
  });

  it('rejects insufficient matter', () => {
    expect(canPurchase(staticCharge, new Set(), 1, 0).reason).toBe('matter');
  });

  it('allows a valid purchase', () => {
    const check = canPurchase(staticCharge, new Set(), staticCharge.baseCost, 0);
    expect(check.allowed).toBe(true);
    expect(check.reason).toBe('ok');
  });
});

describe('canPurchase stage gating', () => {
  it('blocks a planet node below the intermediate-mass threshold, allows it at the threshold', () => {
    expect(canPurchase(planetUnlock, new Set(), 9999999, intermediateStage.massThreshold - 1).reason).toBe('mass');
    expect(canPurchase(planetUnlock, new Set(), 9999999, intermediateStage.massThreshold).allowed).toBe(true);
  });

  it('blocks star and laser paths below the supermassive threshold', () => {
    expect(canPurchase(starUnlock, new Set(), 9999999, supermassiveStage.massThreshold - 1).reason).toBe('mass');
    expect(canPurchase(starUnlock, new Set(), 9999999, supermassiveStage.massThreshold).allowed).toBe(true);
    const laserBeam = UPGRADE_NODE_MAP.get('laser.beam')!;
    expect(canPurchase(laserBeam, new Set(), 9999999, supermassiveStage.massThreshold - 1).reason).toBe('mass');
    expect(canPurchase(laserBeam, new Set(), 9999999, supermassiveStage.massThreshold).allowed).toBe(true);
  });

  it('blocks the orb path below the galactic-core threshold', () => {
    expect(canPurchase(orbSpark, new Set(), 9999999, galacticCoreStage.massThreshold - 1).reason).toBe('mass');
    expect(canPurchase(orbSpark, new Set(), 9999999, galacticCoreStage.massThreshold).allowed).toBe(true);
  });

  it('the stage gate outranks the matter check - a rich wallet still reads mass-locked', () => {
    expect(canPurchase(orbSpark, new Set(), 1, 0).reason).toBe('mass');
  });

  it('stage-1 paths are never mass gated', () => {
    expect(canPurchase(staticCharge, new Set(), 9999, 0).allowed).toBe(true);
    const goldenSpawn = UPGRADE_NODE_MAP.get('golden.spawn')!;
    expect(canPurchase(goldenSpawn, new Set(), 9999, 0).allowed).toBe(true);
  });
});
