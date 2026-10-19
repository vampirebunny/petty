import { breedById, catBreeds, dogBreeds } from '../../actor/breeds';
import { GEN, archetypeStrong, traits } from '../config';
import { clampCurrent, generateOffers, startingCurrent } from '../offers';
import type { Stats } from '../types';

const allBreeds = [...dogBreeds(), ...catBreeds()];
const seeds = Array.from({ length: 300 }, (_, i) => (i + 1) * 7919);

function sum(stats: Stats): number {
  return traits.reduce((total, trait) => total + stats[trait], 0);
}

it('returns identical output for the same seed, species, and breed', () => {
  const husky = breedById('husky')!;
  const first = generateOffers(12345, 'dog', 'husky', husky.attributeRanges);
  const second = generateOffers(12345, 'dog', 'husky', husky.attributeRanges);
  expect(second).toEqual(first);
  expect(first.map((offer) => offer.archetype)).toEqual(['athlete', 'thinker', 'charmer']);
});

it('matches the reference example for seed 12345 and a husky', () => {
  const husky = breedById('husky')!;
  const [athlete, thinker, charmer] = generateOffers(12345, 'dog', 'husky', husky.attributeRanges);
  expect(athlete.total).toBe(377);
  expect(athlete.potential.stamina).toBe(99);
  expect(athlete.potential.agility).toBe(88);
  expect(thinker.potential.intelligence).toBe(69);
  expect(thinker.potential.obedience).toBe(32);
  expect(charmer.potential.boldness).toBe(73);
  expect(charmer.potential.affection).toBe(62);
});

it('keeps every value inside its breed range and every set on one total within the spread', () => {
  for (const breed of allBreeds) {
    for (const seed of seeds) {
      const offers = generateOffers(seed, breed.species, breed.id, breed.attributeRanges);
      const total = offers[0].total;
      expect(Math.abs(total - GEN.BASE_TOTAL)).toBeLessThanOrEqual(GEN.QUALITY_SPREAD);
      for (const offer of offers) {
        expect(offer.total).toBe(total);
        expect(sum(offer.potential)).toBe(total);
        for (const trait of traits) {
          const [min, max] = breed.attributeRanges[trait];
          expect(offer.potential[trait]).toBeGreaterThanOrEqual(min);
          expect(offer.potential[trait]).toBeLessThanOrEqual(max);
        }
      }
    }
  }
});

it('puts each archetype highest within the breed range for its strong attributes', () => {
  for (const breed of allBreeds) {
    for (const seed of seeds) {
      const offers = generateOffers(seed, breed.species, breed.id, breed.attributeRanges);
      const position = (offer: (typeof offers)[number], trait: (typeof traits)[number]) => {
        const [min, max] = breed.attributeRanges[trait];
        return (offer.potential[trait] - min) / (max - min);
      };
      for (const offer of offers) {
        for (const trait of archetypeStrong[offer.archetype]) {
          for (const other of offers) {
            if (other !== offer) {
              expect(position(offer, trait)).toBeGreaterThanOrEqual(position(other, trait));
            }
          }
        }
      }
    }
  }
});

it('varies with the seed and with the species and breed', () => {
  const retriever = breedById('retriever')!;
  expect(generateOffers(1, 'dog', 'retriever', retriever.attributeRanges)).not.toEqual(
    generateOffers(2, 'dog', 'retriever', retriever.attributeRanges),
  );
  expect(generateOffers(1, 'dog', 'retriever', retriever.attributeRanges)).not.toEqual(
    generateOffers(1, 'dog', 'corgi', breedById('corgi')!.attributeRanges),
  );
});

it('starts current at the start fraction of potential, at least 1, and never above potential', () => {
  for (const breed of allBreeds) {
    const [offer] = generateOffers(99, breed.species, breed.id, breed.attributeRanges);
    for (const trait of traits) {
      const expected = Math.max(1, Math.round(offer.potential[trait] * GEN.START_FRACTION));
      expect(offer.current[trait]).toBe(expected);
      expect(offer.current[trait]).toBeLessThanOrEqual(offer.potential[trait]);
    }
  }
  const tiny = startingCurrent({ stamina: 2, agility: 1, intelligence: 3, boldness: 4, affection: 5, obedience: 6 });
  expect(tiny.agility).toBe(1);
  expect(tiny.stamina).toBeLessThanOrEqual(2);
});

it('clamps current to potential wherever it is written', () => {
  const potential = { stamina: 50, agility: 40, intelligence: 30, boldness: 20, affection: 10, obedience: 60 };
  const clamped = clampCurrent(
    { stamina: 500, agility: -5, intelligence: 30, boldness: 21, affection: 10, obedience: 61 },
    potential,
  );
  expect(clamped).toEqual({ stamina: 50, agility: 0, intelligence: 30, boldness: 20, affection: 10, obedience: 60 });
});

it('never calls Math.random while generating offers', () => {
  const spy = jest.spyOn(Math, 'random').mockImplementation(() => {
    throw new Error('Math.random must not be used in attribute generation');
  });
  try {
    const husky = breedById('husky')!;
    expect(() => generateOffers(5, 'dog', 'husky', husky.attributeRanges)).not.toThrow();
  } finally {
    spy.mockRestore();
  }
});

it('has breed ranges for all ten breeds', () => {
  expect(allBreeds.map((breed) => breed.id).sort()).toEqual(
    ['bombay', 'corgi', 'dachshund', 'domesticshorthair', 'husky', 'mainecoon', 'persian', 'pug', 'retriever', 'siamese'],
  );
});
