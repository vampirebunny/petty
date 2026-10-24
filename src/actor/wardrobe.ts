import type { OutfitSlot } from '../sim/types';

export type PatternId = 'stripes' | 'gingham' | 'plaid' | 'daisies' | 'stars' | 'rainbow';

export type CollarAccent = 'tag' | 'bell' | 'studs';

export type Colorway = { c: string; d?: string; pattern?: PatternId; accent?: CollarAccent };

export type NeckwearShape = 'collar' | 'bandana' | 'scarf' | 'bow' | 'bowtie';
export type JacketShape = 'puffer' | 'sweater' | 'hoodie' | 'raincoat' | 'vest';
export type ShapeId = NeckwearShape | JacketShape | string;

export type WearItem = {
  id: string;
  slot: OutfitSlot;
  label: string;
  shape: ShapeId;
  colorway: Colorway;
  // Parts that take the pattern. Omitted means every patterned part of the shape.
  patternParts?: readonly string[];
  // Replaces the lens color from glassesStyles. Alpha and glare stay on the shape.
  lensTint?: string;
};

function wear(
  slot: OutfitSlot,
  id: string,
  label: string,
  shape: ShapeId,
  c: string,
  d?: string,
  pattern?: PatternId,
  patternParts?: readonly string[],
  accent?: CollarAccent,
): WearItem {
  const colorway: Colorway = d ? { c, d } : { c };
  if (pattern) {
    colorway.pattern = pattern;
  }
  if (accent) {
    colorway.accent = accent;
  }
  return patternParts ? { id, slot, label, shape, colorway, patternParts } : { id, slot, label, shape, colorway };
}

export function neckBackMode(shape: string): 'band' | 'knot' {
  return shape === 'bowtie' ? 'band' : 'knot';
}

export const wardrobe: Record<OutfitSlot, { label: string; items: WearItem[] }> = {
  hat: {
    label: 'Hat',
    items: [
      wear('hat', 'beanie', 'Green Beanie', 'beanie', '#2f9e6b'),
      wear('hat', 'party', 'Party Hat', 'party', '#8a5ad6', '#ffd34d'),
      wear('hat', 'top', 'Top Hat', 'top', '#26262c', '#f4dede'),
      wear('hat', 'beanie-pink', 'Pink Beanie', 'beanie', '#FF8CC4'),
      wear('hat', 'beanie-stripe', 'Stripe Beanie', 'beanie', '#2B3A6B', '#FFFFFF', 'stripes', ['crown']),
      wear('hat', 'cap', 'Red Ball Cap', 'cap', '#D64545', '#B23434'),
      wear('hat', 'cap-sky', 'Sky Ball Cap', 'cap', '#5AA9E6', '#3F8FCC'),
      wear('hat', 'bucket', 'Sunny Bucket Hat', 'bucket', '#FFC93C', '#E0A01E'),
      wear('hat', 'bucket-daisy', 'Daisy Bucket Hat', 'bucket', '#BFE9FF', '#FFFFFF', 'daisies', ['crown']),
      wear('hat', 'beret', 'Rose Beret', 'beret', '#E85A8C'),
      wear('hat', 'top-velvet', 'Midnight Top Hat', 'top', '#2B1F4A', '#FFC93C', 'stars', ['band']),
      wear('hat', 'crown', 'Golden Crown', 'crown', '#FFC93C', '#FF5FA2'),
    ],
  },
  glasses: {
    label: 'Glasses',
    items: [
      wear('glasses', 'classic', 'Classic Shades', 'classic', '#1b1b22'),
      wear('glasses', 'square', 'Round Gold Specs', 'square', '#e0b43c'),
      wear('glasses', 'red-rim', 'Red Rims', 'red-rim', '#d64545'),
      wear('glasses', 'heart', 'Heart Shades', 'heart', '#FF5FA2', '#FFB3D6'),
      wear('glasses', 'heart-sky', 'Sky Heart Shades', 'heart', '#5AA9E6', '#BFE3FF'),
      wear('glasses', 'star', 'Star Shades', 'star', '#FFC93C', '#FFE38F'),
    ],
  },
  neckwear: {
    label: 'Neckwear',
    items: [
      wear('neckwear', 'collar', 'Red Collar', 'collar', '#d64545', '#f0c94a'),
      wear('neckwear', 'bandana', 'Blue Bandana', 'bandana', '#3b6fc4'),
      wear('neckwear', 'scarf', 'Sunny Scarf', 'scarf', '#e8c53a'),
      wear('neckwear', 'bell', 'Bell Collar', 'collar', '#6b3a2a', '#f0c94a', undefined, undefined, 'bell'),
      wear('neckwear', 'bow', 'Pink Bow', 'bow', '#e85a8c'),
      wear('neckwear', 'gold', 'Gold Stud Collar', 'collar', '#e0b43c', '#fff3c4', undefined, undefined, 'studs'),
      wear('neckwear', 'bandana-cherry', 'Cherry Bandana', 'bandana', '#E0526A'),
      wear('neckwear', 'scarf-stripe', 'Candy Stripe Scarf', 'scarf', '#FF8CC4', '#FFFFFF', 'stripes', ['band', 'tail']),
      wear('neckwear', 'bandana-gingham', 'Picnic Bandana', 'bandana', '#E0526A', '#FFFFFF', 'gingham', ['cloth']),
      wear('neckwear', 'bowtie', 'Navy Bow Tie', 'bowtie', '#2B3A6B', '#F0C94A'),
      wear('neckwear', 'bowtie-plaid', 'Plaid Bow Tie', 'bowtie', '#C84A4A', '#2B3A6B', 'plaid', ['wing']),
    ],
  },
  jacket: {
    label: 'Jacket',
    items: [
      wear('jacket', 'sweater', 'Cherry Sweater', 'sweater', '#d64545', '#f4dede'),
      wear('jacket', 'rain', 'Yellow Raincoat', 'raincoat', '#f2c230'),
      wear('jacket', 'vest', 'Quilted Vest', 'vest', '#3b6fc4'),
      wear('jacket', 'puffer', 'Orange Puffer', 'puffer', '#f28c28', '#ffe0c2'),
      wear('jacket', 'hoodie', 'Cozy Hoodie', 'hoodie', '#FF9FCB', '#8A5AD6'),
      wear('jacket', 'puffer-mint', 'Mint Puffer', 'puffer', '#7FE3BA', '#CFFBE8'),
      wear('jacket', 'sweater-lilac', 'Lilac Sweater', 'sweater', '#B9A2F5', '#F1EBFF'),
      wear('jacket', 'puffer-rainbow', 'Rainbow Puffer', 'puffer', '#FF8CC4', undefined, 'rainbow', ['body']),
    ],
  },
  boots: {
    label: 'Boots',
    items: [
      wear('boots', 'red', 'Red Boots', 'red', '#d64545'),
      wear('boots', 'rain', 'Yellow Rain Boots', 'rain', '#f2c230', '#f7f7f7'),
      wear('boots', 'sneaker', 'Classic Sneakers', 'sneaker', '#f4f4f4', '#d64545'),
      wear('boots', 'rain-blue', 'Puddle Blue Boots', 'rain', '#5AA9E6'),
      wear('boots', 'sneaker-pink', 'Bubblegum Sneakers', 'sneaker', '#FFC2E0', '#8A5AD6'),
      wear('boots', 'sneaker-gold', 'Gold High-Tops', 'sneaker', '#E0B43C', '#FFF3C4'),
    ],
  },
};

