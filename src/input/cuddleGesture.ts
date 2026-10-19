import type { CuddleZone } from '../actor/types';

// Pure touch classification for Cuddle mode. Distances are view pixels, times are milliseconds.
export const cuddleGestureConfig = {
  // A drag slower than this is a hold, and faster than maxSpeed is a swipe.
  minSpeed: 20,
  maxSpeed: 900,
  // A valid stroke is this much continuous valid movement in one direction.
  strokeDistance: 40,
  // A swipe has to cover this much before the pet flinches, and then waits before it can flinch again.
  tooFastDistance: 60,
  tooFastCooldownMs: 700,
  scratchReversals: 3,
  scratchWindowMs: 600,
  scratchMinStep: 4,
  scratchCooldownMs: 500,
  // Every Nth valid stroke spawns a heart.
  heartEvery: 3,
  speedWindowMs: 90,
};

export type CuddleGestureConfig = typeof cuddleGestureConfig;

export type GestureEvent =
  // Valid movement over the pet. It leaves a trail and keeps the pet "being touched".
  | { type: 'move'; x: number; y: number; zone: CuddleZone }
  | { type: 'stroke'; x: number; y: number; zone: CuddleZone }
  | { type: 'heart'; x: number; y: number }
  | { type: 'tooFast'; x: number; y: number }
  | { type: 'scratch'; x: number; y: number; zone: CuddleZone };

type Sample = { x: number; y: number; t: number };

export class CuddleGesture {
  private readonly config: CuddleGestureConfig;
  private samples: Sample[] = [];
  private last: Sample | null = null;
  private lastDir: { x: number; y: number } | null = null;
  private reversals: number[] = [];
  private run = 0;
  private fastRun = 0;
  private strokes = 0;
  private lastTooFast = -Infinity;
  private lastScratch = -Infinity;
  private suppressUntil = -Infinity;

  constructor(config: CuddleGestureConfig = cuddleGestureConfig) {
    this.config = config;
  }

  // Starts a new touch. Stroke counts carry over so the heart rhythm survives lifting the finger.
  begin(): void {
    this.samples = [];
    this.last = null;
    this.lastDir = null;
    this.reversals = [];
    this.run = 0;
    this.fastRun = 0;
  }

  get strokeCount(): number {
    return this.strokes;
  }

  reset(): void {
    this.begin();
    this.strokes = 0;
    this.lastTooFast = -Infinity;
    this.lastScratch = -Infinity;
    this.suppressUntil = -Infinity;
  }

  private speed(): number {
    const window = this.config.speedWindowMs;
    const recent = this.samples.filter((sample) => sample.t >= this.samples[this.samples.length - 1].t - window);
    if (recent.length < 2) {
      return 0;
    }
    let path = 0;
    for (let i = 1; i < recent.length; i += 1) {
      path += Math.hypot(recent[i].x - recent[i - 1].x, recent[i].y - recent[i - 1].y);
    }
    const elapsed = recent[recent.length - 1].t - recent[0].t;
    return elapsed > 0 ? (path / elapsed) * 1000 : 0;
  }

  move(x: number, y: number, t: number, zone: CuddleZone | null): GestureEvent[] {
    const cfg = this.config;
    const events: GestureEvent[] = [];
    const sample = { x, y, t };
    this.samples.push(sample);
    if (this.samples.length > 32) {
      this.samples.shift();
    }
    const previous = this.last;
    if (!previous) {
      this.last = sample;
      return events;
    }
    const dx = x - previous.x;
    const dy = y - previous.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1.5 || t <= previous.t) {
      return events;
    }
    this.last = sample;

    const onHead = zone === 'head' || zone === 'nose';
    // Direction reversals build a scratch. A reversal also ends the current stroke run.
    if (dist >= cfg.scratchMinStep) {
      const dir = { x: dx / dist, y: dy / dist };
      if (this.lastDir && this.lastDir.x * dir.x + this.lastDir.y * dir.y < -0.3) {
        this.reversals.push(t);
        this.run = 0;
      }
      this.lastDir = dir;
    }
    this.reversals = this.reversals.filter((at) => t - at <= cfg.scratchWindowMs);
    if (
      onHead &&
      zone &&
      this.reversals.length >= cfg.scratchReversals &&
      t - this.lastScratch >= cfg.scratchCooldownMs
    ) {
      this.lastScratch = t;
      this.suppressUntil = t + 400;
      this.reversals = [];
      this.run = 0;
      this.fastRun = 0;
      events.push({ type: 'scratch', x, y, zone });
      return events;
    }
    if (t < this.suppressUntil) {
      return events;
    }

    const speed = this.speed();
    if (speed > cfg.maxSpeed) {
      // Too fast: no trail, no hearts. After enough distance the pet flinches to teach "slower".
      this.run = 0;
      if (zone) {
        this.fastRun += dist;
        if (this.fastRun >= cfg.tooFastDistance && t - this.lastTooFast >= cfg.tooFastCooldownMs) {
          this.lastTooFast = t;
          this.fastRun = 0;
          events.push({ type: 'tooFast', x, y });
        }
      }
      return events;
    }
    this.fastRun = 0;
    if (speed < cfg.minSpeed || !zone) {
      return events;
    }
    events.push({ type: 'move', x, y, zone });
    this.run += dist;
    if (this.run >= cfg.strokeDistance) {
      this.run = 0;
      this.strokes += 1;
      events.push({ type: 'stroke', x, y, zone });
      if (this.strokes % cfg.heartEvery === 0) {
        events.push({ type: 'heart', x, y });
      }
    }
    return events;
  }
}
