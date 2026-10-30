import { localDay } from '../economy/clock';
import { ITEM_KINDS } from '../items/kinds';
import { startingWaterLevel } from './config';
import { gameplayConfig } from './gameplayConfig';
import { grantSuggestionXp, onParkFindRecorded } from './progress';
import type { ParkFindRarity } from './parkFindsConfig';
import { speciesOf, trackDef, trackName } from './tracks';
import type { OutfitSlot, PetState, SuggestionSlot } from './types';

export type SuggestionContext = {
  toys?: string[];
  closet?: { slot: OutfitSlot; id: string }[];
  /** False when the collection already has every catalog item. */
  unfound?: boolean;
  /** Friends of a linked account. Zero for guests. Unknown leaves a friend-game slot alone. */
  friends?: number;
};

export type SuggestionFocus =
  | { kind: 'prop'; prop: 'food' | 'water' | 'bed' }
  | { kind: 'action'; id: 'feed' | 'refill' | 'play' | 'wardrobe' }
  | { kind: 'map' }
  | { kind: 'pet' }
  | { kind: 'track'; id: string };

const actionOf = (id: string): string => (id.startsWith('tutorial:') ? id.slice('tutorial:'.length) : id);

export function suggestionSlotCount(level: number): number {
  if (level < gameplayConfig.tutorialLevel) {
    return 1;
  }
  if (level < 20) {
    return 2;
  }
  return 3;
}

export function suggestionSignature(state: PetState): string {
  const slots = (state.suggestions ?? []).map((slot) => `${slot.id}:${slot.progress ?? 0}`).join('|');
  return `${state.suggestionDay ?? ''}|${state.suggestionCompletions ?? 0}|${slots}`;
}

export function suggestionLabel(id: string, species: 'dog' | 'cat' = 'dog'): string {
  const action = actionOf(id);
  const goal = gameplayConfig.goals.find((row) => row.action === action);
  if (id.startsWith('tutorial:') && goal) {
    return goal.label;
  }
  if (action === 'feed') return 'Feed';
  if (action === 'water') return 'Fill the water bowl';
  if (action === 'pat') return species === 'cat' ? 'Scratch' : 'Pat';
  if (action === 'nap') return 'Nap in the bed';
  if (action === 'play') return 'Play ball';
  if (action === 'park') return 'Visit the park';
  if (action === 'hat') return 'Wear a hat';
  if (action === 'closet') return 'Try something new from the Closet';
  if (action === 'find') return 'Find something new at the park';
  if (action === 'race') return 'Compete in the Stadium';
  if (action === 'friendGame') return 'Start a friends game';
  if (action.startsWith('toy:')) {
    const toyId = action.slice('toy:'.length);
    return `Play with the ${ITEM_KINDS[toyId]?.name ?? toyId}`;
  }
  if (action.startsWith('practice:')) {
    const trackId = action.slice('practice:'.length);
    return `Practice ${trackName(trackId, species)} 5 times`;
  }
  if (action.startsWith('progress:')) {
    const trackId = action.slice('progress:'.length);
    return `Make progress on ${trackName(trackId, species)}`;
  }
  return goal?.label ?? 'Try this';
}

export function suggestionFocus(id: string): SuggestionFocus {
  const action = actionOf(id);
  if (action === 'feed') return { kind: 'prop', prop: 'food' };
  if (action === 'water') return { kind: 'prop', prop: 'water' };
  if (action === 'nap') return { kind: 'prop', prop: 'bed' };
  if (action === 'pat' || action === 'cuddle') return { kind: 'pet' };
  if (action === 'play' || action.startsWith('toy:')) return { kind: 'action', id: 'play' };
  if (action === 'hat' || action === 'closet') return { kind: 'action', id: 'wardrobe' };
  if (action === 'sit') return { kind: 'track', id: 'sit' };
  if (action.startsWith('practice:')) return { kind: 'track', id: action.slice('practice:'.length) };
  if (action.startsWith('progress:')) return { kind: 'track', id: action.slice('progress:'.length) };
  return { kind: 'map' };
}