export const outfitSlots = Object.keys(wardrobe) as OutfitSlot[];

let remoteWearLookup: ((slot: OutfitSlot, id: string) => WearItem | null) | null = null;

export function bindRemoteWear(lookup: (slot: OutfitSlot, id: string) => WearItem | null): void {
  remoteWearLookup = lookup;
}

export function wearItem(slot: OutfitSlot, id: string | undefined): WearItem | null {
  if (!id || id === 'none') {
    return null;
  }
  const lookup = slot === 'glasses' && id === 'round' ? 'square' : id;
  const item = wardrobe[slot].items.find((entry) => entry.id === lookup);
  if (item?.colorway.c) {
    return item;
  }
  return remoteWearLookup?.(slot, lookup) ?? null;
}

export function jacketHasSleeves(item: { shape: string } | string): boolean {
  const shape = typeof item === 'string' ? wearItem('jacket', item)?.shape : item.shape;
  return shape === 'sweater' || shape === 'raincoat' || shape === 'hoodie';
}

export const DEF_SCHEMA_MAX = 1;

export const KNOWN_PATTERNS: readonly PatternId[] = ['stripes', 'gingham', 'plaid', 'daisies', 'stars', 'rainbow'];

export const KNOWN_SHAPES: Record<OutfitSlot, readonly string[]> = {
  hat: ['beanie', 'party', 'top', 'cap', 'bucket', 'beret', 'crown'],
  glasses: ['classic', 'square', 'red-rim', 'heart', 'star'],
  neckwear: ['collar', 'bandana', 'scarf', 'bow', 'bowtie'],
  jacket: ['puffer', 'sweater', 'hoodie', 'raincoat', 'vest'],
  boots: ['red', 'rain', 'sneaker'],
};

// Parts drawItemPattern can clip into. An empty list means this shape has no pattern.
export const PATTERN_PARTS: Record<string, readonly string[]> = {
  beanie: ['crown'],
  party: [],
  top: ['band'],
  cap: ['crown'],
  bucket: ['crown'],
  beret: ['crown'],
  crown: [],
  classic: [],
  square: [],
  'red-rim': [],
  heart: [],
  star: [],
  collar: [],
  bandana: ['cloth'],
  scarf: ['band', 'tail'],
  bow: [],
  bowtie: ['wing'],
  puffer: ['body'],
  sweater: ['body'],
  hoodie: ['body'],
  raincoat: ['body'],
  vest: ['body'],
  red: [],
  rain: [],
  sneaker: [],
};
