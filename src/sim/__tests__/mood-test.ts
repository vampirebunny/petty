import { deriveMood } from '../mood';
import { testPet } from '../__fixtures__/pets';
import type { Needs, PetState } from '../types';

function pet(partial: Omit<Partial<PetState>, 'needs'> & { needs?: Partial<Needs> } = {}): PetState {
  const base = testPet(1, 'retriever', 0, 'Pup', 'pet');
  return {
    ...base,
    ...partial,
    needs: { ...base.needs, ...partial.needs },
  };
}

it('lets sleeping win over every other condition', () => {
  expect(
    deriveMood(
      pet({
        asleep: true,
        needs: { fullness: 0, energy: 0, happiness: 0 },
      }),
    ),
  ).toBe('sleeping');
});

it('lets hunger win over sleepy and happy', () => {
  expect(
    deriveMood(pet({ needs: { fullness: 24, energy: 0, happiness: 100 } })),
  ).toBe('hungry');
});

it('lets sleepy win over happy', () => {
  expect(
    deriveMood(pet({ needs: { fullness: 25, energy: 19, happiness: 100 } })),
  ).toBe('sleepy');
});

it('treats under-thresholds as exclusive and happiness 70 as happy', () => {
  expect(
    deriveMood(pet({ needs: { fullness: 25, energy: 20, happiness: 70 } })),
  ).toBe('happy');
  expect(
    deriveMood(pet({ needs: { fullness: 25, energy: 20, happiness: 30 } })),
  ).toBe('content');
  expect(
    deriveMood(pet({ needs: { fullness: 25, energy: 20, happiness: 29 } })),
  ).toBe('sad');
});
