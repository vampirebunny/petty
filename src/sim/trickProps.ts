// Trick props are owned by the player and placed only for the current scene.
// Anchor numbers match the catalog and are scaled into stage pixels.

export type TrickPropType = 'podium' | 'tunnel' | 'hurdle' | 'cones' | 'hoop';

export const PROP_SCALE = 1.6;

export type OwnedTrickProp = {
  instanceId: string;
  type: TrickPropType;
  sourceTrickId: string;
};

export type PlacedTrickProp = OwnedTrickProp & {
  x: number;
  y: number;
  knocked: boolean;
};

const ALIGN_Y = 36;

export function propInstanceId(trickId: string, petId: string): string {
  return `prop:${trickId}:${petId}`;
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
  const s = PROP_SCALE;
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
    const entry = 66 * s;
    if (at === 'mid') {
      return { x: propX, y: propY, landZ: 0 };
    }
    if (at === 'out') {
      return { x: propX + dir * (entry + 0.7 * bl), y: propY, landZ: 0 };
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
  const path = [-60, -20, 20, 60].map((x) => propX + dir * x * s);
  if (at === 'approach') {
    return { x: path[0] - dir * 0.75 * bl, y: propY, landZ: 0 };
  }
  if (at === 'out') {
    return { x: path[path.length - 1] + dir * 0.75 * bl, y: propY, landZ: 0 };
  }
  const index = at === 'c0' ? 0 : at === 'c1' ? 1 : at === 'c2' ? 2 : 3;
  return { x: path[index], y: propY, landZ: 0 };
}

export function barHeight(bodyHeight: number, heightCapPx: number): number {
  return Math.min(48 * PROP_SCALE, Math.max(16, heightCapPx - 8));
}

export function hoopClearance(bodyCenter: number): number {
  return Math.max(12, 70 * PROP_SCALE - bodyCenter);
}
