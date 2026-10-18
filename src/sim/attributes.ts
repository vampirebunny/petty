import {
  adultGrowthFraction,
  agingObedienceGain,
  agingStaminaDrop,
  basePotential,
  breedPotentialTotal,
  daysToSenior,
  driftLimit,
  levelCeilingByStage,
  healthyWeightBand,
  puppyGrowthFraction,
  rollRange,
  temperamentByVariant,
  traits,
  vitalityFloor,
  weightModifierAtExtreme,
  xpPerLevel,
} from './config';
import type { PetState, SeniorBand, Stage, Stats, Temperament, Trait, Variant } from './types';

export function hash32(value: number): number {
  let x = value >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  return (x ^ (x >>> 16)) >>> 0;
}

function mix(seed: number, breedId: string, variant: number, salt: number): number {
  let h = hash32((seed ^ Math.imul(variant + 1, 0x9e3779b9) ^ salt) >>> 0);
  for (let i = 0; i < breedId.length; i += 1) {
    h = hash32(h ^ breedId.charCodeAt(i));
  }
  return h;
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

export function temperamentOf(variant: Variant): Temperament {
  const row = temperamentByVariant[variant];
  return { boosts: row.boosts, dampens: row.dampens, label: row.label };
}

export function potentialOf(seed: number, breedId: string, variant: Variant): Stats {
  const scores = traits.map(() => basePotential);
  const roll = mix(seed, breedId, variant, 1);
  const from = roll % traits.length;
  let to = (from + 1 + (Math.floor(roll / traits.length) % (traits.length - 1))) % traits.length;
  if (to === from) {
    to = (from + 1) % traits.length;
  }
  const shift = 1 + (roll % rollRange);
  scores[from] -= shift;
  scores[to] += shift;

  const temperament = temperamentByVariant[variant];
  const boost = traits.indexOf(temperament.boosts);
  const damp = traits.indexOf(temperament.dampens);
  const amount = Math.max(1, Math.round(scores[damp] * 0.1));
  const movable = Math.min(amount, scores[damp] - 1, 20 - scores[boost]);
  scores[damp] -= movable;
  scores[boost] += movable;

  const potential = zeroStats();
  traits.forEach((trait, index) => {
    potential[trait] = scores[index];
  });
  return potential;
}

export function potentialTotal(potential: Stats): number {
  return traits.reduce((sum, trait) => sum + potential[trait], 0);
}

export function rngSeed(seed: number, variant: Variant): number {
  return hash32((seed ^ Math.imul(variant + 1, 0x85ebca6b)) >>> 0);
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

export function currentScores(potential: Stats, maturity: number): Stats {
  const current = zeroStats();
  for (const trait of traits) {
    current[trait] = naturalGrowth(potential[trait], maturity);
  }
  return current;
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

export function attributeScore(state: PetState, trait: Trait): number {
  const stage = stageOf(state.ageDays);
  const natural = naturalGrowth(state.potential[trait], state.maturity);
  const combined = natural + state.trained[trait] + state.drift[trait];
  const weighted =
    trait === 'stamina' || trait === 'agility' ? combined * weightModifier(state.weight) : combined;
  const aged = weighted * agingModifier(stage, state.vitality, trait);
  return Math.min(state.potential[trait], Math.max(1, aged));
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
  };
}

export function clampDrift(value: number): number {
  return Math.max(-driftLimit, Math.min(driftLimit, value));
}

export { breedPotentialTotal };
