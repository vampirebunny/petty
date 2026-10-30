// Trick props are owned by the player and placed only for the current scene.
// Anchor numbers match the catalog and are scaled into stage pixels.
// The art and the trick paths both read the geometry below, so a drawing can't drift from where the pet goes.

export type TrickPropType = 'podium' | 'tunnel' | 'hurdle' | 'cones' | 'hoop';

export const PROP_SCALE = 1.6;
const s = PROP_SCALE;

// A tube along the path. The pet crawls through it at the prop's depth.
// foot is 0: the opening sits on the ground line. The drawing adds a short skirt below it so paws don't show under the fabric.
export const TUNNEL = { half: 66 * s, height: 62 * s, foot: 0, mouth: 12 * s };
// A bar across the path, seen at a slight angle: far post right and up, near post left and down.
// The bar crosses the pet's depth at its midpoint, so its far half draws behind and its near half in front.
export const HURDLE = { depth: 14 * s, skew: 7 * s, post: 6 * s, bar: 6 * s, barMin: 6, barMax: 36 * s, barDefault: 30 * s };
// A ring across the path, turned slightly so it reads as a thin ellipse. z values are ring-center heights.
// bodyCenter is below 0.5 so the torso sits in the lower half of the ring and the ears clear the top.
export const HOOP = { r: 58 * s, tilt: 14 * s, ring: 6 * s, bodyCenter: 0.72, zMax: 96 * s, zDefault: 72 * s };
// Cones in a line along the path. The pet passes each one on alternating sides.
// Gaps are about a body length so the pet clears one cone before the next.
export const CONES = { xs: [-100, -34, 34, 100], weave: 18 * s, h: 30 * s, w: 11 * s };

export type OwnedTrickProp = {
  instanceId: string;
  type: TrickPropType;
  sourceTrickId: string;
};

export type PlacedTrickProp = OwnedTrickProp & {
  x: number;
  y: number;
  knocked: boolean;
  // Fitted to the performing pet when a trick starts. Undefined uses the default height.
  barZ?: number;
  hoopZ?: number;
};

const ALIGN_Y = 36;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function propInstanceId(trickId: string, petId: string): string {
  return `prop:${trickId}:${petId}`;
}

// How far from the floor edges a prop must sit so its path stays on the floor.
export function propYInset(type: TrickPropType): number {
  return type === 'cones' ? CONES.weave + 4 : 0;
}

export function barTop(prop: PlacedTrickProp): number {
  return prop.barZ ?? HURDLE.barDefault;
}

export function hoopCenter(prop: PlacedTrickProp): number {
  return prop.hoopZ ?? HOOP.zDefault;
}

// Foot height at the apex that puts the body's middle through the ring's middle.
export function hoopApex(prop: PlacedTrickProp, bodyHPx: number): number {
  return Math.max(4, hoopCenter(prop) - HOOP.bodyCenter * bodyHPx);
}

// Sets the bar and ring to heights this pet can actually clear.
// ceilingPx is the pet's highest jump (feet height), bodyHPx its body height, margin the jump's obstacle margin in body-heights.
export function fitBarZ(ceilingPx: number, bodyHPx: number, margin: number): number {
  return clamp((ceilingPx - margin * bodyHPx) * 0.85, HURDLE.barMin, HURDLE.barMax);
}

export function fitTrickProp(prop: PlacedTrickProp, ceilingPx: number, bodyHPx: number, margin: number): void {
  if (prop.type === 'hurdle') {
    prop.barZ = fitBarZ(ceilingPx, bodyHPx, margin);
  } else if (prop.type === 'hoop') {
    const lowest = HOOP.r + HOOP.ring / 2 + 4;
    prop.hoopZ = clamp(ceilingPx * 0.85 + HOOP.bodyCenter * bodyHPx, lowest, HOOP.zMax);
  }
}

export function approachSign(
  petX: number,
  petY: number,
  propX: number,
  propY: number,
  face: 1 | -1,
  reach: number,
): 1 | -1 {
  const aligned = Math.abs(petY - propY) <= ALIGN_Y;
  if (aligned) {
    if (Math.abs(petX - propX) < 8) {
      return face === 1 ? 1 : -1;
    }
    return petX < propX ? -1 : 1;
  }
  const left = Math.hypot(petX - (propX - reach), petY - propY);
  const right = Math.hypot(petX - (propX + reach), petY - propY);
  if (Math.abs(left - right) < 8) {
    return face === 1 ? 1 : -1;
  }
  return left < right ? -1 : 1;
}

export function propsForTrick(
  placed: PlacedTrickProp[],
  type: TrickPropType,
  petX: number,
  petY: number,
  mastered: boolean,
): PlacedTrickProp[] {
  const matching = placed
    .filter((prop) => prop.type === type)
    .sort((a, b) => Math.hypot(a.x - petX, a.y - petY) - Math.hypot(b.x - petX, b.y - petY));
  return mastered ? matching : matching.slice(0, 1);
}

export type PropPoint = {
  x: number;
  y: number;
  landZ: number;
};

// `sign` -1 performs toward +x (the pet is on the left). `sign` 1 reverses the path.
export function propPoint(
  type: TrickPropType,
  at: string,
  propX: number,
  propY: number,
  sign: 1 | -1,
  bodyLength: number,
  hurdleApproach = 72,
  hurdlePast = 52,
): PropPoint {
  const bl = Math.max(bodyLength, 24);
  const dir = sign === -1 ? 1 : -1;
  const halfTop = 40 * s;
  const topZ = 30 * s;
  if (type === 'podium') {
    if (at === 'top') {
      return { x: propX, y: propY, landZ: topZ };
    }
    if (at === 'off') {
      return { x: propX + dir * (halfTop + 0.7 * bl), y: propY, landZ: 0 };
    }
    return { x: propX - dir * (halfTop + 0.62 * bl), y: propY, landZ: 0 };
  }
  if (type === 'tunnel') {
    const entry = TUNNEL.half;
    if (at === 'mid') {
      return { x: propX, y: propY, landZ: 0 };
    }
    if (at === 'out') {
      // Past the mouth by a body length, so the pet is clear of the tube when the dash ends.
      return { x: propX + dir * (entry + TUNNEL.mouth + 1.5 * bl), y: propY, landZ: 0 };
    }
    return { x: propX - dir * (entry + 0.55 * bl), y: propY, landZ: 0 };
  }
  if (type === 'hurdle') {
    if (at === 'landing') {
      return { x: propX + dir * (hurdlePast + 0.5 * bl), y: propY, landZ: 0 };
    }
    return { x: propX - dir * (hurdleApproach + 0.5 * bl), y: propY, landZ: 0 };
  }
  if (type === 'hoop') {
    const gap = 0.5 * bl + 95;
    if (at === 'landing') {
      return { x: propX + dir * gap, y: propY, landZ: 0 };
    }
    return { x: propX - dir * gap, y: propY, landZ: 0 };
  }
  // Cones: approach and exit on the line, each cone passed on the opposite side from the last.
  const path = CONES.xs.map((x) => propX + dir * x * s);
  if (at === 'approach') {
    return { x: path[0] - dir * 0.75 * bl, y: propY, landZ: 0 };
  }
  if (at === 'out') {
    return { x: path[path.length - 1] + dir * (1.5 * bl + CONES.w), y: propY, landZ: 0 };
  }
  const index = at === 'c0' ? 0 : at === 'c1' ? 1 : at === 'c2' ? 2 : 3;
  const side = index % 2 === 0 ? -1 : 1;
  return { x: path[index], y: propY + side * CONES.weave, landZ: 0 };
}
