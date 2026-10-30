import { breedById } from '../actor/breeds';
import { gameplayConfig } from '../sim/gameplayConfig';
import { stageOf } from '../sim/attributes';
import type { OutfitSlot, PetState } from '../sim/types';
import { roadSpotForScene } from '../sim/road';
import { bucketLevel, setProp, track } from './analytics';
import { activityIdOf, type Place } from './events';
import { readMetaFlag, trickAttempts, trickStartedAt, writeMetaFlag } from './clock';

const rooms = new Set(['livingroom', 'bedroom', 'catio']);

function placeOf(sceneId: string): Place | null {
  if (rooms.has(sceneId)) {
    return sceneId as Place;
  }
  if (sceneId === 'park' || sceneId === 'school') {
    return roadSpotForScene(sceneId);
  }
  return null;
}

function badgeTier(id: string): number | undefined {
  if (id.endsWith('gold')) {
    return 3;
  }
  if (id.endsWith('silver')) {
    return 2;
  }
  if (id.endsWith('bronze')) {
    return 1;
  }
  return undefined;
}

/** Diff two publishes of the same pet. First load (no previous pet) logs nothing. */
export function observePet(prev: PetState | null, next: PetState): void {
  if (!prev || prev.id !== next.id) {
    return;
  }
  const breed = breedById(next.breedId);
  if (next.level > prev.level && breed) {
    track('level_up', { level: next.level, character: breed.species });
    setProp('pet_level_bucket', bucketLevel(next.level));
  }
  if (breed && stageOf(next.ageDays) !== stageOf(prev.ageDays)) {
    setProp('life_stage', stageOf(next.ageDays));
  }
  for (const [trickId, trackState] of Object.entries(next.training ?? {})) {
    const before = prev.training?.[trickId];
    if (trackState.mastered && !before?.mastered) {
      const started = trickStartedAt(next.id, trickId) ?? next.bornAt;
      const days = Math.max(0, Math.floor((Date.now() - started) / 86_400_000));
      track('trick_learned', {
        trick_id: trickId,
        attempts_total: trickAttempts(next.id, trickId),
        days_to_learn: days,
      });
    }
  }
  if (next.roadSpot && next.roadSpot !== prev.roadSpot) {
    track('location_visit', { place: next.roadSpot });
  } else if (!next.roadSpot && next.sceneId !== prev.sceneId) {
    const place = placeOf(next.sceneId);
    if (place) {
      track('location_visit', { place });
    }
  }
  const seen = new Set(prev.tutorialSeen ?? []);
  const freshSeen = (next.tutorialSeen ?? []).filter((id) => !seen.has(id));
  if (freshSeen.length > 0 && !readMetaFlag(`analytics.tutorialBegin.${next.id}`)) {
    writeMetaFlag(`analytics.tutorialBegin.${next.id}`);
    track('tutorial_begin');
  }
  for (const id of freshSeen) {
    const activity = activityIdOf(id);
    if (activity) {
      track('suggested_activity_complete', { activity_id: activity, list: 'tutorial', pet_level: next.level });
    }
  }
  const goals = gameplayConfig.goals.map((goal) => goal.action);
  const done = (seen: string[]) => goals.every((action) => seen.includes(action));
  if (done(next.tutorialSeen ?? []) && !done(prev.tutorialSeen ?? []) && !readMetaFlag(`analytics.tutorialDone.${next.id}`)) {
    writeMetaFlag(`analytics.tutorialDone.${next.id}`);
    track('tutorial_complete');
  }
  const nextSlots = new Set((next.suggestions ?? []).map((slot) => slot.id));
  for (const slot of prev.suggestions ?? []) {
    if (nextSlots.has(slot.id) || slot.id.startsWith('tutorial:')) {
      continue;
    }
    const activity = activityIdOf(slot.id);
    if (activity) {
      track('suggested_activity_complete', { activity_id: activity, list: 'daily', pet_level: next.level });
    }
  }
  const prevBadges = new Set(prev.badges ?? []);
  for (const id of next.badges ?? []) {
    if (prevBadges.has(id)) {
      continue;
    }
    const tier = badgeTier(id);
    track('unlock_achievement', tier == null ? { achievement_id: id } : { achievement_id: id, tier });
  }
  const slots = new Set<OutfitSlot>([
    ...(Object.keys(prev.equipped ?? {}) as OutfitSlot[]),
    ...(Object.keys(next.equipped ?? {}) as OutfitSlot[]),
  ]);
  for (const slot of slots) {
    const before = prev.equipped?.[slot];
    const after = next.equipped?.[slot];
    if (before === after) {
      continue;
    }
    if (before) {
      track('closet_equip', { slot, item_id: before, action: 'off' });
    }
    if (after) {
      track('closet_equip', { slot, item_id: after, action: 'on' });
    }
  }
}
