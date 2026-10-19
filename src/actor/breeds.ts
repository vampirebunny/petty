import type { Look } from '../sim/types';
import { breedAttributes } from './breedAttributes';
import { luminance, mixHexColor } from './color';
import type { Breed, EarShape, Face3q, Pattern, Species, TailShape, TaskType } from './types';

// Visual and behavior parameters of a breed. Attribute ranges, the blurb and the 3/4 face come from data below.
type BreedVisual = Omit<Breed, 'attributeRanges' | 'blurb' | 'face3q'>;

// 3/4 head presets, in head radii. Breeds pick one and may override single fields.
const face3qPresets: Record<'longSnout' | 'medium' | 'flat' | 'cat', Face3q> = {
  longSnout: { farEyeDx: 0.5, snoutShift: 0.1, snoutDrop: 0.08, farEarDx: 0.85, farEarDy: 0 },
  medium: { farEyeDx: 0.48, snoutShift: 0.06, snoutDrop: 0.1, farEarDx: 0.85, farEarDy: 0 },
  flat: { farEyeDx: 0.44, snoutShift: 0.02, snoutDrop: 0.12, farEarDx: 0.8, farEarDy: 0.04 },
  cat: { farEyeDx: 0.46, snoutShift: 0.03, snoutDrop: 0.1, farEarDx: 1.05, farEarDy: 0 },
};

const face3qByBreed: Record<string, Face3q> = {
  retriever: { ...face3qPresets.longSnout, farEarDx: 0.8 },
  corgi: { ...face3qPresets.medium, farEarDx: 1 },
  dachshund: { ...face3qPresets.longSnout, farEyeDx: 0.46, snoutShift: 0.12 },
  husky: { ...face3qPresets.longSnout, farEyeDx: 0.52, farEarDx: 1.05 },
  pug: { ...face3qPresets.flat, farEyeDx: 0.42, snoutDrop: 0.14 },
  domesticshorthair: face3qPresets.cat,
  siamese: { ...face3qPresets.cat, farEarDx: 1.1, farEyeDx: 0.44 },
  persian: { ...face3qPresets.flat, farEarDx: 1.05, snoutDrop: 0.14 },
  mainecoon: { ...face3qPresets.cat, farEyeDx: 0.48 },
  bombay: face3qPresets.cat,
};

function withAttributes(breed: BreedVisual): Breed {
  const data = breedAttributes[breed.id];
  if (!data) {
    throw new Error(`Breed "${breed.id}" has no attribute ranges.`);
  }
  const face3q = face3qByBreed[breed.id] ?? face3qPresets[breed.species === 'cat' ? 'cat' : 'medium'];
  return { ...breed, face3q, attributeRanges: data.ranges, blurb: data.blurb };
}

export const sharedTasks: readonly TaskType[] = ['stand', 'sit', 'sleep', 'eat', 'walk', 'jump', 'idle'];

export const dogTasks: readonly TaskType[] = [...sharedTasks, 'pant', 'paw', 'bark', 'fetch'];

export const catTasks: readonly TaskType[] = [...sharedTasks, 'purr', 'groom', 'pounce'];

const dogVisuals: BreedVisual[] = [
  {
    id: 'retriever',
    name: 'Retriever',
    species: 'dog',
    bodyLen: 1,
    bodyH: 1,
    legLen: 1,
    head: 1,
    snout: 1,
    earSize: 1,
    ear: 'floppy',
    tail: 'straight',
    coat: '#d9a441',
    earColor: '#b9822a',
    muzzle: '#ecc97a',
    pitch: 0.85,
    size: 1,
    cuteness: 1,
    behaviors: dogTasks,
  },
  {
    id: 'corgi',
    name: 'Corgi',
    species: 'dog',
    bodyLen: 0.95,
    bodyH: 0.95,
    legLen: 0.5,
    head: 1.05,
    snout: 0.9,
    earSize: 1,
    ear: 'pointy',
    tail: 'stub',
    coat: '#e08a3c',
    earColor: '#c46f27',
    muzzle: '#f4e3cf',
    pitch: 1.15,
    size: 1,
    cuteness: 1,
    behaviors: dogTasks,
  },
  {
    id: 'dachshund',
    name: 'Dachshund',
    species: 'dog',
    bodyLen: 1.45,
    bodyH: 0.7,
    legLen: 0.38,
    head: 0.85,
    snout: 1.2,
    earSize: 1,
    ear: 'floppy',
    tail: 'straight',
    coat: '#6b3f2a',
    earColor: '#4d2b1c',
    muzzle: '#8a5a41',
    pitch: 1.3,
    size: 1,
    cuteness: 1,
    behaviors: dogTasks,
  },
  {
    id: 'husky',
    name: 'Husky',
    species: 'dog',
    bodyLen: 1,
    bodyH: 0.95,
    legLen: 0.95,
    head: 1,
    snout: 0.9,
    earSize: 1,
    ear: 'pointy',
    tail: 'curl',
    coat: '#8a97a6',
    earColor: '#5f6b79',
    muzzle: '#f1f4f7',
    pitch: 0.95,
    size: 1,
    cuteness: 1,
    behaviors: dogTasks,
  },
  {
    id: 'pug',
    name: 'Pug',
    species: 'dog',
    bodyLen: 0.8,
    bodyH: 1,
    legLen: 0.6,
    head: 1.25,
    snout: 0.3,
    earSize: 0.7,
    ear: 'floppy',
    tail: 'curl',
    coat: '#d8c19a',
    earColor: '#3b2f2a',
    muzzle: '#3b2f2a',
    pitch: 1.4,
    size: 1,
    cuteness: 1,
    behaviors: dogTasks,
  },
];

