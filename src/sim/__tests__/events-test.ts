import { applyEvent } from '../events';
import { createPet } from '../createPet';
import type { PetState } from '../types';

function asleep(state: PetState): PetState {
  return { ...state, asleep: true };
}

it('feeds an awake pet and ignores feeding while asleep', () => {
  const before = createPet(1, 'retriever', 0, 0, 'Pup', 'pet');
  before.needs.fullness = 40;
  const fed = applyEvent(before, { type: 'feed' });

  expect(fed.cue).toEqual({ kind: 'eat' });
  expect(fed.state.needs.fullness).toBe(65);
  expect(fed.state.needs.energy).toBe(before.needs.energy);
  expect(fed.state.rngState).toBe(before.rngState);
  expect(before.needs.fullness).toBe(40);

  const resting = applyEvent(asleep(before), { type: 'feed' });
  expect(resting.cue).toEqual({ kind: 'stir' });
  expect(resting.state.needs).toEqual(before.needs);
  expect(resting.state.asleep).toBe(true);
});

it('clamps feeding at 100', () => {
  const full = createPet(1, 'retriever', 0, 0, 'Pup', 'pet');
  full.needs.fullness = 90;
  expect(applyEvent(full, { type: 'feed' }).state.needs.fullness).toBe(100);
});

it('toggles rest with a yawn when falling asleep', () => {
  const before = createPet(1, 'retriever', 0, 0, 'Pup', 'pet');
  const sleeping = applyEvent(before, { type: 'toggleRest' });
  const awake = applyEvent(sleeping.state, { type: 'toggleRest' });

  expect(sleeping.cue).toEqual({ kind: 'yawn' });
  expect(sleeping.state.asleep).toBe(true);
  expect(sleeping.state.needs).toEqual(before.needs);
  expect(awake.cue).toEqual({ kind: 'none' });
  expect(awake.state.asleep).toBe(false);
});

it('pets an awake pet and only stirs a sleeping pet', () => {
  const before = createPet(4, 'retriever', 0, 0, 'Pup', 'pet');
  const petted = applyEvent(before, { type: 'pet' });
  const gain = 6 * (1 - 80 / 100);

  expect(petted.cue.kind === 'wiggle' || petted.cue.kind === 'purr').toBe(true);
  expect(petted.state.needs.happiness).toBeCloseTo(80 + gain, 5);
  expect(petted.state.rngState).not.toBe(before.rngState);

  const resting = applyEvent(asleep(before), { type: 'pet' });
  expect(resting.cue).toEqual({ kind: 'stir' });
  expect(resting.state.needs).toEqual(before.needs);
  expect(resting.state.rngState).toBe(before.rngState);
});

it('returns the same result for the same state and event', () => {
  const before = createPet(4, 'retriever', 0, 0, 'Pup', 'pet');
  expect(applyEvent(before, { type: 'pet' })).toEqual(applyEvent(before, { type: 'pet' }));
  expect(applyEvent(before, { type: 'feed' })).toEqual(applyEvent(before, { type: 'feed' }));
  expect(applyEvent(before, { type: 'toggleRest' })).toEqual(
    applyEvent(before, { type: 'toggleRest' }),
  );
});
