import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';

export function createStartMenu(
  bus: EventBus<GameEvents>,
  onStart: () => void,
  onOpenUpgrades: () => void,
): void {
  const menu = document.createElement('div');
  menu.id = 'start-menu';
  menu.innerHTML = `
    <div class="start-menu-panel">
      <h1>ACCRETION</h1>
      <p class="start-menu-tagline">It only ever grows.</p>
      <button class="start-menu-begin">Begin Feeding</button>
      <button class="start-menu-upgrades" type="button">Upgrades</button>
    </div>
  `;
  document.body.append(menu);

  const beginButton = menu.querySelector('.start-menu-begin') as HTMLButtonElement;
  beginButton.addEventListener('click', () => onStart(), { once: true });
  // Reopenable, unlike Begin - the player may check the tree multiple times before starting.
  menu.querySelector('.start-menu-upgrades')!.addEventListener('click', () => onOpenUpgrades());
  const unsubscribe = bus.on('sessionStarted', () => { menu.remove(); unsubscribe(); });
}
