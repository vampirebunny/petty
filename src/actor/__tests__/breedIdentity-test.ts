import { breedsFor, defaultLook, resolveBreed } from '../breeds';
import { earProfiles } from '../data/breedShapes';
import { geomOf, headFaceOf, noseOf } from '../geometry';
import { luminance } from '../color';
import { baseColorOf, markingOf, resolveMarkings } from '../markings';
import type { Breed } from '../types';

const dogs = breedsFor('dog');
const cats = breedsFor('cat');
const stages = [
  { name: 'puppy', age: 0 },
  { name: 'adult', age: 500 },
  { name: 'senior', age: 1000 },
];

function withCoat(breed: Breed, coat: string): Breed {
  return resolveBreed(breed, { ...defaultLook(breed), coat, pattern: 'none' });
}

function order(values: Record<string, number>): string[] {
  return Object.entries(values)
    .sort((a, b) => a[1] - b[1])
    .map(([id]) => id);
}

describe('cuteness keeps breed proportions', () => {
  for (const [name, group] of [['dogs', dogs], ['cats', cats]] as const) {
    for (const stage of stages) {
      it(`${name} at ${stage.name}: head, snout and ear order is the same at cuteness 0 and 1`, () => {
        const at = (cuteness: number) =>
          group.map((breed) => ({ id: breed.id, geom: geomOf({ ...breed, cuteness }, stage.age, 0) }));
        const flat = at(0);
        const cute = at(1);
        for (const key of ['headR', 'snout', 'ear'] as const) {
          const pick = (rows: typeof flat) => Object.fromEntries(rows.map((row) => [row.id, row.geom[key]]));
          expect(order(pick(cute))).toEqual(order(pick(flat)));
          // Breeds stay clearly apart: adjacent breeds differ by at least 2%.
          const sorted = Object.values(pick(cute)).sort((a, b) => a - b);
          for (let i = 1; i < sorted.length; i += 1) {
            expect(sorted[i] / sorted[i - 1]).toBeGreaterThan(1.02);
          }
        }
      });
    }
  }
});

describe('marking regions', () => {
  const coats = ['#d9a441', '#2b2b33', '#8fd9b6'];
  const regionsOf = (id: string, coat: string) => {
    const breed = withCoat(breedsFor('dog').find((b) => b.id === id)!, coat);
    return resolveMarkings(breed);
  };

  it('locked regions ignore the user palette', () => {
    const locked: Record<string, string[]> = {
      husky: ['faceMask', 'chest', 'belly'],
      corgi: ['blaze', 'muzzle', 'chest', 'socks'],
      pug: ['blackMask', 'muzzle', 'ears', 'wrinkles'],
    };
    for (const [id, shapes] of Object.entries(locked)) {
      for (const shape of shapes) {
        const colors = coats.map((coat) => markingOf(regionsOf(id, coat), shape as never)?.color);
        expect(colors[0]).toBeDefined();
        expect(new Set(colors).size).toBe(1);
        expect(markingOf(regionsOf(id, coats[0]), shape as never)?.locked).toBe(true);
      }
    }
  });

  it('husky cap and brow spots are darker than the base', () => {
    for (const coat of coats.slice(0, 1).concat(coats.slice(2))) {
      const markings = regionsOf('husky', coat);
      expect(luminance(markingOf(markings, 'cap')!.color)).toBeLessThan(luminance(coat));
      expect(luminance(markingOf(markings, 'browDots')!.color)).toBeLessThan(luminance(coat));
    }
  });

  it('dachshund points and retriever feathering are lighter tints that follow the palette', () => {
    for (const [id, shapes] of [['dachshund', ['browDots', 'muzzle', 'chest', 'lowerLegs']], ['retriever', ['feathering', 'chest']]] as const) {
      for (const shape of shapes) {
        const a = markingOf(regionsOf(id, coats[0]), shape)!;
        const b = markingOf(regionsOf(id, coats[2]), shape)!;
        expect(a.locked).toBe(false);
        expect(a.color).not.toBe(b.color);
        expect(luminance(a.color)).toBeGreaterThan(luminance(coats[0]));
      }
    }
  });

  it('is data: every breed declares valid regions', () => {
    for (const breed of [...dogs, ...cats]) {
      for (const region of breed.markings) {
        expect(['head', 'body']).toContain(region.where);
        expect(region.name.length).toBeGreaterThan(0);
      }
      expect(resolveMarkings(breed).length).toBeLessThanOrEqual(breed.markings.length);
    }
  });
});

