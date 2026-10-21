// Tuning for care and training. The brief's `src/game/config.ts` path does not exist;
// this file sits next to the rest of the sim tuning.
export const careConfig = {
  dailyRepCap: 8,
  fatigueMultiplier: 0.1,
  pSuccessBase: 0.55,
  pSuccessObedience: 0.003,
  pSuccessProgress: 0.004,
  pSuccessMin: 0.5,
  pSuccessMax: 0.97,
  intelligenceBase: 0.8,
  intelligenceSpan: 0.4,
  tierGain: { 1: 15, 2: 7.5, 3: 5 } as const,
  rewardFullMs: 5_000,
  rewardLateMs: 15_000,
  creditFull: 1,
  creditLate: 0.5,
  creditNone: 0.25,
  tierFactor: { basic: 1, special: 1.5 } as const,
  rawAttrPerRep: 0.15,
  rawAttrOnMastery: 3,
  trainingRepXp: 2,
  masteryXp: 20,
  regenMs: 20 * 60_000,
  regenCap: 15,
  loginBonus: 10,
  stackCeiling: 99,
  milestoneBasic: 10,
  milestoneSpecial: 1,
  rewardCalorieFraction: 0.25,
  notificationMax: 3,
  quietStartHour: 21,
  quietEndHour: 8,
};

export type TrickTier = 1 | 2 | 3;
export type TreatTier = 'basic' | 'special';
