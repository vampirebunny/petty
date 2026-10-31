import type { RunwayCostumeSlot } from './types';

export type RunwayThemeId =
  | 'space'
  | 'sea'
  | 'royal'
  | 'beach'
  | 'winter'
  | 'rock'
  | 'garden'
  | 'spooky'
  | 'west'
  | 'hero'
  | 'pirate'
  | 'safari';

export type RunwayTheme = {
  id: RunwayThemeId;
  name: string;
  sort: number;
};

export type RunwayCostume = {
  id: string;
  name: string;
  slot: RunwayCostumeSlot;
  /** Style bias tags for NPC dress weights. */
  tags: string[];
  colorway: { c: string; d?: string };
  shape: string;
};

export type RunwayTrack = {
  id: string;
  title: string;
  /** Object name in the public `catwalk-music` Storage bucket (and on disk under that folder). */
  fileName: string;
};

export const runwayThemes: RunwayTheme[] = [
  { id: 'space', name: 'Space Travelers', sort: 1 },
  { id: 'sea', name: 'Under the Sea', sort: 2 },
  { id: 'royal', name: 'Royal Ball', sort: 3 },
  { id: 'beach', name: 'Beach Day', sort: 4 },
  { id: 'winter', name: 'Winter Wonderland', sort: 5 },
  { id: 'rock', name: 'Rock Star', sort: 6 },
  { id: 'garden', name: 'Garden Party', sort: 7 },
  { id: 'spooky', name: 'Spooky Night', sort: 8 },
  { id: 'west', name: 'Wild West', sort: 9 },
  { id: 'hero', name: 'Superhero City', sort: 10 },
  { id: 'pirate', name: 'Pirate Cove', sort: 11 },
  { id: 'safari', name: 'Safari', sort: 12 },
];

/** Shared 23-piece rack for every theme (assets/runway-costumes/catalog.json). */
export const runwayCostumes: RunwayCostume[] = [
  { id: 'crown', name: 'Crown', slot: 'hat', tags: ['crown', 'jewel', 'glam'], colorway: { c: '#FFD45E', d: '#E784B3' }, shape: 'crown' },
  { id: 'goggles', name: 'Goggles', slot: 'hat', tags: ['goggles', 'sporty'], colorway: { c: '#C9B8F5', d: '#B9E2FF' }, shape: 'goggles' },
  { id: 'antennae', name: 'Antennae Headband', slot: 'hat', tags: ['antennae', 'goofy'], colorway: { c: '#E784B3', d: '#FFD45E' }, shape: 'antennae' },
  { id: 'flowercrown', name: 'Flower Crown', slot: 'hat', tags: ['crown', 'pastel', 'glam'], colorway: { c: '#F7A9C9', d: '#7FD3A0' }, shape: 'flower-crown' },
  { id: 'tophat', name: 'Showman Top Hat', slot: 'hat', tags: ['hat', 'glam'], colorway: { c: '#7A6AB8', d: '#E784B3' }, shape: 'top' },
  { id: 'bandana', name: 'Head Bandana', slot: 'hat', tags: ['bandana', 'sporty'], colorway: { c: '#F7A9C9', d: '#E784B3' }, shape: 'bandana' },
  { id: 'starglasses', name: 'Star Sunglasses', slot: 'glasses', tags: ['glitter', 'glam'], colorway: { c: '#FFD45E', d: '#9C84E8' }, shape: 'star' },
  { id: 'mask', name: 'Eye Mask', slot: 'glasses', tags: ['cape', 'glam'], colorway: { c: '#9C84E8', d: '#F5F6FB' }, shape: 'mask' },
  { id: 'mustache', name: 'Mustache', slot: 'glasses', tags: ['mustache', 'goofy'], colorway: { c: '#8A5A3C' }, shape: 'mustache' },
  { id: 'ruffle', name: 'Ruffle Collar', slot: 'neckwear', tags: ['glam', 'jewel'], colorway: { c: '#FFFFFF', d: '#E9E3F5' }, shape: 'ruffle' },
  { id: 'bowtie', name: 'Bow Tie', slot: 'neckwear', tags: ['glam'], colorway: { c: '#E784B3', d: '#D1689E' }, shape: 'bowtie' },
  { id: 'shells', name: 'Shell Necklace', slot: 'neckwear', tags: ['pastel'], colorway: { c: '#FFD3B5', d: '#F7A9C9' }, shape: 'shell' },
  { id: 'chain', name: 'Gold Chain', slot: 'neckwear', tags: ['jewel', 'glam'], colorway: { c: '#FFD45E' }, shape: 'chain' },
  { id: 'vest', name: 'Sequin Vest', slot: 'jacket', tags: ['sequin', 'glam'], colorway: { c: '#C9B8F5', d: '#FFD45E' }, shape: 'vest' },
  { id: 'tutu', name: 'Tutu', slot: 'jacket', tags: ['tutu', 'glam', 'pastel'], colorway: { c: '#FFC9E2', d: '#E784B3' }, shape: 'tutu' },
  { id: 'jacket', name: 'Leather Jacket', slot: 'jacket', tags: ['jacket', 'sporty'], colorway: { c: '#4A3E73', d: '#FFD45E' }, shape: 'jacket' },
  { id: 'stripes', name: 'Striped Shirt', slot: 'jacket', tags: ['odd'], colorway: { c: '#FFFFFF', d: '#7CC4F5' }, shape: 'sweater' },
  { id: 'cape', name: 'Cape', slot: 'back', tags: ['cape', 'glam'], colorway: { c: '#E784B3', d: '#FFD45E' }, shape: 'cape' },
  { id: 'wings', name: 'Wings', slot: 'back', tags: ['glam', 'odd'], colorway: { c: '#EAF6FF', d: '#C9B8F5' }, shape: 'wings' },
  { id: 'jetpack', name: 'Jetpack', slot: 'back', tags: ['sporty', 'odd'], colorway: { c: '#C9B8F5', d: '#FFAD7A' }, shape: 'jetpack' },
  { id: 'glitterboots', name: 'Glitter Boots', slot: 'boots', tags: ['glitter', 'boots', 'glam'], colorway: { c: '#9C84E8', d: '#FFE9A8' }, shape: 'boots' },
  { id: 'cowboyboots', name: 'Cowboy Boots', slot: 'boots', tags: ['boots', 'sporty'], colorway: { c: '#C98A66', d: '#FFD45E' }, shape: 'boots' },
  { id: 'rainboots', name: 'Rain Boots', slot: 'boots', tags: ['rain', 'boots', 'cozy'], colorway: { c: '#FFD45E', d: '#7CC4F5' }, shape: 'boots' },
];

