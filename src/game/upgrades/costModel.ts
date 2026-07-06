import { massRequirementForPath } from '../../config/stages';
import { UPGRADE_NODE_MAP, UPGRADE_TUNING, type UpgradeNode } from '../../config/upgrades';

export type PurchaseBlock = 'ok' | 'owned' | 'prerequisite' | 'mass' | 'matter' | 'placeholder';

export function nodeCost(node: UpgradeNode, purchased: ReadonlySet<string>, mass: number): number {
  // Hub nodes never inflate and never scale with mass - flat price is the whole point.
  if (node.pathId === 'hub') return node.baseCost;
  let pathPurchases = 0;
  for (const purchasedId of purchased) {
    const purchasedNode = UPGRADE_NODE_MAP.get(purchasedId);
    if (purchasedNode && purchasedNode.pathId === node.pathId) pathPurchases++;
  }
  // Dormant placeholder: inflation and mass scaling are tuned to 0 for the full-clear economy (static per-node prices), kept live so build 2 can re-lever them without re-plumbing.
  const inflation = Math.pow(1 + UPGRADE_TUNING.pathInflation, pathPurchases);
  const massScale = 1 + UPGRADE_TUNING.massCostFactor * Math.log10(1 + mass);
  return Math.max(1, Math.round(node.baseCost * inflation * massScale));
}

export function canPurchase(
  node: UpgradeNode,
  purchased: ReadonlySet<string>,
  matter: number,
  mass: number,
): { allowed: boolean; reason: PurchaseBlock } {
  if (node.placeholder) return { allowed: false, reason: 'placeholder' }; // Hard block: never purchasable regardless of mass/matter, mechanic not shipped yet
  if (purchased.has(node.id)) return { allowed: false, reason: 'owned' };
  for (const prerequisite of node.prerequisites) {
    if (!purchased.has(prerequisite)) return { allowed: false, reason: 'prerequisite' };
  }
  // Stage gate first: a path locked behind a later mass stage blocks before any node-level or matter check.
  if (mass < massRequirementForPath(node.pathId)) return { allowed: false, reason: 'mass' };
  if (node.massRequirement !== undefined && mass < node.massRequirement) {
    return { allowed: false, reason: 'mass' };
  }
  if (matter < nodeCost(node, purchased, mass)) return { allowed: false, reason: 'matter' };
  return { allowed: true, reason: 'ok' };
}
