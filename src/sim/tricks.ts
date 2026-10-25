import { stageOf } from './attributes';
import type { PetState, Stage, TrainingTrack, Trait } from './types';

export type TrickSpecies = 'dog' | 'cat';

// Placeholder shop rows. `difficulty` is stored and not applied. Learning uses tier 1.
export type TrickListing = {
  id: string;
  species: TrickSpecies;
  name: string;
  description: string;
  priceBoops: number;
  minAgeStage: Stage;
  difficulty: number;
  attributesRaised: Trait[];
  petAnimationKey: string;
  demoAnimationKey: string;
  sortOrder: number;
};

const stageOrder: Stage[] = ['puppy', 'olderPuppy', 'adolescent', 'adult', 'senior'];

function row(
  species: TrickSpecies,
  id: string,
  name: string,
  description: string,
  priceBoops: number,
  minAgeStage: Stage,
  difficulty: number,
  attributesRaised: Trait[],
  sortOrder: number,
): TrickListing {
  return {
    id,
    species,
    name,
    description,
    priceBoops,
    minAgeStage,
    difficulty,
    attributesRaised,
    petAnimationKey: 'sit',
    demoAnimationKey: 'sit',
    sortOrder,
  };
}

export const trickCatalog: TrickListing[] = [
  row('dog', 'dog_spin', 'Spin', 'A quick circle on the mat.', 150, 'puppy', 0.9, ['agility'], 1),
  row('dog', 'dog_high_five', 'High Five', 'A paw up high.', 200, 'olderPuppy', 1, ['obedience', 'affection'], 2),
  row('dog', 'dog_bow', 'Bow', 'A play bow.', 250, 'olderPuppy', 1, ['obedience'], 3),
  row('dog', 'dog_roll_over', 'Roll Over', 'All the way over.', 300, 'adolescent', 1.2, ['agility', 'obedience'], 4),
  row('dog', 'dog_sit_pretty', 'Sit Pretty', 'Up on the hind legs.', 350, 'adolescent', 1.3, ['stamina', 'obedience'], 5),
  row('dog', 'dog_play_dead', 'Play Dead', 'Down and still.', 500, 'adult', 1.5, ['intelligence', 'obedience'], 6),
  row('cat', 'cat_spin', 'Spin', 'A quick circle on the mat.', 150, 'puppy', 0.9, ['agility'], 1),
  row('cat', 'cat_high_five', 'High Five', 'A paw up high.', 200, 'olderPuppy', 1, ['affection'], 2),
  row('cat', 'cat_sit_pretty', 'Sit Pretty', 'Up on the hind legs.', 300, 'adolescent', 1.2, ['obedience'], 3),
  row('cat', 'cat_jump_up', 'Jump Up', 'Onto the stool.', 350, 'adolescent', 1.2, ['agility', 'boldness'], 4),
  row('cat', 'cat_roll_over', 'Roll Over', 'All the way over.', 400, 'adolescent', 1.4, ['agility'], 5),
  row('cat', 'cat_fetch', 'Fetch', 'Bring the ball back.', 500, 'adult', 1.5, ['intelligence', 'boldness'], 6),
];

const byId = new Map(trickCatalog.map((trick) => [trick.id, trick]));

export function trickListing(id: string): TrickListing | null {
  return byId.get(id) ?? null;
}

export function tricksForSpecies(species: TrickSpecies): TrickListing[] {
  return trickCatalog.filter((trick) => trick.species === species).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function ageAllowsTrick(ageDays: number, minAgeStage: Stage): boolean {
  return stageOrder.indexOf(stageOf(ageDays)) >= stageOrder.indexOf(minAgeStage);
}

export type TrickQuote =
  | { ok: true; pet: PetState; price: number }
  | { ok: false; reason: 'unknown' | 'species' | 'age' | 'owned' | 'insufficient_boops' };

export function prepareTrickPurchase(pet: PetState, species: TrickSpecies, trickId: string, boops: number): TrickQuote {
  const listing = trickListing(trickId);
  if (!listing) {
    return { ok: false, reason: 'unknown' };
  }
  if (listing.species !== species) {
    return { ok: false, reason: 'species' };
  }
  if (!ageAllowsTrick(pet.ageDays, listing.minAgeStage)) {
    return { ok: false, reason: 'age' };
  }
  if (pet.training[trickId]) {
    return { ok: false, reason: 'owned' };
  }
  if (boops < listing.priceBoops) {
    return { ok: false, reason: 'insufficient_boops' };
  }
  const track: TrainingTrack = {
    id: trickId,
    progress: 0,
    unlocked: true,
    mastered: false,
    focusUsed: 0,
    restUntil: null,
    hadNoTreat: false,
    pendingPenalty: false,
    lastPracticedAt: null,
    source: 'purchase',
  };
  return {
    ok: true,
    price: listing.priceBoops,
    pet: { ...pet, training: { ...pet.training, [trickId]: track } },
  };
}

export function trickMilestoneKey(petId: string, trickId: string): string {
  return `milestone:trick:${trickId}:${petId}`;
}
