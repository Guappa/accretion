import {
  UPGRADE_CLUSTERS,
  UPGRADE_EXPANSION_SLOTS,
  UPGRADE_NODES,
  UPGRADE_NODE_MAP,
  type UpgradeNode,
} from '../config/upgrades';

export interface GridPoint {
  gx: number;
  gy: number;
}

export interface WorldBounds {
  minGx: number;
  minGy: number;
  maxGx: number;
  maxGy: number;
}

export interface ViewTransform {
  x: number;
  y: number;
  scale: number;
}

export function absoluteGrid(node: UpgradeNode): GridPoint {
  // Look up cluster origin, default to (0, 0) if not found
  const cluster = UPGRADE_CLUSTERS.find((candidate) => candidate.id === node.clusterId);
  return {
    gx: (cluster?.originGx ?? 0) + node.gx,
    gy: (cluster?.originGy ?? 0) + node.gy,
  };
}

export function worldBounds(coreCell: GridPoint): WorldBounds {
  // Sweep every rendered cell (core, nodes, expansion slots) so nothing can land outside the world box.
  let minGx = coreCell.gx;
  let maxGx = coreCell.gx;
  let minGy = coreCell.gy;
  let maxGy = coreCell.gy;
  const extend = (point: GridPoint): void => {
    minGx = Math.min(minGx, point.gx);
    maxGx = Math.max(maxGx, point.gx);
    minGy = Math.min(minGy, point.gy);
    maxGy = Math.max(maxGy, point.gy);
  };
  for (const node of UPGRADE_NODES) extend(absoluteGrid(node));
  for (const slot of UPGRADE_EXPANSION_SLOTS) {
    const anchor = UPGRADE_NODE_MAP.get(slot.attachedTo);
    if (!anchor) continue;
    const anchorPoint = absoluteGrid(anchor);
    extend({ gx: anchorPoint.gx + slot.dgx, gy: anchorPoint.gy + slot.dgy });
  }
  return { minGx, maxGx, minGy, maxGy };
}

export function gridToPx(point: GridPoint, cellPx: number, bounds: WorldBounds): { x: number; y: number } {
  // Shift by the world minimum plus a one-cell margin so the topmost/leftmost cell still lands at positive pixels.
  return {
    x: (point.gx - bounds.minGx + 1) * cellPx,
    y: (point.gy - bounds.minGy + 1) * cellPx,
  };
}

export function worldSizePx(bounds: WorldBounds, cellPx: number): { width: number; height: number } {
  // One margin cell on each side of the grid span, mirroring gridToPx's +1 shift.
  return {
    width: (bounds.maxGx - bounds.minGx + 2) * cellPx,
    height: (bounds.maxGy - bounds.minGy + 2) * cellPx,
  };
}

export function clusterEdges(): Array<{ from: string; to: string }> {
  // Find all orthogonal adjacent pairs within same cluster, deduped by ordering
  const edges: Array<{ from: string; to: string }> = [];
  for (const a of UPGRADE_NODES) {
    for (const b of UPGRADE_NODES) {
      if (a.clusterId !== b.clusterId) continue;
      const adjacent = Math.abs(a.gx - b.gx) + Math.abs(a.gy - b.gy) === 1;
      const ordered = a.gx < b.gx || (a.gx === b.gx && a.gy < b.gy);
      if (adjacent && ordered) edges.push({ from: a.id, to: b.id });
    }
  }
  return edges;
}

export function prerequisiteEdges(): Array<{ from: string; to: string }> {
  // Real dependency edges, drawn heavier than the decorative adjacency lattice.
  const edges: Array<{ from: string; to: string }> = [];
  for (const node of UPGRADE_NODES) {
    for (const prerequisite of node.prerequisites) edges.push({ from: prerequisite, to: node.id });
  }
  return edges;
}

export function coreSpokes(coreCell: GridPoint): UpgradeNode[] {
  // Nodes orthogonally touching the core are the spokes radiating from the black hole.
  return UPGRADE_NODES.filter((node) => {
    const abs = absoluteGrid(node);
    return Math.abs(abs.gx - coreCell.gx) + Math.abs(abs.gy - coreCell.gy) === 1;
  });
}

export function zoomAt(
  view: ViewTransform,
  cursorX: number,
  cursorY: number,
  factor: number,
  minScale: number,
  maxScale: number,
): ViewTransform {
  // Clamp new scale to [min, max]
  const scale = Math.min(Math.max(view.scale * factor, minScale), maxScale);
  const ratio = scale / view.scale;
  // Keep world point under cursor fixed during zoom
  return {
    x: cursorX - (cursorX - view.x) * ratio,
    y: cursorY - (cursorY - view.y) * ratio,
    scale,
  };
}
