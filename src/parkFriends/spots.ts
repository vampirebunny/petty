import { parkFriendRules } from './rules';

export type SpotFloor = { xMin: number; xMax: number; yMin: number; yMax: number };

export type SpotBody = { x: number; y: number };

export type SpotObstacle = { x: number; y: number; hw: number; hd: number };

function hash(id: string): number {
  let value = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    value ^= id.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function insideObstacle(point: SpotBody, obstacle: SpotObstacle): boolean {
  const nx = (point.x - obstacle.x) / Math.max(obstacle.hw, 1);
  const ny = (point.y - obstacle.y) / Math.max(obstacle.hd, 1);
  return nx * nx + ny * ny <= 1;
}

/** A stable grass spot for this pet. The same id and floor pick the same point until something is in the way. */
export function friendSpot(
  petId: string,
  floor: SpotFloor,
  bodies: readonly SpotBody[],
  obstacles: readonly SpotObstacle[],
): SpotBody {
  const rng = mulberry32(hash(petId) || 1);
  const xPad = 36;
  const yPad = 10;
  const xLo = floor.xMin + xPad;
  const xHi = Math.max(xLo, floor.xMax - xPad);
  const yLo = floor.yMin + yPad;
  const yHi = Math.max(yLo, floor.yMax - yPad);
  let best: SpotBody = { x: (xLo + xHi) / 2, y: (yLo + yHi) / 2 };
  let bestScore = -1;
  for (let i = 0; i < 12; i += 1) {
    const point = { x: xLo + rng() * (xHi - xLo), y: yLo + rng() * (yHi - yLo) };
    if (obstacles.some((obstacle) => insideObstacle(point, obstacle))) {
      continue;
    }
    const nearest = bodies.reduce((gap, body) => Math.min(gap, Math.hypot(body.x - point.x, body.y - point.y)), Number.POSITIVE_INFINITY);
    if (nearest >= parkFriendRules.spotGap) {
      return point;
    }
    if (nearest > bestScore) {
      best = point;
      bestScore = nearest;
    }
  }
  return best;
}
