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
  themeTags: RunwayThemeId[];
  /** Style bias tags for NPC dress weights. */
  tags: string[];
  colorway: { c: string; d?: string };
  shape: string;
  themeSpecific?: boolean;
  wildcard?: boolean;
};

export type RunwayTrack = {
  id: string;
  title: string;
  /** Static require module id for local seed tracks. */
  asset: number;
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

const versatile: RunwayCostume[] = [
  { id: 'crown', name: 'Crown', slot: 'head', themeTags: ['royal', 'sea', 'winter', 'hero'], tags: ['crown', 'jewel'], colorway: { c: '#F4D35E', d: '#E8B923' }, shape: 'crown' },
  { id: 'goggles', name: 'Goggles', slot: 'head', themeTags: ['space', 'sea', 'winter', 'pirate'], tags: ['goggles', 'sporty'], colorway: { c: '#5AA9E6', d: '#222222' }, shape: 'goggles' },
  { id: 'antennae', name: 'Antennae headband', slot: 'head', themeTags: ['space', 'garden', 'spooky'], tags: ['antennae', 'goofy'], colorway: { c: '#8a5ad6', d: '#ffd34d' }, shape: 'antennae' },
  { id: 'flower-crown', name: 'Flower crown', slot: 'head', themeTags: ['garden', 'beach', 'royal'], tags: ['crown', 'pastel'], colorway: { c: '#FF8CC4', d: '#FFFFFF' }, shape: 'flower-crown' },
  { id: 'top-hat', name: 'Top hat', slot: 'head', themeTags: ['royal', 'spooky', 'rock'], tags: ['hat', 'glam'], colorway: { c: '#26262c', d: '#f4dede' }, shape: 'top' },
  { id: 'bandana', name: 'Head bandana', slot: 'head', themeTags: ['pirate', 'rock', 'west'], tags: ['bandana', 'sporty'], colorway: { c: '#D64545', d: '#FFFFFF' }, shape: 'bandana' },
  { id: 'star-shades', name: 'Star sunglasses', slot: 'face', themeTags: ['rock', 'beach', 'space'], tags: ['glitter', 'glam'], colorway: { c: '#F4D35E', d: '#222222' }, shape: 'star' },
  { id: 'eye-mask', name: 'Eye mask', slot: 'face', themeTags: ['hero', 'spooky', 'royal'], tags: ['cape', 'glam'], colorway: { c: '#2B3A6B', d: '#FFFFFF' }, shape: 'mask' },
  { id: 'mustache', name: 'Mustache', slot: 'face', themeTags: ['west', 'pirate', 'royal'], tags: ['mustache', 'goofy'], colorway: { c: '#3a2a1a' }, shape: 'mustache' },
  { id: 'ruffle', name: 'Ruffle collar', slot: 'neck', themeTags: ['royal', 'pirate', 'spooky'], tags: ['glam', 'jewel'], colorway: { c: '#FFFFFF', d: '#E8B923' }, shape: 'ruffle' },
  { id: 'bow-tie', name: 'Bow tie', slot: 'neck', themeTags: ['royal', 'garden', 'spooky'], tags: ['glam'], colorway: { c: '#D64545', d: '#FFFFFF' }, shape: 'bowtie' },
  { id: 'shell-necklace', name: 'Shell necklace', slot: 'neck', themeTags: ['beach', 'sea'], tags: ['pastel'], colorway: { c: '#F0C94A', d: '#FFFFFF' }, shape: 'shell' },
  { id: 'gold-chain', name: 'Gold chain', slot: 'neck', themeTags: ['rock', 'pirate'], tags: ['jewel', 'glam'], colorway: { c: '#F4D35E' }, shape: 'chain' },
  { id: 'cape', name: 'Cape', slot: 'back', themeTags: ['hero', 'royal', 'spooky'], tags: ['cape', 'glam'], colorway: { c: '#D64545', d: '#F4D35E' }, shape: 'cape' },
  { id: 'sequin-vest', name: 'Sequin vest', slot: 'body', themeTags: ['rock', 'space', 'royal'], tags: ['sequin', 'glam'], colorway: { c: '#8a5ad6', d: '#F4D35E' }, shape: 'vest' },
  { id: 'tutu', name: 'Tutu', slot: 'body', themeTags: ['royal', 'garden', 'spooky'], tags: ['tutu', 'glam', 'pastel'], colorway: { c: '#FF8CC4', d: '#FFFFFF' }, shape: 'tutu' },
  { id: 'leather-jacket', name: 'Leather jacket', slot: 'body', themeTags: ['rock', 'west', 'hero'], tags: ['jacket', 'sporty'], colorway: { c: '#26262c', d: '#D64545' }, shape: 'jacket' },
  { id: 'striped-shirt', name: 'Striped shirt', slot: 'body', themeTags: ['pirate', 'beach'], tags: ['odd'], colorway: { c: '#FFFFFF', d: '#2B3A6B' }, shape: 'sweater' },
  { id: 'wings', name: 'Wings', slot: 'back', themeTags: ['garden', 'spooky', 'royal'], tags: ['glam', 'odd'], colorway: { c: '#BFE9FF', d: '#FFFFFF' }, shape: 'wings' },
  { id: 'jetpack', name: 'Jetpack', slot: 'back', themeTags: ['space', 'hero'], tags: ['sporty', 'odd'], colorway: { c: '#5AA9E6', d: '#FF8CC4' }, shape: 'jetpack' },
  { id: 'glitter-boots', name: 'Glitter boots', slot: 'feet', themeTags: ['rock', 'space', 'royal'], tags: ['glitter', 'boots', 'glam'], colorway: { c: '#8a5ad6', d: '#F4D35E' }, shape: 'boots' },
  { id: 'cowboy-boots', name: 'Cowboy boots', slot: 'feet', themeTags: ['west', 'rock'], tags: ['boots', 'sporty'], colorway: { c: '#C98A66', d: '#3a2a1a' }, shape: 'boots' },
  { id: 'rain-boots', name: 'Rain boots', slot: 'feet', themeTags: ['garden', 'winter', 'sea'], tags: ['rain', 'boots', 'cozy'], colorway: { c: '#2f9e6b', d: '#FFFFFF' }, shape: 'boots' },
];

const themeSpecific: RunwayCostume[] = [
  { id: 'astronaut-helmet', name: 'Astronaut helmet', slot: 'head', themeTags: ['space'], tags: ['sporty'], colorway: { c: '#E8EEF5', d: '#5AA9E6' }, shape: 'helmet', themeSpecific: true },
  { id: 'pirate-hat', name: 'Pirate hat', slot: 'head', themeTags: ['pirate'], tags: ['hat'], colorway: { c: '#26262c', d: '#D64545' }, shape: 'pirate-hat', themeSpecific: true },
  { id: 'pirate-patch', name: 'Eye patch', slot: 'face', themeTags: ['pirate'], tags: ['odd'], colorway: { c: '#26262c' }, shape: 'patch', themeSpecific: true },
  { id: 'mermaid-tail', name: 'Mermaid tail', slot: 'body', themeTags: ['sea'], tags: ['glam', 'sequin'], colorway: { c: '#5AA9E6', d: '#2f9e6b' }, shape: 'tail', themeSpecific: true },
  { id: 'bumblebee', name: 'Bumblebee antennae', slot: 'head', themeTags: ['garden'], tags: ['antennae', 'goofy'], colorway: { c: '#F4D35E', d: '#26262c' }, shape: 'antennae', themeSpecific: true },
  { id: 'lion-mane', name: "Lion's mane", slot: 'head', themeTags: ['safari'], tags: ['odd'], colorway: { c: '#E0A01E', d: '#C98A66' }, shape: 'mane', themeSpecific: true },
  { id: 'cowboy-hat', name: 'Cowboy hat', slot: 'head', themeTags: ['west'], tags: ['hat', 'sporty'], colorway: { c: '#C98A66', d: '#3a2a1a' }, shape: 'cowboy-hat', themeSpecific: true },
  { id: 'wizard-hat', name: 'Wizard hat', slot: 'head', themeTags: ['spooky'], tags: ['hat', 'glam'], colorway: { c: '#2B3A6B', d: '#F4D35E' }, shape: 'wizard', themeSpecific: true },
  { id: 'earmuffs', name: 'Scarf and earmuffs', slot: 'neck', themeTags: ['winter'], tags: ['scarf', 'cozy', 'pastel'], colorway: { c: '#FF8CC4', d: '#FFFFFF' }, shape: 'scarf', themeSpecific: true },
  { id: 'pumpkin-suit', name: 'Pumpkin suit', slot: 'body', themeTags: ['spooky'], tags: ['odd', 'goofy'], colorway: { c: '#E07A2F', d: '#2f9e6b' }, shape: 'pumpkin', themeSpecific: true },
  { id: 'dino-hoodie', name: 'Dinosaur hoodie', slot: 'body', themeTags: ['space', 'sea', 'royal', 'beach', 'winter', 'rock', 'garden', 'spooky', 'west', 'hero', 'pirate', 'safari'], tags: ['odd', 'goofy'], colorway: { c: '#2f9e6b', d: '#FFC93C' }, shape: 'hoodie', wildcard: true },
  { id: 'hot-dog-bun', name: 'Hot dog bun', slot: 'body', themeTags: ['space', 'sea', 'royal', 'beach', 'winter', 'rock', 'garden', 'spooky', 'west', 'hero', 'pirate', 'safari'], tags: ['odd', 'goofy', 'mismatch'], colorway: { c: '#E0A01E', d: '#D64545' }, shape: 'bun', wildcard: true },
];

export const runwayCostumes: RunwayCostume[] = [...themeSpecific, ...versatile];

export const runwayTracks: RunwayTrack[] = [
  { id: 'fashion-show-music', title: 'Fashion Show', asset: require('../../assets/runway-music/absolutesound-fashion-show-music-504647.mp3') },
  { id: 'fashion-vogue', title: 'Fashion Vogue', asset: require('../../assets/runway-music/absolutesound-fashion-show-vogue-504648.mp3') },
  { id: 'runway-flute', title: 'Runway Flute', asset: require('../../assets/runway-music/astronautflute-fashion-runway-music-554673.mp3') },
  { id: 'runway-rebel', title: 'Runway Rebel', asset: require('../../assets/runway-music/bassloom-runway-rebel-553307.mp3') },
  { id: 'fashion-runway', title: 'Fashion Runway', asset: require('../../assets/runway-music/bearstockmusic-fashion-runway-586679.mp3') },
  { id: 'berry-runway', title: 'Berry Runway', asset: require('../../assets/runway-music/berrydeep-fashion-runway-565396.mp3') },
  { id: 'runway-groove', title: 'Runway Groove', asset: require('../../assets/runway-music/echomoodz-runway-groove-246071.mp3') },
  { id: 'runway-instrumental', title: 'Runway Instrumental', asset: require('../../assets/runway-music/maison_brava-runway-instrumental-376958.mp3') },
  { id: 'runway-royalty', title: 'Runway Royalty', asset: require('../../assets/runway-music/maison_brava-runway-royalty-388307.mp3') },
  { id: 'positive-fun', title: 'Positive Fun', asset: require('../../assets/runway-music/musictown-positive-fun-exploration-110144.mp3') },
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

/** Theme-specific, then wildcards, then versatile tagged for the theme. */
export function rackForTheme(themeId: RunwayThemeId): RunwayCostume[] {
  const specific = runwayCostumes.filter((piece) => piece.themeSpecific && piece.themeTags.includes(themeId));
  const wild = runwayCostumes.filter((piece) => piece.wildcard);
  const versatileTagged = versatile.filter((piece) => piece.themeTags.includes(themeId));
  return [...specific, ...wild, ...versatileTagged];
}
