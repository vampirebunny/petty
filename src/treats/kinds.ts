import type { Effects } from '../sim/effects';
import { treatHungerDrop, treatWeightGain } from '../sim/config';

export type TreatKind = {
  id: string;
  name: string;
  species: Array<'dog' | 'cat'>;
  rarity: 'common' | 'special' | 'rare';
  effects: Effects;
  reaction: 'wag_burst' | 'hop' | 'spin' | 'purr_headbump';
  tags?: string[];
};

export const TREAT_KINDS: Record<string, TreatKind> = {
  biscuit: {
    id: 'biscuit',
    name: 'Biscuit',
    species: ['dog', 'cat'],
    rarity: 'common',
    effects: { hunger: -treatHungerDrop, weight: treatWeightGain, mood: 4 },
    reaction: 'wag_burst',
    tags: ['crunchy'],
  },
  special: {
    id: 'special',
    name: 'Special treat',
    species: ['dog', 'cat'],
    rarity: 'special',
    effects: { hunger: -treatHungerDrop, weight: treatWeightGain, mood: 6 },
    reaction: 'spin',
    tags: ['special'],
  },
  softchew: {
    id: 'softchew',
    name: 'Soft Chew',
    species: ['dog', 'cat'],
    rarity: 'common',
    effects: { hunger: -treatHungerDrop, weight: treatWeightGain, mood: 3 },
    reaction: 'hop',
    tags: ['soft'],
  },
};

export function treatById(id: string): TreatKind | null {
  return TREAT_KINDS[id] ?? null;
}
