import { CELESTIAL_TIERS, type CelestialTierId } from '../../config/celestials';
import { EventBus } from '../../core/EventBus';
import type { GameEvents, KillSource } from '../../core/events';
import { celestialPosition, type Celestial } from '../entities';

// Shared by every gimmick system's hit resolution: apply hp loss, emit entityDamaged, and on death splice the entity out and pay out objectBroken.
export function applyDamage(
  bus: EventBus<GameEvents>,
  entities: Celestial[],
  target: Celestial,
  amount: number,
  source: KillSource,
  valueMult: (tierId: CelestialTierId) => number = () => 1,
): { killed: boolean } {
  const { x, y } = celestialPosition(target);
  target.hp -= amount;
  bus.emit('entityDamaged', { id: target.id, tierId: target.tierId, amount, x, y });
  if (target.hp > 0) return { killed: false };
  const index = entities.indexOf(target);
  if (index !== -1) entities.splice(index, 1);
  bus.emit('objectBroken', {
    id: target.id,
    tierId: target.tierId,
    value: Math.round(CELESTIAL_TIERS[target.tierId].breakValue * valueMult(target.tierId)),
    x,
    y,
    source,
    affix: target.affix,
  });
  return { killed: true };
}
