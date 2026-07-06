import { AUDIO } from '../config/audio';
import type { SoundEngine } from '../audio/SoundEngine';

interface StoredAudioSettings {
  volume: number;
  muted: boolean;
}

export function createAudioControls(engine: SoundEngine): void {
  const stored = loadSettings();
  if (stored) {
    engine.setVolume(stored.volume);
    engine.setMuted(stored.muted);
  }

  const root = document.createElement('div');
  root.id = 'audio-controls';
  root.innerHTML = `
    <button class="audio-mute" type="button" aria-label="Toggle sound"></button>
    <input class="audio-volume" name="audio-volume" type="range" min="0" max="100" aria-label="Volume" />
  `;
  document.body.append(root);

  const muteButton = root.querySelector('.audio-mute') as HTMLButtonElement;
  const volumeSlider = root.querySelector('.audio-volume') as HTMLInputElement;

  const sync = (): void => {
    muteButton.textContent = engine.muted ? '🔇' : '🔊';
    volumeSlider.value = String(Math.round(engine.volume * 100));
  };

  muteButton.addEventListener('click', () => {
    engine.setMuted(!engine.muted);
    saveSettings(engine);
    sync();
  });
  volumeSlider.addEventListener('input', () => {
    engine.setVolume(Number(volumeSlider.value) / 100);
    if (engine.muted && engine.volume > 0) engine.setMuted(false);
    saveSettings(engine);
    sync();
  });

  sync();
}

function loadSettings(): StoredAudioSettings | null {
  try {
    const raw = localStorage.getItem(AUDIO.storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredAudioSettings>;
    if (typeof parsed.volume !== 'number' || typeof parsed.muted !== 'boolean') return null;
    return { volume: parsed.volume, muted: parsed.muted };
  } catch {
    return null;
  }
}

function saveSettings(engine: SoundEngine): void {
  try {
    localStorage.setItem(
      AUDIO.storageKey,
      JSON.stringify({ volume: engine.volume, muted: engine.muted }),
    );
  } catch {
    // Storage unavailable (private mode) — settings just will not persist.
  }
}
