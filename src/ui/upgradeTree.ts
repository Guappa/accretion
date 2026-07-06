import { massRequirementForPath } from '../config/stages';
import { TREE_UI } from '../config/treeUi';
import {
  UPGRADE_CLUSTERS,
  UPGRADE_EXPANSION_SLOTS,
  UPGRADE_NODES,
  UPGRADE_NODE_MAP,
  UPGRADE_TRUNKS,
  type UpgradeNode,
} from '../config/upgrades';
import { canPurchase, nodeCost } from '../game/upgrades/costModel';
import type { SoundEngine } from '../audio/SoundEngine';
import { GameState } from '../state/GameState';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import {
  absoluteGrid,
  coreSpokes,
  gridToPx,
  prerequisiteEdges,
  routeWaypoints,
  trunkRoute,
  worldBounds,
  worldSizePx,
  zoomAt,
  type ViewTransform,
} from './upgradeTreeLayout';
import { formatAmount } from './format';

const SVG_NS = 'http://www.w3.org/2000/svg';

interface EdgeRef {
  element: SVGLineElement | SVGPolylineElement;
  fromId: string | null;
  toId: string;
}

export function createUpgradeTree(
  gameState: GameState,
  soundEngine: SoundEngine,
  bus: EventBus<GameEvents>,
): { open(): void } {
  let overlay: HTMLDivElement | null = null;
  let world: HTMLDivElement | null = null;
  let detail: HTMLDivElement | null = null;
  let matterLabel: HTMLElement | null = null;
  let tooltip: HTMLDivElement | null = null;
  const nodeButtons = new Map<string, HTMLButtonElement>();
  const edgeRefs: EdgeRef[] = [];
  let selectedId: string | null = null;
  let view: ViewTransform = { x: 40, y: 40, scale: 1 };
  const corePoint = { gx: TREE_UI.core.gx, gy: TREE_UI.core.gy };
  const bounds = worldBounds(corePoint);

  function nodePx(node: UpgradeNode): { x: number; y: number } {
    return gridToPx(absoluteGrid(node), TREE_UI.cellPx, bounds);
  }

  function clusterColor(node: UpgradeNode): string {
    const cluster = UPGRADE_CLUSTERS.find((candidate) => candidate.id === node.clusterId);
    return `#${(cluster?.color ?? 0x8b5cf6).toString(16).padStart(6, '0')}`;
  }

  function build(): void {
    overlay = document.createElement('div');
    overlay.id = 'upgrade-tree';
    overlay.innerHTML = `
      <header class="tree-header">
        <h2>Upgrades</h2>
        <span class="tree-matter"></span>
        <button class="tree-close" type="button">Close</button>
      </header>
      <div class="tree-stage"><div class="tree-world"></div></div>
      <div class="tree-detail"><p class="tree-detail-hint">Select an upgrade.</p></div>
      <div class="tree-tooltip" hidden></div>
    `;
    document.body.append(overlay);
    world = overlay.querySelector('.tree-world') as HTMLDivElement;
    detail = overlay.querySelector('.tree-detail') as HTMLDivElement;
    matterLabel = overlay.querySelector('.tree-matter') as HTMLElement;
    tooltip = overlay.querySelector('.tree-tooltip') as HTMLDivElement;
    (overlay.querySelector('.tree-close') as HTMLButtonElement).addEventListener('click', close);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && overlay && !overlay.classList.contains('hidden')) close();
    });
    buildWorld();
    bindPanZoom();
    gameState.subscribe(() => {
      if (overlay && !overlay.classList.contains('hidden')) refresh();
    });
    bus.on('sessionStarted', close); // Self-heals: tree closes the instant any session starts, from any entry point.
  }

  function buildWorld(): void {
    if (!world) return;
    // Size the world to the actual node span so no edge or node ever clips at the SVG bounds.
    const size = worldSizePx(bounds, TREE_UI.cellPx);
    world.style.width = `${size.width}px`;
    world.style.height = `${size.height}px`;
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.classList.add('tree-edges');
    world.append(svg);
    const corePxPos = gridToPx(corePoint, TREE_UI.cellPx, bounds);
    const core = document.createElement('div');
    core.className = 'tree-core';
    core.style.left = `${corePxPos.x}px`;
    core.style.top = `${corePxPos.y}px`;
    core.style.width = `${TREE_UI.core.radiusPx * 2}px`;
    core.style.height = `${TREE_UI.core.radiusPx * 2}px`;
    world.append(core);
    for (const spoke of coreSpokes(corePoint)) {
      // fromId null: the core is always "lit", so spoke brightness follows the spoke node alone.
      addLine(svg, corePxPos, nodePx(spoke), '#8b5cf6', null, spoke.id);
    }
    // Only real gates get drawn: prereq edges plus the trunks/spokes below - a visible connection always means "this unlocks that".
    const trunkPairs = new Set(UPGRADE_TRUNKS.map((trunk) => `${trunk.from}|${trunk.to}`));
    for (const edge of prerequisiteEdges()) {
      // Trunk-gated entries render as the elbow below, not a straight cross-map line on top of it.
      if (trunkPairs.has(`${edge.from}|${edge.to}`)) continue;
      const from = UPGRADE_NODE_MAP.get(edge.from);
      const to = UPGRADE_NODE_MAP.get(edge.to);
      if (from && to) addLine(svg, nodePx(from), nodePx(to), clusterColor(to), from.id, to.id);
    }
    for (const trunk of UPGRADE_TRUNKS) {
      const from = UPGRADE_NODE_MAP.get(trunk.from);
      const to = UPGRADE_NODE_MAP.get(trunk.to);
      if (!from || !to) continue;
      // Drawn trunks follow trunkRoute exactly, the same cells the no-collision invariant certifies.
      const waypoints = routeWaypoints(trunkRoute(absoluteGrid(from), absoluteGrid(to), trunk.corner)).map(
        (cell) => gridToPx(cell, TREE_UI.cellPx, bounds),
      );
      addPolyline(svg, waypoints, clusterColor(to), from.id, to.id);
    }
    for (const node of UPGRADE_NODES) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `tree-node${node.keystone ? ' keystone' : ''}`;
      const { x, y } = nodePx(node);
      button.style.left = `${x}px`;
      button.style.top = `${y}px`;
      button.style.setProperty('--path-color', clusterColor(node));
      button.textContent = TREE_UI.iconGlyphs[node.icon] ?? '?';
      button.addEventListener('click', () => select(node.id));
      button.addEventListener('mouseenter', () => showTooltip(button, node));
      button.addEventListener('mouseleave', hideTooltip);
      nodeButtons.set(node.id, button);
      world.append(button);
    }
    for (const slot of UPGRADE_EXPANSION_SLOTS) {
      const anchor = UPGRADE_NODE_MAP.get(slot.attachedTo);
      if (!anchor) continue;
      const anchorPoint = absoluteGrid(anchor);
      const point = gridToPx(
        { gx: anchorPoint.gx + slot.dgx, gy: anchorPoint.gy + slot.dgy },
        TREE_UI.cellPx,
        bounds,
      );
      // Synthetic toId is never purchased, so the slot edge stays on the frontier/dim rungs.
      addElbow(svg, nodePx(anchor), point, '#64748b', anchor.id, `slot:${slot.label}`);
      const lock = document.createElement('button');
      lock.type = 'button';
      lock.className = 'tree-lock';
      lock.style.left = `${point.x}px`;
      lock.style.top = `${point.y}px`;
      lock.textContent = '\u{1F512}';
      lock.title = slot.label; // Desktop hover bonus; click below covers touch/no-hover input.
      lock.addEventListener('click', () => showLockDetail(slot.label));
      world.append(lock);
    }
  }

  function registerEdge(
    element: SVGLineElement | SVGPolylineElement,
    color: string,
    fromId: string | null,
    toId: string,
  ): void {
    element.style.stroke = color;
    element.style.strokeOpacity = String(TREE_UI.edges.mainDim);
    element.setAttribute('stroke-width', String(TREE_UI.edges.mainWidth));
    edgeRefs.push({ element, fromId, toId });
  }

  function addLine(
    svg: SVGSVGElement,
    from: { x: number; y: number },
    to: { x: number; y: number },
    color: string,
    fromId: string | null,
    toId: string,
  ): void {
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', String(from.x));
    line.setAttribute('y1', String(from.y));
    line.setAttribute('x2', String(to.x));
    line.setAttribute('y2', String(to.y));
    registerEdge(line, color, fromId, toId);
    svg.append(line);
  }

  function addPolyline(
    svg: SVGSVGElement,
    points: Array<{ x: number; y: number }>,
    color: string,
    fromId: string,
    toId: string,
  ): void {
    const path = document.createElementNS(SVG_NS, 'polyline');
    path.setAttribute('points', points.map((point) => `${point.x},${point.y}`).join(' '));
    path.style.fill = 'none';
    registerEdge(path, color, fromId, toId);
    svg.append(path);
  }

  // Orthogonal L-connector (long axis first, then a short perpendicular jog) for expansion-slot teasers, which have no route data.
  function addElbow(
    svg: SVGSVGElement,
    from: { x: number; y: number },
    to: { x: number; y: number },
    color: string,
    fromId: string,
    toId: string,
  ): void {
    const corner =
      Math.abs(to.y - from.y) > Math.abs(to.x - from.x)
        ? { x: from.x, y: to.y }
        : { x: to.x, y: from.y };
    addPolyline(svg, [from, corner, to], color, fromId, toId);
  }

  function refreshEdges(purchased: ReadonlySet<string>): void {
    // Purchased-to-purchased brightest, edges touching the owned frontier next, fully locked territory dimmest.
    for (const edge of edgeRefs) {
      const fromOwned = edge.fromId === null || purchased.has(edge.fromId);
      const toOwned = purchased.has(edge.toId);
      const opacity =
        fromOwned && toOwned
          ? TREE_UI.edges.mainLit
          : fromOwned || toOwned
            ? TREE_UI.edges.mainFrontier
            : TREE_UI.edges.mainDim;
      edge.element.style.strokeOpacity = String(opacity);
    }
  }

  function bindPanZoom(): void {
    const stage = overlay?.querySelector('.tree-stage') as HTMLDivElement;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    stage.addEventListener('pointerdown', (event) => {
      if ((event.target as HTMLElement).closest('button')) return;
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
      stage.setPointerCapture(event.pointerId);
    });
    stage.addEventListener('pointermove', (event) => {
      if (!dragging) return;
      view = { ...view, x: view.x + event.clientX - lastX, y: view.y + event.clientY - lastY };
      lastX = event.clientX;
      lastY = event.clientY;
      applyView();
    });
    stage.addEventListener('pointerup', () => {
      dragging = false;
    });
    stage.addEventListener('pointercancel', () => {
      dragging = false; // Recover from interrupted gestures (e.g. touch cancel) so drag doesn't get stuck.
    });
    stage.addEventListener('wheel', (event) => {
      event.preventDefault();
      const bounds = stage.getBoundingClientRect();
      const factor = event.deltaY < 0 ? TREE_UI.zoomWheelFactor : 1 / TREE_UI.zoomWheelFactor;
      view = zoomAt(
        view,
        event.clientX - bounds.left,
        event.clientY - bounds.top,
        factor,
        TREE_UI.zoomMin,
        TREE_UI.zoomMax,
      );
      applyView();
    });
  }

  function applyView(): void {
    if (world) world.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
  }

  function stateOf(node: UpgradeNode): { className: string; check: ReturnType<typeof canPurchase>; cost: number } {
    const snapshot = gameState.snapshot();
    const purchased = new Set(snapshot.purchasedNodes);
    const check = canPurchase(node, purchased, snapshot.matter, snapshot.mass);
    const cost = nodeCost(node, purchased, snapshot.mass);
    // Mass-gated nodes get their own class so the lock badge marks them apart from plain prerequisite blocks.
    const className = purchased.has(node.id)
      ? 'purchased'
      : check.allowed
        ? 'affordable'
        : check.reason === 'mass'
          ? 'locked mass-gated'
          : 'locked';
    return { className, check, cost };
  }

  function refresh(): void {
    const snapshot = gameState.snapshot();
    if (matterLabel) matterLabel.textContent = `${formatAmount(snapshot.matter)} matter`;
    for (const node of UPGRADE_NODES) {
      const button = nodeButtons.get(node.id);
      if (!button) continue;
      const { className } = stateOf(node);
      button.className = `tree-node${node.keystone ? ' keystone' : ''} ${className}${selectedId === node.id ? ' selected' : ''}`;
    }
    refreshEdges(new Set(snapshot.purchasedNodes));
    renderDetail();
  }

  function select(nodeId: string): void {
    selectedId = nodeId;
    refresh();
  }

  function showLockDetail(label: string): void {
    // Deselect any node so refresh() won't repaint over the lock's own detail text.
    selectedId = null;
    // Drop the outline directly - a full refresh would clobber the lock text below.
    for (const button of nodeButtons.values()) button.classList.remove('selected');
    if (!detail) return;
    detail.replaceChildren();
    const title = document.createElement('h3');
    title.textContent = 'Locked slot';
    const description = document.createElement('p');
    description.textContent = label;
    detail.append(title, description);
  }

  function renderDetail(): void {
    if (!detail) return;
    detail.replaceChildren();
    const node = selectedId ? UPGRADE_NODE_MAP.get(selectedId) : undefined;
    if (!node) {
      const hint = document.createElement('p');
      hint.className = 'tree-detail-hint';
      hint.textContent = 'Select an upgrade.';
      detail.append(hint);
      return;
    }
    const { check, cost, className } = stateOf(node);
    const title = document.createElement('h3');
    title.textContent = node.name;
    const description = document.createElement('p');
    description.textContent = node.description;
    // Name the missing gates (e.g. a branch entry's hub node) so the player knows where to unlock toward.
    const purchased = new Set(gameState.snapshot().purchasedNodes);
    const missingNames = node.prerequisites
      .filter((id) => !purchased.has(id))
      .map((id) => UPGRADE_NODE_MAP.get(id)?.name ?? id)
      .join(', ');
    const price = document.createElement('p');
    price.className = 'tree-price';
    price.textContent =
      className === 'purchased'
        ? 'Owned'
        : check.reason === 'placeholder'
          ? 'Coming soon'
          : check.reason === 'prerequisite'
            ? `Requires ${missingNames} · ${formatAmount(cost)} matter`
            : check.reason === 'mass'
              ? `Requires ${formatAmount(Math.max(node.massRequirement ?? 0, massRequirementForPath(node.pathId)))} mass · ${formatAmount(cost)} matter`
              : `${formatAmount(cost)} matter`;
    detail.append(title, description, price);
    // Placeholder stubs are hard-blocked and never purchasable - the "Coming soon" price line above stands alone, no Buy button.
    if (check.reason !== 'placeholder' && className !== 'purchased') {
      const buy = document.createElement('button');
      buy.type = 'button';
      buy.className = 'tree-buy';
      buy.textContent = check.allowed ? `Buy — ${formatAmount(cost)}` : 'Locked';
      buy.disabled = !check.allowed;
      buy.addEventListener('click', () => attemptPurchase(node));
      detail.append(buy);
    }
  }

  function attemptPurchase(node: UpgradeNode): void {
    // Re-check against a fresh snapshot at click time - the button's gating snapshot may be stale.
    const snapshot = gameState.snapshot();
    const purchased = new Set(snapshot.purchasedNodes);
    const check = canPurchase(node, purchased, snapshot.matter, snapshot.mass);
    if (!check.allowed) return;
    if (gameState.purchaseNode(node.id, nodeCost(node, purchased, snapshot.mass))) {
      soundEngine.play('purchase');
    }
  }

  function showTooltip(button: HTMLButtonElement, node: UpgradeNode): void {
    if (window.matchMedia('(pointer: coarse)').matches) return; // Touch has no hover; skip entirely per spec.
    if (!tooltip) return;
    const { check, cost, className } = stateOf(node);
    tooltip.replaceChildren();
    const title = document.createElement('h4');
    title.textContent = node.name;
    const body = document.createElement('div');
    body.textContent = node.description;
    const price = document.createElement('div');
    price.className = 'tree-price';
    price.textContent =
      className === 'purchased' ? 'Owned' : `${formatAmount(cost)} matter · ${check.allowed ? 'Available' : 'Locked'}`;
    tooltip.append(title, body, price);
    tooltip.hidden = false;
    const rect = button.getBoundingClientRect();
    const tipRect = tooltip.getBoundingClientRect();
    let left = rect.right + 12;
    if (left + tipRect.width > window.innerWidth - 10) left = rect.left - tipRect.width - 12;
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${Math.min(rect.top, window.innerHeight - tipRect.height - 10)}px`;
  }

  function hideTooltip(): void {
    if (tooltip) tooltip.hidden = true;
  }

  function close(): void {
    overlay?.classList.add('hidden');
    hideTooltip();
  }

  return {
    open(): void {
      if (!overlay) build();
      overlay?.classList.remove('hidden');
      const stage = overlay?.querySelector('.tree-stage') as HTMLDivElement | null;
      if (stage) {
        // Recenter on the core every open, regardless of any prior pan.
        const rect = stage.getBoundingClientRect();
        const corePx = gridToPx(corePoint, TREE_UI.cellPx, bounds);
        view = { x: rect.width / 2 - corePx.x * view.scale, y: rect.height / 2 - corePx.y * view.scale, scale: view.scale };
      }
      applyView();
      refresh();
    },
  };
}
