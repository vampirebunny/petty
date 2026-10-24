import { testPet } from '../__fixtures__/pets';
import { openReturnFollowUp, returnEnergyAfterMs } from '../returnEnergy';

function pet(energy: number) {
  const born = testPet(1, 'retriever', 0, 'Pip', 'pet');
  return { ...born, needs: { ...born.needs, energy } };
}

it('waits three hours before a return can fill energy', () => {
  expect(returnEnergyAfterMs).toBe(3 * 60 * 60 * 1000);
});

it('hands a visible return refill to the energy pop', () => {
  const follow = openReturnFollowUp(pet(40), null, true);
  expect(follow.pet.needs.energy).toBe(100);
  expect(follow.cue).toEqual({ kind: 'none', energyGain: 60 });
});

it('fills a fraction of a point without a pop', () => {
  const follow = openReturnFollowUp(pet(99.8), null, true);
  expect(follow.pet.needs.energy).toBe(100);
  expect(follow.cue).toBeUndefined();
});

it('leaves full energy alone', () => {
  const current = pet(100);
  expect(openReturnFollowUp(current, null, true)).toEqual({ pet: current });
});

it('keeps the greeting and sends the energy pop with it', () => {
  const follow = openReturnFollowUp(pet(25), { elapsedH: 4 }, true);
  expect(follow.cue).toEqual({ kind: 'greet', elapsedH: 4, energyGain: 75 });
});

it('does not refill when the open was sooner than three hours', () => {
  const current = pet(25);
  const follow = openReturnFollowUp(current, { elapsedH: 1 }, false);
  expect(follow.pet).toBe(current);
  expect(follow.cue).toEqual({ kind: 'greet', elapsedH: 1 });
});
