import type { EarType } from '../types';

// Per ear type layout, in head radii. Data only: a new ear type is a new row here plus a shape in the renderer.
export type EarProfile = {
  // Stiff ears rotate about their base with the ear pose. Others hang and swing from the top.
  stiff: boolean;
  // Far ear offset from the near ear at the 3/4 turn.
  farDx: number;
  farDy: number;
  // How far a stiff near ear slides back at the 3/4 turn so the pair spreads apart.
  nearBack: number;
  // Tip height above the head center at earSize 1 (hanging ears: the attachment point).
  height: number;
  // Erect ears poke through a beanie, others are covered by it.
  hatPoke: boolean;
  // Erect ears start folded at the puppy stage and rise along the growth curve.
  rises: boolean;
  // Ears set lower on the head, in head radii.
  drop: number;
  // Drawn over the head circle instead of behind it (folded ears).
  overHead: boolean;
};

export const earProfiles: Record<EarType, EarProfile> = {
  erectTall: { rises: true, stiff: true, farDx: 1.05, farDy: 0, nearBack: 0.28, height: 1.95, hatPoke: true, drop: 0, overHead: false },
  bat: { rises: true, stiff: true, farDx: 1.0, farDy: 0, nearBack: 0.25, height: 1.8, hatPoke: true, drop: 0, overHead: false },
  longDrape: { rises: false, stiff: false, farDx: 0.5, farDy: 0.06, nearBack: 0, height: 0.45, hatPoke: false, drop: 0, overHead: false },
  button: { rises: false, stiff: false, farDx: 0.85, farDy: 0, nearBack: 0.1, height: 0.85, hatPoke: false, drop: 0, overHead: false },
  softFlop: { rises: false, stiff: false, farDx: 0.7, farDy: 0.02, nearBack: 0, height: 0.5, hatPoke: false, drop: 0, overHead: false },
  standard: { rises: false, stiff: true, farDx: 1.05, farDy: 0, nearBack: 0.28, height: 1.7, hatPoke: true, drop: 0, overHead: false },
  wedgeLarge: { rises: false, stiff: true, farDx: 1.1, farDy: 0, nearBack: 0.3, height: 1.95, hatPoke: true, drop: 0, overHead: false },
  // Small ears set wide and low on the sides of the head.
  smallLow: { rises: false, stiff: true, farDx: 1.2, farDy: 0, nearBack: 0.45, height: 1.2, hatPoke: false, drop: 0.2, overHead: false },
  tufted: { rises: false, stiff: true, farDx: 1.05, farDy: 0, nearBack: 0.28, height: 2.0, hatPoke: true, drop: 0, overHead: false },
  // Folded caps lie forward on top of the head, so both are drawn over it and both stay on the head in 3/4.
  folded: { rises: false, stiff: false, farDx: 0.72, farDy: 0, nearBack: 0.12, height: 0.95, hatPoke: false, drop: 0, overHead: true },
};

// Where one ear sits on the back of the head, in head space. The side-view shifts tuck both
// ears onto one cheek; from behind the pair is mirrored and the left ear is flipped so the
// side-view silhouette flares outward. `sx` is the horizontal scale, negative on the left.
export function rearEarPlace(
  earType: EarType,
  far: boolean,
  R: number,
  oneEarFlop = false,
): { x: number; y: number; sx: number } {
  const profile = earProfiles[earType];
  const side = far ? 1 : -1;
  const flopped = oneEarFlop && !far && profile.rises;
  if (profile.stiff && !flopped) {
    // Narrowed: the side-view triangle is the face of the ear. From behind only the back shows,
    // and the base sits on the upper side of the skull rather than out at the cheek.
    return { x: side * R * 0.42, y: R * (0.06 + profile.drop), sx: side * 0.72 };
  }
  if ((earType === 'folded' || earType === 'button') && !flopped) {
    return { x: side * R * 0.52, y: R * 0.07, sx: side };
  }
  // Hanging ears drop from each side of the head.
  return { x: side * R * 0.93, y: R * 0.05, sx: side };
}

// Local -x extent of each stiff ear path, in head radii. The front pair uses it to keep the inner corners even.
const stiffBaseMin: Record<EarType, number> = {
  erectTall: -0.52,
  bat: -0.72,
  longDrape: 0,
  button: 0,
  softFlop: 0,
  standard: -0.4,
  wedgeLarge: -0.55,
  smallLow: -0.45,
  tufted: -0.4,
  folded: 0,
};

// Full front. The side-view ear leans one way, and the far ear is tucked behind the skull, so a
// straight-on face came out lopsided. This plants a mirrored pair with both inner corners at the same gap.
export function frontEarPlace(
  earType: EarType,
  far: boolean,
  R: number,
  oneEarFlop = false,
): { x: number; y: number; sx: number } {
  const profile = earProfiles[earType];
  const side = far ? 1 : -1;
  const flopped = oneEarFlop && !far && profile.rises;
  if (profile.stiff && !flopped) {
    const spread = 0.1 - stiffBaseMin[earType];
    return { x: side * R * spread, y: profile.drop * R, sx: side };
  }
  if ((earType === 'folded' || earType === 'button') && !flopped) {
    return { x: side * R * 0.42, y: R * 0.04, sx: side };
  }
  return { x: side * R * 0.87, y: R * 0.02, sx: side };
}