function slotMatches(slotId: string, key: string): boolean {
  return slotId === key || slotId === `tutorial:${key}`;
}

function stampDay(state: PetState, now: number): PetState {
  const today = localDay(now);
  if ((state.suggestionDay ?? '') === today) {
    return state;
  }
  return {
    ...state,
    suggestionDay: today,
    suggestionCompletions: 0,
    suggestions: [],
  };
}

function trainingSuggestion(state: PetState): string | null {
  if (state.level < gameplayConfig.suggestions.trainingFromLevel) {
    return null;
  }
  const species = speciesOf(state.breedId);
  const open = Object.values(state.training).filter((track) => {
    const def = trackDef(track.id);
    return track.unlocked && !track.mastered && def != null && def.species.includes(species);
  });
  const working = open.filter((track) => track.progress > 0).sort((a, b) => b.progress - a.progress)[0];
  if (working) {
    return `progress:${working.id}`;
  }
  const fresh = open[0];
  return fresh ? `practice:${fresh.id}` : null;
}

function candidates(state: PetState, ctx: SuggestionContext): string[] {
  const need = gameplayConfig.suggestions.needAt;
  const ids: string[] = [];
  if (state.needs.hunger >= need && !state.foodInBowl) ids.push('feed');
  if (state.waterLevel < startingWaterLevel) ids.push('water');
  ids.push('pat');
  if (!state.asleep && state.needs.energy < need) ids.push('nap');
  ids.push('play');
  if (!state.races?.signup) ids.push('race');
  if ((ctx.friends ?? 0) > 0) ids.push('friendGame');
  if (ctx.toys) {
    const toy = ctx.toys.find((id) => id && id !== 'ball');
    if (toy) ids.push(`toy:${toy}`);
  }
  if (ctx.closet) {
    const unequipped = ctx.closet.filter((item) => state.equipped[item.slot] !== item.id);
    if (unequipped.some((item) => item.slot === 'hat')) ids.push('hat');
    if (unequipped.some((item) => item.slot !== 'hat')) ids.push('closet');
  }
  if (state.sceneId !== 'park') ids.push('park');
  const training = trainingSuggestion(state);
  if (training) ids.push(training);
  if (state.level >= gameplayConfig.suggestions.findsFromLevel && ctx.unfound !== false) ids.push('find');
  return ids;
}

function keepSlot(slot: SuggestionSlot, state: PetState, ctx: SuggestionContext, allowed: Set<string>): boolean {
  if (allowed.has(slot.id)) {
    return true;
  }
  if (slot.id.startsWith('toy:') && ctx.toys == null) {
    const toyId = slot.id.slice('toy:'.length);
    return toyId !== 'ball';
  }
  if ((slot.id === 'hat' || slot.id === 'closet') && ctx.closet == null) {
    if (slot.id === 'hat' && state.equipped.hat) {
      return false;
    }
    return true;
  }
  if (slot.id === 'find' && ctx.unfound == null && state.level >= gameplayConfig.suggestions.findsFromLevel) {
    return true;
  }
  if (slot.id === 'friendGame' && ctx.friends == null) {
    return true;
  }
  return false;
}

function tutorialOffers(action: string, current: SuggestionSlot[], ctx: SuggestionContext): boolean {
  if (action !== 'friendGame') {
    return true;
  }
  if (ctx.friends == null) {
    return current.some((slot) => slot.id === 'tutorial:friendGame');
  }
  return ctx.friends > 0;
}

