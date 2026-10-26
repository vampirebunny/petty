import { catalog, catalogItem, treatReaction, type TreatReaction } from '../economy/catalog';
import type { Effects } from '../sim/effects';
import { speciesOf } from '../sim/tracks';

export type TreatKind = {
  id: string;
  name: string;
  species: ('dog' | 'cat')[];
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
  const known = TREAT_KINDS[id];
  if (known) {
    return known;
  }
  const item = catalogItem(id);
  if (!item || item.kind !== 'treat') {
    return null;
  }
  if (!item.effects?.casual && item.effects?.fill == null) {
    return null;
  }
  return {
    id: item.id,
    name: item.name,
    species: item.species ?? ['dog', 'cat'],
    rarity: item.effects?.fill === 'mood' ? 'special' : 'common',
    effects: item.effects?.casual ?? {},
    reaction: item.reaction ?? 'wag_burst',
  };
}

export function reactionForTreat(id: string, breedId: string): TreatReaction {
  const item = catalogItem(id);
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
  for (const stack of inventory) {
    if (choices.some((choice) => choice.id === stack.itemId) || stack.qty <= 0) {
      continue;
    }
    const item = catalogItem(stack.itemId);
    if (!item || item.kind !== 'treat') {
      continue;
    }
    const allowed = item.species ?? ['dog', 'cat'];
    if (allowed.includes(species)) {
      choices.push({ id: item.id, name: item.name, count: stack.qty });
    }
  }
  return choices;
}
