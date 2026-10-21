import { attributeScore, withDerived } from '../attributes';
import { drinkHydrationGain, playHappinessGain, waterDrainPerDrink } from '../config';
import { applyEvent } from '../events';
import { testPet } from '../__fixtures__/pets';
import type { PetState } from '../types';

function asleep(state: PetState): PetState {
  return { ...state, asleep: true };
}

function eat(state: PetState): PetState {
  return applyEvent(applyEvent(state, { type: 'feed' }).state, { type: 'ate', now: 1 }).state;
}

it('feed fills the empty bowl and sends the pet to eat, waking a sleeper', () => {
  const before = testPet(1, 'retriever', 0, 'Pup', 'pet');
  before.needs.hunger = 60;
  const fed = applyEvent(before, { type: 'feed' });

  expect(fed.cue).toEqual({ kind: 'eat' });
  expect(fed.state.foodInBowl).toBe(true);
  expect(fed.state.needs.hunger).toBe(60);
  expect(before.foodInBowl).toBe(false);

  const resting = applyEvent(asleep(before), { type: 'feed' });
  expect(resting.cue).toEqual({ kind: 'eat' });
  expect(resting.state.asleep).toBe(false);
});

it('does nothing when the bowl already has food', () => {
  const before = testPet(1, 'retriever', 0, 'Pup', 'pet');
  const full = applyEvent(before, { type: 'feed' }).state;
  const again = applyEvent(full, { type: 'feed' });
  expect(again.cue).toEqual({ kind: 'none' });
  expect(again.state).toBe(full);
});

it('finishing the bowl feeds the pet and empties it', () => {
  const before = testPet(1, 'retriever', 0, 'Pup', 'pet');
  before.needs.hunger = 60;
  const done = eat(before);
  expect(done.needs.hunger).toBe(20);
  expect(done.needs.energy).toBe(before.needs.energy + 2);
  expect(done.foodInBowl).toBe(false);
  expect(done.rngState).toBe(before.rngState);
  expect(applyEvent(done, { type: 'ate', now: 2 }).state).toBe(done);
});

it('lets a full pet eat when the bowl is filled, clamping hunger at 0', () => {
  const full = testPet(1, 'retriever', 0, 'Pup', 'pet');
  full.needs.hunger = 0;
  expect(applyEvent(full, { type: 'feed' }).cue).toEqual({ kind: 'eat' });
  expect(eat(full).needs.hunger).toBe(0);
  const almost = testPet(1, 'retriever', 0, 'Pup', 'pet');
  almost.needs.hunger = 10;
  expect(eat(almost).needs.hunger).toBe(0);

  const tired = testPet(1, 'retriever', 0, 'Pup', 'pet');
  tired.needs.energy = 99;
  expect(eat(tired).needs.energy).toBe(100);
  const rested = testPet(1, 'retriever', 0, 'Pup', 'pet');
  rested.needs.energy = 100;
  expect(eat(rested).needs.energy).toBe(100);
});

it('refills water without changing happiness', () => {
  const before = testPet(1, 'retriever', 0, 'Pup', 'pet');
  before.waterLevel = 0.2;
  before.waterEmptySince = 100;
  before.needs.happiness = 50;
  const result = applyEvent(before, { type: 'refillWater' });
  expect(result.cue).toEqual({ kind: 'none' });
  expect(result.state.waterLevel).toBe(1);
  expect(result.state.waterEmptySince).toBeNull();
  expect(result.state.needs.happiness).toBe(50);
});

it('drains the water bowl when the pet drinks from it', () => {
  const before = testPet(1, 'retriever', 0, 'Pup', 'pet');
  before.hydration = 20;
  const result = applyEvent(before, { type: 'drank', fromBowl: true, now: 500 });
  expect(result.state.waterLevel).toBeCloseTo(1 - waterDrainPerDrink, 5);
  expect(result.state.waterEmptySince).toBeNull();
  expect(result.state.hydration).toBe(20 + drinkHydrationGain);

  const pond = applyEvent({ ...before, hydration: 40 }, { type: 'drank', fromBowl: false, now: 500 });
  expect(pond.state.waterLevel).toBe(before.waterLevel);
  expect(pond.state.hydration).toBe(40 + drinkHydrationGain);

  const empty = applyEvent(
    { ...before, waterLevel: 0.05 },
    { type: 'drank', fromBowl: true, now: 900 },
  );
  expect(empty.state.waterLevel).toBe(0);
  expect(empty.state.waterEmptySince).toBe(900);

  let stepped = before;
  for (let drink = 0; drink < 3; drink += 1) {
    stepped = applyEvent(stepped, { type: 'drank', fromBowl: true, now: 1000 + drink }).state;
  }
  expect(stepped.waterLevel).toBe(0);
});

it('toggles rest with a yawn when falling asleep', () => {
  const before = testPet(1, 'retriever', 0, 'Pup', 'pet');
  const sleeping = applyEvent(before, { type: 'toggleRest' });
  const awake = applyEvent(sleeping.state, { type: 'toggleRest' });

  expect(sleeping.cue).toEqual({ kind: 'yawn' });
  expect(sleeping.state.asleep).toBe(true);
  expect(sleeping.state.needs).toEqual(before.needs);
  expect(awake.cue).toEqual({ kind: 'none' });
  expect(awake.state.asleep).toBe(false);
});

