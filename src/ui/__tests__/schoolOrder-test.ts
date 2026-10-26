import { tricksForSpecies } from '../../sim/tricks';
import { dayKey, shopOrder, stageAgeLabel, trainingOrder, trickOfTheDay, untilMidnightLabel } from '../school/order';

it('picks the same trick of the day until the local date changes', () => {
  const morning = new Date(2026, 9, 25, 8, 0, 0).getTime();
  const evening = new Date(2026, 9, 25, 23, 30, 0).getTime();
  const next = new Date(2026, 9, 26, 0, 5, 0).getTime();
  const eligible = tricksForSpecies('dog').slice(0, 4);
  const first = trickOfTheDay(eligible, 'player-a', morning);
  expect(trickOfTheDay(eligible, 'player-a', evening)?.id).toBe(first?.id);
  expect(dayKey(morning)).not.toBe(dayKey(next));
  expect(trickOfTheDay([], 'player-a', morning)).toBeNull();
});

it('names cat stages kitten and older kitten', () => {
  expect(stageAgeLabel('puppy', 'cat')).toBe('Kitten');
  expect(stageAgeLabel('olderPuppy', 'cat')).toBe('Older kitten');
  expect(stageAgeLabel('puppy', 'dog')).toBe('Puppy');
  expect(stageAgeLabel('olderPuppy', 'dog')).toBe('Older puppy');
});

it('counts down to local midnight', () => {
  const now = new Date(2026, 9, 25, 22, 30, 0).getTime();
  expect(untilMidnightLabel(now)).toBe('1h 30m');
});

it('sorts training rows new, then progress, then soonest rest', () => {
  const now = 1_000_000;
  const ids = trainingOrder(
    [
      { id: 'rest-late', progress: 10, unlocked: true, restUntil: now + 5000, source: 'starter', lastPracticedAt: 1 },
      { id: 'ready-low', progress: 20, unlocked: true, restUntil: null, source: 'starter', lastPracticedAt: 1 },
      { id: 'fresh', progress: 0, unlocked: true, restUntil: null, source: 'purchase', lastPracticedAt: null },
      { id: 'almost', progress: 95, unlocked: true, restUntil: null, source: 'starter', lastPracticedAt: 1 },
      { id: 'rest-soon', progress: 40, unlocked: true, restUntil: now + 1000, source: 'starter', lastPracticedAt: 1 },
      { id: 'locked', progress: 0, unlocked: false, restUntil: null, source: 'starter', lastPracticedAt: null },
    ],
    now,
  );
  expect(ids).toEqual(['fresh', 'almost', 'ready-low', 'rest-soon', 'rest-late', 'locked']);
});

it('sorts the shop new, then affordable, then the rest', () => {
  expect(
    shopOrder([
      { id: 'learned', price: 100, mastered: true, owned: true, fresh: false, affordable: true },
      { id: 'pricey', price: 400, mastered: false, owned: false, fresh: false, affordable: false },
      { id: 'cheap', price: 150, mastered: false, owned: false, fresh: false, affordable: true },
      { id: 'fresh', price: 500, mastered: false, owned: false, fresh: true, affordable: false },
      { id: 'training', price: 200, mastered: false, owned: true, fresh: false, affordable: true },
    ]),
  ).toEqual(['fresh', 'cheap', 'pricey', 'training', 'learned']);
});
