import { ENDGAME } from '../config/endgame';
import { SESSION_CONFIG } from '../config/session';
import { PROGRESSION_STAGES, stageForMass } from '../config/stages';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import { GameState } from '../state/GameState';
import { formatAmount } from './format';

export function createHud(gameState: GameState, bus: EventBus<GameEvents>): void {
  const root = document.createElement('div');
  root.id = 'hud';
  root.innerHTML = `
    <div class="hud-panel">
      <span class="hud-matter">0</span>
      <span class="hud-label">matter</span>
      <span class="hud-mass">mass 0</span>
      <span class="hud-stage"></span>
    </div>
    <div class="hud-timer">${SESSION_CONFIG.baseDurationSeconds.toFixed(1)}s</div>
  `;
  document.body.append(root);

  const matterLabel = root.querySelector('.hud-matter') as HTMLElement;
  const massLabel = root.querySelector('.hud-mass') as HTMLElement;
  const stageLabel = root.querySelector('.hud-stage') as HTMLElement;
  const timerLabel = root.querySelector('.hud-timer') as HTMLElement;

  const paintWallet = ({ matter, mass }: { matter: number; mass: number }): void => {
    matterLabel.textContent = formatAmount(matter);
    massLabel.textContent = `mass ${formatAmount(mass)}`;
    const stage = stageForMass(mass);
    const next = PROGRESSION_STAGES[PROGRESSION_STAGES.indexOf(stage) + 1];
    // Final stage has no next threshold, so the line falls back to progress toward the victory goal.
    // Progress is measured within the current stage so each new stage starts near 0% instead of inheriting the old percent.
    stageLabel.textContent = next
      ? `${stage.name} · ${Math.min(100, Math.floor(((mass - stage.massThreshold) / (next.massThreshold - stage.massThreshold)) * 100))}% to ${next.name}`
      : `${stage.name} · goal ${Math.min(100, Math.floor((mass / ENDGAME.victoryMassGoal) * 100))}%`;
  };
  gameState.subscribe(paintWallet);
  // Save restore happens before the HUD exists, so paint the current snapshot at boot.
  paintWallet(gameState.snapshot());
  bus.on('sessionStarted', ({ durationSeconds }) => {
    timerLabel.textContent = `${durationSeconds.toFixed(1)}s`;
  });
  bus.on('sessionTick', ({ remainingSeconds }) => {
    timerLabel.textContent = `${remainingSeconds.toFixed(1)}s`;
    timerLabel.classList.toggle('low-time', remainingSeconds <= 5);
  });
  bus.on('sessionEnded', () => {
    timerLabel.textContent = '0.0s';
    timerLabel.classList.remove('low-time');
  });
}
