import type { UpgradePathId } from '../config/upgrades';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';

// Player-facing names for upgrade paths; node/cluster ids stay code-facing.
const PATH_LABELS: Record<UpgradePathId, string> = {
  hub: 'Core',
  chainLightning: 'Chain Lightning',
  planets: 'Planets',
  stars: 'Stars',
  golden: 'Golden Asteroids',
  radioactive: 'Radioactive',
  comet: 'Comets',
  laser: 'Lasers',
  orb: 'Orbs',
  moon: 'Moons',
};

export function createStageUpOverlay(bus: EventBus<GameEvents>): void {
  const overlay = document.createElement('div');
  overlay.id = 'stage-up';
  overlay.classList.add('hidden');
  overlay.innerHTML = `
    <div class="stage-up-panel">
      <p class="stage-up-kicker">Mass class reached</p>
      <h2 class="stage-up-name" data-stage="name"></h2>
      <p class="stage-up-line">Your black hole has grown to a new mass class</p>
      <p class="stage-up-unlocks" data-stage="unlocks"></p>
      <div class="stage-up-actions">
        <button class="stage-up-continue" type="button">Continue</button>
      </div>
    </div>
  `;
  document.body.append(overlay);

  // Continue only hides this layer; the session report waits underneath.
  overlay.querySelector('.stage-up-continue')!.addEventListener('click', () => {
    overlay.classList.add('hidden');
  });

  // Defensive: any path that starts a session must never leave the stage banner covering play.
  bus.on('sessionStarted', () => overlay.classList.add('hidden'));

  bus.on('stageAdvanced', ({ stageName, unlockedPaths }) => {
    const nameLabel = overlay.querySelector('[data-stage="name"]');
    if (nameLabel) nameLabel.textContent = stageName;
    const unlockLabel = overlay.querySelector('[data-stage="unlocks"]');
    if (unlockLabel) {
      const labels = unlockedPaths.map((pathId) => PATH_LABELS[pathId]).join(', ');
      unlockLabel.textContent = labels ? `New prey and branches: ${labels}` : '';
    }
    overlay.classList.remove('hidden');
  });
}
