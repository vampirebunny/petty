import type { OutfitSlot } from '../sim/types';
import { treatHungerDrop, treatMoodGain, treatWeightGain } from '../sim/config';

export type ItemKind = 'treat' | 'food' | 'second_wind' | 'outfit' | 'toy' | 'furniture';
export type TreatReaction = 'wag_burst' | 'hop' | 'spin' | 'purr_headbump';

export type TreatEffects = { hunger: number; weight: number; mood: number };

export type CatalogItem = {
  id: string;
  name: string;
  kind: ItemKind;
  price: number | null;
  available: boolean;
  starter?: boolean;
  slot?: OutfitSlot;
  wearId?: string;
  species?: Array<'dog' | 'cat'>;
  reaction?: TreatReaction | { dog: TreatReaction; cat: TreatReaction };
  effects?: {
    casual?: TreatEffects;
    training?: TreatEffects | null;
    fill?: 'energy' | 'mood';
    premiumMeal?: boolean;
    mealMultipliers?: { hunger: number; weight: number; energy: number; xp: number };
    moodBonus?: number;
    endRest?: boolean;
  };
};

export function treatReaction(item: CatalogItem, species: 'dog' | 'cat'): TreatReaction {
  const reaction = item.reaction;
  if (reaction == null) {
    return 'wag_burst';
  }
  if (typeof reaction === 'string') {
    return reaction;
  }
  return reaction[species];
}

const basicCasual: TreatEffects = { hunger: -treatHungerDrop, weight: treatWeightGain, mood: treatMoodGain };
const basicTraining: TreatEffects = {
  hunger: -treatHungerDrop * 0.25,
  weight: treatWeightGain * 0.25,
  mood: treatMoodGain,
};

// Shop prices live in the shop catalog. What an item does stays here.
function outfit(slot: OutfitSlot, wearId: string, name: string, starter = false): CatalogItem {
  return {
    id: `${slot}:${wearId}`,
    name,
    kind: 'outfit',
    price: null,
    available: !starter,
    starter,
    slot,
    wearId,
  };
}

