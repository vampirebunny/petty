// Tuning for care and training. The brief's `src/game/config.ts` path does not exist;
// this file sits next to the rest of the sim tuning.
export const careConfig = {
  fatigueMultiplier: 0.1,
  trickRestMs: 10 * 60_000,
  focusCostTreat: 1,
  focusCostNoTreat: 2,
  sessionBase: 5,
  sessionStaminaSpan: 5,
  startingTreats: 10,
  pSuccessBase: 0.55,
  pSuccessObedience: 0.003,
  pSuccessProgress: 0.004,
  pSuccessMin: 0.5,
  pSuccessMax: 0.97,
  intelligenceBase: 0.8,
  intelligenceSpan: 0.4,
  tierGain: { 1: 15, 2: 7.5, 3: 5 } as const,
  creditTreat: 1,
  creditNoTreat: 0.25,
  rawAttrPerRep: 1,
  rawAttrOnMastery: 5,
  trainingGainExponent: 1,
  masteryIntelligenceRaw: 2,
  trainingRepXp: 2,
  masteryXp: 20,
  stackCeiling: 99,
  rewardCalorieFraction: 0.25,
  notificationMax: 3,
  quietStartHour: 21,
  quietEndHour: 8,
};

export type TrickTier = 1 | 2 | 3;
export type TreatTier = 'basic' | 'special';
