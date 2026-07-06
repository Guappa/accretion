export interface ParticlePhysics {
  pullStrength: number;
  minPullDistance: number;
  dragPerSecond: number;
  tangentialFactor: number;
}

export interface ParticleSpawn {
  x: number;
  y: number;
  count: number;
  speedMin: number;
  speedMax: number;
  lifeSeconds: number;
  sizeWorldMin: number;
  sizeWorldMax: number;
  tint: number;
  stretch: number;
  aim: 'scatter' | 'inward';
}

const INWARD_JITTER_RADIANS = 0.35;

export class ParticlePool {
  readonly capacity: number;
  readonly active: Uint8Array;
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly vx: Float32Array;
  readonly vy: Float32Array;
  readonly life: Float32Array;
  readonly maxLife: Float32Array;
  readonly sizeWorld: Float32Array;
  readonly stretch: Float32Array;
  readonly tint: Uint32Array;
  private cursor = 0;

  constructor(
    capacity: number,
    private readonly physics: ParticlePhysics,
    private readonly rng: () => number,
  ) {
    this.capacity = capacity;
    this.active = new Uint8Array(capacity);
    this.x = new Float32Array(capacity);
    this.y = new Float32Array(capacity);
    this.vx = new Float32Array(capacity);
    this.vy = new Float32Array(capacity);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.sizeWorld = new Float32Array(capacity);
    this.stretch = new Float32Array(capacity);
    this.tint = new Uint32Array(capacity);
  }

  spawn(spec: ParticleSpawn): void {
    for (let emitted = 0; emitted < spec.count; emitted++) {
      const slot = this.claimSlot();
      if (slot === -1) return;
      const speed = spec.speedMin + this.rng() * (spec.speedMax - spec.speedMin);
      const { velocityX, velocityY } = this.initialVelocity(spec, speed);
      this.active[slot] = 1;
      this.x[slot] = spec.x;
      this.y[slot] = spec.y;
      this.vx[slot] = velocityX;
      this.vy[slot] = velocityY;
      this.life[slot] = spec.lifeSeconds;
      this.maxLife[slot] = spec.lifeSeconds;
      this.sizeWorld[slot] = spec.sizeWorldMin + this.rng() * (spec.sizeWorldMax - spec.sizeWorldMin);
      this.stretch[slot] = spec.stretch;
      this.tint[slot] = spec.tint;
    }
  }

  update(deltaSeconds: number, horizonWorldRadius: number): void {
    const drag = Math.exp(-this.physics.dragPerSecond * deltaSeconds);
    const absorbRadius = Math.max(horizonWorldRadius, 0.001);
    for (let slot = 0; slot < this.capacity; slot++) {
      if (!this.active[slot]) continue;
      this.life[slot] -= deltaSeconds;
      if (this.life[slot] <= 0) {
        this.active[slot] = 0;
        continue;
      }
      const distance = Math.hypot(this.x[slot], this.y[slot]);
      if (distance <= absorbRadius) {
        this.active[slot] = 0;
        continue;
      }
      const acceleration = this.physics.pullStrength / Math.max(distance, this.physics.minPullDistance);
      this.vx[slot] += (-this.x[slot] / distance) * acceleration * deltaSeconds;
      this.vy[slot] += (-this.y[slot] / distance) * acceleration * deltaSeconds;
      this.vx[slot] *= drag;
      this.vy[slot] *= drag;
      this.x[slot] += this.vx[slot] * deltaSeconds;
      this.y[slot] += this.vy[slot] * deltaSeconds;
    }
  }

  activeCount(): number {
    let count = 0;
    for (let slot = 0; slot < this.capacity; slot++) count += this.active[slot];
    return count;
  }

  private claimSlot(): number {
    for (let probe = 0; probe < this.capacity; probe++) {
      const slot = (this.cursor + probe) % this.capacity;
      if (!this.active[slot]) {
        this.cursor = (slot + 1) % this.capacity;
        return slot;
      }
    }
    return -1;
  }

  private initialVelocity(
    spec: ParticleSpawn,
    speed: number,
  ): { velocityX: number; velocityY: number } {
    const distance = Math.hypot(spec.x, spec.y);
    if (spec.aim === 'inward' && distance > 0) {
      const jitter = (this.rng() - 0.5) * 2 * INWARD_JITTER_RADIANS;
      const angle = Math.atan2(-spec.y, -spec.x) + jitter;
      return { velocityX: Math.cos(angle) * speed, velocityY: Math.sin(angle) * speed };
    }
    const scatterAngle = this.rng() * Math.PI * 2;
    let velocityX = Math.cos(scatterAngle) * speed;
    let velocityY = Math.sin(scatterAngle) * speed;
    if (distance > 0) {
      velocityX += (-spec.y / distance) * speed * this.physics.tangentialFactor;
      velocityY += (spec.x / distance) * speed * this.physics.tangentialFactor;
    }
    return { velocityX, velocityY };
  }
}
