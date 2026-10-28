import type { CollarAccent, PatternId } from '../../src/actor/wardrobe';
import type { Swatch } from './palette';

export type Tier = 'common' | 'uncommon' | 'rare' | 'limited' | 'exclusive';

export type Theme = {
  id: string; // slug, part of every item id. Never rename once published.
  name: string; // shown in item labels: "<name> <Shape>"
  main: Swatch; // biggest area: crown, body, shaft, cloth
  accent: Swatch; // second color: pom, pocket, sneaker stripe, pattern's second color
  trim: Swatch; // edges: cuff, rib, brim, collar, sole
  detail: Swatch; // small bits: laces, charm, knot, lining
  // One pattern per item, on the hero part only. Colors default to main + accent.
  pattern?: { id: PatternId; c?: Swatch; d?: Swatch };
  // Puffer baffles. 'blocks' alternates main/accent; a list cycles through those swatches.
  baffles?: 'blocks' | Swatch[];
  collarAccent?: CollarAccent;
  tier?: Tier; // overrides the automatic tier
  season?: 'spring' | 'summer' | 'autumn' | 'winter';
  collection?: string; // drop name, for the shop
  // Curation. Shapes listed in skip are never generated for this theme.
  skip?: string[];
};

// Launch collection. Only the six patterns the renderer already has.
export const THEMES: Theme[] = [
  {
    id: 'strawberry-milk',
    name: 'Strawberry Milk',
    main: 'strawberry',
    accent: 'cream',
    trim: 'berry',
    detail: 'mint',
    collarAccent: 'tag',
    baffles: 'blocks',
    collection: 'evergreen',
    skip: ['top'],
  },
  {
    id: 'mint-choc',
    name: 'Mint Choc',
    main: 'mint',
    accent: 'cocoa',
    trim: 'cocoa',
    detail: 'cream',
    collarAccent: 'bell',
    collection: 'evergreen',
  },
  {
    id: 'lemon-drop',
    name: 'Lemon Drop',
    main: 'butter',
    accent: 'sky',
    trim: 'sunflower',
    detail: 'cornflower',
    collarAccent: 'tag',
    collection: 'evergreen',
    skip: ['top'],
  },
  {
    id: 'lavender-fog',
    name: 'Lavender Fog',
    main: 'lilac',
    accent: 'lavender',
    trim: 'grape',
    detail: 'butter',
    collarAccent: 'studs',
    baffles: ['lilac', 'periwinkle', 'lavender'],
    collection: 'evergreen',
  },
  {
    id: 'blueberry-gingham',
    name: 'Blueberry Gingham',
    main: 'cornflower',
    accent: 'snow',
    trim: 'navy',
    detail: 'sunflower',
    pattern: { id: 'gingham' },
    collarAccent: 'tag',
    collection: 'evergreen',
  },
  {
    id: 'candy-stripe',
    name: 'Candy Stripe',
    main: 'strawberry',
    accent: 'snow',
    trim: 'berry',
    detail: 'butter',
    pattern: { id: 'stripes' },
    collarAccent: 'bell',
    collection: 'evergreen',
  },
  {
    id: 'daisy-meadow',
    name: 'Daisy Meadow',
    main: 'pistachio',
    accent: 'snow',
    trim: 'forest',
    detail: 'sunflower',
    pattern: { id: 'daisies' },
    collarAccent: 'tag',
    season: 'spring',
    collection: 'evergreen',
  },
  {
    id: 'autumn-plaid',
    name: 'Autumn Plaid',
    main: 'forest',
    accent: 'mustard',
    trim: 'cocoa',
    detail: 'cream',
    pattern: { id: 'plaid', c: 'rust', d: 'mustard' },
    collarAccent: 'studs',
    season: 'autumn',
    collection: 'evergreen',
  },
  {
    id: 'midnight-stars',
    name: 'Midnight Stars',
    main: 'midnight',
    accent: 'sunflower',
    trim: 'lilac',
    detail: 'sunflower',
    pattern: { id: 'stars' },
    collarAccent: 'studs',
    tier: 'limited',
    collection: 'evergreen',
  },
  {
    id: 'rainbow-sherbet',
    name: 'Rainbow Sherbet',
    main: 'bubblegum',
    accent: 'snow',
    trim: 'periwinkle',
    detail: 'butter',
    pattern: { id: 'rainbow' },
    baffles: ['strawberry', 'peach', 'butter', 'pistachio', 'sky', 'lilac'],
    collarAccent: 'tag',
    tier: 'exclusive',
    collection: 'evergreen',
  },
];
