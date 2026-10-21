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

const deg = Math.PI / 180;

function sectorLimits(): { side: number; front: number; hyst: number } {
  return {
    side: facingConfig.sectors.sideDeg * deg,
    front: facingConfig.sectors.frontDeg * deg,
    hyst: facingConfig.hysteresisDeg * deg,
  };
}

// angle = atan2(-vy, vx). Negative sin is toward the camera.
function sectorAt(angle: number, sideLimit: number, frontLimit: number): Facing {
  const a = wrap(angle);
  const abs = Math.abs(a);
  const toHoriz = Math.min(abs, Math.PI - abs);
  const east = Math.cos(a) >= 0;
  const south = Math.sin(a) < 0;
  if (toHoriz <= sideLimit) {
    return east ? 'E' : 'W';
  }
  if (toHoriz <= frontLimit) {
    if (east) {
      return south ? 'SE' : 'NE';
    }
    return south ? 'SW' : 'NW';
  }
  return south ? 'S' : 'N';
}

function inExpanded(angle: number, octant: Facing, expand: number): boolean {
  const { side, front } = sectorLimits();
  const a = wrap(angle);
  const abs = Math.abs(a);
  const toHoriz = Math.min(abs, Math.PI - abs);
  const east = Math.cos(a) >= 0;
  const south = Math.sin(a) < 0;
  switch (octant) {
    case 'E':
      return east && toHoriz <= side + expand;
    case 'W':
      return !east && toHoriz <= side + expand;
    case 'NE':
      return east && !south && toHoriz >= side - expand && toHoriz <= front + expand;
    case 'SE':
      return east && south && toHoriz >= side - expand && toHoriz <= front + expand;
    case 'NW':
      return !east && !south && toHoriz >= side - expand && toHoriz <= front + expand;
    case 'SW':
      return !east && south && toHoriz >= side - expand && toHoriz <= front + expand;
    case 'N':
      return !south && toHoriz >= front - expand;
    case 'S':
      return south && toHoriz >= front - expand;
    default:
      return false;
  }
}

// angle = atan2(-vy, vx). Side, diagonal, and front/back widths come from facingConfig.
export function octantFromVelocity(vx: number, vy: number, previous: Facing): Facing {
  if (Math.hypot(vx, vy) < facingConfig.restSpeed) {
    return previous;
  }
  const { side, front, hyst } = sectorLimits();
  const angle = Math.atan2(-vy, vx);
  const next = sectorAt(angle, side, front);
  if (next === previous || inExpanded(angle, previous, hyst)) {
    return previous;
  }
  return next;
}

// Screen heading: E = 0, S = +90° (down the screen), back octants are negative.
export function screenTheta(octant: Facing): number {
  return -CENTER[octant];
}

// Fold a west-side angle into the east-facing draw frame so a canvas mirror does not double-flip.
export function localTheta(octant: Facing, dir: 1 | -1): number {
  const abs = screenTheta(octant);
  if (dir >= 0) {
    return abs;
  }
  return wrap(Math.PI - abs);
}

export function blendedTheta(from: Facing, to: Facing, blend: number, dir: 1 | -1): number {
  const t = Math.max(0, Math.min(1, blend));
  const a = localTheta(from, dir);
  const b = localTheta(to, dir);
  return a + wrap(b - a) * t;
}

// During a tween, N/S never pick the mirror. If both octants have a side, the current one wins.
export function mirrorDir(from: Facing, current: Facing, blend: number, face: number): 1 | -1 {
  const pair: Facing[] = blend < 1 ? [from, current] : [current];
  const sided = pair.filter((octant) => octant !== 'N' && octant !== 'S');
  const pick = sided.length === 0 ? null : sided.length === 1 ? sided[0] : current;
  if (!pick) {
    return face >= 0 ? 1 : -1;
  }
  return horizontalDir(pick, face);
}

export type LocalPoint = { f: number; l: number; h: number };

// f is forward along the body, l is lateral (left −, right +), h is height off the ground.
// Forward maps onto the ground 1:1. depthTilt only separates the far side vertically, so a planted paw stays put.
export function projectLocal(
  point: LocalPoint,
  theta: number,
  depthTilt = facingConfig.depthTilt,
): { x: number; y: number; depth: number } {
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const depth = point.f * sin - point.l * cos;
  return {
    x: point.f * cos + point.l * sin,
    y: -point.h + point.f * sin - point.l * cos * depthTilt,
    depth,
  };
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
  aimFace: 1 | -1;
} {
  return { octant: 'E', octantFrom: 'E', octantTarget: 'E', octantBlend: 1, octantHold: 0, octantSpan: 0, aimFace: 1 };
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
  actor.aimFace = face;
  actor.aimVx = 0;
  actor.aimVy = 0;
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
    actor.octant = stepToward(actor.octant, actor.octantTarget, actor.aimFace);
    actor.octantBlend = 0;
    actor.octantHold = 0;
    actor.lead = Math.max(actor.lead, headLead);
  }
  syncHorizontal(actor);
  const pending = actor.octant !== actor.octantTarget || actor.octantBlend < 1;
  actor.turning = pending || actor.lead > 0 || actor.spin != null;
  actor.anchors.facing = mirrorDir(actor.octantFrom, actor.octant, actor.octantBlend, actor.face);
}

// Remember how far this target was, and the horizontal sign at that moment (the N/S tie-break).
export function aimOctant(actor: Actor, target: Facing): void {
  if (target === actor.octantTarget) {
    return;
  }
  actor.octantSpan = octantDistance(actor.octant, target);
  actor.octantTarget = target;
  actor.aimFace = actor.face >= 0 ? 1 : -1;
}

export function holdForTurn(actor: Actor): boolean {
  return actor.octantSpan > 1 && actor.octant !== actor.octantTarget;
}

const fitOf: Record<ViewId, { foreshorten: number; front: number; rear: number }> = {
  side: { foreshorten: 1, front: 0, rear: 0 },
  front34: { foreshorten: 0.6, front: 0.35, rear: 0 },
  front: { foreshorten: 0.38, front: 1, rear: 0 },
  back34: { foreshorten: 0.6, front: 0, rear: 0.72 },
  back: { foreshorten: 0.36, front: 0, rear: 1 },
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// Blended foreshorten, front amount, and rear amount for the head and the mouth.
export function facingFit(from: Facing, to: Facing, blend: number): { foreshorten: number; front: number; rear: number } {
  const t = Math.max(0, Math.min(1, blend));
  const a = fitOf[viewOf(from)];
  const b = fitOf[viewOf(to)];
  const headT = Math.min(1, t / 0.65);
  return {
    foreshorten: lerp(a.foreshorten, b.foreshorten, t),
    front: lerp(a.front, b.front, headT),
    rear: lerp(a.rear, b.rear, t),
  };
}