describe('breed silhouettes are distinct', () => {
  it('every breed in a species has its own ear type, skull and tail', () => {
    for (const group of [dogs, cats]) {
      for (const key of ['earType', 'tailType'] as const) {
        const values = group.map((breed) => breed[key]);
        if (group === dogs) {
          expect(new Set(values).size).toBe(group.length);
        }
      }
      for (const breed of group) {
        expect(earProfiles[breed.earType]).toBeDefined();
      }
    }
    expect(new Set(dogs.map((breed) => breed.skull)).size).toBe(dogs.length);
  });

  for (const stage of stages) {
    it(`3/4 snouts differ by breed at ${stage.name}`, () => {
      const rows = dogs.map((breed) => {
        const geom = geomOf(breed, stage.age, 0);
        const side = headFaceOf(breed, geom, 0);
        const face = headFaceOf(breed, geom, 1);
        const R = geom.headR;
        // How far the muzzle's tip reaches, in head radii, past the head center on the side it faces.
        const bottom = (face.muzzle.x + face.muzzle.rx) / R;
        const noseDrop = (noseOf(breed, R, face).y - face.nearEye.y) / R;
        const sideTip = (side.muzzle.x + side.muzzle.rx) / R;
        return { id: breed.id, bottom, noseDrop, sideTip };
      });
      const byId = Object.fromEntries(rows.map((row) => [row.id, row]));
      // Long snouts clearly extend past the near cheek line (the head circle's edge on the side it faces).
      for (const id of ['dachshund', 'husky', 'retriever']) {
        expect(byId[id].bottom).toBeGreaterThan(1.15);
      }
      // The pug's nose sits directly under its eyes and its face stays inside the head.
      expect(byId.pug.noseDrop).toBeLessThan(0.5);
      expect(byId.pug.bottom).toBeLessThan(1.2);
      // Longest to shortest, in 3/4 and in side view.
      expect(order(Object.fromEntries(rows.map((row) => [row.id, row.bottom])))).toEqual(
        expect.arrayContaining(['pug', 'dachshund']),
      );
      expect(byId.dachshund.bottom).toBeGreaterThan(byId.husky.bottom);
      expect(byId.husky.bottom).toBeGreaterThan(byId.corgi.bottom);
      expect(byId.pug.bottom).toBeLessThan(byId.corgi.bottom);
      expect(byId.dachshund.sideTip).toBeGreaterThan(byId.husky.sideTip);
      expect(byId.husky.sideTip).toBeGreaterThan(byId.retriever.sideTip);
      expect(byId.retriever.sideTip).toBeGreaterThan(byId.corgi.sideTip);
      expect(byId.corgi.sideTip).toBeGreaterThan(byId.pug.sideTip);
    });

    it(`eye spacing and eye size follow the breed at ${stage.name}`, () => {
      const gap = (id: string) => {
        const breed = dogs.find((b) => b.id === id)!;
        const geom = geomOf(breed, stage.age, 0);
        const face = headFaceOf(breed, geom, 1);
        return { gap: face.gap3 / geom.headR, eye: face.eyeR / geom.headR };
      };
      expect(gap('husky').gap).toBeLessThanOrEqual(gap('retriever').gap);
      expect(gap('pug').gap).toBeGreaterThanOrEqual(gap('retriever').gap);
      expect(gap('pug').eye).toBeGreaterThan(gap('husky').eye);
    });
  }

  it('far ears: erect types show both, hanging types stay partly behind the head', () => {
    for (const breed of dogs) {
      const geom = geomOf(breed, 500, 0);
      const face = headFaceOf(breed, geom, 1);
      const profile = earProfiles[breed.earType];
      if (profile.stiff) {
        expect(face.farEarShift.x).toBeGreaterThan(geom.headR * 0.9);
      } else if (breed.earType === 'longDrape') {
        expect(face.farEarShift.x).toBeLessThan(geom.headR * 0.6);
      }
    }
  });
});

