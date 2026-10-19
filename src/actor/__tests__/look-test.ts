import {
  breedById,
  coatStyles,
  coatStylesFor,
  defaultLook,
  eyeColorsFor,
  isDarkCoat,
  lookWithCoat,
  resolveBreed,
} from '../breeds';
import { luminance } from '../color';
import { baseColorOf, markingOf, resolveMarkings } from '../markings';
import { createWorld, spawnActor, syncActor } from '../sim';

const source = {
  id: 'a',
  breedId: 'retriever',
  ageDays: 0,
  weight: 0,
  vitality: 0.75,
  equipped: {},
  asleep: false,
};

it('returns the breed unchanged when there is no look or the look is the default', () => {
  const breed = breedById('corgi')!;
  expect(resolveBreed(breed, null)).toBe(breed);
  expect(resolveBreed(breed, defaultLook(breed))).toEqual(breed);
});

it('overrides coat and eye color but leaves anatomy, ears and tail alone', () => {
  const breed = breedById('domesticShorthair')!;
  const resolved = resolveBreed(breed, { coat: '#2b2b33', eyeColor: '#5aa7d8' });
  expect(resolved.coat).toBe('#2b2b33');
  expect(resolved.eyeColor).toBe('#5aa7d8');
  expect(resolved.earColor).not.toBe(breed.earColor);
  expect(resolved.muzzle).not.toBe(breed.muzzle);
  expect(resolved.bodyLen).toBe(breed.bodyLen);
  expect(resolved.legLen).toBe(breed.legLen);
  expect(resolved.head).toBe(breed.head);
  expect(resolved.earType).toBe(breed.earType);
  expect(resolved.tailType).toBe(breed.tailType);
  expect(resolved.attributeRanges).toBe(breed.attributeRanges);
});

it('ear and tail come from breed data: legacy look fields are ignored', () => {
  const husky = breedById('husky')!;
  const legacy = { coat: '#ffffff', ear: 'floppy', tail: 'stub' } as never;
  const resolved = resolveBreed(husky, legacy);
  expect(resolved.earType).toBe('erectTall');
  expect(resolved.tailType).toBe('sickleBushy');
});

it('offers eye colors only for unlocked breeds that have one', () => {
  expect(eyeColorsFor(breedById('domesticShorthair')!).length).toBeGreaterThan(0);
  for (const id of ['scottishFold', 'siamese', 'persian']) {
    expect(eyeColorsFor(breedById(id)!).length).toBeGreaterThan(0);
  }
  for (const id of ['husky', 'pug']) {
    expect(eyeColorsFor(breedById(id)!)).toEqual([]);
  }
});

it('only offers pattern variants the breed allows, and snaps a disallowed pattern back', () => {
  const husky = breedById('husky')!;
  expect(coatStylesFor(husky).every((style) => (style.pattern ?? 'none') === 'none')).toBe(true);
  const dsh = breedById('domesticShorthair')!;
  const patterns = new Set(coatStylesFor(dsh).map((style) => style.pattern ?? 'none'));
  expect(patterns.has('bicolor')).toBe(true);
  expect(patterns.has('points')).toBe(false);
  expect(resolveBreed(husky, { coat: '#ffffff', pattern: 'stripes' }).pattern).toBe(husky.pattern);
});

it('siamese: the user color fills the points and the body is a pale tint of it', () => {
  const siamese = breedById('siamese')!;
  const resolved = resolveBreed(siamese, { coat: '#6f7f95' });
  expect(baseColorOf(resolved)).not.toBe('#6f7f95');
  expect(luminance(baseColorOf(resolved))).toBeGreaterThan(luminance('#6f7f95'));
  const points = resolveMarkings(resolved);
  for (const shape of ['blackMask', 'ears', 'legs', 'tail'] as const) {
    expect(markingOf(points, shape)?.color).toBe('#6f7f95');
  }
});

it('lists the breed coat first with no duplicate coat styles', () => {
  const breed = breedById('retriever')!;
  const styles = coatStylesFor(breed);
  expect(styles[0].coat).toBe(breed.coat);
  const keys = styles.map((style) => `${style.coat}|${style.pattern ?? 'none'}|${style.accent ?? ''}`.toLowerCase());
  expect(new Set(keys).size).toBe(styles.length);
});

it('offers striped and pointed combinations to both species', () => {
  for (const species of ['dog', 'cat'] as const) {
    const styles = coatStyles[species];
    expect(styles.some((style) => style.pattern === 'stripes')).toBe(true);
    expect(styles.some((style) => style.pattern === 'points' && style.accent)).toBe(true);
  }
});

it('applies a pointed coat: accent on ears and muzzle', () => {
  const breed = breedById('retriever')!;
  const style = coatStyles.dog.find((candidate) => candidate.id === 'cocoa-points')!;
  const resolved = resolveBreed(breed, lookWithCoat(defaultLook(breed), style));
  expect(resolved.pattern).toBe('points');
  expect(resolved.accent).toBe(style.accent);
  expect(resolved.earColor).toBe(style.accent);
});

it('a solid coat clears the breed pattern', () => {
  const siamese = breedById('siamese')!;
  const style = coatStyles.cat.find((candidate) => candidate.id === 'lilac')!;
  const resolved = resolveBreed(siamese, lookWithCoat(defaultLook(siamese), style));
  expect(resolved.pattern).toBe('none');
  expect(resolved.coat).toBe(style.coat);
});

it('detects dark coats by luminance, not by one hex value', () => {
  expect(isDarkCoat('#2b2b33')).toBe(true);
  expect(isDarkCoat('#222222')).toBe(true);
  expect(isDarkCoat('#d9a441')).toBe(false);
});

it('carries the look onto the actor and updates it on sync', () => {
  const look = { coat: '#8a97a6' };
  const actor = spawnActor({ ...source, look });
  expect(actor.look).toEqual(look);
  expect(createWorld([actor]).actors[0].look).toEqual(look);

  syncActor(actor, { ...source, look: { ...look, coat: '#ffffff' } });
  expect(actor.look?.coat).toBe('#ffffff');

  syncActor(actor, source);
  expect(actor.look).toBeNull();
});
