export interface ToneSpec {
  frequency: number;
  frequencyJitter: number;
  durationSeconds: number;
  oscillator: OscillatorType;
  gain: number;
}

export interface NoiseSpec {
  durationSeconds: number;
  gain: number;
  highpassHz: number;
}

export interface SfxRecipe {
  minGapMs: number;
  tones: ToneSpec[];
  noise: NoiseSpec | null;
}

export type SfxName =
  | 'hit'
  | 'break'
  | 'crit'
  | 'consume'
  | 'sessionStart'
  | 'sessionEnd'
  | 'lightning'
  | 'purchase';

export const AUDIO = {
  defaultMasterVolume: 0.3,
  maxConcurrent: 6,
  attenuateAbove: 3,
  storageKey: 'black-hole.audio.v1',
  sfx: {
    hit: {
      minGapMs: 45,
      tones: [
        { frequency: 260, frequencyJitter: 70, durationSeconds: 0.05, oscillator: 'sine', gain: 0.03 },
      ],
      noise: { durationSeconds: 0.04, gain: 0.025, highpassHz: 2500 },
    },
    break: {
      minGapMs: 55,
      tones: [
        { frequency: 200, frequencyJitter: 0, durationSeconds: 0.15, oscillator: 'sine', gain: 0.12 },
        { frequency: 120, frequencyJitter: 0, durationSeconds: 0.25, oscillator: 'sine', gain: 0.08 },
      ],
      noise: { durationSeconds: 0.1, gain: 0.09, highpassHz: 1800 },
    },
    crit: {
      minGapMs: 60,
      tones: [
        { frequency: 600, frequencyJitter: 0, durationSeconds: 0.08, oscillator: 'square', gain: 0.09 },
        { frequency: 800, frequencyJitter: 0, durationSeconds: 0.12, oscillator: 'square', gain: 0.07 },
      ],
      noise: { durationSeconds: 0.08, gain: 0.1, highpassHz: 2200 },
    },
    consume: {
      minGapMs: 85,
      tones: [
        { frequency: 60, frequencyJitter: 0, durationSeconds: 0.2, oscillator: 'sine', gain: 0.08 },
        { frequency: 40, frequencyJitter: 0, durationSeconds: 0.3, oscillator: 'sine', gain: 0.05 },
      ],
      noise: null,
    },
    sessionStart: {
      minGapMs: 0,
      tones: [
        { frequency: 330, frequencyJitter: 0, durationSeconds: 0.12, oscillator: 'sine', gain: 0.1 },
        { frequency: 495, frequencyJitter: 0, durationSeconds: 0.18, oscillator: 'sine', gain: 0.08 },
      ],
      noise: null,
    },
    sessionEnd: {
      minGapMs: 0,
      tones: [
        { frequency: 300, frequencyJitter: 0, durationSeconds: 0.3, oscillator: 'sine', gain: 0.12 },
        { frequency: 200, frequencyJitter: 0, durationSeconds: 0.5, oscillator: 'sine', gain: 0.08 },
      ],
      noise: null,
    },
    lightning: {
      minGapMs: 50,
      tones: [
        { frequency: 120, frequencyJitter: 50, durationSeconds: 0.12, oscillator: 'sawtooth', gain: 0.06 },
      ],
      noise: { durationSeconds: 0.15, gain: 0.12, highpassHz: 1500 },
    },
    purchase: {
      minGapMs: 0,
      tones: [
        { frequency: 440, frequencyJitter: 0, durationSeconds: 0.08, oscillator: 'sine', gain: 0.1 },
        { frequency: 660, frequencyJitter: 0, durationSeconds: 0.12, oscillator: 'sine', gain: 0.08 },
      ],
      noise: null,
    },
  } satisfies Record<SfxName, SfxRecipe>,
} as const;
