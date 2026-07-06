import { CELESTIAL_TIERS, type CelestialTierId } from '../config/celestials';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import type { SessionStatsSnapshot } from '../game/SessionStats';
import { formatAmount } from './format';

// Derived from category so new tiers bucket automatically (the planet spectrum is three tiers).
const tiersInCategory = (category: 'asteroid' | 'planet' | 'star' | 'comet'): CelestialTierId[] =>
  (Object.keys(CELESTIAL_TIERS) as CelestialTierId[]).filter((id) => CELESTIAL_TIERS[id].category === category);
const ASTEROID_TIERS = tiersInCategory('asteroid');
const PLANET_TIERS = tiersInCategory('planet');
const STAR_TIERS = tiersInCategory('star');
const COMET_TIERS = tiersInCategory('comet');

interface StatCard {
  key: string;
  icon: string;
  label: string;
}

// Grid mirrors the reference.
const STAT_CARDS: readonly StatCard[] = [
  { key: 'damage', icon: '⚔️', label: 'Damage' },
  { key: 'critDamage', icon: '💥', label: 'Crit Dmg' },
  { key: 'hits', icon: '👊', label: 'Hits' },
  { key: 'asteroids', icon: '🪨', label: 'Asteroids' },
  { key: 'planets', icon: '🪐', label: 'Planets' },
  { key: 'stars', icon: '⭐', label: 'Stars' },
  { key: 'moons', icon: '🌙', label: 'Moons' },
  { key: 'comets', icon: '☄️', label: 'Comets' },
  { key: 'golden', icon: '🥇', label: 'Golden' },
  { key: 'chainKills', icon: '⚡', label: 'Chain Kills' },
  { key: 'timeAdded', icon: '⏱️', label: 'Time Added' },
];

function sumTiers(
  destroyed: Partial<Record<CelestialTierId, number>>,
  tiers: readonly CelestialTierId[],
): number {
  return tiers.reduce((total, tier) => total + (destroyed[tier] ?? 0), 0);
}

function cardValues(stats: SessionStatsSnapshot): Record<string, string> {
  const destroyed = stats.destroyedByTier;
  return {
    damage: formatAmount(stats.damage),
    critDamage: formatAmount(stats.critDamage),
    hits: formatAmount(stats.hits),
    asteroids: formatAmount(sumTiers(destroyed, ASTEROID_TIERS)),
    planets: formatAmount(sumTiers(destroyed, PLANET_TIERS)),
    stars: formatAmount(sumTiers(destroyed, STAR_TIERS)),
    moons: formatAmount(stats.moon),
    comets: formatAmount(sumTiers(destroyed, COMET_TIERS)),
    golden: formatAmount(stats.golden),
    chainKills: formatAmount(stats.chainKills),
    timeAdded: `+${stats.timeAdded.toFixed(1)}s`,
  };
}

export function createSessionEndOverlay(
  bus: EventBus<GameEvents>,
  onRestart: () => void,
  onOpenUpgrades: () => void,
  getStats: () => SessionStatsSnapshot,
  getLifetimeTotal: () => number,
): void {
  const overlay = document.createElement('div');
  overlay.id = 'session-end';
  overlay.classList.add('hidden');
  const cardsMarkup = STAT_CARDS.map(
    (card) => `
      <div class="stat-card">
        <span class="stat-icon">${card.icon}</span>
        <span class="stat-value" data-stat="${card.key}">0</span>
        <span class="stat-label">${card.label}</span>
      </div>`,
  ).join('');
  overlay.innerHTML = `
    <div class="session-end-panel">
      <h2>Session Complete</h2>
      <div class="session-end-summary">
        <div class="summary-item"><span class="summary-value" data-summary="matter">0</span><span class="summary-label">Matter Collected</span></div>
        <div class="summary-item"><span class="summary-value" data-summary="total">0</span><span class="summary-label">Mass</span></div>
        <div class="summary-item"><span class="summary-value" data-summary="session">#1</span><span class="summary-label">Session</span></div>
      </div>
      <div class="session-end-grid">${cardsMarkup}</div>
      <div class="session-end-actions">
        <button class="session-end-restart" type="button">Feed Again</button>
        <button class="session-end-upgrades" type="button">Upgrades</button>
      </div>
    </div>
  `;
  document.body.append(overlay);

  overlay.querySelector('.session-end-restart')!.addEventListener('click', () => onRestart());
  // Reopenable - the player may revisit the tree before feeding again.
  overlay.querySelector('.session-end-upgrades')!.addEventListener('click', () => onOpenUpgrades());

  const setText = (selector: string, value: string): void => {
    const element = overlay.querySelector(selector);
    if (element) element.textContent = value;
  };

  bus.on('sessionStarted', () => overlay.classList.add('hidden'));
  bus.on('sessionEnded', () => {
    const stats = getStats();
    setText('[data-summary="matter"]', formatAmount(stats.matterCollected));
    setText('[data-summary="total"]', formatAmount(getLifetimeTotal()));
    setText('[data-summary="session"]', `#${stats.sessionNumber}`);
    const values = cardValues(stats);
    for (const [key, value] of Object.entries(values)) {
      setText(`[data-stat="${key}"]`, value);
    }
    overlay.classList.remove('hidden');
  });
}
