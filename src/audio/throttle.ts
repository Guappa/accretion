export class SfxGate {
  private readonly lastPlayedMs = new Map<string, number>();
  private activeSources = 0;

  constructor(
    private readonly maxConcurrent: number,
    private readonly attenuateAbove: number,
  ) {}

  tryAcquire(name: string, minGapMs: number, nowMs: number): boolean {
    const lastMs = this.lastPlayedMs.get(name);
    if (lastMs !== undefined && nowMs - lastMs < minGapMs) return false;
    if (this.activeSources >= this.maxConcurrent) return false;
    this.lastPlayedMs.set(name, nowMs);
    this.activeSources++;
    return true;
  }

  release(): void {
    this.activeSources = Math.max(0, this.activeSources - 1);
  }

  attenuatedGain(gain: number): number {
    if (this.activeSources <= this.attenuateAbove) return gain;
    return gain * (this.attenuateAbove / this.activeSources);
  }
}
