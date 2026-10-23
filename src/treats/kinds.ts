import { catalog, treatReaction, type TreatReaction } from '../economy/catalog';
import type { Effects } from '../sim/effects';
import { speciesOf } from '../sim/tracks';

export type TreatKind = {
  id: string;
  name: string;
  species: Array<'dog' | 'cat'>;
  rarity: 'common' | 'special' | 'rare';
  effects: Effects;
  reaction: TreatReaction | { dog: TreatReaction; cat: TreatReaction };
  tags?: string[];
};

function fromCatalog(): Record<string, TreatKind> {
  const kinds: Record<string, TreatKind> = {};
  for (const item of catalog) {
    if (item.kind !== 'treat' || !item.effects?.casual) {
      continue;
    }
    kinds[item.id] = {
      id: item.id,
      name: item.name,
      species: item.species ?? ['dog', 'cat'],
      rarity: item.effects.fill === 'mood' ? 'special' : 'common',
      effects: item.effects.casual,
      reaction: item.reaction ?? 'wag_burst',
    };
  }
  return kinds;
}

export const TREAT_KINDS: Record<string, TreatKind> = fromCatalog();

export function treatById(id: string): TreatKind | null {
  return TREAT_KINDS[id] ?? null;
}

export function reactionForTreat(id: string, breedId: string): TreatReaction {
  const item = catalog.find((entry) => entry.id === id);
  if (!item) {
    return 'wag_burst';
  }
  return treatReaction(item, speciesOf(breedId));
}

export type TreatChoice = { id: string; name: string; count: number };

// Stacks the pet can actually be given, in catalog order. Empty means the picker should say so.
export function treatsInInventory(
  inventory: readonly { itemId: string; qty: number }[],
  species: 'dog' | 'cat',
): TreatChoice[] {
  const qty = new Map(inventory.map((stack) => [stack.itemId, stack.qty]));
  const choices: TreatChoice[] = [];
  for (const item of catalog) {
    if (item.kind !== 'treat') {
      continue;
    }
    const count = qty.get(item.id) ?? 0;
    const allowed = item.species ?? ['dog', 'cat'];
    if (count > 0 && allowed.includes(species)) {
      choices.push({ id: item.id, name: item.name, count });
    }
  }
  return choices;
}
