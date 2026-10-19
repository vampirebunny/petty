import type { Look } from '../sim/types';
import { breedAttributes } from './breedAttributes';
import { luminance, mixHexColor } from './color';
import type { Breed, MarkingRegion, Pattern, Species, TaskType } from './types';

// Visual and behavior parameters of a breed. Attribute ranges and the blurb come from data below.
type BreedVisual = Omit<Breed, 'attributeRanges' | 'blurb'>;

function withAttributes(breed: BreedVisual): Breed {
  const data = breedAttributes[breed.id];
  if (!data) {
    throw new Error(`Breed "${breed.id}" has no attribute ranges.`);
  }
  return { ...breed, attributeRanges: data.ranges, blurb: data.blurb };
}

export const sharedTasks: readonly TaskType[] = ['stand', 'sit', 'sleep', 'eat', 'walk', 'jump', 'idle'];

export const dogTasks: readonly TaskType[] = [...sharedTasks, 'pant', 'paw', 'bark', 'fetch'];

export const catTasks: readonly TaskType[] = [...sharedTasks, 'purr', 'groom', 'pounce'];

const white = '#f7f4ee';
const ink = '#241d19';
// A pug's mask is a soft warm brown, not black, so the face stays readable and friendly.
const pugMask = '#8a7461';

const locked = (name: string, shape: MarkingRegion['shape'], where: MarkingRegion['where'], color: string): MarkingRegion => ({
  name,
  shape,
  where,
  color: { mode: 'locked', color },
});
const tint = (name: string, shape: MarkingRegion['shape'], where: MarkingRegion['where'], amount: number): MarkingRegion => ({
  name,
  shape,
  where,
  color: { mode: 'tint', amount },
});
const shade = (name: string, shape: MarkingRegion['shape'], where: MarkingRegion['where'], amount: number): MarkingRegion => ({
  name,
  shape,
  where,
  color: { mode: 'shade', amount },
});

// Tabby and bicolor regions are shared by the breeds that allow those patterns.
const tabbyRegions: MarkingRegion[] = [
  { ...shade('back', 'tabbyBack', 'body', 0.5), when: 'stripes' },
  { ...shade('forehead', 'tabbyM', 'head', 0.5), when: 'stripes' },
  { ...shade('cheeks', 'cheekBars', 'head', 0.5), when: 'stripes' },
];
const bicolorRegions: MarkingRegion[] = [
  { ...locked('blaze', 'blaze', 'head', white), when: 'bicolor' },
  { ...locked('chest', 'chest', 'body', white), when: 'bicolor' },
  { ...locked('belly', 'belly', 'body', white), when: 'bicolor' },
  { ...locked('socks', 'socks', 'body', white), when: 'bicolor' },
];

// Every breed declares its silhouette, its face and its marking regions. The renderer only reads this data.
const dogVisuals: BreedVisual[] = [
  {
    id: 'retriever',
    name: 'Retriever',
    species: 'dog',
    bodyLen: 1.05,
    bodyH: 1,
    legLen: 1,
    head: 1.05,
    snout: 1,
    earSize: 0.85,
    earType: 'softFlop',
    skull: 'broad',
    stop: 0.45,
    tailType: 'plume',
    ruff: 'none',
    texture: 'feathered',
    noseSize: 1.05,
    muzzleWidth: 1.1,
    eyeShape: 'round',
    eyeSpacing: 1,
    // Solid base. Ear, leg, tail and chest feathering is a lighter tint of it.
    markings: [tint('feathering', 'feathering', 'body', 0.2), tint('chest', 'chest', 'body', 0.2)],
    patterns: ['none', 'stripes', 'points'],
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
    bodyLen: 1.02,
    bodyH: 0.92,
    legLen: 0.42,
    head: 1.15,
    snout: 0.8,
    earSize: 1.3,
    earType: 'bat',
    skull: 'fox',
    stop: 0.35,
    tailType: 'fluffyRump',
    ruff: 'none',
    texture: 'fluffyRump',
    noseSize: 0.9,
    muzzleWidth: 0.9,
    eyeShape: 'round',
    eyeSpacing: 1,
    // White blaze, muzzle, bib and socks are locked and ignore the user palette.
    markings: [
      locked('blaze', 'blaze', 'head', white),
      locked('muzzle', 'muzzle', 'head', white),
      locked('bib', 'chest', 'body', white),
      locked('socks', 'socks', 'body', white),
    ],
    patterns: ['none'],
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
    bodyLen: 1.65,
    bodyH: 0.62,
    legLen: 0.34,
    head: 0.78,
    snout: 1.5,
    earSize: 1,
    earType: 'longDrape',
    skull: 'long',
    stop: 0.2,
    tailType: 'thinTaper',
    ruff: 'none',
    texture: 'smooth',
    noseSize: 0.8,
    muzzleWidth: 0.7,
    eyeShape: 'round',
    eyeSpacing: 1.05,
    // Tan points follow the palette as a lighter tint of the base.
    markings: [
      tint('browDots', 'browDots', 'head', 0.4),
      tint('muzzle', 'muzzle', 'head', 0.4),
      tint('chest', 'chest', 'body', 0.4),
      tint('lowerLegs', 'lowerLegs', 'body', 0.4),
    ],
    patterns: ['none', 'stripes'],
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
    bodyH: 0.92,
    legLen: 1.12,
    head: 0.9,
    snout: 1.15,
    earSize: 1.1,
    earType: 'erectTall',
    skull: 'wedge',
    stop: 0.12,
    tailType: 'sickleBushy',
    ruff: 'none',
    texture: 'ruff',
    noseSize: 0.95,
    muzzleWidth: 0.85,
    eyeShape: 'almond',
    eyeSpacing: 0.8,
    // White mask, chest and belly are locked. The dark cap and brow spots are a darker shade of the base.
    markings: [
      shade('cap', 'cap', 'head', 0.3),
      locked('mask', 'faceMask', 'head', white),
      shade('browSpots', 'browDots', 'head', 0.45),
      locked('chest', 'chest', 'body', white),
      locked('belly', 'belly', 'body', white),
    ],
    patterns: ['none'],
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
    bodyLen: 0.75,
    bodyH: 1.05,
    legLen: 0.55,
    head: 1.35,
    snout: 0.12,
    earSize: 0.55,
    earType: 'button',
    skull: 'dome',
    stop: 0.95,
    tailType: 'doubleCurl',
    ruff: 'none',
    texture: 'smooth',
    noseSize: 1.1,
    muzzleWidth: 1.25,
    eyeShape: 'bigRound',
    eyeSpacing: 1.25,
    // Black mask (muzzle and around the eyes), black ears and forehead wrinkles are locked.
    markings: [
      locked('mask', 'blackMask', 'head', pugMask),
      locked('muzzle', 'muzzle', 'head', pugMask),
      locked('ears', 'ears', 'head', pugMask),
      locked('wrinkles', 'wrinkles', 'head', '#4a3a31'),
    ],
    patterns: ['none'],
    coat: '#d8c19a',
    earColor: pugMask,
    muzzle: pugMask,
    pitch: 1.4,
    size: 1,
    cuteness: 1,
    behaviors: dogTasks,
  },
];