const catVisuals: BreedVisual[] = [
  {
    id: 'domesticshorthair',
    name: 'Domestic Shorthair',
    species: 'cat',
    bodyLen: 0.95,
    bodyH: 0.72,
    legLen: 0.78,
    head: 0.92,
    snout: 0.3,
    earSize: 1,
    ear: 'cat',
    tail: 'long',
    coat: '#b98a58',
    earColor: '#8c6238',
    muzzle: '#efe0c8',
    pitch: 1.6,
    size: 0.95,
    cuteness: 1,
    eyeColor: '#79bd5a',
    pattern: 'stripes',
    behaviors: catTasks,
  },
  {
    id: 'siamese',
    name: 'Siamese',
    species: 'cat',
    bodyLen: 1,
    bodyH: 0.62,
    legLen: 0.88,
    head: 0.86,
    snout: 0.4,
    earSize: 1.2,
    ear: 'cat',
    tail: 'long',
    coat: '#eadbc2',
    earColor: '#5b4636',
    muzzle: '#5b4636',
    pitch: 1.75,
    size: 0.97,
    cuteness: 1,
    eyeColor: '#5aa7d8',
    pattern: 'points',
    accent: '#5b4636',
    behaviors: catTasks,
  },
  {
    id: 'persian',
    name: 'Persian',
    species: 'cat',
    bodyLen: 0.9,
    bodyH: 0.9,
    legLen: 0.6,
    head: 1.12,
    snout: 0.1,
    earSize: 0.8,
    ear: 'cat',
    tail: 'fluffy',
    coat: '#f1ece4',
    earColor: '#d9cfc0',
    muzzle: '#e3d9ca',
    pitch: 1.5,
    size: 0.95,
    cuteness: 1,
    eyeColor: '#e0933a',
    pattern: 'none',
    behaviors: catTasks,
  },
  {
    id: 'mainecoon',
    name: 'Maine Coon',
    species: 'cat',
    bodyLen: 1.18,
    bodyH: 0.86,
    legLen: 0.86,
    head: 1,
    snout: 0.45,
    earSize: 1.1,
    ear: 'cat',
    tail: 'fluffy',
    coat: '#8b6a4a',
    earColor: '#5f4630',
    muzzle: '#d9c4a5',
    pitch: 1.3,
    size: 1.1,
    cuteness: 1,
    eyeColor: '#c9b24a',
    pattern: 'stripes',
    behaviors: catTasks,
  },
  {
    id: 'bombay',
    name: 'Bombay',
    species: 'cat',
    bodyLen: 0.95,
    bodyH: 0.7,
    legLen: 0.8,
    head: 0.9,
    snout: 0.3,
    earSize: 1,
    ear: 'cat',
    tail: 'long',
    coat: '#2b2b33',
    earColor: '#1a1a20',
    muzzle: '#3b3b45',
    pitch: 1.65,
    size: 0.95,
    cuteness: 1,
    eyeColor: '#e7c53a',
    pattern: 'none',
    behaviors: catTasks,
  },
];

const dogs: Breed[] = dogVisuals.map(withAttributes);
const cats: Breed[] = catVisuals.map(withAttributes);
const all = [...dogs, ...cats];
const byId = new Map(all.map((breed) => [breed.id, breed]));

