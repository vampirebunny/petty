import { breedById, defaultLook, resolveBreed } from '../breeds';
import { frostColorOf, luminance } from '../color';
import { grayAmountsOf, grayLevelOf } from '../data/graying';
import { geomOf } from '../geometry';

describe('senior graying', () => {
  it('is zero before day 550, eases up, and is 1 by day 850', () => {
    for (const species of ['dog', 'cat'] as const) {
      expect(grayLevelOf(species, 0)).toBe(0);
      expect(grayLevelOf(species, 550)).toBe(0);
      expect(grayLevelOf(species, 850)).toBe(1);
      expect(grayLevelOf(species, 1000)).toBe(1);
      let last = -1;
      for (let age = 500; age <= 900; age += 10) {
        const level = grayLevelOf(species, age);
        expect(level).toBeGreaterThanOrEqual(last);
        last = level;
      }
      // S-curve: slow at both ends.
      expect(grayLevelOf(species, 580)).toBeLessThan(0.1);
      expect(grayLevelOf(species, 820)).toBeGreaterThan(0.9);
    }
  });

  it('fades regions in on their own thresholds: muzzle, then brows, then chest and paws', () => {
    const at = (age: number) => grayAmountsOf('dog', age);
    // Level 0.2: muzzle only.
    const early = at(550 + 300 * 0.3);
    expect(early.muzzle).toBeGreaterThan(0);
    expect(early.brows).toBe(0);
    expect(early.chest).toBe(0);
    // Level just over 0.5: brows have started, chest has not.
    const mid = at(550 + 300 * 0.6);
    expect(mid.brows).toBeGreaterThan(0);
    expect(mid.chest).toBe(0);
    const late = at(850);
    expect(late.muzzle).toBe(1);
    expect(late.brows).toBe(1);
    expect(late.chest).toBe(1);
  });

  it('cats gray the muzzle only, at about 0.4 of a dog', () => {
    const cat = grayAmountsOf('cat', 850);
    expect(cat.muzzle).toBeCloseTo(0.4, 5);
    expect(cat.brows).toBe(0);
    expect(cat.chest).toBe(0);
  });

  it('follows age only: vitality and weight do not change it', () => {
    const breed = breedById('retriever')!;
    const low = geomOf(breed, 800, 0, 0).gray;
    const high = geomOf(breed, 800, 0.4, 1).gray;
    expect(low).toEqual(high);
  });

  it('frost is a light desaturated gray that is subtle on light coats and clear on dark ones', () => {
    const dark = frostColorOf('#3b2f2a');
    const light = frostColorOf('#f1ece4');
    expect(luminance(dark)).toBeGreaterThan(0.6);
    expect(Math.abs(luminance(light) - luminance('#f1ece4'))).toBeLessThan(0.1);
    // Locked dark regions (pug mask) still frost visibly.
    const pug = breedById('pug')!;
    expect(luminance(frostColorOf(resolveBreed(pug, defaultLook(pug)).muzzle))).toBeGreaterThan(luminance(pug.muzzle));
  });
});
