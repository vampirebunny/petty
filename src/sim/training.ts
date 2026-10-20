import { attributeScore, trainingGain } from './attributes';
import { careConfig, type TreatTier } from './careConfig';
import { nextRng } from './rng';
import { ageFactorOf, houseTrained, speciesOf, trackDef } from './tracks';
import type { PetState, TrainingTrack, Trait } from './types';

export function petDayIndex(state: PetState, now: number): number {
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.floor(Math.max(0, now - state.bornAt) / dayMs);
}

export function intelligenceFactor(state: PetState): number {
  const score = attributeScore(state, 'intelligence');
  return careConfig.intelligenceBase + careConfig.intelligenceSpan * Math.max(0, Math.min(1, score / 100));
}

export function successChance(obedience: number, progress: number, mastered: boolean): number {
  if (mastered) {
    return 1;
  }
  const raw =
    careConfig.pSuccessBase +
    careConfig.pSuccessObedience * obedience +
    careConfig.pSuccessProgress * progress;
  return Math.max(careConfig.pSuccessMin, Math.min(careConfig.pSuccessMax, raw));
}

function withTrack(state: PetState, track: TrainingTrack): PetState {
  return { ...state, training: { ...state.training, [track.id]: track } };
}

function rollDay(track: TrainingTrack, day: number): TrainingTrack {
  if (track.repsPetDay === day) {
    return track;
  }
  return { ...track, repsToday: 0, repsPetDay: day };
}

function addAttribute(state: PetState, trait: Trait, raw: number): PetState {
  if (raw <= 0) {
    return state;
  }
  const current = state.attributes.current[trait];
  const potential = state.attributes.potential[trait];
  const gain = trainingGain(current, potential, raw);
  return {
    ...state,
    attributes: {
      ...state.attributes,
      current: { ...state.attributes.current, [trait]: current + gain },
    },
  };
}

function grantMastery(state: PetState, trackId: string): PetState {
  const def = trackDef(trackId);
  if (!def) {
    return state;
  }
  const share = careConfig.rawAttrOnMastery / def.linked.length;
  let next = state;
  for (const trait of def.linked) {
    next = addAttribute(next, trait, share);
  }
  const milestones = next.milestones.includes(trackId) ? next.milestones : [...next.milestones, trackId];
  if (trackId === 'house_training' && !milestones.includes('house_trained')) {
    milestones.push('house_trained');
  }
  return {
    ...next,
    xp: next.xp + careConfig.masteryXp,
    milestones,
    care: {
      ...next.care,
      unclaimed: {
        basic: next.care.unclaimed.basic + careConfig.milestoneBasic,
        special: next.care.unclaimed.special + careConfig.milestoneSpecial,
      },
    },
  };
}

// A resolved successful rep. Credit is 1, 0.5, or 0.25. Fatigued reps still move the bar a little.
export function payRep(state: PetState, trackId: string, credit: number, now: number): PetState {
  const def = trackDef(trackId);
  const existing = state.training[trackId];
  if (!def || !existing || existing.mastered) {
    return state;
  }
  const day = petDayIndex(state, now);
  let track = rollDay(existing, day);
  const fatigued = track.repsToday >= careConfig.dailyRepCap;
  const penalty = track.pendingPenalty && def.id === 'house_training' ? careConfig.accidentPenalty : 1;
  const base = def.tier == null ? careConfig.houseGain : careConfig.tierGain[def.tier];
  const age = def.tier == null ? ageFactorOf(state) : 1;
  const fatigue = fatigued ? careConfig.fatigueMultiplier : 1;
  const gain = base * intelligenceFactor(state) * age * credit * fatigue * penalty;
  const progress = Math.min(100, track.progress + gain);
  const mastered = progress >= 100;
  track = {
    ...track,
    progress,
    mastered,
    repsToday: track.repsToday + 1,
    pendingPenalty: false,
    lastPracticedAt: now,
  };
  let next = withTrack(state, track);
  if (!fatigued) {
    const share = (careConfig.rawAttrPerRep * credit) / def.linked.length;
    for (const trait of def.linked) {
      next = addAttribute(next, trait, share);
    }
    next = { ...next, xp: next.xp + careConfig.trainingRepXp };
  }
  if (mastered) {
    next = grantMastery(next, trackId);
    if (trackId === 'house_training') {
      next = {
        ...next,
        care: {
          ...next.care,
          potty: { ...next.care.potty, nextUrgeAt: null, signal: null, outing: null },
        },
      };
    }
  }
  return next;
}

export function rewardCredit(elapsedMs: number, tier: TreatTier | null): number {
  if (tier == null) {
    return careConfig.creditNone;
  }
  if (elapsedMs <= careConfig.rewardFullMs) {
    return careConfig.creditFull * careConfig.tierFactor[tier];
  }
  if (elapsedMs <= careConfig.rewardLateMs) {
    return careConfig.creditLate;
  }
  return careConfig.creditNone;
}

export function openReward(state: PetState, trackId: string, now: number): PetState {
  return {
    ...state,
    care: { ...state.care, pendingReward: { trackId, openedAt: now } },
  };
}

export function resolveReward(state: PetState, now: number, tier: TreatTier | null): PetState {
  const pending = state.care.pendingReward;
  if (!pending) {
    return state;
  }
  const credit = rewardCredit(now - pending.openedAt, tier);
  const paid = payRep(state, pending.trackId, credit, now);
  return {
    ...paid,
    care: { ...paid.care, pendingReward: null },
  };
}

export function rollTrick(state: PetState, trackId: string, now: number): { state: PetState; ok: boolean } {
  const def = trackDef(trackId);
  const track = state.training[trackId];
  const species = speciesOf(state.breedId);
  if (!def || !track || !def.species.includes(species) || !track.unlocked) {
    return { state, ok: false };
  }
  let next = state.care.pendingReward ? resolveReward(state, now, null) : state;
  const current = rollDay(next.training[trackId] ?? track, petDayIndex(next, now));
  next = withTrack(next, current);
  if (current.mastered) {
    return { state: next, ok: true };
  }
  const chance = successChance(attributeScore(next, 'obedience'), current.progress, false);
  const roll = nextRng(next.rngState);
  next = { ...next, rngState: roll.state };
  if (roll.value > chance) {
    return { state: next, ok: false };
  }
  return { state: openReward(next, trackId, now), ok: true };
}

export function markHousePenalty(state: PetState): PetState {
  const track = state.training.house_training;
  if (!track || track.mastered) {
    return state;
  }
  return withTrack(state, { ...track, pendingPenalty: true });
}

export function trainedEnough(state: PetState): boolean {
  return houseTrained(state);
}
