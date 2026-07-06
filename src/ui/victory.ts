import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import { formatAmount } from './format';

export function createVictoryOverlay(bus: EventBus<GameEvents>): void {
  const overlay = document.createElement('div');
  overlay.id = 'victory';
  overlay.classList.add('hidden');
  overlay.innerHTML = `
    <div class="victory-panel">
      <h2>Galaxy Devoured</h2>
      <p class="victory-line">Your black hole sits at the center of a galaxy, consuming everything</p>
      <div class="victory-summary">
        <span class="victory-mass" data-victory="mass">0</span>
        <span class="victory-mass-label">Lifetime Mass</span>
      </div>
      <div class="victory-actions">
        <button class="victory-continue" type="button">Keep Feeding</button>
      </div>
    </div>
  `;
  document.body.append(overlay);

  overlay.querySelector('.victory-continue')!.addEventListener('click', () => {
    overlay.classList.add('hidden');
  });

  // Defensive: any path that starts a session must never leave the victory overlay covering play.
  bus.on('sessionStarted', () => overlay.classList.add('hidden'));

  bus.on('victoryAchieved', ({ mass }) => {
    const massLabel = overlay.querySelector('[data-victory="mass"]');
    if (massLabel) massLabel.textContent = formatAmount(mass);
    overlay.classList.remove('hidden');
  });
}
