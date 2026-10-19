import {
  breedById,
  coatStyles,
  coatStylesFor,
  defaultLook,
  earOptions,
  isDarkCoat,
  lookWithCoat,
  resolveBreed,
  tailOptions,
} from '../breeds';
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

it('overrides coat, ears, and tail but leaves anatomy alone', () => {
  const breed = breedById('retriever')!;
  const look = { coat: '#2b2b33', ear: 'pointy', tail: 'curl' };
  const resolved = resolveBreed(breed, look);
  expect(resolved.coat).toBe('#2b2b33');
  expect(resolved.ear).toBe('pointy');
  expect(resolved.tail).toBe('curl');
  expect(resolved.earColor).not.toBe(breed.earColor);
  expect(resolved.muzzle).not.toBe(breed.muzzle);
  expect(resolved.bodyLen).toBe(breed.bodyLen);
  expect(resolved.legLen).toBe(breed.legLen);
  expect(resolved.head).toBe(breed.head);
  expect(resolved.attributeRanges).toBe(breed.attributeRanges);
});

it('ignores ear and tail values the species does not offer', () => {
  const cat = breedById('tabby')!;
  const resolved = resolveBreed(cat, { coat: cat.coat, ear: 'floppy', tail: 'stub' });
  expect(resolved.ear).toBe('cat');
  expect(resolved.tail).toBe(cat.tail);
  expect(earOptions.cat).toEqual([]);
  expect(tailOptions.cat.map((option) => option.id)).toEqual(['long', 'fluffy']);
});

it('keeps siamese point colors when the coat changes', () => {
  const siamese = breedById('siamese')!;
  const resolved = resolveBreed(siamese, { coat: '#ffffff', ear: 'cat', tail: 'long' });
  expect(resolved.earColor).toBe(siamese.earColor);
  expect(resolved.muzzle).toBe(siamese.muzzle);
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
  const look = { coat: '#8a97a6', ear: 'floppy', tail: 'stub' };
  const actor = spawnActor({ ...source, look });
  expect(actor.look).toEqual(look);
  expect(createWorld([actor]).actors[0].look).toEqual(look);

  syncActor(actor, { ...source, look: { ...look, coat: '#ffffff' } });
  expect(actor.look?.coat).toBe('#ffffff');

  syncActor(actor, source);
  expect(actor.look).toBeNull();
});