export function syncSuggestions(state: PetState, now: number, ctx: SuggestionContext = {}): PetState {
  const stamped = stampDay(state, now);
  if (stamped.level < gameplayConfig.tutorialLevel) {
    const current = stamped.suggestions ?? [];
    const next = gameplayConfig.goals.find(
      (goal) => !(stamped.tutorialSeen ?? []).includes(goal.action) && tutorialOffers(goal.action, current, ctx),
    );
    const id = next ? `tutorial:${next.action}` : '';
    if (!id) {
      return current.length === 0 ? stamped : { ...stamped, suggestions: [] };
    }
    if (current.length === 1 && current[0]?.id === id) {
      return stamped;
    }
    return { ...stamped, suggestions: [{ id }] };
  }
  const cap = gameplayConfig.suggestions.dailyCap;
  if ((stamped.suggestionCompletions ?? 0) >= cap) {
    return (stamped.suggestions ?? []).length === 0 ? stamped : { ...stamped, suggestions: [] };
  }
  const allowed = candidates(stamped, ctx);
  const allowedSet = new Set(allowed);
  const kept = (stamped.suggestions ?? []).filter((slot) => keepSlot(slot, stamped, ctx, allowedSet));
  const used = new Set(kept.map((slot) => slot.id));
  const room = suggestionSlotCount(stamped.level) - kept.length;
  const added: SuggestionSlot[] = [];
  for (const id of allowed) {
    if (added.length >= room) break;
    if (used.has(id)) continue;
    used.add(id);
    added.push(id.startsWith('practice:') ? { id, progress: 0 } : { id });
  }
  const suggestions = [...kept, ...added];
  const same =
    suggestions.length === (stamped.suggestions ?? []).length &&
    suggestions.every((slot, index) => {
      const prev = stamped.suggestions[index];
      return prev?.id === slot.id && (prev.progress ?? 0) === (slot.progress ?? 0);
    });
  return same ? stamped : { ...stamped, suggestions };
}

export function completeSuggestion(state: PetState, key: string, now: number, ctx: SuggestionContext = {}): PetState {
  const hit = (state.suggestions ?? []).find((slot) => slotMatches(slot.id, key));
  let next = stampDay(state, now);
  if (!hit) {
    return syncSuggestions(next, now, ctx);
  }
  const tutorial = hit.id.startsWith('tutorial:');
  next = {
    ...next,
    suggestions: (next.suggestions ?? []).filter((slot) => slot.id !== hit.id),
  };
  if (!tutorial && next.level >= gameplayConfig.tutorialLevel) {
    next = {
      ...next,
      suggestionCompletions: (next.suggestionCompletions ?? 0) + 1,
    };
    next = grantSuggestionXp(next);
  }
  return syncSuggestions(next, now, ctx);
}

// One training rep. Practice suggestions count to 5. A progress suggestion completes when the bar moves.
export function noteSuggestionRep(
  state: PetState,
  trackId: string,
  before: number,
  after: number,
  now: number,
): PetState {
  let next = stampDay(state, now);
  const practiceId = `practice:${trackId}`;
  const practice = (next.suggestions ?? []).find((slot) => slot.id === practiceId);
  if (practice) {
    const progress = (practice.progress ?? 0) + 1;
    next = {
      ...next,
      suggestions: next.suggestions.map((slot) => (slot.id === practiceId ? { ...slot, progress } : slot)),
    };
    if (progress >= gameplayConfig.suggestions.practiceReps) {
      next = completeSuggestion(next, practiceId, now);
    }
  }
  if (after > before && (next.suggestions ?? []).some((slot) => slot.id === `progress:${trackId}`)) {
    next = completeSuggestion(next, `progress:${trackId}`, now);
  }
  if (trackId === 'sit' && next.training.sit?.mastered) {
    next = completeSuggestion(next, 'sit', now);
  }
  return syncSuggestions(next, now);
}

export function recordParkFind(
  state: PetState,
  itemId: string,
  isNew: boolean,
  rarity: ParkFindRarity,
  now: number,
): PetState {
  let next = completeSuggestion(onParkFindRecorded(state, itemId, isNew, rarity, now), 'parkFind', now);
  if (isNew) {
    next = completeSuggestion(next, 'find', now);
  }
  return next;
}
