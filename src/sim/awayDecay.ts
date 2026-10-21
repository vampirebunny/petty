import { AWAY_DECAY } from './awayDecayConfig';
import { clampWeight } from './care';
import { weightFloor } from './config';

const msPerHour = 3.6e6;

export type AwayNeeds = {
  tummy: number;
  mood: number;
  energy: number;
};

type AwayConfig = typeof AWAY_DECAY;
type NeedConfig = AwayConfig['needs'][keyof AwayConfig['needs']];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function applyNeed(v: number, h: number, c: NeedConfig): number {
  if ('recovers' in c) {
    return clamp(
      c.recoverTarget - (c.recoverTarget - v) * Math.pow(0.5, h / c.recoverHalfLifeH),
      0,
      100,
    );
  }
  const t1 = Math.min(h, c.graceH);
  let out = v > c.graceTarget ? v - (v - c.graceTarget) * (t1 / c.graceH) : v;
  const t2 = Math.max(0, h - c.graceH);
  if (t2 > 0 && out > c.floor) {
    out = c.floor + (out - c.floor) * Math.pow(0.5, t2 / c.halfLifeH);
  }
  return clamp(out, 0, 100);
}

export function awayElapsedHours(
  lastUpdatedAt: number,
  now: number,
  config: AwayConfig = AWAY_DECAY,
): number {
  if (now < lastUpdatedAt) {
    return 0;
  }
  return Math.min((now - lastUpdatedAt) / msPerHour, config.maxElapsedH);
}

export function awayElapsedMs(lastUpdatedAt: number, now: number, config: AwayConfig = AWAY_DECAY): number {
  return awayElapsedHours(lastUpdatedAt, now, config) * msPerHour;
}

export function applyAwayDecay(
  needs: AwayNeeds,
  elapsedH: number,
  config: AwayConfig = AWAY_DECAY,
): AwayNeeds {
  if (elapsedH < 0) {
    return needs;
  }
  const h = Math.min(elapsedH, config.maxElapsedH);
  if (h === 0) {
    return needs;
  }
  return {
    tummy: applyNeed(needs.tummy, h, config.needs.tummy),
    mood: applyNeed(needs.mood, h, config.needs.mood),
    energy: applyNeed(needs.energy, h, config.needs.energy),
  };
}

export function applyAwayWeight(weight: number, elapsedH: number, config: AwayConfig = AWAY_DECAY): number {
  if (elapsedH < 0) {
    return weight;
  }
  const h = Math.min(elapsedH, config.maxElapsedH);
  if (h <= config.weight.graceH) {
    return weight;
  }
  if (weight <= weightFloor) {
    return clampWeight(weight);
  }
  const t2 = h - config.weight.graceH;
  const next = weightFloor + (weight - weightFloor) * Math.pow(0.5, t2 / config.weight.halfLifeH);
  return clampWeight(next);
}
