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
