import { describe, expect, it } from 'vitest';
import { UPGRADE_CLUSTERS, UPGRADE_NODES, UPGRADE_NODE_MAP, UPGRADE_TRUNKS } from '../config/upgrades';
import {
  absoluteGrid,
  coreSpokes,
  gridToPx,
  prerequisiteEdges,
  worldBounds,
  worldSizePx,
  zoomAt,
  type WorldBounds,
} from './upgradeTreeLayout';

const CORE = { gx: 2, gy: 2 };
const CELL = 72;

describe('absoluteGrid', () => {
  it('offsets node coordinates by the cluster origin', () => {
    const staticCharge = UPGRADE_NODE_MAP.get('cl.static')!;
    const cluster = UPGRADE_CLUSTERS.find((candidate) => candidate.id === staticCharge.clusterId)!;
    const point = absoluteGrid(staticCharge);
    expect(point.gx).toBe(cluster.originGx + staticCharge.gx);
    expect(point.gy).toBe(cluster.originGy + staticCharge.gy);
  });
});

describe('gridToPx', () => {
  // Same expected pixels as the old fixed mapping: a zero-minimum bounds reduces to the legacy one-cell margin.
  it('adds a one-cell margin when the world minimum is the origin', () => {
    const zeroBounds: WorldBounds = { minGx: 0, minGy: 0, maxGx: 5, maxGy: 5 };
    expect(gridToPx({ gx: 0, gy: 0 }, CELL, zeroBounds)).toEqual({ x: 72, y: 72 });
    expect(gridToPx({ gx: 2, gy: 1 }, CELL, zeroBounds)).toEqual({ x: 216, y: 144 });
  });

  it('shifts negative grid minima into positive pixel space', () => {
    const bounds: WorldBounds = { minGx: -5, minGy: -7, maxGx: 11, maxGy: 9 };
    expect(gridToPx({ gx: -5, gy: -7 }, CELL, bounds)).toEqual({ x: 72, y: 72 });
    expect(gridToPx({ gx: 0, gy: 0 }, CELL, bounds)).toEqual({ x: 432, y: 576 });
  });
});

describe('worldBounds', () => {
  it('maps every node inside the world box with a full margin cell to spare', () => {
    const bounds = worldBounds(CORE);
    const size = worldSizePx(bounds, CELL);
    for (const node of UPGRADE_NODES) {
      const px = gridToPx(absoluteGrid(node), CELL, bounds);
      expect(px.x).toBeGreaterThanOrEqual(CELL);
      expect(px.y).toBeGreaterThanOrEqual(CELL);
      expect(px.x).toBeLessThanOrEqual(size.width - CELL);
      expect(px.y).toBeLessThanOrEqual(size.height - CELL);
    }
  });

  it('keeps the core cell inside the bounds', () => {
    const bounds = worldBounds(CORE);
    const px = gridToPx(CORE, CELL, bounds);
    expect(px.x).toBeGreaterThan(0);
    expect(px.y).toBeGreaterThan(0);
  });

  it('keeps both endpoints of every trunk inside the world box', () => {
    const bounds = worldBounds(CORE);
    const size = worldSizePx(bounds, CELL);
    for (const trunk of UPGRADE_TRUNKS) {
      for (const id of [trunk.from, trunk.to]) {
        const node = UPGRADE_NODE_MAP.get(id)!;
        const px = gridToPx(absoluteGrid(node), CELL, bounds);
        expect(px.x).toBeGreaterThan(0);
        expect(px.y).toBeGreaterThan(0);
        expect(px.x).toBeLessThan(size.width);
        expect(px.y).toBeLessThan(size.height);
      }
    }
  });
});

describe('prerequisiteEdges', () => {
  it('emits one edge per prerequisite entry, prerequisite first', () => {
    const edges = prerequisiteEdges();
    const total = UPGRADE_NODES.reduce((sum, node) => sum + node.prerequisites.length, 0);
    expect(edges.length).toBe(total);
    expect(edges).toContainEqual({ from: 'hub.size1', to: 'hub.size2' });
    expect(edges).toContainEqual({ from: 'cl.static', to: 'cl.fork' });
  });

  it('references only known nodes', () => {
    for (const edge of prerequisiteEdges()) {
      expect(UPGRADE_NODE_MAP.has(edge.from)).toBe(true);
      expect(UPGRADE_NODE_MAP.has(edge.to)).toBe(true);
    }
  });
});