export const runwayTracks: RunwayTrack[] = [
  { id: 'fashion-show-music', title: 'Fashion Show', fileName: 'absolutesound-fashion-show-music-504647.mp3' },
  { id: 'fashion-vogue', title: 'Fashion Vogue', fileName: 'absolutesound-fashion-show-vogue-504648.mp3' },
  { id: 'runway-flute', title: 'Runway Flute', fileName: 'astronautflute-fashion-runway-music-554673.mp3' },
  { id: 'runway-rebel', title: 'Runway Rebel', fileName: 'bassloom-runway-rebel-553307.mp3' },
  { id: 'fashion-runway', title: 'Fashion Runway', fileName: 'bearstockmusic-fashion-runway-586679.mp3' },
  { id: 'berry-runway', title: 'Berry Runway', fileName: 'berrydeep-fashion-runway-565396.mp3' },
  { id: 'runway-groove', title: 'Runway Groove', fileName: 'echomoodz-runway-groove-246071.mp3' },
  { id: 'runway-instrumental', title: 'Runway Instrumental', fileName: 'maison_brava-runway-instrumental-376958.mp3' },
  { id: 'runway-royalty', title: 'Runway Royalty', fileName: 'maison_brava-runway-royalty-388307.mp3' },
  { id: 'positive-fun', title: 'Positive Fun', fileName: 'musictown-positive-fun-exploration-110144.mp3' },
];

export function themeById(id: string): RunwayTheme | undefined {
  return runwayThemes.find((theme) => theme.id === id);
}

export function costumeById(id: string): RunwayCostume | undefined {
  return runwayCostumes.find((piece) => piece.id === id);
}

export function trackById(id: string): RunwayTrack | undefined {
  return runwayTracks.find((track) => track.id === id);
}

/** Full shared costume catalog (every theme uses the same 23 pieces). */
export function allCostumes(): RunwayCostume[] {
  return [...runwayCostumes];
}

/** @deprecated Prefer allCostumes — themes no longer filter the rack. */
export function rackForTheme(_themeId: RunwayThemeId): RunwayCostume[] {
  return allCostumes();
}