// Look options offered at adoption. Data only, so adding a swatch or a shape is a config entry.
export type LookOption = { id: string; label: string };

// A coat is a base color, optionally with a pattern: stripes (darker bands) or points (an accent on
// ears, legs, tail, and muzzle). The renderer draws both patterns for dogs and cats.
export type CoatStyle = {
  id: string;
  label: string;
  coat: string;
  pattern?: Pattern;
  accent?: string;
};

const solid = (id: string, label: string, coat: string): CoatStyle => ({ id, label, coat });
const striped = (id: string, label: string, coat: string): CoatStyle => ({ id, label, coat, pattern: 'stripes' });
const pointed = (id: string, label: string, coat: string, accent: string): CoatStyle => ({
  id,
  label,
  coat,
  pattern: 'points',
  accent,
});

export const coatStyles: Record<Species, readonly CoatStyle[]> = {
  dog: [
    solid('gold', 'Gold', '#d9a441'),
    solid('ginger', 'Ginger', '#e08a3c'),
    solid('cocoa', 'Cocoa', '#6b3f2a'),
    solid('slate', 'Slate', '#8a97a6'),
    solid('fawn', 'Fawn', '#d8c19a'),
    solid('midnight', 'Midnight', '#2b2b33'),
    solid('cream', 'Cream', '#f1ece4'),
    solid('rust', 'Rust', '#a8572f'),
    striped('brindle', 'Brindle', '#8a5a3a'),
    striped('tiger-dog', 'Tiger', '#e08a3c'),
    striped('mint-stripe', 'Mint stripes', '#8fd9b6'),
    pointed('cocoa-points', 'Cocoa points', '#ead9bf', '#6b3f2a'),
    pointed('ghost-points', 'Ghost points', '#f1ece4', '#9aa6b8'),
    pointed('lilac-points', 'Lilac points', '#d9d2ee', '#4a3f6b'),
    pointed('candy', 'Cotton candy', '#f6c1dc', '#7fb7ea'),
    solid('bubblegum', 'Bubblegum', '#f2a1c7'),
    solid('sky', 'Sky', '#7fb7ea'),
  ],
  cat: [
    solid('tabby-brown', 'Brown', '#b98a58'),
    solid('cream-cat', 'Cream', '#eadbc2'),
    solid('snow', 'Snow', '#f1ece4'),
    solid('walnut', 'Walnut', '#8b6a4a'),
    solid('soot', 'Soot', '#2b2b33'),
    solid('orange', 'Orange', '#d9822b'),
    solid('smoke', 'Smoke', '#8a97a6'),
    solid('sand', 'Sand', '#c7b299'),
    striped('ginger-tiger', 'Ginger tiger', '#d9822b'),
    striped('silver-tabby', 'Silver tabby', '#c9ced6'),
    striped('mint-tabby', 'Mint tabby', '#8fd9b6'),
    striped('cosmic', 'Cosmic', '#4a4478'),
    pointed('blue-point', 'Blue point', '#e8e2d8', '#6f7f95'),
    pointed('chocolate-point', 'Chocolate point', '#efe3cf', '#5b3a2a'),
    pointed('flame-point', 'Flame point', '#f4e6d0', '#d9822b'),
    pointed('bubblegum-points', 'Bubblegum points', '#f6c1dc', '#8a6ad0'),
    solid('lilac', 'Lilac', '#cdb7e8'),
  ],
};

export const earOptions: Record<Species, readonly LookOption[]> = {
  dog: [
    { id: 'floppy', label: 'Floppy' },
    { id: 'pointy', label: 'Pointy' },
  ],
  cat: [],
};

export const tailOptions: Record<Species, readonly LookOption[]> = {
  dog: [
    { id: 'straight', label: 'Straight' },
    { id: 'curl', label: 'Curled' },
    { id: 'stub', label: 'Stub' },
  ],
  cat: [
    { id: 'long', label: 'Long' },
    { id: 'fluffy', label: 'Fluffy' },
  ],
};

// The breed's own look, the starting point of the customize step.
export function defaultLook(breed: Breed): Look {
  const look: Look = { coat: breed.coat, ear: breed.ear, tail: breed.tail };
  if (breed.pattern) {
    look.pattern = breed.pattern;
  }
  if (breed.accent) {
    look.accent = breed.accent;
  }
  return look;
}

