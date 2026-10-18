import type { Breed, TaskType } from './types';

export const sharedTasks: readonly TaskType[] = ['stand', 'sit', 'sleep', 'eat', 'walk', 'jump', 'idle'];

export const dogTasks: readonly TaskType[] = [...sharedTasks, 'pant', 'paw', 'bark', 'fetch'];

export const catTasks: readonly TaskType[] = [...sharedTasks, 'purr', 'groom', 'pounce'];

const dogs: Breed[] = [
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

const cats: Breed[] = [
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

const all = [...dogs, ...cats];
const byId = new Map(all.map((breed) => [breed.id, breed]));

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

export function pitchFor(breed: Breed, growth: number): number {
  return breed.pitch * (1.35 - 0.35 * growth);
}