export const catalog: CatalogItem[] = [
  outfit('neckwear', 'collar', 'Red Collar', true),
  outfit('neckwear', 'bandana', 'Blue Bandana', true),
  outfit('neckwear', 'scarf', 'Sunny Scarf', true),
  outfit('hat', 'beanie', 'Green Beanie', true),
  outfit('glasses', 'red-rim', 'Red Rims', true),
  outfit('jacket', 'puffer', 'Orange Puffer', true),
  outfit('boots', 'red', 'Red Boots', true),
  outfit('neckwear', 'bell', 'Brown Bell Collar'),
  outfit('neckwear', 'bow', 'Pink Bow'),
  outfit('neckwear', 'gold', 'Gold Stud Collar'),
  outfit('glasses', 'classic', 'Black Shades'),
  outfit('glasses', 'square', 'Round Gold Specs'),
  outfit('hat', 'party', 'Party Hat'),
  outfit('hat', 'top', 'Black Top Hat'),
  outfit('boots', 'rain', 'Yellow Rain Boots'),
  outfit('boots', 'sneaker', 'White Sneakers'),
  outfit('jacket', 'sweater', 'Cherry Sweater'),
  outfit('jacket', 'rain', 'Yellow Raincoat'),
  outfit('jacket', 'vest', 'Blue Quilted Vest'),
  outfit('jacket', 'hoodie', 'Cozy Pink Hoodie'),
  outfit('neckwear', 'bandana-cherry', 'Cherry Bandana'),
  outfit('neckwear', 'scarf-stripe', 'Candy Stripe Scarf'),
  outfit('neckwear', 'bandana-gingham', 'Red Gingham Bandana'),
  outfit('neckwear', 'bowtie', 'Navy Bow Tie'),
  outfit('neckwear', 'bowtie-plaid', 'Red Plaid Bow Tie'),
  outfit('glasses', 'heart', 'Pink Heart Shades'),
  outfit('glasses', 'heart-sky', 'Sky Heart Shades'),
  outfit('glasses', 'star', 'Gold Star Shades'),
  outfit('hat', 'beanie-pink', 'Pink Beanie'),
  outfit('hat', 'beanie-stripe', 'Navy Stripe Beanie'),
  outfit('hat', 'cap', 'Red Ball Cap'),
  outfit('hat', 'cap-sky', 'Sky Ball Cap'),
  outfit('hat', 'bucket', 'Sunny Bucket Hat'),
  outfit('hat', 'bucket-daisy', 'Daisy Bucket Hat'),
  outfit('hat', 'beret', 'Rose Beret'),
  outfit('hat', 'top-velvet', 'Midnight Top Hat'),
  outfit('hat', 'crown', 'Golden Crown'),
  outfit('boots', 'rain-blue', 'Puddle Blue Boots'),
  outfit('boots', 'sneaker-pink', 'Bubblegum Sneakers'),
  outfit('boots', 'sneaker-gold', 'Gold High-Tops'),
  outfit('jacket', 'puffer-mint', 'Mint Puffer'),
  outfit('jacket', 'sweater-lilac', 'Lilac Sweater'),
  outfit('jacket', 'puffer-rainbow', 'Rainbow Puffer'),
  {
    id: 'biscuit',
    name: 'Biscuit',
    kind: 'treat',
    price: null,
    available: true,
    species: ['dog', 'cat'],
    reaction: 'wag_burst',
    effects: { casual: basicCasual, training: basicTraining },
  },
  {
    id: 'special',
    name: 'Salmon Bites',
    kind: 'treat',
    price: null,
    available: true,
    species: ['dog', 'cat'],
    reaction: { dog: 'wag_burst', cat: 'purr_headbump' },
    effects: { casual: { hunger: basicCasual.hunger, weight: basicCasual.weight, mood: 0 }, training: null, fill: 'mood' },
  },
  {
    id: 'treat_jerky',
    name: 'Chicken Jerky',
    kind: 'treat',
    price: null,
    available: true,
    species: ['dog'],
    reaction: 'hop',
    effects: { casual: { hunger: basicCasual.hunger, weight: basicCasual.weight, mood: 0 }, training: null, fill: 'energy' },
  },
  {
    id: 'treat_tuna',
    name: 'Tuna Flakes',
    kind: 'treat',
    price: null,
    available: true,
    species: ['cat'],
    reaction: 'hop',
    effects: { casual: { hunger: basicCasual.hunger, weight: basicCasual.weight, mood: 0 }, training: null, fill: 'energy' },
  },
  {
    id: 'food_fish',
    name: 'Fish Feast',
    kind: 'food',
    price: null,
    available: true,
    species: ['cat'],
    effects: { premiumMeal: true },
  },
  {
    id: 'food_steak',
    name: 'Steak Dinner',
    kind: 'food',
    price: null,
    available: true,
    species: ['dog'],
    effects: { premiumMeal: true },
  },
  {
    id: 'food_gourmet',
    name: 'Gourmet Bowl',
    kind: 'food',
    price: null,
    available: true,
    species: ['dog', 'cat'],
    effects: { premiumMeal: true },
  },
  { id: 'dogHouse', name: 'Glass Conservatory', kind: 'furniture', price: null, available: true, species: ['dog'] },
  { id: 'catTree', name: 'Cat Tree', kind: 'furniture', price: null, available: true, species: ['cat'] },
  { id: 'scratcher', name: 'Scratch Pole', kind: 'furniture', price: null, available: true, species: ['cat'] },
  { id: 'bowl_food', name: 'Extra food bowl', kind: 'furniture', price: null, available: true },
  { id: 'bowl_water', name: 'Extra water bowl', kind: 'furniture', price: null, available: true },
  { id: 'bed_standard', name: 'Standard Bed', kind: 'furniture', price: null, available: true },
  { id: 'bed_cloud_puff', name: 'Cloud Puff Bolster', kind: 'furniture', price: null, available: true, species: ['dog'] },
  { id: 'bed_bone_sofa', name: 'Bone Pillow Sofa', kind: 'furniture', price: null, available: true, species: ['dog'] },
  { id: 'bed_kitty_cave', name: 'Kitty Cave Pod', kind: 'furniture', price: null, available: true, species: ['cat'] },
  { id: 'bed_moon_cradle', name: 'Moon Cradle', kind: 'furniture', price: null, available: true, species: ['cat'] },
  {
    id: 'second_wind',
    name: 'Second Wind',
    kind: 'second_wind',
    price: null,
    available: true,
    effects: { endRest: true },
  },
  { id: 'frisbee', name: 'Blue Frisbee', kind: 'toy', price: null, available: true },
  { id: 'squeaky', name: 'Squeaky Duckie', kind: 'toy', price: null, available: true },
  { id: 'yarn', name: 'Pink Yarn Ball', kind: 'toy', price: null, available: true },
  { id: 'crinkle', name: 'Blue Crinkle Ball', kind: 'toy', price: null, available: true },
  { id: 'mouse', name: 'Lilac Catnip Mouse', kind: 'toy', price: null, available: true },
  { id: 'bone', name: 'Mint Chew Bone', kind: 'toy', price: null, available: true },
  { id: 'rope', name: 'Red Rope Tug', kind: 'toy', price: null, available: true },
  { id: 'wand', name: 'Feather Wand', kind: 'toy', price: null, available: true },
  { id: 'laser', name: 'Purple Laser Pointer', kind: 'toy', price: null, available: true },
];

const byId = new Map(catalog.map((item) => [item.id, item]));

let remoteCatalogLookup: ((id: string) => CatalogItem | null) | null = null;

export function bindRemoteCatalog(lookup: (id: string) => CatalogItem | null): void {
  remoteCatalogLookup = lookup;
}

export function catalogItem(id: string): CatalogItem | null {
  return byId.get(id) ?? remoteCatalogLookup?.(id) ?? null;
}

export function starterOutfits(): CatalogItem[] {
  return catalog.filter((item) => item.starter);
}

export function storeItems(): CatalogItem[] {
  return catalog.filter((item) => item.available && item.price != null);
}

export type FoodChoice = { id: string; name: string; count: number | null };

// Everyday kibble is not a ledger item. Null count means it is always available.
export const KIBBLE_ID = 'kibble';

export function foodsInInventory(
  inventory: readonly { itemId: string; qty: number }[],
  species: 'dog' | 'cat',
): FoodChoice[] {
  const qty = new Map(inventory.map((stack) => [stack.itemId, stack.qty]));
  const choices: FoodChoice[] = [{ id: KIBBLE_ID, name: 'Kibble', count: null }];
  const push = (id: string, name: string, count: number, allowed: Array<'dog' | 'cat'>) => {
    if (count > 0 && allowed.includes(species) && !choices.some((choice) => choice.id === id)) {
      choices.push({ id, name, count });
    }
  };
  for (const item of catalog) {
    if (item.kind !== 'food') {
      continue;
    }
    push(item.id, item.name, qty.get(item.id) ?? 0, item.species ?? ['dog', 'cat']);
  }
  for (const stack of inventory) {
    const item = catalogItem(stack.itemId);
    if (!item || item.kind !== 'food') {
      continue;
    }
    push(item.id, item.name, stack.qty, item.species ?? ['dog', 'cat']);
  }
  return choices;
}