describe('cat identity', () => {
  const cat = (id: string) => cats.find((breed) => breed.id === id)!;

  it('has the five cat breeds with distinct ears, heads and tails', () => {
    expect(cats.map((breed) => breed.id)).toEqual(['domesticShorthair', 'siamese', 'persian', 'maineCoon', 'scottishFold']);
    expect(new Set(cats.map((breed) => breed.earType)).size).toBe(cats.length);
    expect(new Set(cats.map((breed) => breed.tailType)).size).toBeGreaterThanOrEqual(4);
    expect(new Set(cats.map((breed) => breed.skull)).size).toBeGreaterThanOrEqual(4);
  });

  it('tabby markings only show for the stripes pattern and bicolor regions are locked white', () => {
    const dsh = cat('domesticShorthair');
    const names = (pattern: 'stripes' | 'none' | 'bicolor') =>
      resolveMarkings({ ...dsh, pattern }).map((marking) => marking.shape);
    expect(names('stripes')).toEqual(expect.arrayContaining(['tabbyBack', 'tabbyM', 'cheekBars']));
    expect(names('none')).toEqual([]);
    const bicolor = resolveMarkings({ ...dsh, pattern: 'bicolor', coat: '#2b2b33' });
    expect(bicolor.map((marking) => marking.shape)).toEqual(expect.arrayContaining(['blaze', 'chest', 'belly', 'socks']));
    expect(bicolor.every((marking) => marking.locked)).toBe(true);
    expect(new Set(bicolor.map((marking) => marking.color)).size).toBe(1);
  });

  it('keeps the Siamese blue and Persian copper as defaults but lets the look change them', () => {
    expect(cat('siamese').eyeColor).toBe('#5aa7d8');
    expect(cat('persian').eyeColor).toBe('#d9822b');
    for (const id of ['siamese', 'persian', 'scottishFold']) {
      const breed = cat(id);
      expect(resolveBreed(breed, defaultLook(breed)).eyeColor).toBe(breed.eyeColor);
      expect(resolveBreed(breed, { ...defaultLook(breed), eyeColor: '#79bd5a' }).eyeColor).toBe('#79bd5a');
    }
  });

  it('Siamese body is a pale tint of the user color and Fold has no locked regions', () => {
    const siamese = withCoat(cat('siamese'), '#5b4636');
    expect(baseColorOf(siamese)).not.toBe('#5b4636');
    expect(luminance(baseColorOf(siamese))).toBeGreaterThan(luminance('#5b4636'));
    expect(resolveMarkings(cat('scottishFold'))).toHaveLength(0);
    expect(cat('scottishFold').markings.every((region) => region.when != null)).toBe(true);
  });

  for (const stage of stages) {
    it(`3/4 faces read at headTurn 1 at ${stage.name}`, () => {
      const faceOf = (id: string, turn = 1) => {
        const breed = cat(id);
        const geom = geomOf(breed, stage.age, 0);
        return { breed, geom, face: headFaceOf(breed, geom, turn), R: geom.headR };
      };
      // Persian: the nose sits between the eyes in 3/4 and just in front of the eye line in side view.
      for (const turn of [0, 1]) {
        const { breed, face, R } = faceOf('persian', turn);
        const nose = noseOf(breed, R, face);
        expect(Math.abs(nose.y - face.nearEye.y)).toBeLessThan(R * 0.45);
        if (turn === 1) {
          expect(nose.x).toBeGreaterThan(face.nearEye.x);
          expect(nose.x).toBeLessThan(face.farEye.x);
        }
      }
      // Maine Coon: a square, wide muzzle, unlike the Siamese wedge.
      const maine = faceOf('maineCoon');
      const siamese = faceOf('siamese');
      expect(maine.face.squareMuzzle).toBe(true);
      expect(siamese.face.squareMuzzle).toBe(false);
      expect(maine.face.muzzle.rx / maine.R).toBeGreaterThan(siamese.face.muzzle.rx / siamese.R);
      // Siamese: the mask region exists and both eyes are inside the head so both are masked.
      expect(markingOf(resolveMarkings(withCoat(siamese.breed, '#5b4636')), 'blackMask')).toBeDefined();
      expect(siamese.face.farEyeAlpha).toBe(1);
      // Fold: both caps lie on the head at the 3/4 turn.
      const fold = faceOf('scottishFold');
      expect(earProfiles[fold.breed.earType].overHead).toBe(true);
      const nearX = -fold.R * 0.1 + fold.face.nearEarShift.x;
      const farX = -fold.R * 0.1 - fold.R * 0.35 + fold.face.farEarShift.x;
      expect(Math.abs(nearX)).toBeLessThan(fold.R * 0.9);
      expect(Math.abs(farX)).toBeLessThan(fold.R * 0.9);
      expect(farX).toBeGreaterThan(nearX);
    });
  }
});
