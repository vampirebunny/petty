import { localDay } from '../../economy/clock';
import { testPet } from '../__fixtures__/pets';
import { applyEvent } from '../events';
import { gameplayConfig } from '../gameplayConfig';
import { completeSuggestion, noteSuggestionRep, syncSuggestions } from '../suggestions';
import type { PetState } from '../types';

const now = new Date(2026, 5, 2, 12).getTime();
const nextDay = new Date(2026, 5, 3, 12).getTime();

function pup(): PetState {
  return testPet(4, 'retriever', now, 'Maple', 'pet');
}

function grown(): PetState {
  const pet = pup();
  return {
    ...pet,
    level: gameplayConfig.tutorialLevel,
    xpTotal: 0,
    xpIntoLevel: 0,
    needs: { ...pet.needs, hunger: 40, energy: 80 },
    suggestionDay: localDay(now),
  };
}

it('shows one tutorial action and pays no suggestion XP', () => {
  let pet = syncSuggestions(pup(), now);
  expect(pet.suggestions.map((slot) => slot.id)).toEqual(['tutorial:feed']);
  expect(pet.suggestionCompletions).toBe(0);

  pet = applyEvent(pet, { type: 'feed' }).state;
  expect(pet.level).toBe(2);
  expect(pet.xpTotal).toBe(gameplayConfig.tutorialXp);
  expect(pet.suggestionCompletions).toBe(0);
  expect(pet.suggestions.map((slot) => slot.id)).toEqual(['tutorial:water']);
});

it('pays suggestion XP on top of the everyday feed', () => {
  let pet = syncSuggestions(grown(), now);
  expect(pet.suggestions.some((slot) => slot.id === 'feed')).toBe(true);
  pet = applyEvent(pet, { type: 'feed' }).state;
  expect(pet.xpTotal).toBe(gameplayConfig.suggestions.xp + gameplayConfig.everyday.xp);
  expect(pet.suggestionCompletions).toBe(1);
  expect(pet.suggestions.some((slot) => slot.id === 'feed')).toBe(false);
});

it('drops Feed when the tummy is full', () => {
  const pet = grown();
  const full = syncSuggestions(
    {
      ...pet,
      needs: { ...pet.needs, hunger: 0 },
      suggestions: [{ id: 'feed' }, { id: 'pat' }],
    },
    now,
  );
  expect(full.suggestions.some((slot) => slot.id === 'feed')).toBe(false);
  expect(full.suggestions.some((slot) => slot.id === 'pat')).toBe(true);
});

it('hides the row at the daily cap and brings it back the next day', () => {
  const capped = syncSuggestions(
    {
      ...grown(),
      suggestionCompletions: gameplayConfig.suggestions.dailyCap,
      suggestionDay: localDay(now),
      suggestions: [{ id: 'pat' }, { id: 'play' }],
    },
    now,
  );
  expect(capped.suggestions).toEqual([]);

  const restored = syncSuggestions(capped, nextDay);
  expect(restored.suggestionCompletions).toBe(0);
  expect(restored.suggestions).toHaveLength(2);
});

it('clears a tutorial Pat or Cuddle when Cuddle is pressed and waits to give credit', () => {
  const today = Date.now();
  const seen = ['feed', 'water', 'school', 'play', 'nap', 'parkFind'];
  for (const id of ['tutorial:pat', 'tutorial:cuddle']) {
    const pet: PetState = {
      ...pup(),
      suggestionDay: localDay(today),
      tutorialSeen: seen,
      suggestions: [{ id }],
    };
    const started = applyEvent(pet, { type: 'cuddleStart' }).state;
    expect(started.level).toBe(pet.level);
    expect(started.tutorialSeen ?? []).not.toContain('pat');
    expect(started.tutorialSeen ?? []).not.toContain('cuddle');
    expect(started.suggestions.some((slot) => slot.id === 'pat' || slot.id === 'cuddle' || slot.id.endsWith(':pat') || slot.id.endsWith(':cuddle'))).toBe(false);
    expect(syncSuggestions(started, today).suggestions.some((slot) => slot.id.includes('pat') || slot.id.includes('cuddle'))).toBe(false);
  }
});

it('clears Pat when Cuddle is pressed and does not bring it back the same day', () => {
  const today = Date.now();
  const pet = syncSuggestions(
    { ...grown(), suggestionDay: localDay(today), suggestions: [{ id: 'pat' }, { id: 'play' }] },
    today,
  );
  const started = applyEvent(pet, { type: 'cuddleStart' }).state;
  expect(started.asleep).toBe(false);
  expect(started.suggestionsDone).toContain('pat');
  expect(started.suggestions.some((slot) => slot.id === 'pat' || slot.id === 'cuddle')).toBe(false);
  expect(syncSuggestions(started, today).suggestions.some((slot) => slot.id === 'pat')).toBe(false);
  expect(started.tutorialSeen ?? []).not.toContain('cuddle');
});

it('does not offer a finished suggestion again until the next day', () => {
  const pet = syncSuggestions({ ...grown(), suggestions: [{ id: 'pat' }, { id: 'play' }] }, now);
  const done = completeSuggestion(completeSuggestion(pet, 'play', now), 'pat', now);
  expect(done.suggestions.some((slot) => slot.id === 'play' || slot.id === 'pat')).toBe(false);
  expect(syncSuggestions(done, now).suggestions.some((slot) => slot.id === 'play' || slot.id === 'pat')).toBe(false);

  const tomorrow = syncSuggestions({ ...done, needs: { ...done.needs, hunger: 0 } }, nextDay);
  expect(tomorrow.suggestionsDone).toEqual([]);
  expect(tomorrow.suggestions.some((slot) => slot.id === 'pat')).toBe(true);
});

it('offers Feed again the same day once the tummy is hungry again', () => {
  const fed = completeSuggestion(syncSuggestions(grown(), now), 'feed', now);
  expect(fed.suggestionsDone).toContain('feed');
  const hungry = syncSuggestions({ ...fed, needs: { ...fed.needs, hunger: 80 }, suggestions: [] }, now);
  expect(hungry.suggestions.some((slot) => slot.id === 'feed')).toBe(true);
});

it('completes a practice suggestion on the fifth rep', () => {
  const pet = grown();
  const started = {
    ...pet,
    suggestions: [{ id: 'practice:sit', progress: 4 }],
    suggestionDay: localDay(now),
    suggestionCompletions: 0,
  };
  const done = noteSuggestionRep(started, 'sit', 0, 10, now);
  expect(done.xpTotal).toBe(gameplayConfig.suggestions.xp);
  expect(done.suggestionCompletions).toBe(1);
  expect(done.suggestions.some((slot) => slot.id === 'practice:sit')).toBe(false);
});
