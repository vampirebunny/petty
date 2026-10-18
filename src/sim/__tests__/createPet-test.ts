import { startingNeeds, startingWeight } from '../config';
import { createLitter, createPet } from '../createPet';
import { potentialOf, potentialTotal } from '../attributes';

const seed = 7;
const now = 1_700_000_000_000;

function make(variant: 0 | 1 | 2 = 0, breedId = 'retriever', id = 'pet') {
  return createPet(seed, breedId, variant, now, 'Maple', id);
}

it('starts at age 0, a balanced weight, and vitality near the care target', () => {
  const pet = make();

  expect(pet.ageDays).toBe(0);
  expect(pet.maturity).toBe(0);
  expect(pet.weight).toBe(startingWeight);
  expect(pet.vitality).toBeCloseTo(0.75, 5);
  expect(pet.name).toBe('Maple');
  expect(pet.needs).toEqual(startingNeeds);
  expect(pet.asleep).toBe(false);
  expect(pet.lastUpdatedAt).toBe(now);
  expect(pet.bornAt).toBe(now);
  expect(pet.weightAppliedAt).toBe(now);
  expect(pet.sceneId).toBe('livingroom');
  expect(pet.equipped).toEqual({});
  expect(pet.bond).toBe(0);
  expect(pet.xp).toBe(0);
  expect(pet.level).toBe(1);
});

it('copies starting needs so a pet cannot change the defaults', () => {
  const first = make();
  const second = make();

  expect(first.needs).toEqual(second.needs);
  expect(first.needs).not.toBe(second.needs);

  first.needs.fullness = 0;

  expect(startingNeeds.fullness).toBe(80);
  expect(make().needs.fullness).toBe(80);
});

it('returns the same litter and pet for the same seed, breed, and variant', () => {
  expect(createLitter(seed, 'retriever')).toEqual(createLitter(seed, 'retriever'));
  expect(make()).toEqual(make());
  expect(make(1).potential).toEqual(potentialOf(seed, 'retriever', 1));
});

it('gives the three variations different labels and the same potential total', () => {
  const litter = createLitter(seed, 'corgi');

  expect(litter.map((mate) => mate.temperament.label)).toEqual([
    'steady pacer',
    'bright pupil',
    'soft heart',
  ]);
  expect(new Set(litter.map((mate) => mate.temperament.boosts)).size).toBe(3);
  for (const mate of litter) {
    expect(potentialTotal(mate.potential)).toBe(72);
    expect(potentialTotal(mate.current)).toBeGreaterThan(0);
  }
});

it('can differ across seeds and ignores rngState', () => {
  const first = potentialOf(1, 'retriever', 0);
  const second = potentialOf(2, 'retriever', 0);
  expect(first).not.toEqual(second);

  const pet = make();
  pet.rngState = 999;
  expect(potentialOf(pet.seed, pet.breedId, pet.variant)).toEqual(pet.potential);
});