it('pets an awake pet and wakes a sleeper to pet', () => {
  const before = testPet(4, 'retriever', 0, 'Pup', 'pet');
  const petted = applyEvent(before, { type: 'pet' });
  const gain = 6 * (1 - 80 / 100);

  expect(petted.cue.kind === 'wiggle' || petted.cue.kind === 'purr').toBe(true);
  expect(petted.state.needs.happiness).toBeCloseTo(80 + gain, 5);
  expect(petted.state.rngState).not.toBe(before.rngState);

  const resting = applyEvent(asleep(before), { type: 'pet' });
  expect(resting.cue.kind === 'wiggle' || resting.cue.kind === 'purr').toBe(true);
  expect(resting.state.asleep).toBe(false);
  expect(resting.state.needs.happiness).toBeCloseTo(80 + gain, 5);
  expect(resting.state.rngState).not.toBe(before.rngState);
});

it('returns the same result for the same state and event', () => {
  const before = testPet(4, 'retriever', 0, 'Pup', 'pet');
  expect(applyEvent(before, { type: 'pet' })).toEqual(applyEvent(before, { type: 'pet' }));
  expect(applyEvent(before, { type: 'feed' })).toEqual(applyEvent(before, { type: 'feed' }));
  expect(applyEvent(before, { type: 'toggleRest' })).toEqual(
    applyEvent(before, { type: 'toggleRest' }),
  );
});

it('runs idle, sit, give paw and speak without touching needs', () => {
  const before = testPet(1, 'retriever', 0, 'Pup', 'pet');
  for (const type of ['sit', 'paw', 'speak'] as const) {
    const result = applyEvent(before, { type });
    expect(result.cue).toEqual({ kind: type });
    expect(result.state.needs).toEqual(before.needs);
    expect(result.state.rngState).toBe(before.rngState);
    const woken = applyEvent(asleep(before), { type });
    expect(woken.cue).toEqual({ kind: type });
    expect(woken.state.asleep).toBe(false);
  }
});

it('wakes a sleeping pet when asked to idle', () => {
  const before = asleep(testPet(1, 'retriever', 0, 'Pup', 'pet'));
  const result = applyEvent(before, { type: 'idle' });
  expect(result.cue).toEqual({ kind: 'idle' });
  expect(result.state.asleep).toBe(false);
});

it('wakes the pet when Cuddle starts and gives no cue', () => {
  const before = asleep(testPet(1, 'retriever', 0, 'Pup', 'pet'));
  const started = applyEvent(before, { type: 'cuddleStart' });
  expect(started.cue).toEqual({ kind: 'none' });
  expect(started.state.asleep).toBe(false);
});

it('playdate raises the attributes the activity trains', () => {
  const before = withDerived({ ...testPet(1, 'retriever', 0, 'Pup', 'pet'), ageDays: 80 });
  before.needs.happiness = 40;
  const stamina = attributeScore(before, 'stamina');
  const agility = attributeScore(before, 'agility');
  const affection = attributeScore(before, 'affection');
  const result = applyEvent(before, {
    type: 'playdate',
    happiness: 12,
    attributes: { stamina: 3, agility: 2 },
  });
  expect(attributeScore(result.state, 'stamina')).toBeGreaterThan(stamina);
  expect(attributeScore(result.state, 'agility')).toBeGreaterThan(agility);
  expect(attributeScore(result.state, 'affection')).toBeCloseTo(affection);
  expect(result.state.needs.happiness).toBe(before.needs.happiness + 12);
  expect(result.state.xp).toBe(before.xp);
});

it('rewards a finished cuddle, more for a longer one, with no cue', () => {
  const before = testPet(1, 'retriever', 0, 'Pup', 'pet');
  before.needs.happiness = 40;
  const quick = applyEvent(before, { type: 'cuddled', seconds: 1 });
  const long = applyEvent(before, { type: 'cuddled', seconds: 30 });
  expect(quick.cue).toEqual({ kind: 'none' });
  expect(quick.state.needs.happiness).toBeGreaterThan(40);
  expect(long.state.needs.happiness).toBeGreaterThan(quick.state.needs.happiness);
  expect(long.state.rngState).toBe(before.rngState);
});

it('raises happiness when the user throws a toy', () => {
  const before = testPet(1, 'retriever', 0, 'Pup', 'pet');
  before.needs.happiness = 50;
  const thrown = applyEvent(before, { type: 'fetch', drop: { x: 200, y: 240 } });
  expect(thrown.cue).toEqual({ kind: 'fetch', drop: { x: 200, y: 240 } });
  expect(thrown.state.needs.happiness).toBe(50 + playHappinessGain);
  expect(thrown.state.asleep).toBe(false);

  const full = applyEvent({ ...before, needs: { ...before.needs, happiness: 100 } }, { type: 'fetch' });
  expect(full.state.needs.happiness).toBe(100);
});

it('does not raise mood when tummy or energy is below 30', () => {
  const tired = testPet(1, 'retriever', 0, 'Pup', 'pet');
  tired.needs.happiness = 50;
  tired.needs.energy = 20;
  expect(applyEvent(tired, { type: 'fetch' }).state.needs.happiness).toBe(50);
  expect(applyEvent(tired, { type: 'pet' }).state.needs.happiness).toBe(50);

  const hungry = testPet(1, 'retriever', 0, 'Pup', 'pet');
  hungry.needs.happiness = 50;
  hungry.needs.hunger = 80;
  expect(applyEvent(hungry, { type: 'cuddled', seconds: 10 }).state.needs.happiness).toBe(50);
});
