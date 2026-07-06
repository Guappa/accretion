import { AUDIO, type NoiseSpec, type SfxName, type ToneSpec } from '../config/audio';
import type { SfxGate } from './throttle';

export class SoundEngine {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private mutedState = false;
  private volumeState: number = AUDIO.defaultMasterVolume;

  constructor(private readonly gate: SfxGate) {
    const resume = (): void => {
      if (this.context && this.context.state === 'suspended') void this.context.resume();
    };
    for (const eventName of ['pointerdown', 'keydown', 'touchstart']) {
      document.addEventListener(eventName, resume, { capture: true });
    }
  }

  play(name: SfxName): void {
    if (this.mutedState) return;
    const recipe = AUDIO.sfx[name];
    if (!this.gate.tryAcquire(name, recipe.minGapMs, performance.now())) return;
    const context = this.ensureContext();
    if (context.state !== 'running') {
      this.gate.release();
      return;
    }
    let longestSeconds = 0;
    let lastNode: AudioScheduledSourceNode | null = null;
    for (const tone of recipe.tones) {
      const node = this.playTone(context, tone);
      if (tone.durationSeconds >= longestSeconds) {
        longestSeconds = tone.durationSeconds;
        lastNode = node;
      }
    }
    if (recipe.noise) {
      const node = this.playNoise(context, recipe.noise);
      if (recipe.noise.durationSeconds >= longestSeconds) {
        longestSeconds = recipe.noise.durationSeconds;
        lastNode = node;
      }
    }
    let released = false;
    const releaseOnce = (): void => {
      if (released) return;
      released = true;
      this.gate.release();
    };
    if (lastNode) lastNode.onended = releaseOnce;
    else releaseOnce();
    // Fallback: onended can be dropped when the tab is backgrounded or the audio session is interrupted.
    setTimeout(releaseOnce, (longestSeconds + 0.25) * 1000);
  }

  setVolume(volume: number): void {
    this.volumeState = Math.max(0, Math.min(1, volume));
    this.applyGain();
  }

  setMuted(muted: boolean): void {
    this.mutedState = muted;
    this.applyGain();
  }

  get volume(): number {
    return this.volumeState;
  }

  get muted(): boolean {
    return this.mutedState;
  }

  private ensureContext(): AudioContext {
    if (!this.context) {
      this.context = new AudioContext();
      this.masterGain = this.context.createGain();
      this.masterGain.connect(this.context.destination);
      this.applyGain();
    }
    if (this.context.state === 'suspended') void this.context.resume();
    return this.context;
  }

  private applyGain(): void {
    if (this.masterGain) this.masterGain.gain.value = this.mutedState ? 0 : this.volumeState;
  }

  private playTone(context: AudioContext, tone: ToneSpec): OscillatorNode {
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    oscillator.type = tone.oscillator;
    const jitter = (Math.random() * 2 - 1) * tone.frequencyJitter;
    oscillator.frequency.setValueAtTime(tone.frequency + jitter, context.currentTime);
    gainNode.gain.setValueAtTime(this.gate.attenuatedGain(tone.gain), context.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + tone.durationSeconds);
    oscillator.connect(gainNode);
    if (this.masterGain) gainNode.connect(this.masterGain);
    oscillator.start();
    oscillator.stop(context.currentTime + tone.durationSeconds);
    return oscillator;
  }

  private playNoise(context: AudioContext, noise: NoiseSpec): AudioBufferSourceNode {
    const frameCount = Math.max(1, Math.floor(context.sampleRate * noise.durationSeconds));
    const buffer = context.createBuffer(1, frameCount, context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let frame = 0; frame < frameCount; frame++) channel[frame] = Math.random() * 2 - 1;
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = noise.highpassHz;
    const gainNode = context.createGain();
    gainNode.gain.setValueAtTime(this.gate.attenuatedGain(noise.gain), context.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + noise.durationSeconds);
    source.connect(filter);
    filter.connect(gainNode);
    if (this.masterGain) gainNode.connect(this.masterGain);
    source.start();
    return source;
  }
}
