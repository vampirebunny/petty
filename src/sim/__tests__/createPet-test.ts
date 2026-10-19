import { breedById, defaultLook } from '../../actor/breeds';
import { testPet } from '../__fixtures__/pets';
import { potentialTotal } from '../attributes';
import { startingNeeds, startingWeight } from '../config';
import { createPet } from '../createPet';
import { attributesFor, generateOffers, startingCurrent } from '../offers';

const seed = 7;
const now = 1_700_000_000_000;

function make(archetype: 'athlete' | 'thinker' | 'charmer' = 'athlete', breedId = 'retriever', id = 'pet') {
  return testPet(seed, breedId, now, 'Maple', id, archetype);
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

  first.needs.hunger = 100;

  expect(startingNeeds.hunger).toBe(20);
  expect(make().needs.hunger).toBe(20);
});

it('returns the same pet for the same seed, breed, and archetype', () => {
  expect(make()).toEqual(make());
  expect(make('thinker').attributes.potential).not.toEqual(make('charmer').attributes.potential);
});

it('stores the seed, rules version, archetype, potential, and a starting current score', () => {
  const pet = make('charmer', 'corgi');
  const breed = breedById('corgi');
  expect(breed).not.toBeNull();
  const offer = generateOffers(seed, 'dog', 'corgi', breed!.attributeRanges).find((o) => o.archetype === 'charmer');

  expect(pet.attributes.seed).toBe(seed);
  expect(pet.attributes.rulesVersion).toBeGreaterThan(0);
  expect(pet.attributes.archetype).toBe('charmer');
  expect(pet.attributes.potential).toEqual(offer?.potential);
  expect(pet.attributes.current).toEqual(startingCurrent(pet.attributes.potential));
  expect(potentialTotal(pet.attributes.potential)).toBe(offer?.total);
});

it('keeps stored potential when breed ranges change later and ignores rngState', () => {
  const pet = make();
  pet.rngState = 999;
  const breed = breedById('retriever')!;
  const narrowed = attributesFor(seed, 'dog', 'retriever', {
    ...breed.attributeRanges,
    stamina: [10, 20],
  }, 'athlete');
  expect(narrowed.potential).not.toEqual(pet.attributes.potential);

  // A reset rebuilds from the stored attributes, not from the (changed) ranges.
  const rebuilt = createPet({
    id: pet.id,
    name: pet.name,
    breedId: pet.breedId,
    look: pet.look,
    attributes: pet.attributes,
    now: now + 1,
  });
  expect(rebuilt.attributes.potential).toEqual(pet.attributes.potential);
});

it('starts with the breed look and keeps a picked look', () => {
  const breed = breedById('husky')!;
  expect(make('athlete', 'husky').look).toEqual(defaultLook(breed));

  const look = { coat: '#2b2b33' };
  const custom = createPet({
    id: 'p',
    name: 'Maple',
    breedId: 'husky',
    look,
    attributes: attributesFor(seed, 'dog', 'husky', breed.attributeRanges, 'thinker'),
    now,
  });
  expect(custom.look).toEqual(look);
});
