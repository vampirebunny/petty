import { facingConfig, facingRing, type Facing, type ViewId } from './data/facing';
import type { Actor } from './types';

const CENTER: Record<Facing, number> = {
  E: 0,
  NE: Math.PI / 4,
  N: Math.PI / 2,
  NW: (3 * Math.PI) / 4,
  W: Math.PI,
  SW: (-3 * Math.PI) / 4,
  S: -Math.PI / 2,
  SE: -Math.PI / 4,
};

const VIEW: Record<Facing, ViewId> = {
  E: 'side',
  W: 'side',
  SE: 'front34',
  SW: 'front34',
  S: 'front',
  NE: 'back34',
  NW: 'back34',
  N: 'back',
};

function wrap(angle: number): number {
  let value = angle;
  while (value > Math.PI) {
    value -= Math.PI * 2;
  }
  while (value < -Math.PI) {
    value += Math.PI * 2;
  }
  return value;
}

export function viewOf(octant: Facing): ViewId {
  return VIEW[octant];
}

export function sideOctant(face: number): 'E' | 'W' {
  return face >= 0 ? 'E' : 'W';
}

// West-side octants mirror. N and S keep the last horizontal sign.
export function horizontalDir(octant: Facing, face: number): 1 | -1 {
  if (octant === 'W' || octant === 'NW' || octant === 'SW') {
    return -1;
  }
  if (octant === 'E' || octant === 'NE' || octant === 'SE') {
    return 1;
  }
  return face >= 0 ? 1 : -1;
}

export function octantIndex(octant: Facing): number {
  return facingRing.indexOf(octant);
}

export function octantDistance(a: Facing, b: Facing): number {
  const delta = Math.abs(octantIndex(a) - octantIndex(b));
  return Math.min(delta, facingRing.length - delta);
}

function nearestOctant(angle: number): Facing {
  let best: Facing = 'E';
  let bestD = Infinity;
  for (const id of facingRing) {
    const d = Math.abs(wrap(angle - CENTER[id]));
    if (d < bestD) {
      bestD = d;
      best = id;
    }
  }
  return best;
}

// angle = atan2(-vy, vx). Stays on `previous` until the angle is 10° past the boundary.
export function octantFromVelocity(vx: number, vy: number, previous: Facing): Facing {
  if (Math.hypot(vx, vy) < facingConfig.restSpeed) {
    return previous;
  }
  const angle = Math.atan2(-vy, vx);
  const next = nearestOctant(angle);
  if (next === previous) {
    return previous;
  }
  const half = Math.PI / 8;
  const extra = (facingConfig.hysteresisDeg * Math.PI) / 180;
  const fromCenter = Math.abs(wrap(angle - CENTER[previous]));
  if (fromCenter <= half + extra) {
    return previous;
  }
  return next;
}

// One step toward `to`. Equal paths go through S. N↔S uses `face` (east when face is positive).
export function stepToward(from: Facing, to: Facing, face: number): Facing {
  if (from === to) {
    return from;
  }
  const i = octantIndex(from);
  const j = octantIndex(to);
  const cw = (j - i + 8) % 8;
  const ccw = (i - j + 8) % 8;
  if (cw < ccw) {
    return facingRing[(i + 1) % 8];
  }
  if (ccw < cw) {
    return facingRing[(i + 7) % 8];
  }
  const south = octantIndex('S');
  const cwOct = facingRing[(i + 1) % 8];
  const ccwOct = facingRing[(i + 7) % 8];
  const toSouth = (octant: Facing): number => {
    const k = octantIndex(octant);
    const d = Math.abs(k - south);
    return Math.min(d, 8 - d);
  };
  const cwSouth = toSouth(cwOct);
  const ccwSouth = toSouth(ccwOct);
  if (cwSouth < ccwSouth) {
    return cwOct;
  }
  if (ccwSouth < cwSouth) {
    return ccwOct;
  }
  return face >= 0 ? facingRing[(i + 1) % 8] : facingRing[(i + 7) % 8];
}

export function emptyFacing(): {
  octant: Facing;
  octantFrom: Facing;
  octantTarget: Facing;
  octantBlend: number;
  octantHold: number;
  octantSpan: number;
} {
  return { octant: 'E', octantFrom: 'E', octantTarget: 'E', octantBlend: 1, octantHold: 0, octantSpan: 0 };
}

// Teleports (scene cut, debug flip, an off-screen entrance) match the drawn view immediately.
export function snapFacing(actor: Actor, face: 1 | -1): void {
  const octant = sideOctant(face);
  actor.face = face;
  actor.octant = octant;
  actor.octantFrom = octant;
  actor.octantTarget = octant;
  actor.octantBlend = 1;
  actor.octantHold = 0;
  actor.octantSpan = 0;
  actor.yaw = face >= 0 ? 0 : Math.PI;
  actor.yawFace = face;
  actor.lead = 0;
  actor.turning = false;
}

function syncHorizontal(actor: Actor): void {
  if (actor.octant === 'E') {
    actor.face = 1;
  } else if (actor.octant === 'W') {
    actor.face = -1;
  }
}

// Moves the displayed octant at most one step. The tween finishes before the next step.
export function stepOctant(actor: Actor, dt: number): void {
  const { neighborTween, turnHold, headLead } = facingConfig;
  if (actor.octantBlend < 1) {
    actor.octantBlend = Math.min(1, actor.octantBlend + dt / neighborTween);
  }
  actor.octantHold += dt;
  if (actor.octant !== actor.octantTarget && actor.octantBlend >= 1 && actor.octantHold >= turnHold) {
    actor.octantFrom = actor.octant;
    actor.octant = stepToward(actor.octant, actor.octantTarget, actor.face);
    actor.octantBlend = 0;
    actor.octantHold = 0;
    actor.lead = Math.max(actor.lead, headLead);
  }
  syncHorizontal(actor);
  const pending = actor.octant !== actor.octantTarget || actor.octantBlend < 1;
  actor.turning = pending || actor.lead > 0 || actor.spin != null;
  actor.anchors.facing = horizontalDir(actor.octantBlend >= 1 ? actor.octant : actor.octantFrom, actor.face);
}

// Remember how far this target was when it was chosen, so a long turn finishes in place.
export function aimOctant(actor: Actor, target: Facing): void {
  if (target === actor.octantTarget) {
    return;
  }
  actor.octantSpan = octantDistance(actor.octant, target);
  actor.octantTarget = target;
}

export function holdForTurn(actor: Actor): boolean {
  return actor.octantSpan > 1 && actor.octant !== actor.octantTarget;
}