const sameHex = (a: string | undefined, b: string | undefined) => (a ?? '').toLowerCase() === (b ?? '').toLowerCase();

// Whether a look's coat is this style (same base color, pattern, and accent).
export function isCoatStyle(look: Look, style: CoatStyle): boolean {
  return (
    sameHex(look.coat, style.coat) &&
    (look.pattern ?? 'none') === (style.pattern ?? 'none') &&
    (style.pattern === 'points' ? sameHex(look.accent, style.accent) : true)
  );
}

// The coat styles for a breed: its own coat first, then the species styles without duplicates.
export function coatStylesFor(breed: Breed): CoatStyle[] {
  const own: CoatStyle = {
    id: `${breed.id}-own`,
    label: `${breed.name} classic`,
    coat: breed.coat,
    pattern: breed.pattern,
    accent: breed.accent,
  };
  const ownLook = defaultLook(breed);
  return [own, ...coatStyles[breed.species].filter((style) => !isCoatStyle(ownLook, style))];
}

// The look for a coat style, keeping the ears and tail already chosen.
export function lookWithCoat(look: Look, style: CoatStyle): Look {
  // A solid style says so explicitly, so it clears a breed's own pattern (a Siamese's points).
  const next: Look = { coat: style.coat, ear: look.ear, tail: look.tail, pattern: style.pattern ?? 'none' };
  if (style.accent) {
    next.accent = style.accent;
  }
  return next;
}

// The breed with a pet's look applied. Anatomy is untouched. Ear and muzzle colors follow the coat
// when it changes. Ears are only changed for dogs, and only to a shape the species offers.
export function resolveBreed(breed: Breed, look: Look | null | undefined): Breed {
  if (!look) {
    return breed;
  }
  const ear = breed.species === 'dog' && earOptions.dog.some((option) => option.id === look.ear) ? look.ear : breed.ear;
  const tail = tailOptions[breed.species].some((option) => option.id === look.tail) ? look.tail : breed.tail;
  const pattern = look.pattern ?? breed.pattern;
  const accent = look.accent ?? breed.accent;
  const patternChanged =
    (pattern ?? 'none') !== (breed.pattern ?? 'none') || (pattern === 'points' && !sameHex(accent, breed.accent));
  const recolored = !sameHex(look.coat, breed.coat) || patternChanged;
  let earColor = breed.earColor;
  let muzzle = breed.muzzle;
  if (recolored) {
    if (pattern === 'points' && accent) {
      earColor = accent;
      muzzle = accent;
    } else {
      earColor = mixHexColor(look.coat, '#000000', 0.22);
      muzzle = mixHexColor(look.coat, '#ffffff', 0.45);
    }
  }
  return {
    ...breed,
    coat: look.coat,
    ear: ear as EarShape,
    tail: tail as TailShape,
    pattern,
    accent,
    earColor,
    muzzle,
  };
}

export function resolveBreedById(id: string, look: Look | null | undefined): Breed | null {
  const breed = byId.get(id);
  return breed ? resolveBreed(breed, look) : null;
}

// True when a coat is dark enough that white whiskers and dark details need to switch.
export function isDarkCoat(coat: string): boolean {
  return luminance(coat) < 0.22;
}

export function dogBreeds(): readonly Breed[] {
  return dogs;
}

export function catBreeds(): readonly Breed[] {
  return cats;
}

export function breedsFor(species: 'dog' | 'cat'): readonly Breed[] {
  return species === 'cat' ? cats : dogs;
}

export function limbSize(species: 'dog' | 'cat'): { legW: number; pawRx: number; pawRy: number } {
  return species === 'cat' ? { legW: 7.4, pawRx: 6, pawRy: 3.8 } : { legW: 10, pawRx: 8, pawRy: 4.8 };
}

export function breedById(id: string): Breed | null {
  return byId.get(id) ?? null;
}

// The cat clip is recorded at this breed pitch, so a rate of 1 plays it as recorded.
export const catClipPitch = 1.5;

export function pitchFor(breed: Breed, growth: number): number {
  return breed.species === 'cat' ? breed.pitch * (1.25 - 0.25 * growth) : breed.pitch * (1.35 - 0.35 * growth);
}

// Playback rate for the recorded clip: breed pitch times the age factor, relative to how the clip was made.
export function voiceRate(breed: Breed, growth: number): number {
  const pitch = pitchFor(breed, growth);
  return breed.species === 'cat' ? pitch / catClipPitch : pitch;
}
