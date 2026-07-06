import { UPGRADE_NODES, type EffectMap } from '../config/upgrades';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import { nodeCost } from '../game/upgrades/costModel';
import { GameState } from '../state/GameState';
import { SaveSystem } from '../state/SaveSystem';
import { formatAmount } from './format';

export interface DebugHooks {
  spawnStorm(count: number): void;
  setSessionTimer(seconds: number): void;
  applyDebugBuff(effects: EffectMap): void;
  clearDebugBuff(): void;
  setDriftFrozen(frozen: boolean): void;
  setTimerFrozen(frozen: boolean): void;
  fps(): number;
}

const REFRESH_INTERVAL_MS = 250;
const KILLS_WINDOW_MS = 1000;

function makeButton(label: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

export function createDebugPanel(
  gameState: GameState,
  bus: EventBus<GameEvents>,
  saveSystem: SaveSystem,
  getHooks: () => DebugHooks | null,
): void {
  let root: HTMLDivElement | null = null;
  let refreshTimer: ReturnType<typeof setInterval> | null = null;
  let refresh: (() => void) | null = null;
  // Local mirror of the session's frozen state so the button label can flip without asking the scene.
  let driftFrozen = false;
  // Local mirror of the session's timer-frozen state so the button label can flip without asking the scene.
  let timerFrozen = false;
  // objectBroken timestamps for the rolling kills/s window - pruned at push time so growth stays bounded even while the panel is closed.
  const killTimestamps: number[] = [];
  bus.on('objectBroken', () => {
    const now = performance.now();
    killTimestamps.push(now);
    while (killTimestamps.length > 0 && killTimestamps[0] < now - KILLS_WINDOW_MS) killTimestamps.shift();
  });

  function build(): HTMLDivElement {
    const panel = document.createElement('div');
    panel.id = 'debug-panel';
    panel.classList.add('hidden');

    const readouts = document.createElement('div');
    readouts.className = 'debug-readouts';
    const fpsLine = document.createElement('div');
    const killsLine = document.createElement('div');
    const walletLine = document.createElement('div');
    readouts.append(fpsLine, killsLine, walletLine);

    const walletSection = document.createElement('div');
    walletSection.className = 'debug-section';
    const matterButton = makeButton('+1k matter', () => gameState.collectMatter(1000));
    const massButton = makeButton('+10k mass', () => gameState.addMass(10000));
    const grantAllButton = makeButton('Grant all', () => {
      for (const node of UPGRADE_NODES) {
        const snapshot = gameState.snapshot();
        const purchased = new Set(snapshot.purchasedNodes);
        if (purchased.has(node.id)) continue;
        const cost = nodeCost(node, purchased, snapshot.mass);
        gameState.collectMatter(cost);
        gameState.purchaseNode(node.id, cost);
      }
    });
    const resetButton = makeButton('Reset purchases', () => gameState.resetPurchases());
    walletSection.append(matterButton, massButton, grantAllButton, resetButton);

    const sessionSection = document.createElement('div');
    sessionSection.className = 'debug-section';
    const timerInput = document.createElement('input');
    timerInput.type = 'number';
    timerInput.name = 'debug-timer-seconds';
    timerInput.value = '10';
    timerInput.className = 'debug-input';
    const setTimerButton = makeButton('Set timer', () => {
      getHooks()?.setSessionTimer(Number(timerInput.value));
    });
    const stormInput = document.createElement('input');
    stormInput.type = 'number';
    stormInput.name = 'debug-storm-count';
    stormInput.value = '150';
    stormInput.className = 'debug-input';
    const spawnStormButton = makeButton('Spawn storm', () => {
      getHooks()?.spawnStorm(Number(stormInput.value));
    });
    const freezeDriftButton = makeButton('Freeze drift', () => {
      const hooks = getHooks();
      if (!hooks) return;
      driftFrozen = !driftFrozen;
      hooks.setDriftFrozen(driftFrozen);
      freezeDriftButton.textContent = driftFrozen ? 'Unfreeze drift' : 'Freeze drift';
    });
    const freezeTimerButton = makeButton('Freeze timer', () => {
      const hooks = getHooks();
      if (!hooks) return;
      timerFrozen = !timerFrozen;
      hooks.setTimerFrozen(timerFrozen);
      freezeTimerButton.textContent = timerFrozen ? 'Unfreeze timer' : 'Freeze timer';
    });
    const sessionStatus = document.createElement('div');
    sessionStatus.className = 'debug-status';
    sessionSection.append(
      timerInput,
      setTimerButton,
      stormInput,
      spawnStormButton,
      freezeDriftButton,
      freezeTimerButton,
      sessionStatus,
    );

    const buffSection = document.createElement('div');
    buffSection.className = 'debug-section';
    const turboButton = makeButton('Turbo Breaker', () => {
      getHooks()?.applyDebugBuff({ tickIntervalFraction: -0.5, damagePerTickFlat: 20 });
    });
    const clearBuffButton = makeButton('Clear buff', () => {
      getHooks()?.clearDebugBuff();
    });
    buffSection.append(turboButton, clearBuffButton);

    const saveSection = document.createElement('div');
    saveSection.className = 'debug-section';
    const saveTextarea = document.createElement('textarea');
    saveTextarea.name = 'debug-save-json';
    saveTextarea.className = 'debug-save-textarea';
    const saveStatus = document.createElement('div');
    saveStatus.className = 'debug-status';
    const exportButton = makeButton('Export', () => {
      saveTextarea.value = saveSystem.exportJson();
      saveStatus.textContent = 'exported';
    });
    const importButton = makeButton('Import', () => {
      saveStatus.textContent = saveSystem.importJson(saveTextarea.value) ? 'import ok' : 'import failed';
    });
    const clearSaveButton = makeButton('Clear save', () => {
      saveSystem.clear();
      saveStatus.textContent = 'cleared — reload for fresh start';
    });
    saveSection.append(saveTextarea, exportButton, importButton, clearSaveButton, saveStatus);

    panel.append(readouts, walletSection, sessionSection, buffSection, saveSection);
    document.body.append(panel);

    refresh = (): void => {
      const hooks = getHooks();
      const fps = hooks?.fps() ?? 0;
      fpsLine.textContent = `FPS: ${fps.toFixed(1)}`;
      const now = performance.now();
      while (killTimestamps.length > 0 && now - killTimestamps[0] > KILLS_WINDOW_MS) {
        killTimestamps.shift();
      }
      killsLine.textContent = `kills/s: ${killTimestamps.length}`;
      const snapshot = gameState.snapshot();
      walletLine.textContent = `matter ${formatAmount(snapshot.matter)} / mass ${formatAmount(snapshot.mass)}`;
      sessionStatus.textContent = hooks ? '' : '(no active session)';
    };
    refresh();

    return panel;
  }

  function setVisible(visible: boolean): void {
    if (!root) root = build();
    root.classList.toggle('hidden', !visible);
    if (visible) {
      refresh?.();
      refreshTimer = setInterval(() => refresh?.(), REFRESH_INTERVAL_MS);
    } else if (refreshTimer !== null) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  }

  window.addEventListener('keydown', (event) => {
    if (event.key !== 'F2') return;
    event.preventDefault();
    const nowVisible = root === null || root.classList.contains('hidden');
    setVisible(nowVisible);
  });
}
