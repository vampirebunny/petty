import { breedById, breedsFor } from '../breeds';
import { geomOf } from '../geometry';
import { visualLifespanDays } from '../../sim/config';
import { variantFor } from '../variation';

it('is deterministic from the seed and breed', () => {
  expect(variantFor(42, 'corgi')).toEqual(variantFor(42, 'corgi'));
  expect(variantFor(42, 'corgi')).not.toEqual(variantFor(43, 'corgi'));
});

it('stays inside its ranges and has no seed means no change', () => {
  for (let seed = 0; seed < 300; seed += 1) {
    const v = variantFor(seed, 'maineCoon');
    expect(v.earSize).toBeGreaterThanOrEqual(0.9);
    expect(v.earSize).toBeLessThanOrEqual(1.1);
    expect(v.tailFluff).toBeGreaterThanOrEqual(0.85);
    expect(v.tailFluff).toBeLessThanOrEqual(1.2);
    expect(v.markingIntensity).toBeGreaterThanOrEqual(0.8);
    expect(v.markingIntensity).toBeLessThanOrEqual(1);
  }
  expect(variantFor(undefined, 'corgi')).toEqual({ earSize: 1, tailFluff: 1, markingIntensity: 1, oneEarFlop: false });
});

it('gives the one-ear flop rarely, and only to erect-eared dogs', () => {
  const rate = (id: string) => {
    let count = 0;
    for (let seed = 0; seed < 2000; seed += 1) {
      count += variantFor(seed, id).oneEarFlop ? 1 : 0;
    }
    return count / 2000;
  };
  expect(rate('corgi')).toBeGreaterThan(0.02);
  expect(rate('corgi')).toBeLessThan(0.15);
  expect(rate('husky')).toBeGreaterThan(0.02);
  for (const id of ['retriever', 'dachshund', 'pug', 'domesticShorthair', 'siamese', 'scottishFold']) {
    expect(rate(id)).toBe(0);
  }
});

it('erect ears start folded at puppy age and rise monotonically to up at adult age', () => {
  for (const id of ['corgi', 'husky']) {
    const breed = breedById(id)!;
    expect(geomOf(breed, 0, 0).earRise).toBe(0);
    expect(geomOf(breed, visualLifespanDays, 0).earRise).toBe(1);
    let last = -1;
    for (let age = 0; age <= visualLifespanDays; age += visualLifespanDays / 40) {
      const rise = geomOf(breed, age, 0).earRise;
      expect(rise).toBeGreaterThanOrEqual(last);
      last = rise;
    }
  }
  for (const breed of [...breedsFor('dog'), ...breedsFor('cat')]) {
    if (!['corgi', 'husky'].includes(breed.id)) {
      expect(geomOf(breed, 0, 0).earRise).toBe(1);
    }
  }
});
