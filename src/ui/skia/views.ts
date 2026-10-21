import type { Facing, ViewId } from '../../actor/data/facing';
import type { HeadFace } from '../../actor/geometry';
import { mirrorDir, viewOf } from '../../actor/facing';

export type LegId = 'hindFar' | 'foreFar' | 'hindNear' | 'foreNear';

export type TailSlot = 'body' | 'over' | 'top';

export type ViewDef = {
  view: ViewId;
  foreshorten: number;
  // Shadow radii as multiples of the side-view oval.
  shadowRx: number;
  shadowRy: number;
  // Lateral hip separation in local pixels at this view.
  spread: number;
  // 0 = stride along the body, 1 = lift and step down.
  legAngle: number;
  headTurn: number;
  headFront: number;
  // 0 = face the camera, 1 = back of the head.
  rear: number;
  chest: number;
  legsFirst: readonly LegId[];
  legsLast: readonly LegId[];
  tail: TailSlot;
};

// Draw order lives here, not in the renderer. West-side octants mirror these views.
export const viewDefs: Record<ViewId, ViewDef> = {
  side: {
    view: 'side',
    foreshorten: 1,
    shadowRx: 1,
    shadowRy: 1,
    spread: 0,
    legAngle: 0,
    headTurn: 0,
    headFront: 0,
    rear: 0,
    chest: 0,
    legsFirst: ['hindFar', 'foreFar'],
    legsLast: ['hindNear', 'foreNear'],
    tail: 'body',
  },
  front34: {
    view: 'front34',
    foreshorten: 0.6,
    shadowRx: 0.72,
    shadowRy: 1.6,
    spread: 10,
    legAngle: 0.55,
    headTurn: 1,
    headFront: 0.35,
    rear: 0,
    chest: 0.55,
    legsFirst: ['hindFar', 'hindNear'],
    legsLast: ['foreFar', 'foreNear'],
    tail: 'body',
  },
  front: {
    view: 'front',
    foreshorten: 0.38,
    shadowRx: 0.5,
    shadowRy: 2.8,
    spread: 14,
    legAngle: 1,
    headTurn: 1,
    headFront: 1,
    rear: 0,
    chest: 1,
    legsFirst: ['hindFar', 'hindNear'],
    legsLast: ['foreFar', 'foreNear'],
    tail: 'over',
  },
  back34: {
    view: 'back34',
    foreshorten: 0.6,
    shadowRx: 0.72,
    shadowRy: 1.6,
    spread: 10,
    legAngle: 0.55,
    headTurn: 0.15,
    headFront: 0,
    rear: 0.72,
    chest: 0,
    legsFirst: ['foreFar', 'foreNear'],
    legsLast: ['hindFar', 'hindNear'],
    tail: 'top',
  },
  back: {
    view: 'back',
    foreshorten: 0.36,
    shadowRx: 0.48,
    shadowRy: 2.6,
    spread: 13,
    legAngle: 1,
    headTurn: 0,
    headFront: 0,
    rear: 1,
    chest: 0,
    legsFirst: ['foreFar', 'foreNear'],
    legsLast: ['hindFar', 'hindNear'],
    tail: 'top',
  },
};

export type ViewRig = {
  view: ViewId;
  foreshorten: number;
  shadowRx: number;
  shadowRy: number;
  spread: number;
  legAngle: number;
  headTurn: number;
  headFront: number;
  rear: number;
  chest: number;
  legsFirst: readonly LegId[];
  legsLast: readonly LegId[];
  tail: TailSlot;
  dir: 1 | -1;
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// Continuous fields blend. Draw order stays on the view being left until the tween finishes.
export function viewRig(from: Facing, to: Facing, blend: number, face: number): ViewRig {
  const t = Math.max(0, Math.min(1, blend));
  const a = viewDefs[viewOf(from)];
  const b = viewDefs[viewOf(to)];
  const order = t >= 1 ? b : a;
  return {
    view: order.view,
    foreshorten: lerp(a.foreshorten, b.foreshorten, t),
    shadowRx: lerp(a.shadowRx, b.shadowRx, t),
    shadowRy: lerp(a.shadowRy, b.shadowRy, t),
    spread: lerp(a.spread, b.spread, t),
    legAngle: lerp(a.legAngle, b.legAngle, t),
    headTurn: lerp(a.headTurn, b.headTurn, Math.min(1, t / 0.65)),
    headFront: lerp(a.headFront, b.headFront, Math.min(1, t / 0.65)),
    rear: lerp(a.rear, b.rear, t),
    chest: lerp(a.chest, b.chest, t),
    legsFirst: order.legsFirst,
    legsLast: order.legsLast,
    tail: order.tail,
    dir: mirrorDir(from, to, t, face),
  };
}

// Side stride `along` (positive forward) becomes a vertical step as legAngle goes to 1.
export function angledStep(
  along: number,
  lift: number,
  legAngle: number,
  sway: number,
): { x: number; y: number } {
  const k = Math.max(0, Math.min(1, legAngle));
  return { x: along * (1 - k) + sway * k, y: lift + along * k * 0.2 };
}

type Layout = { bodyRx: number; bodyRy: number; head: HeadFace };

const layouts = new Map<string, Layout>();

// Static per-view sizes. Wag, breath, and the stride stay outside this cache.
export function cachedLayout(key: string, make: () => Layout): Layout {
  const hit = layouts.get(key);
  if (hit) {
    return hit;
  }
  const made = make();
  layouts.set(key, made);
  if (layouts.size > 64) {
    const first = layouts.keys().next().value;
    if (first !== undefined) {
      layouts.delete(first);
    }
  }
  return made;
}
