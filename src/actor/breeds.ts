import type { Look } from '../sim/types';
import { breedAttributes } from './breedAttributes';
import { luminance, mixHexColor } from './color';
import type { Breed, EarShape, Species, TailShape, TaskType } from './types';

// Visual and behavior parameters of a breed. Attribute ranges and the blurb come from breedAttributes.
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
    cuteness: 0.6,
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
    cuteness: 0.6,
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
    cuteness: 0.6,
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
    cuteness: 0.6,
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
    cuteness: 0.6,
    behaviors: dogTasks,
  },
];

const catVisuals: BreedVisual[] = [
  {
    id: 'tabby',
    name: 'Tabby',
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
    cuteness: 0.6,
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
    cuteness: 0.6,
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
    cuteness: 0.6,
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
    cuteness: 0.6,
    eyeColor: '#c9b24a',
    pattern: 'stripes',
    behaviors: catTasks,
  },
  {
    id: 'black',
    name: 'Black cat',
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
    cuteness: 0.6,
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

export const coatPalette: Record<Species, readonly string[]> = {
  dog: ['#d9a441', '#e08a3c', '#6b3f2a', '#8a97a6', '#d8c19a', '#2b2b33', '#f1ece4', '#a8572f'],
  cat: ['#b98a58', '#eadbc2', '#f1ece4', '#8b6a4a', '#2b2b33', '#d9822b', '#8a97a6', '#c7b299'],
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
  return { coat: breed.coat, ear: breed.ear, tail: breed.tail };
}

// The swatches for a breed: its own coat first, then the species palette without duplicates.
export function coatSwatchesFor(breed: Breed): string[] {
  const own = breed.coat.toLowerCase();
  return [breed.coat, ...coatPalette[breed.species].filter((color) => color.toLowerCase() !== own)];
}

// The breed with a pet's look applied. Anatomy is untouched. Ear and muzzle colors follow the coat
// when it changes. Ears are only changed for dogs, and only to a shape the species offers.
export function resolveBreed(breed: Breed, look: Look | null | undefined): Breed {
  if (!look) {
    return breed;
  }
  const recolored = look.coat.toLowerCase() !== breed.coat.toLowerCase();
  const ear = breed.species === 'dog' && earOptions.dog.some((option) => option.id === look.ear) ? look.ear : breed.ear;
  const tail = tailOptions[breed.species].some((option) => option.id === look.tail) ? look.tail : breed.tail;
  return {
    ...breed,
    coat: look.coat,
    ear: ear as EarShape,
    tail: tail as TailShape,
    earColor: recolored && breed.pattern !== 'points' ? mixHexColor(look.coat, '#000000', 0.22) : breed.earColor,
    muzzle: recolored && breed.pattern !== 'points' ? mixHexColor(look.coat, '#ffffff', 0.45) : breed.muzzle,
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
