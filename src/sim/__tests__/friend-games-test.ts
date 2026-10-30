import { testPet } from '../__fixtures__/pets';
import { gameplayConfig } from '../gameplayConfig';
import { applyFriendRaceResult, noteFriendGameStarted } from '../raceRewards';
import { suggestionLabel, syncSuggestions } from '../suggestions';
import type { PetState } from '../types';

const now = Date.UTC(2026, 0, 1, 12, 0, 0);

function tutorialUpTo(pet: PetState, action: string): PetState {
  const seen = gameplayConfig.goals.map((goal) => goal.action).filter((id) => id !== action);
  return { ...pet, tutorialSeen: seen, suggestions: [] };
}

it('renames the open-race goal and adds Start a friends game', () => {
  expect(suggestionLabel('tutorial:race')).toBe('Compete in the Stadium');
  expect(suggestionLabel('race')).toBe('Compete in the Stadium');
  expect(suggestionLabel('tutorial:friendGame')).toBe('Start a friends game');
  expect(suggestionLabel('friendGame')).toBe('Start a friends game');
});

it('offers the friends-game tutorial only with at least one friend', () => {
  const pet = tutorialUpTo(testPet(4, 'retriever', now, 'Maple', 'pet'), 'friendGame');
  expect(syncSuggestions(pet, now, { friends: 0 }).suggestions).toEqual([]);
  const offered = syncSuggestions(pet, now, { friends: 2 });
  expect(offered.suggestions).toEqual([{ id: 'tutorial:friendGame' }]);
  expect(syncSuggestions(offered, now).suggestions).toEqual([{ id: 'tutorial:friendGame' }]);
  expect(syncSuggestions(offered, now, { friends: 0 }).suggestions).toEqual([]);
});

it('keeps the friends-game suggestion only while the player has friends', () => {
  const base = syncSuggestions({ ...testPet(4, 'retriever', now, 'Maple', 'pet'), level: 20 }, now, { friends: 1 });
  const pet: PetState = { ...base, suggestions: [{ id: 'friendGame' }] };
  const ids = (ctx: { friends?: number }) => syncSuggestions(pet, now, ctx).suggestions.map((slot) => slot.id);
  expect(ids({ friends: 1 })).toContain('friendGame');
  expect(ids({})).toContain('friendGame');
  expect(ids({ friends: 0 })).not.toContain('friendGame');
});

it('counts sending invites even without the pill', () => {
  const pet = testPet(4, 'retriever', now, 'Maple', 'pet');
  const next = noteFriendGameStarted(pet, now);
  expect(next.tutorialSeen).toContain('friendGame');
  expect(next.level).toBe(pet.level + 1);
});

it('charges race energy once and gives nothing else for a friend game', () => {
  const pet = { ...testPet(4, 'retriever', now, 'Maple', 'pet'), level: 15 };
  const done = applyFriendRaceResult(pet, 'friend-race');
  expect(done.needs.energy).toBe(Math.max(0, pet.needs.energy - gameplayConfig.races.energyCost));
  expect(done.appliedRaceIds).toEqual(['friend-race']);
  expect(done.level).toBe(pet.level);
  expect(done.ribbons ?? []).toEqual(pet.ribbons ?? []);
  expect(done.tutorialSeen ?? []).not.toContain('race');
  expect(done.xpTotal).toBe(pet.xpTotal);
  expect(applyFriendRaceResult(done, 'friend-race')).toBe(done);
});
