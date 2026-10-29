import {
  adultGrowthFraction,
  agingObedienceGain,
  agingStaminaDrop,
  archetypes,
  daysToSenior,
  driftLimit,
  stageDayThresholds,
  healthyWeightBand,
  puppyGrowthFraction,
  traits,
  vitalityFloor,
  weightModifierAtExtreme,
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
  const [puppyEnd, olderPuppyEnd, adolescentEnd, seniorStart] = stageDayThresholds;
  if (ageDays < puppyEnd) {
    return 'puppy';
  }
  if (ageDays < olderPuppyEnd) {
    return 'olderPuppy';
  }
  if (ageDays < adolescentEnd) {
    return 'adolescent';
  }
  if (ageDays < seniorStart) {
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

export function trainingGain(current: number, potential: number, raw: number, exponent = 2): number {
  if (potential <= 0 || raw <= 0 || current >= potential) {
    return 0;
  }
  const fraction = (potential - current) / potential;
  return raw * Math.pow(fraction, exponent);
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

function trainedOf(state: PetState, trait: Trait): number {
  return state.attributes.trained?.[trait] ?? 0;
}

function clampTrained(trained: Stats, potential: Stats, maturity: number): Stats {
  const next = { ...trained };
  for (const trait of traits) {
    const room = Math.max(0, potential[trait] - naturalGrowth(potential[trait], maturity));
    next[trait] = Math.max(0, Math.min(room, trained[trait] ?? 0));
  }
  return next;
}

// Raised score used for the style label: natural growth plus training and playdate points.
// Drift, weight, and aging stay out so a heavy or elderly pet does not change style.
export function styleBasis(state: PetState): Stats {
  const trained = state.attributes.trained ?? zeroStats();
  const { potential } = state.attributes;
  const out = zeroStats();
  for (const trait of traits) {
    const natural = naturalGrowth(potential[trait], state.maturity);
    out[trait] = Math.min(potential[trait], natural + (trained[trait] ?? 0));
  }
  return out;
}

// Flat playdate points, added on top of natural growth. Training uses trainingGain instead.
export function addFlatTrained(state: PetState, gains: Partial<Record<Trait, number>>): PetState {
  const trained = { ...(state.attributes.trained ?? zeroStats()) };
  for (const trait of traits) {
    const gain = gains[trait];
    if (!gain) {
      continue;
    }
    trained[trait] = Math.max(0, (trained[trait] ?? 0) + gain);
  }
  return { ...state, attributes: { ...state.attributes, trained } };
}

export function shownAttributeSteps(before: PetState, after: PetState): { trait: Trait; delta: number }[] {
  const gains: { trait: Trait; delta: number }[] = [];
  for (const trait of traits) {
    const delta = Math.round(attributeScore(after, trait)) - Math.round(attributeScore(before, trait));
    if (delta > 0) {
      gains.push({ trait, delta });
    }
  }
  return gains;
}

// Effective score: natural growth plus the trained bonus, plus care drift, times the aging and
// weight modifiers, capped at potential. Aging and weight change only this derived value.
export function attributeScore(state: PetState, trait: Trait): number {
  const stage = stageOf(state.ageDays);
  const { potential } = state.attributes;
  const natural = naturalGrowth(potential[trait], state.maturity);
  const combined = natural + trainedOf(state, trait) + state.drift[trait];
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
  const trained = state.attributes.trained;
  return {
    ...state,
    maturity,
    seniorBand: reconcileBand({ ...state, maturity }),
    attributes: {
      ...state.attributes,
      current: clampCurrent(state.attributes.current, state.attributes.potential),
      trained: trained ? clampTrained(trained, state.attributes.potential, maturity) : undefined,
    },
  };
}

export function clampDrift(value: number): number {
  return Math.max(-driftLimit, Math.min(driftLimit, value));
}