const catVisuals: BreedVisual[] = [
  {
    id: 'domesticShorthair',
    name: 'Domestic Shorthair',
    species: 'cat',
    bodyLen: 0.95,
    bodyH: 0.72,
    legLen: 0.78,
    head: 0.95,
    snout: 0.3,
    earSize: 1,
    earType: 'standard',
    skull: 'round',
    stop: 0.4,
    tailType: 'catLong',
    texture: 'smooth',
    ruff: 'none',
    noseSize: 0.8,
    muzzleWidth: 0.8,
    eyeShape: 'round',
    eyeSpacing: 1,
    // Tabby: back stripes, forehead "M" and cheek bars, all derived from the user color. Solid draws none.
    // Bicolor: white face blaze, chest, belly and socks, locked.
    markings: [...tabbyRegions, ...bicolorRegions],
    patterns: ['none', 'stripes', 'bicolor'],
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
    bodyLen: 1.12,
    bodyH: 0.52,
    legLen: 0.98,
    head: 0.8,
    snout: 0.5,
    earSize: 1.4,
    earType: 'wedgeLarge',
    skull: 'wedge',
    stop: 0.15,
    tailType: 'catThin',
    texture: 'smooth',
    ruff: 'none',
    noseSize: 0.7,
    muzzleWidth: 0.65,
    eyeShape: 'slanted',
    eyeSpacing: 0.95,
    // The user color fills the points (mask, ears, legs, tail). The body is a pale tint of it, derived.
    baseRule: { mode: 'tint', amount: 0.78 },
    markings: [
      { name: 'mask', shape: 'blackMask', where: 'head', color: { mode: 'base' } },
      { name: 'muzzle', shape: 'muzzle', where: 'head', color: { mode: 'base' } },
      { name: 'ears', shape: 'ears', where: 'head', color: { mode: 'base' } },
      { name: 'legs', shape: 'legs', where: 'body', color: { mode: 'base' } },
      { name: 'tail', shape: 'tail', where: 'body', color: { mode: 'base' } },
    ],
    patterns: ['none'],
    coat: '#5b4636',
    earColor: '#5b4636',
    muzzle: '#5b4636',
    pitch: 1.75,
    size: 0.97,
    cuteness: 1,
    eyeColor: '#5aa7d8',
    pattern: 'none',
    behaviors: catTasks,
  },
  {
    id: 'persian',
    name: 'Persian',
    species: 'cat',
    bodyLen: 0.85,
    bodyH: 0.98,
    legLen: 0.5,
    head: 1.25,
    snout: 0.03,
    earSize: 0.65,
    earType: 'smallLow',
    skull: 'flat',
    stop: 0.9,
    tailType: 'catPlume',
    texture: 'longCoat',
    ruff: 'neck',
    noseSize: 0.7,
    muzzleWidth: 1,
    eyeShape: 'bigRound',
    eyeSize: 1.3,
    eyeSpacing: 1.15,
    markings: [tint('fringe', 'feathering', 'body', 0.22), tint('bib', 'chest', 'body', 0.25)],
    patterns: ['none', 'points'],
    coat: '#f1ece4',
    earColor: '#d9cfc0',
    muzzle: '#e3d9ca',
    pitch: 1.5,
    size: 0.95,
    cuteness: 1,
    eyeColor: '#d9822b',
    pattern: 'none',
    behaviors: catTasks,
  },
  {
    id: 'maineCoon',
    name: 'Maine Coon',
    species: 'cat',
    bodyLen: 1.35,
    bodyH: 0.95,
    legLen: 0.92,
    head: 1.1,
    snout: 0.55,
    earSize: 1.2,
    earType: 'tufted',
    skull: 'square',
    stop: 0.3,
    tailType: 'catBushy',
    texture: 'smooth',
    ruff: 'chest',
    noseSize: 0.85,
    muzzleWidth: 1.1,
    eyeShape: 'almond',
    eyeSpacing: 1,
    markings: [...tabbyRegions, shade('rings', 'tailRings', 'body', 0.5)],
    patterns: ['none', 'stripes'],
    coat: '#8b6a4a',
    earColor: '#5f4630',
    muzzle: '#d9c4a5',
    pitch: 1.3,
    size: 1.25,
    cuteness: 1,
    eyeColor: '#c9b24a',
    pattern: 'stripes',
    behaviors: catTasks,
  },
  {
    id: 'scottishFold',
    name: 'Scottish Fold',
    species: 'cat',
    bodyLen: 0.92,
    bodyH: 0.78,
    legLen: 0.72,
    head: 1.15,
    snout: 0.2,
    earSize: 0.8,
    earType: 'folded',
    skull: 'round',
    stop: 0.5,
    tailType: 'catLong',
    texture: 'smooth',
    ruff: 'none',
    noseSize: 0.8,
    muzzleWidth: 0.85,
    eyeShape: 'bigRound',
    eyeSize: 1.1,
    eyeSpacing: 1.05,
    // Any coat color. Tabby and bicolor are allowed patterns.
    markings: [...tabbyRegions, ...bicolorRegions],
    patterns: ['none', 'stripes', 'bicolor'],
    coat: '#9aa0ab',
    earColor: '#7c828d',
    muzzle: '#d9dce2',
    pitch: 1.65,
    size: 0.95,
    cuteness: 1,
    eyeColor: '#e0a030',
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
const bicolor = (id: string, label: string, coat: string): CoatStyle => ({ id, label, coat, pattern: 'bicolor' });
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
    bicolor('tuxedo', 'Tuxedo', '#2b2b33'),
    bicolor('white-ginger', 'Ginger and white', '#d9822b'),
    bicolor('white-gray', 'Gray and white', '#8a97a6'),
  ],
};

