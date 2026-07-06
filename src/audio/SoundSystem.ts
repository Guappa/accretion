import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import type { SoundEngine } from './SoundEngine';

export function connectSoundSystem(bus: EventBus<GameEvents>, engine: SoundEngine): void {
  bus.on('entityDamaged', () => engine.play('hit'));
  bus.on('objectBroken', () => engine.play('break'));
  bus.on('critLanded', () => engine.play('crit'));
  bus.on('matterConsumed', () => engine.play('consume'));
  bus.on('sessionStarted', () => engine.play('sessionStart'));
  bus.on('sessionEnded', () => engine.play('sessionEnd'));
  bus.on('lightningBolt', () => engine.play('lightning'));
}
