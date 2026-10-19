import type { BreedRanges } from '../sim/types';

// Potential ceilings per breed, as min to max per attribute, in the order
// stamina, agility, intelligence, boldness, affection, obedience.
// These are tuning numbers: nothing in logic hardcodes them. Retriever, corgi,
// Domestic Shorthair, Siamese, Bombay and Maine Coon midpoints
// sum to 375; dachshund, husky, pug and persian sum to a little less, which the
// generator absorbs by pushing those breeds slightly above their midpoints.
type Row = [number, number][];

function ranges(row: Row): BreedRanges {
  return {
    stamina: row[0],
    agility: row[1],
    intelligence: row[2],
    boldness: row[3],
    affection: row[4],
    obedience: row[5],
  };
}

export type BreedAttributes = { ranges: BreedRanges; blurb: string };

export const breedAttributes: Record<string, BreedAttributes> = {
  retriever: {
    ranges: ranges([[50, 80], [40, 70], [50, 80], [25, 55], [65, 95], [55, 85]]),
    blurb: 'Affectionate, eager to please, not very bold.',
  },
  corgi: {
    ranges: ranges([[40, 70], [45, 75], [55, 85], [55, 85], [50, 80], [40, 70]]),
    blurb: 'Balanced, clever, a little stubborn.',
  },
  dachshund: {
    ranges: ranges([[40, 70], [30, 60], [55, 85], [75, 100], [65, 95], [20, 50]]),
    blurb: 'Fearless and loving, hard to train.',
  },
  husky: {
    ranges: ranges([[80, 100], [60, 90], [45, 75], [50, 80], [40, 70], [10, 40]]),
    blurb: 'Endless stamina, does what it wants.',
  },
  pug: {
    ranges: ranges([[15, 45], [30, 60], [45, 75], [65, 95], [80, 100], [50, 80]]),
    blurb: 'Maximum cuddles, low endurance.',
  },
  domesticshorthair: {
    ranges: ranges([[45, 75], [55, 85], [50, 80], [45, 75], [50, 80], [40, 70]]),
    blurb: 'The all-rounder.',
  },
  siamese: {
    ranges: ranges([[40, 70], [60, 90], [65, 95], [45, 75], [50, 80], [25, 55]]),
    blurb: 'Smart and agile, opinionated.',
  },
  persian: {
    ranges: ranges([[20, 50], [25, 55], [45, 75], [55, 85], [80, 100], [60, 90]]),
    blurb: 'Lap cat, calm and cooperative.',
  },
  bombay: {
    ranges: ranges([[45, 75], [65, 95], [50, 80], [60, 90], [40, 70], [25, 55]]),
    blurb: 'Quick and bold, independent.',
  },
  mainecoon: {
    ranges: ranges([[55, 85], [40, 70], [55, 85], [45, 75], [55, 85], [35, 65]]),
    blurb: 'Big, steady, friendly.',
  },
};
