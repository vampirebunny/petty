import { grayEndDay, grayStartDay } from '../../sim/config';
import { breedById, defaultLook, resolveBreed } from '../breeds';
import { frostColorOf, luminance } from '../color';
import { grayAmountsOf, grayLevelOf } from '../data/graying';
import { geomOf } from '../geometry';

const span = grayEndDay - grayStartDay;

describe('senior graying', () => {
  it('is zero before gray starts, eases up, and is 1 by the end day', () => {
    for (const species of ['dog', 'cat'] as const) {
      expect(grayLevelOf(species, 0)).toBe(0);
      expect(grayLevelOf(species, grayStartDay)).toBe(0);
      expect(grayLevelOf(species, grayEndDay)).toBe(1);
      expect(grayLevelOf(species, grayEndDay + 10)).toBe(1);
      let last = -1;
      for (let age = grayStartDay - 4; age <= grayEndDay + 6; age += 1) {
        const level = grayLevelOf(species, age);
        expect(level).toBeGreaterThanOrEqual(last);
        last = level;
      }
      // S-curve: slow at both ends.
      expect(grayLevelOf(species, grayStartDay + span * 0.1)).toBeLessThan(0.1);
      expect(grayLevelOf(species, grayStartDay + span * 0.9)).toBeGreaterThan(0.9);
    }
  });

  it('fades regions in on their own thresholds: muzzle, then brows, then chest and paws', () => {
    const at = (age: number) => grayAmountsOf('dog', age);
    // Early on the curve: muzzle only.
    const early = at(grayStartDay + span * 0.3);
    expect(early.muzzle).toBeGreaterThan(0);
    expect(early.brows).toBe(0);
    expect(early.chest).toBe(0);
    // Past halfway: brows have started, chest has not.
    const mid = at(grayStartDay + span * 0.6);
    expect(mid.brows).toBeGreaterThan(0);
    expect(mid.chest).toBe(0);
    const late = at(grayEndDay);
    expect(late.muzzle).toBe(1);
    expect(late.brows).toBe(1);
    expect(late.chest).toBe(1);
  });

  it('cats gray the muzzle only, at about 0.4 of a dog', () => {
    const cat = grayAmountsOf('cat', grayEndDay);
    expect(cat.muzzle).toBeCloseTo(0.4, 5);
    expect(cat.brows).toBe(0);
    expect(cat.chest).toBe(0);
  });

  it('follows age only: vitality and weight do not change it', () => {
    const breed = breedById('retriever')!;
    const age = grayStartDay + span * 0.8;
    const low = geomOf(breed, age, 0, 0).gray;
    const high = geomOf(breed, age, 0.4, 1).gray;
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
