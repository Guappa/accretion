import Phaser from 'phaser';
import { SoundEngine } from './audio/SoundEngine';
import { connectSoundSystem } from './audio/SoundSystem';
import { SfxGate } from './audio/throttle';
import { AUDIO } from './config/audio';
import { EventBus } from './core/EventBus';
import type { GameEvents } from './core/events';
import { SessionScene } from './scenes/SessionScene';
import { ENDGAME } from './config/endgame';
import { SessionStats } from './game/SessionStats';
import { VictorySystem } from './game/VictorySystem';
import { GameState } from './state/GameState';
import { SaveSystem } from './state/SaveSystem';
import { createDebugPanel } from './ui/debugPanel';
import { createHud } from './ui/hud';
import { createSessionEndOverlay } from './ui/sessionEnd';
import { createStageUpOverlay } from './ui/stageUp';
import { createStartMenu } from './ui/startMenu';
import { createUpgradeTree } from './ui/upgradeTree';
import { createAudioControls } from './ui/audioControls';
import { createRotatePrompt } from './ui/rotatePrompt';
import { createVersionBadge } from './ui/versionBadge';
import { createVictoryOverlay } from './ui/victory';

const bus = new EventBus<GameEvents>();
const gameState = new GameState();
bus.on('matterConsumed', ({ value }) => gameState.collectMatter(value));
bus.on('objectBroken', ({ value }) => gameState.collectMatter(value));
bus.on('bonusMatter', ({ value }) => gameState.collectMatter(value));

// Restore before any UI factory runs so the HUD and tree render the loaded state, not a blank one.
const saveSystem = new SaveSystem(gameState, bus, window.localStorage);
saveSystem.load();

const sessionScene = new SessionScene(bus, gameState);
createHud(gameState, bus);

const soundEngine = new SoundEngine(new SfxGate(AUDIO.maxConcurrent, AUDIO.attenuateAbove));
connectSoundSystem(bus, soundEngine);
createAudioControls(soundEngine);
createRotatePrompt();
createVersionBadge();

const sessionStats = new SessionStats(bus);
const upgradeTree = createUpgradeTree(gameState, soundEngine, bus);
createSessionEndOverlay(
  bus,
  () => sessionScene.beginSession(),
  upgradeTree.open,
  () => sessionStats.snapshot(),
  () => gameState.snapshot().mass,
);
createStageUpOverlay(bus);
createStartMenu(bus, () => sessionScene.beginSession(), upgradeTree.open);
createVictoryOverlay(bus);
new VictorySystem(
  bus,
  () => ({ mass: gameState.snapshot().mass, victorySeen: gameState.snapshot().victorySeen }),
  () => gameState.markVictorySeen(),
  ENDGAME.victoryMassGoal,
);

saveSystem.startAutosave();

// debugHooksOrNull() returns null until create() runs, so an F2 hit before scene creation can't crash the panel.
createDebugPanel(gameState, bus, saveSystem, () => sessionScene.debugHooksOrNull());

new Phaser.Game({
  type: Phaser.AUTO,
  // All SFX go through our own gesture-safe SoundEngine; without this Phaser boots its own AudioContext before any user gesture and Chrome logs an autoplay violation.
  audio: { noAudio: true },
  parent: 'game',
  backgroundColor: '#05030f',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: sessionScene,
});

// Phaser keeps a live scene instance that does not hot-swap its methods; force a full reload on any source change so new scene/hook code actually runs in dev.
if (import.meta.hot) import.meta.hot.accept(() => window.location.reload());
