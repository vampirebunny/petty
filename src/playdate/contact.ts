import { breedById, geomOf } from '../actor';
import type { Actor } from '../actor';
import { PET_SIZE, xRangeOf } from '../actor/geometry';

type Floor = { xMin: number; xMax: number; yMin: number; yMax: number };

// Pets share the floor like bodies on a mat: wide front to back, shallow side to side.
const depthRadius = 20;
// A little give so noses can meet without the bodies overlapping.
const bodyOverlap = 0.88;
// How fast one pet is shoved off another, in stage units per second.
const pushSpeed = 260;

export type Body = { radius: number; lo: number; hi: number };

// How far a pet's body reaches along the floor, and the x range it may stand in.
export function bodyOf(actor: Actor, floor: Floor): Body {
  const breed = breedById(actor.breedId);
  if (!breed) {
    return { radius: 60, lo: floor.xMin, hi: floor.xMax };
  }
  const geom = geomOf(breed, actor.displayAgeDays, actor.displayWeight, actor.vitality);
  const scale = actor.anchors.scale > 0 ? actor.anchors.scale : PET_SIZE * geom.sc;
  const range = xRangeOf(floor, geom, scale);
  return { radius: (geom.bodyLen / 2 + 6) * scale, lo: range.lo, hi: range.hi };
}

// Two pets cannot stand inside each other. Overlapping bodies are pushed apart a little each frame, and
// pets in different rows pass in front of or behind one another.
export function separate(a: Actor, b: Actor, floor: Floor, dt: number): void {
  if (a.z > 8 || b.z > 8) {
    return;
  }
  const bodyA = bodyOf(a, floor);
  const bodyB = bodyOf(b, floor);
  const rx = (bodyA.radius + bodyB.radius) * bodyOverlap;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let nx = dx / rx;
  let ny = dy / depthRadius;
  const distance = Math.hypot(nx, ny);
  if (distance >= 1) {
    return;
  }
  // Head on in one row, so slip past: the pet further back steps back, the other steps forward.
  if (Math.abs(dy) < 6) {
    ny += a.y <= b.y ? 0.4 : -0.4;
  }
  if (Math.hypot(nx, ny) < 0.001) {
    nx = 1;
  }
  const length = Math.hypot(nx, ny);
  const wantX = (nx / length) * rx;
  const wantY = (ny / length) * depthRadius;
  const moveX = wantX - dx;
  const moveY = wantY - dy;
  const limit = pushSpeed * dt;
  const size = Math.hypot(moveX, moveY);
  const k = size > limit && size > 0 ? limit / size : 1;
  const stepX = (moveX * k) / 2;
  const stepY = (moveY * k) / 2;
  a.x = Math.min(bodyA.hi, Math.max(bodyA.lo, a.x - stepX));
  a.y = Math.min(floor.yMax, Math.max(floor.yMin, a.y - stepY));
  b.x = Math.min(bodyB.hi, Math.max(bodyB.lo, b.x + stepX));
  b.y = Math.min(floor.yMax, Math.max(floor.yMin, b.y + stepY));
}

// A pet that has stopped looks at its partner, so a bow, a sniff, or a trick is aimed at someone.
export function faceEachOther(a: Actor, b: Actor): void {
  for (const [self, other] of [
    [a, b],
    [b, a],
  ] as const) {
    if (self.speed < 20 && Math.abs(other.x - self.x) > 4) {
      self.face = other.x > self.x ? 1 : -1;
      self.anchors.facing = self.face >= 0 ? 1 : -1;
    }
  }
}

// Both pets lean the same way as the rope shifts, so a tug rocks the pair back and forth.
export function tugShift(actor: Actor, seconds: number, side: 'A' | 'B', dt: number): void {
  const phase = seconds * 3.2 + (side === 'A' ? 0 : Math.PI);
  actor.x += actor.face * Math.cos(phase) * 28 * dt;
}
