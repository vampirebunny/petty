import {
  adultGrowthFraction,
  agingObedienceGain,
  agingStaminaDrop,
  archetypes,
  daysToSenior,
  driftLimit,
  levelCeilingByStage,
  healthyWeightBand,
  puppyGrowthFraction,
  traits,
  vitalityFloor,
  weightModifierAtExtreme,
  xpPerLevel,
} from './config';
import { clampCurrent } from './offers';
import type { Archetype, PetState, SeniorBand, Stage, Stats, Trait } from './types';

export function hash32(value: number): number {
  let x = value >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  return (x ^ (x >>> 16)) >>> 0;
}

export function zeroStats(): Stats {
  return {
    stamina: 0,
    agility: 0,
    intelligence: 0,
    boldness: 0,
    affection: 0,
    obedience: 0,
  };
}

export function potentialTotal(potential: Stats): number {
  return traits.reduce((sum, trait) => sum + potential[trait], 0);
}

// Seeds the pet's random stream from the adoption seed and the archetype it picked, so pets
// adopted from different offers do not share one stream.
export function rngSeed(seed: number, archetype: Archetype): number {
  return hash32((seed ^ Math.imul(archetypes.indexOf(archetype) + 1, 0x85ebca6b)) >>> 0);
}

export function maturityOf(ageDays: number): number {
  return Math.min(1, Math.max(0, ageDays / daysToSenior));
}

export function stageOf(ageDays: number): Stage {
  if (ageDays < 7) {
    return 'puppy';
  }
  if (ageDays < 21) {
    return 'olderPuppy';
  }
  if (ageDays < 45) {
    return 'adolescent';
  }
  if (ageDays < daysToSenior) {
    return 'adult';
  }
  return 'senior';
}

export function naturalGrowth(potential: number, maturity: number): number {
  const fraction = puppyGrowthFraction + (adultGrowthFraction - puppyGrowthFraction) * maturity;
  return Math.min(potential, Math.max(1, Math.round(potential * fraction)));
}

// A flat playdate grant. It is added on top of the score already shown, which is the
// higher of stored current and natural growth, then capped at potential.
export function grantFlatAttributes(
  current: Stats,
  potential: Stats,
  maturity: number,
  gains: Partial<Record<Trait, number>>,
): Stats {
  const next = { ...current };
  for (const trait of traits) {
    const gain = gains[trait];
    if (!gain) {
      continue;
    }
    const base = Math.max(current[trait], naturalGrowth(potential[trait], maturity));
    next[trait] = base + gain;
  }
  return clampCurrent(next, potential);
}

export function trainingGain(current: number, potential: number, raw: number): number {
  if (potential <= 0 || raw <= 0 || current >= potential) {
    return 0;
  }
  const fraction = (potential - current) / potential;
  return raw * fraction * fraction;
}

export function shownLevel(xp: number, stage: Stage): number {
  const earned = 1 + Math.floor(xp / xpPerLevel);
  return Math.min(earned, levelCeilingByStage[stage]);
}

function weightModifier(weight: number): number {
  const excess = Math.max(0, Math.abs(weight) - healthyWeightBand) / (1 - healthyWeightBand);
  return 1 - (1 - weightModifierAtExtreme) * Math.min(1, excess);
}

function agingModifier(stage: Stage, vitality: number, trait: Trait): number {
  if (stage !== 'senior') {
    return 1;
  }
  const low = Math.min(1, Math.max(0, (1 - vitality) / (1 - vitalityFloor)));
  if (trait === 'stamina' || trait === 'agility') {
    return 1 - agingStaminaDrop * low;
  }
  if (trait === 'obedience') {
    return 1 + agingObedienceGain * low;
  }
  return 1;
}

// Effective score: the larger of the stored current score and natural growth for this maturity,
// plus care drift, times the aging and weight modifiers, capped at potential. Aging and weight
// change only this derived value, never the stored current score or potential.
export function attributeScore(state: PetState, trait: Trait): number {
  const stage = stageOf(state.ageDays);
  const { potential, current } = state.attributes;
  const natural = naturalGrowth(potential[trait], state.maturity);
  const combined = Math.max(current[trait], natural) + state.drift[trait];
  const weighted =
    trait === 'stamina' || trait === 'agility' ? combined * weightModifier(state.weight) : combined;
  const aged = weighted * agingModifier(stage, state.vitality, trait);
  return Math.min(potential[trait], Math.max(1, aged));
}

export function reconcileBand(state: PetState): SeniorBand | undefined {
  if (stageOf(state.ageDays) !== 'senior') {
    return state.seniorBand;
  }
  const vitality = state.vitality;
  const current = state.seniorBand;
  if (current == null) {
    if (vitality < 0.4) {
      return 'elderly';
    }
    if (vitality > 0.7) {
      return 'earlySenior';
    }
    return 'senior';
  }
  if (current === 'elderly' && vitality >= 0.45) {
    return vitality > 0.75 ? 'earlySenior' : 'senior';
  }
  if (current === 'earlySenior' && vitality <= 0.65) {
    return vitality < 0.35 ? 'elderly' : 'senior';
  }
  if (current === 'senior') {
    if (vitality < 0.35) {
      return 'elderly';
    }
    if (vitality > 0.75) {
      return 'earlySenior';
    }
  }
  return current;
}

export function withDerived(state: PetState): PetState {
  const maturity = maturityOf(state.ageDays);
  return {
    ...state,
    maturity,
    level: shownLevel(state.xp, stageOf(state.ageDays)),
    seniorBand: reconcileBand({ ...state, maturity }),
    attributes: {
      ...state.attributes,
      current: clampCurrent(state.attributes.current, state.attributes.potential),
    },
  };
}

export function clampDrift(value: number): number {
  return Math.max(-driftLimit, Math.min(driftLimit, value));
}