// Repurposed from the removed clusterEdges lattice: the tree now draws prereq edges only,
// so every rendered connection must gate, and mere grid neighbors must not connect.
describe('rendered connections are real gates', () => {
  it('draws every prerequisite edge along the grid, except trunk gates which render as elbows', () => {
    // Branch entries gate on their trunk's hub-side node; that pair renders as the trunk elbow, not a straight line.
    const trunkPairs = new Set(UPGRADE_TRUNKS.map((trunk) => `${trunk.from}|${trunk.to}`));
    for (const edge of prerequisiteEdges()) {
      if (trunkPairs.has(`${edge.from}|${edge.to}`)) continue;
      const from = absoluteGrid(UPGRADE_NODE_MAP.get(edge.from)!);
      const to = absoluteGrid(UPGRADE_NODE_MAP.get(edge.to)!);
      expect(
        Math.abs(from.gx - to.gx) + Math.abs(from.gy - to.gy),
        `${edge.from}->${edge.to} would render as a diagonal or long jump`,
      ).toBe(1);
    }
  });

  it('adjacent pairs that do not gate each other are no longer connected', () => {
    // hub.damage1 and hub.time1 touch on the grid but neither unlocks the other; the old lattice drew them joined.
    const keys = prerequisiteEdges().map((edge) => `${edge.from}->${edge.to}`);
    expect(keys).not.toContain('hub.damage1->hub.time1');
    expect(keys).not.toContain('hub.time1->hub.damage1');
    expect(keys).not.toContain('hub.critDamage1->hub.damage1');
  });

  it('still connects the adjacency pairs that really gate, like crit into crit damage', () => {
    const keys = prerequisiteEdges().map((edge) => `${edge.from}->${edge.to}`);
    expect(keys).toContain('hub.crit1->hub.critDamage1');
    expect(keys).toContain('hub.size1->hub.size2');
    // Session Time I gained a real gate from its visible neighbor when free-floating roots were closed.
    expect(keys).toContain('hub.tick1->hub.time1');
  });

  it('every branch entry keystone is gated by its trunk pair', () => {
    const keys = new Set(prerequisiteEdges().map((edge) => `${edge.from}->${edge.to}`));
    for (const trunk of UPGRADE_TRUNKS) {
      expect(keys.has(`${trunk.from}->${trunk.to}`), `${trunk.from}->${trunk.to} must gate`).toBe(true);
    }
  });
});

describe('coreSpokes', () => {
  it('returns exactly the four hub nodes orthogonally adjacent to the core', () => {
    const ids = coreSpokes({ gx: 2, gy: 2 })
      .map((node) => node.id)
      .sort();
    expect(ids).toEqual(['hub.crit1', 'hub.damage1', 'hub.size1', 'hub.tick1']);
  });

  it('excludes hub corner nodes that are diagonal, not orthogonal, to the core', () => {
    const ids = coreSpokes({ gx: 2, gy: 2 }).map((node) => node.id);
    expect(ids).not.toContain('hub.critDamage1');
    expect(ids).not.toContain('hub.time1');
  });
});

describe('zoomAt', () => {
  it('clamps scale to the bounds', () => {
    const view = { x: 0, y: 0, scale: 1.9 };
    expect(zoomAt(view, 0, 0, 1.5, 0.5, 2).scale).toBe(2);
    expect(zoomAt({ ...view, scale: 0.55 }, 0, 0, 0.5, 0.5, 2).scale).toBe(0.5);
  });

  it('keeps the world point under the cursor fixed', () => {
    const view = { x: 40, y: -20, scale: 1 };
    const cursorX = 300;
    const cursorY = 200;
    const worldX = (cursorX - view.x) / view.scale;
    const worldY = (cursorY - view.y) / view.scale;
    const zoomed = zoomAt(view, cursorX, cursorY, 1.25, 0.5, 2);
    expect((cursorX - zoomed.x) / zoomed.scale).toBeCloseTo(worldX, 6);
    expect((cursorY - zoomed.y) / zoomed.scale).toBeCloseTo(worldY, 6);
  });
});
