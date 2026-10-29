import { attributeScore, trainingGain, zeroStats } from './attributes';
import { careConfig } from './careConfig';
import { gameplayConfig } from './gameplayConfig';
import { grantEverydayXp, grantTrickXp, noteTutorialAction } from './progress';
import { nextRng } from './rng';
import { refreshUnlocks, speciesOf, trackDef } from './tracks';
import type { PetState, TrainingTrack, Trait } from './types';

export type RewardChoice = 'treat' | 'none';

export function isResting(track: TrainingTrack, now: number): boolean {
  return track.restUntil != null && now < track.restUntil;
}

export function restRemainingMs(track: TrainingTrack, now: number): number {
  if (track.restUntil == null) {
    return 0;
  }
  return Math.max(0, track.restUntil - now);
}

export function formatRest(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  if (total >= 3600) {
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function sessionLength(state: PetState): number {
  const stamina = Math.max(0, Math.min(1, attributeScore(state, 'stamina') / 100));
  return Math.round(careConfig.sessionBase + careConfig.sessionStaminaSpan * stamina);
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

export function refreshTraining(state: PetState, now: number): PetState {
  let changed = false;
  const training = { ...state.training };
  for (const [id, track] of Object.entries(training)) {
    if (track.restUntil != null && now >= track.restUntil) {
      training[id] = { ...track, focusUsed: 0, hadNoTreat: false, restUntil: null };
      changed = true;
    }
  }
  return changed ? { ...state, training } : state;
}

function addAttribute(state: PetState, trait: Trait, raw: number): PetState {
  if (raw <= 0) {
    return state;
  }
  const gain = trainingGain(
    attributeScore(state, trait),
    state.attributes.potential[trait],
    raw,
    careConfig.trainingGainExponent,
  );
  if (gain <= 0) {
    return state;
  }
  const trained = { ...(state.attributes.trained ?? zeroStats()) };
  trained[trait] = (trained[trait] ?? 0) + gain;
  return { ...state, attributes: { ...state.attributes, trained } };
}

function grantMastery(state: PetState, trackId: string, skipXp: boolean): PetState {
  const def = trackDef(trackId);
  if (!def) {
    return state;
  }
  const share = careConfig.rawAttrOnMastery / def.linked.length;
  let next = state;
  for (const trait of def.linked) {
    next = addAttribute(next, trait, share);
  }
  next = addAttribute(next, 'intelligence', careConfig.masteryIntelligenceRaw);
  const milestones = next.milestones.includes(trackId) ? next.milestones : [...next.milestones, trackId];
  next = { ...next, milestones };
  if (trackId === 'sit') {
    next = noteTutorialAction(next, 'sit');
  }
  if (skipXp) {
    return next;
  }
  return grantTrickXp(next, def.category);
}

// Progress a treat would add right now, capped at the room left to 100.
export function treatProgressPreview(state: PetState, trackId: string): number {
  const def = trackDef(trackId);
  const track = state.training[trackId];
  if (!def?.tier || !track || track.mastered) {
    return 0;
  }
  const gain = careConfig.tierGain[def.tier] * intelligenceFactor(state) * careConfig.creditTreat;
  return Math.min(Math.max(0, 100 - track.progress), gain);
}

// A resolved successful rep. Choice is a treat or none. Resting tricks are blocked before this runs.
export function payRep(state: PetState, trackId: string, choice: RewardChoice, now: number): PetState {
  const def = trackDef(trackId);
  const existing = state.training[trackId];
  if (!def || !existing || existing.mastered || def.tier == null) {
    return state;
  }
  const awake = refreshTraining(state, now);
  const track = awake.training[trackId] ?? existing;
  if (isResting(track, now)) {
    return awake;
  }
  const skipXp = state.level < gameplayConfig.tutorialLevel;
  const credit = choice === 'treat' ? careConfig.creditTreat : careConfig.creditNoTreat;
  const gain = careConfig.tierGain[def.tier] * intelligenceFactor(awake) * credit;
  const progress = Math.min(100, track.progress + gain);
  const mastered = progress >= 100;
  const focusCost = choice === 'treat' ? careConfig.focusCostTreat : careConfig.focusCostNoTreat;
  const focusUsed = track.focusUsed + focusCost;
  const resting = focusUsed >= sessionLength(awake);
  const nextTrack: TrainingTrack = {
    ...track,
    progress,
    mastered,
    focusUsed,
    hadNoTreat: track.hadNoTreat || choice === 'none',
    restUntil: resting ? now + careConfig.trickRestMs : null,
    pendingPenalty: false,
    lastPracticedAt: now,
  };
  let next = withTrack(awake, nextTrack);
  const share = (careConfig.rawAttrPerRep * credit) / def.linked.length;
  for (const trait of def.linked) {
    next = addAttribute(next, trait, share);
  }
  if (!skipXp) {
    next = grantEverydayXp(next, now);
  }
  if (mastered) {
    next = grantMastery(next, trackId, skipXp);
    next = refreshUnlocks(next).state;
  }
  return next;
}

export function openReward(state: PetState, trackId: string, now: number): PetState {
  return {
    ...state,
    care: { ...state.care, pendingReward: { trackId, openedAt: now } },
  };
}

// The player already picked. Progress stays put until the bite finishes, or something else cuts it short.
export function chooseReward(state: PetState, choice: RewardChoice): PetState {
  const pending = state.care.pendingReward;
  if (!pending || pending.choice) {
    return state;
  }
  return {
    ...state,
    care: { ...state.care, pendingReward: { ...pending, choice } },
  };
}

export function resolveReward(state: PetState, now: number, choice: RewardChoice): PetState {
  const pending = state.care.pendingReward;
  if (!pending) {
    return state;
  }
  const paid = payRep(state, pending.trackId, pending.choice ?? choice, now);
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
  let next = state.care.pendingReward ? resolveReward(state, now, 'none') : state;
  next = refreshTraining(next, now);
  const current = next.training[trackId] ?? track;
  next = withTrack(next, current);
  if (isResting(current, now)) {
    return { state: next, ok: false };
  }
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
