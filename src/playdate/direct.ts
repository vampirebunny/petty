import type { Direction, DirectionPose } from '../actor/types';
import { closingHoldMs } from './config';
import type { Beat, PlaydateRecord } from './types';

const poses: Record<string, DirectionPose> = {
  approach: 'walk',
  sniff: 'sniff',
  hide: 'walk',
  play_bow: 'bow',
  run_to: 'run',
  jump: 'jump',
  drop_item: 'sit',
  pick_up: 'bow',
  tug: 'bow',
  tug_rope: 'bow',
  win: 'celebrate',
  nuzzle: 'sniff',
  sit: 'sit',
  nap: 'sleep',
  trick: 'paw',
  celebrate: 'celebrate',
  walk_off: 'walk',
  pounce: 'pounce',
  stalk: 'stalk',
  pant: 'pant',
  speak: 'pant',
  skid: 'skid',
  zoomies: 'zoomies',
  roll_over: 'roll_over',
  flop: 'flop',
};

export function poseFor(action: string): DirectionPose | null {
  return poses[action] ?? null;
}

export function replayBeats(record: PlaydateRecord): Beat[] {
  return record.beats;
}

export function playdateEndMs(beats: readonly Beat[]): number {
  const last = beats.length > 0 ? beats[beats.length - 1].t : 0;
  return last + closingHoldMs;
}

// The latest known beat for this actor. Unknown actions are skipped.
export function beatAt(beats: readonly Beat[], elapsedMs: number, actor: 'A' | 'B'): Beat | null {
  let found: Beat | null = null;
  for (const beat of beats) {
    if (beat.t > elapsedMs) {
      break;
    }
    if ((beat.actor === actor || beat.actor === 'both') && poseFor(beat.action)) {
      found = beat;
    }
  }
  return found;
}

// The latest beat for one pet in a group. A beat with a slot moves that pet. A beat with no slot and actor 'all' moves every pet.
export function beatForSlot(beats: readonly Beat[], elapsedMs: number, slot: number): Beat | null {
  let found: Beat | null = null;
  for (const beat of beats) {
    if (beat.t > elapsedMs) {
      break;
    }
    const matches = beat.slot === slot || (beat.slot == null && beat.actor === 'all');
    if (matches && poseFor(beat.action)) {
      found = beat;
    }
  }
  return found;
}

type Point = { x: number; y: number };

// What a beat needs from the live scene: where each pet is now, how big the two bodies are together,
// and the floor, so a target that follows the partner stays on it.
export type DirectContext = {
  self: Point;
  other: Point;
  // The two body radii added together. A gap of 1 is the bodies just touching.
  reach: number;
  floor: { xMin: number; xMax: number; yMin: number; yMax: number };
};

const defaultGap = 1.3;
const laneSpread = 26;
const fleeDistance = 320;

function clampTo(point: Point, floor: DirectContext['floor']): Point {
  return {
    x: Math.min(floor.xMax, Math.max(floor.xMin, point.x)),
    y: Math.min(floor.yMax, Math.max(floor.yMin, point.y)),
  };
}

// Where this pet should head right now. Beats that follow the partner are worked out again each frame,
// so a chase tracks the runner and a meeting ends halfway between.
export function targetFor(beat: Beat, side: 'A' | 'B', context: DirectContext): Point | null {
  const params = beat.params;
  if (!params) {
    return null;
  }
  const { self, other, reach, floor } = context;
  const sign = self.x >= other.x ? 1 : -1;
  const gap = (params.gap ?? defaultGap) * reach;
  if (params.toward === 'partner') {
    return clampTo({ x: other.x + sign * gap, y: other.y + (params.lane ?? 0) }, floor);
  }
  if (params.toward === 'meet') {
    return clampTo(
      { x: (self.x + other.x) / 2 + (sign * gap) / 2, y: (self.y + other.y) / 2 + (params.lane ?? 0) },
      floor,
    );
  }
  if (params.toward === 'away') {
    const edge = 40;
    let x = self.x + sign * fleeDistance;
    // Cornered against a wall, double back to the other side instead of freezing.
    if (x > floor.xMax - edge || x < floor.xMin + edge) {
      x = sign > 0 ? floor.xMin + edge : floor.xMax - edge;
    }
    const middle = (floor.yMin + floor.yMax) / 2;
    const y = self.y + (self.y >= other.y ? 1 : -1) * 50;
    return clampTo({ x, y: Math.abs(y - middle) > (floor.yMax - floor.yMin) / 2 ? middle : y }, floor);
  }
  if (params.x == null || params.y == null) {
    return null;
  }
  const lane = side === 'A' ? -1 : 1;
  if (params.spread === 'y') {
    return clampTo({ x: params.x, y: params.y + lane * laneSpread }, floor);
  }
  const apart = beat.actor === 'both' ? lane * reach * 0.65 : 0;
  return clampTo({ x: params.x + apart, y: params.y }, floor);
}

export function directionFor(beat: Beat, side: 'A' | 'B', context: DirectContext): Direction {
  const pose = poseFor(beat.action) ?? 'sit';
  const pace = beat.params?.pace ?? (pose === 'zoomies' ? 1 : pose === 'run' ? 0.92 : pose === 'walk' ? 0.45 : pose === 'stalk' ? 0.28 : 0.35);
  return {
    target: targetFor(beat, side, context),
    pace,
    pose,
    token: beat.t * 10 + (beat.slot ?? (side === 'A' ? 0 : 1)),
  };
}
