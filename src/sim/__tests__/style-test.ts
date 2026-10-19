import { breedById, catBreeds, dogBreeds } from '../../actor/breeds';
import { currentStyle, generateOffers, styleScores } from '../offers';
import type { Stats } from '../types';

const potential: Stats = { stamina: 80, agility: 80, intelligence: 80, boldness: 80, affection: 80, obedience: 80 };

function withCurrent(patch: Partial<Stats>, base = 16): Stats {
  return { stamina: base, agility: base, intelligence: base, boldness: base, affection: base, obedience: base, ...patch };
}

it('returns the origin for a fresh pet, for every origin', () => {
  const current = withCurrent({});
  expect(currentStyle('athlete', current, potential)).toBe('athlete');
  expect(currentStyle('thinker', current, potential)).toBe('thinker');
  expect(currentStyle('charmer', current, potential)).toBe('charmer');
});

it('returns the origin for freshly generated pets across breeds', () => {
  const breeds = [...dogBreeds(), ...catBreeds()];
  for (const breed of breeds) {
    for (let seed = 1; seed <= 50; seed += 1) {
      for (const offer of generateOffers(seed * 7919, breed.species, breed.id, breed.attributeRanges)) {
        expect(currentStyle(offer.archetype, offer.current, offer.potential)).toBe(offer.archetype);
      }
    }
  }
  expect(breedById('husky')).not.toBeNull();
});

it('keeps the origin when another archetype leads by less than the margin', () => {
  // charmer ratio 0.2 + 0.0375 = 0.2375 vs thinker 0.2: lead 0.0375
  const current = withCurrent({ boldness: 19, affection: 19 });
  expect(currentStyle('thinker', current, potential)).toBe('thinker');
});

it('switches when another archetype leads by the margin or more', () => {
  // charmer ratio 0.25 vs thinker 0.2: lead of exactly 0.05
  const exact = withCurrent({ boldness: 20, affection: 20 });
  expect(currentStyle('thinker', exact, potential)).toBe('charmer');
  const more = withCurrent({ boldness: 40, affection: 40 });
  expect(currentStyle('thinker', more, potential)).toBe('charmer');
});

it('resolves ties between non-origin archetypes in athlete, thinker, charmer order', () => {
  const current = withCurrent({ stamina: 40, agility: 40, intelligence: 40, obedience: 40 });
  expect(currentStyle('charmer', current, potential)).toBe('athlete');
  const tieBoth = withCurrent({ intelligence: 40, obedience: 40, boldness: 40, affection: 40 });
  expect(currentStyle('athlete', tieBoth, potential)).toBe('thinker');
});

it('picks the higher non-origin archetype when they differ', () => {
  const current = withCurrent({ stamina: 40, agility: 40, boldness: 60, affection: 60 });
  expect(currentStyle('thinker', current, potential)).toBe('charmer');
});

it('does not throw when potential is 0', () => {
  const zero: Stats = { stamina: 0, agility: 0, intelligence: 0, boldness: 0, affection: 0, obedience: 0 };
  expect(() => currentStyle('athlete', zero, zero)).not.toThrow();
  expect(currentStyle('athlete', zero, zero)).toBe('athlete');
  expect(styleScores(zero, zero)).toEqual({ athlete: 0, thinker: 0, charmer: 0 });
});

it('does not modify its inputs', () => {
  const current = withCurrent({ stamina: 40 });
  const copyCurrent = { ...current };
  const copyPotential = { ...potential };
  currentStyle('thinker', current, potential);
  expect(current).toEqual(copyCurrent);
  expect(potential).toEqual(copyPotential);
});