// Eye colors a look can pick for breeds whose eyes are not locked.
export const eyeColorOptions: readonly { id: string; label: string; color: string }[] = [
  { id: 'green', label: 'Green', color: '#79bd5a' },
  { id: 'gold', label: 'Gold', color: '#c9b24a' },
  { id: 'amber', label: 'Amber', color: '#e0a030' },
  { id: 'blue', label: 'Blue', color: '#5aa7d8' },
  { id: 'copper', label: 'Copper', color: '#d9822b' },
];

// Eye colors offered for a breed: none when its eyes are locked or it has no eye color of its own (dogs).
export function eyeColorsFor(breed: Breed): readonly { id: string; label: string; color: string }[] {
  return breed.eyeColor && !breed.eyeColorLocked ? eyeColorOptions : [];
}

// The breed's own look, the starting point of the customize step.
export function defaultLook(breed: Breed): Look {
  const look: Look = { coat: breed.coat };
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
  // Only the pattern variants the breed allows are offered (a husky's mask would clash with stripes).
  return [
    own,
    ...coatStyles[breed.species].filter(
      (style) => !isCoatStyle(ownLook, style) && breed.patterns.includes(style.pattern ?? 'none'),
    ),
  ];
}

// The look for a coat style, keeping the eye color already chosen.
export function lookWithCoat(look: Look, style: CoatStyle): Look {
  // A solid style says so explicitly, so it clears a breed's own pattern (a Siamese's points).
  const next: Look = { coat: style.coat, pattern: style.pattern ?? 'none' };
  if (look.eyeColor) {
    next.eyeColor = look.eyeColor;
  }
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
  // A pattern the breed does not allow snaps back to the breed's own. Ears and tails are never in the look.
  const wanted = look.pattern ?? breed.pattern;
  const pattern = wanted == null || wanted === breed.pattern || breed.patterns.includes(wanted) ? wanted : breed.pattern;
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
    eyeColor: breed.eyeColorLocked ? breed.eyeColor : look.eyeColor ?? breed.eyeColor,
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
