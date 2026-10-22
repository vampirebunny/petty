import type { Effects } from '../sim/effects';
import { treatHungerDrop, treatMoodGain, treatWeightGain } from '../sim/config';

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
    effects: { hunger: -treatHungerDrop, weight: treatWeightGain, mood: treatMoodGain },
    reaction: 'wag_burst',
    tags: ['crunchy'],
  },
  special: {
    id: 'special',
    name: 'Special treat',
    species: ['dog', 'cat'],
    rarity: 'special',
    effects: { hunger: -treatHungerDrop, weight: treatWeightGain, mood: treatMoodGain },
    reaction: 'spin',
    tags: ['special'],
  },
  softchew: {
    id: 'softchew',
    name: 'Soft Chew',
    species: ['dog', 'cat'],
    rarity: 'common',
    effects: { hunger: -treatHungerDrop, weight: treatWeightGain, mood: treatMoodGain },
    reaction: 'hop',
    tags: ['soft'],
  },
};

export function treatById(id: string): TreatKind | null {
  return TREAT_KINDS[id] ?? null;
}

export type TreatChoice = { id: string; name: string; count: number };

// Stacks the pet can actually be given, in catalog order. Empty means the picker should say so.
export function treatsInInventory(
  inventory: readonly { itemId: string; qty: number }[],
  species: 'dog' | 'cat',
): TreatChoice[] {
  const qty = new Map(inventory.map((stack) => [stack.itemId, stack.qty]));
  const choices: TreatChoice[] = [];
  for (const kind of Object.values(TREAT_KINDS)) {
    const count = qty.get(kind.id) ?? 0;
    if (count > 0 && kind.species.includes(species)) {
      choices.push({ id: kind.id, name: kind.name, count });
    }
  }
  return choices;
}
