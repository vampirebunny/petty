import { stageDayThresholds } from '../../sim/config';
import type { Species } from '../types';

// Every Cuddle number lives here: durations in seconds, angles in radians, offsets in actor-local
// pixels (the renderer scales them with body size). Species and breeds override single fields.

export type CuddleTiming = {
  approachMax: number;
  settle: number;
  perk: number;
  tiltEveryMin: number;
  tiltEveryMax: number;
  tilt: number;
  // Seconds without any touch before Cuddle ends by itself.
  waitTimeout: number;
  // A stroke keeps the pet "being touched" this long after the last valid movement.
  strokeHold: number;
  rollDown: number;
  rollOver: number;
  rollBack: number;
  // Seconds without a touch before a rolled-over pet rolls back up.
  rollBackIdle: number;
  hold: number;
  holdIdle: number;
  unturnMin: number;
  shake: number;
  shakeStand: number;
  swat: number;
  leaveMax: number;
  boop: number;
  headShake: number;
  flinch: number;
  scratch: number;
  kick: number;
  bunt: number;
  kneadStop: number;
};

export type CuddlePoseAmps = {
  lidStroke: number;
  lidScratch: number;
  lidBelly: number;
  headLean: number;
  headRot: number;
  torsoShift: number;
  // Positive bends the ears back, negative perks them up.
  earBackDog: number;
  earBackCat: number;
  earPerk: number;
  earFlinch: number;
  tiltRad: number;
  scratchTilt: number;
  boopHeadJolt: number;
  boopSnout: number;
  headShakeRad: number;
  bunt: number;
  catTailUp: number;
  catTailWait: number;
  bellyLoll: number;
  bellyMouth: number;
};

export type CuddleTuning = {
  // 'sit' or 'stand' for the settled posture.
  posture: 'sit' | 'stand';
  timing: CuddleTiming;
  amps: CuddlePoseAmps;
  wag: { waiting: number; max: number; ampWaiting: number; ampStroking: number };
  // Seconds of petting before the escalation, and before the pet has had enough.
  escalation: { rollAt: number; kneadAt: number; trapChance: number; sustainDecay: number; kneadHz: number };
  tolerance: { max: number; boopCost: number; swatCost: number };
  kick: { chance: number; cooldown: number };
};

export type CuddleParams = CuddleTuning;

export const cuddleDefaults: CuddleTuning = {
  posture: 'sit',
  timing: {
    approachMax: 9,
    settle: 0.4,
    perk: 0.7,
    tiltEveryMin: 3.5,
    tiltEveryMax: 6,
    tilt: 0.6,
    waitTimeout: 45,
    strokeHold: 0.6,
    rollDown: 0.5,
    rollOver: 0.6,
    rollBack: 0.9,
    rollBackIdle: 4,
    hold: 1.5,
    holdIdle: 0.2,
    unturnMin: 0.25,
    shake: 0.5,
    shakeStand: 0.3,
    swat: 0.8,
    leaveMax: 4,
    boop: 0.5,
    headShake: 0.7,
    flinch: 0.35,
    scratch: 0.5,
    kick: 0.6,
    bunt: 0.6,
    kneadStop: 3,
  },
  amps: {
    lidStroke: 0.5,
    lidScratch: 0.92,
    lidBelly: 1,
    headLean: 3,
    headRot: 0.087,
    torsoShift: 3,
    earBackDog: 0.17,
    earBackCat: 0,
    earPerk: -0.32,
    earFlinch: 0.45,
    tiltRad: 0.12,
    scratchTilt: 0.175,
    boopHeadJolt: 3,
    boopSnout: 0.1,
    headShakeRad: 0.35,
    bunt: 5,
    catTailUp: 0.85,
    catTailWait: 0.25,
    bellyLoll: 0.5,
    bellyMouth: 0.8,
  },
  wag: { waiting: 3, max: 12, ampWaiting: 0.28, ampStroking: 0.5 },
  escalation: { rollAt: 12, kneadAt: 8, trapChance: 0.3, sustainDecay: 0.6, kneadHz: 2 },
  tolerance: { max: 40, boopCost: 0.8, swatCost: 3 },
  kick: { chance: 0.12, cooldown: 6 },
};

export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

export const cuddleSpecies: Record<Species, DeepPartial<CuddleTuning>> = {
  dog: {},
  cat: {
    // Cats escalate sooner, leave sooner, and keep their ears forward.
    escalation: { kneadAt: 8, trapChance: 0.3 },
    tolerance: { max: 28 },
    wag: { waiting: 2, max: 4, ampWaiting: 0.15, ampStroking: 0.2 },
  },
};

export const cuddleBreeds: Record<string, DeepPartial<CuddleTuning>> = {
  retriever: { tolerance: { max: 55 }, escalation: { rollAt: 9 } },
  corgi: { escalation: { rollAt: 11 } },
  dachshund: { posture: 'stand', escalation: { rollAt: 13 } },
  husky: { tolerance: { max: 34 }, escalation: { rollAt: 14 } },
  pug: { tolerance: { max: 48 }, escalation: { rollAt: 10 } },
  persian: { tolerance: { max: 34 }, escalation: { kneadAt: 6 } },
  siamese: { tolerance: { max: 24 }, escalation: { kneadAt: 10 } },
  maineCoon: { tolerance: { max: 36 } },
};

// Durations in `timing` scale by the life-stage factor, so seniors move slower.
const stageFactors = { puppy: 0.9, olderPuppy: 0.95, adolescent: 1, adult: 1, senior: 1.3 } as const;
// Timing entries that are thresholds or waits and so do not scale with the stage.
const unscaled: (keyof CuddleTiming)[] = [
  'approachMax',
  'tiltEveryMin',
  'tiltEveryMax',
  'waitTimeout',
  'strokeHold',
  'rollBackIdle',
  'leaveMax',
  'kneadStop',
];

export function stageFactor(ageDays: number, vitality = 1): number {
  const [d1, d2, d3, d4] = stageDayThresholds;
  if (ageDays < d1) {
    return stageFactors.puppy;
  }
  if (ageDays < d2) {
    return stageFactors.olderPuppy;
  }
  if (ageDays < d3) {
    return stageFactors.adolescent;
  }
  if (ageDays < d4) {
    return stageFactors.adult;
  }
  // A senior with low vitality moves the slowest.
  return stageFactors.senior + 0.4 * (1 - Math.max(0, Math.min(1, vitality)));
}

function merge<T extends object>(base: T, patch: DeepPartial<T> | undefined): T {
  if (!patch) {
    return base;
  }
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const key of Object.keys(patch)) {
    const value = (patch as Record<string, unknown>)[key];
    const current = (base as Record<string, unknown>)[key];
    if (value != null && typeof value === 'object' && current != null && typeof current === 'object') {
      out[key] = merge(current as object, value as DeepPartial<object>);
    } else if (value !== undefined) {
      out[key] = value;
    }
  }
  return out as T;
}

export function cuddleParamsFor(breedId: string, species: Species, ageDays = 100, vitality = 1): CuddleParams {
  const merged = merge(merge(cuddleDefaults, cuddleSpecies[species]), cuddleBreeds[breedId]);
  const factor = stageFactor(ageDays, vitality);
  const timing = { ...merged.timing };
  for (const key of Object.keys(timing) as (keyof CuddleTiming)[]) {
    if (!unscaled.includes(key)) {
      timing[key] *= factor;
    }
  }
  return { ...merged, timing };
}
