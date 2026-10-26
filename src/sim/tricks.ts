import { stageOf } from './attributes';
import { propInstanceId, type TrickPropType } from './trickProps';
import type { PetState, Stage, TrainingTrack, Trait } from './types';

export type TrickSpecies = 'dog' | 'cat';

// `difficulty` is stored and not applied. Learning uses tier 1.
export type TrickListing = {
  id: string;
  species: TrickSpecies;
  name: string;
  description: string;
  priceBoops: number;
  priceWithoutProp: number | null;
  minAgeStage: Stage;
  difficulty: number;
  attributesRaised: Trait[];
  petAnimationKey: string;
  demoAnimationKey: string;
  sortOrder: number;
  propType: TrickPropType | null;
  propName: string | null;
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
  propType: TrickPropType | null = null,
  propName: string | null = null,
  priceWithoutProp: number | null = null,
): TrickListing {
  return {
    id,
    species,
    name,
    description,
    priceBoops,
    priceWithoutProp,
    minAgeStage,
    difficulty,
    attributesRaised,
    petAnimationKey: id,
    demoAnimationKey: id,
    sortOrder,
    propType,
    propName,
  };
}

export const trickCatalog: TrickListing[] = [
  row('dog', 'dog_down', 'Down', 'Lies all the way down, paws out front.', 150, 'puppy', 0.9, ['obedience'], 110),
  row('dog', 'dog_spin', 'Spin', 'A happy twirl in a full circle.', 150, 'puppy', 0.9, ['agility'], 120),
  row('dog', 'dog_high_five', 'High Five', 'Paw up high to celebrate together.', 200, 'olderPuppy', 1, ['obedience', 'affection'], 200),
  row('dog', 'dog_bow', 'Bow', 'Front paws down, tail up: a very fancy bow.', 250, 'olderPuppy', 1, ['obedience'], 210),
  row('dog', 'dog_jump_up', 'Jump Up', 'Hops up onto the podium and waits like a star.', 400, 'olderPuppy', 1, ['obedience'], 220, 'podium', 'Podium', 250),
  row('dog', 'dog_roll_over', 'Roll Over', 'Flops down and rolls all the way around.', 300, 'adolescent', 1.2, ['agility', 'obedience'], 300),
  row('dog', 'dog_catch', 'Catch', 'Snaps a tossed ball right out of the air.', 300, 'adolescent', 1.2, ['agility'], 310),
  row('dog', 'dog_stand_tall', 'Stand Tall', 'Up on the back legs, front paws tucked.', 350, 'adolescent', 1.3, ['stamina', 'agility'], 325),
  row('dog', 'dog_tunnel', 'Through the Tunnel', 'Dashes in one end and pops out the other.', 450, 'adolescent', 1.2, ['boldness'], 330, 'tunnel', 'Tunnel', 300),
  row('dog', 'dog_hurdle', 'Jump the Hurdle', 'Takes a running start and sails over the bar.', 500, 'adolescent', 1.2, ['agility', 'boldness'], 340, 'hurdle', 'Hurdle', 325),
  row('dog', 'dog_hoop', 'Jump Through Hoop', 'Sails right through the middle of the hoop.', 550, 'adolescent', 1.4, ['agility', 'boldness'], 345, 'hoop', 'Hoop', 350),
  row('dog', 'dog_play_dead', 'Play Dead', 'A dramatic flop, then a sneaky tail wag.', 500, 'adult', 1.5, ['intelligence', 'obedience'], 400),
  row('dog', 'dog_sing', 'Sing', 'A little run of woofs that ends in a howl.', 450, 'adult', 1.4, ['boldness', 'affection'], 405),
  row('dog', 'dog_weave', 'Weave', 'Zig-zags in and out of the cones.', 650, 'adult', 1.5, ['agility', 'intelligence'], 410, 'cones', 'Cone set', 425),
  row('cat', 'cat_spin', 'Spin', 'A graceful little twirl on tiptoes.', 150, 'puppy', 0.9, ['agility'], 110),
  row('cat', 'cat_high_five', 'High Five', 'Paw up to meet your hand.', 200, 'olderPuppy', 1, ['affection'], 200),
  row('cat', 'cat_lie_down', 'Lie Down', 'Settles into a comfy loaf on command.', 200, 'olderPuppy', 1, ['obedience'], 210),
  row('cat', 'cat_jump_up', 'Jump Up', 'Leaps up onto the podium and poses.', 400, 'olderPuppy', 1, ['obedience'], 230, 'podium', 'Podium', 250),
  row('cat', 'cat_tunnel', 'Through the Tunnel', 'Zooms through the tunnel and out the end.', 400, 'olderPuppy', 1.1, ['boldness'], 220, 'tunnel', 'Tunnel', 250),
  row('cat', 'cat_roll_over', 'Roll Over', 'A slow roll from one side to the other.', 400, 'adolescent', 1.4, ['agility'], 300),
  row('cat', 'cat_stand_tall', 'Stand Tall', 'Rises up on the back legs.', 350, 'adolescent', 1.3, ['stamina'], 315),
  row('cat', 'cat_hurdle', 'Jump the Hurdle', 'Bounds over the bar.', 500, 'adolescent', 1.2, ['agility', 'boldness'], 330, 'hurdle', 'Hurdle', 325),
  row('cat', 'cat_hoop', 'Jump Through Hoop', 'Leaps clean through the hoop.', 550, 'adolescent', 1.4, ['agility', 'boldness'], 320, 'hoop', 'Hoop', 350),
  row('cat', 'cat_fetch', 'Fetch', 'Chases the ball and brings it back.', 500, 'adult', 1.5, ['intelligence', 'boldness'], 400),
  row('cat', 'cat_sing', 'Sing', 'A little meow melody.', 450, 'adult', 1.4, ['boldness', 'affection'], 405),
  row('cat', 'cat_weave', 'Weave', 'Winds in and out of the cones.', 650, 'adult', 1.5, ['agility', 'intelligence'], 410, 'cones', 'Cone set', 425),
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

export type GrantedTrickProp = { instanceId: string; type: TrickPropType; sourceTrickId: string };

export type TrickQuote =
  | { ok: true; pet: PetState; price: number; prop: GrantedTrickProp | null }
  | { ok: false; reason: 'unknown' | 'species' | 'age' | 'owned' | 'insufficient_boops' };

export function trickPrice(listing: Pick<TrickListing, 'priceBoops' | 'priceWithoutProp' | 'propType'>, ownsProp: boolean): number {
  if (ownsProp && listing.propType != null && listing.priceWithoutProp != null) {
    return listing.priceWithoutProp;
  }
  return listing.priceBoops;
}

export function prepareTrickPurchase(
  pet: PetState,
  species: TrickSpecies,
  trickId: string,
  boops: number,
  ownedPropTypes: readonly string[] = [],
): TrickQuote {
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
  const ownsProp = listing.propType != null && ownedPropTypes.includes(listing.propType);
  const price = trickPrice(listing, ownsProp);
  if (boops < price) {
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
  const prop =
    listing.propType && !ownsProp
      ? { instanceId: propInstanceId(trickId, pet.id), type: listing.propType, sourceTrickId: trickId }
      : null;
  return {
    ok: true,
    price,
    prop,
    pet: { ...pet, training: { ...pet.training, [trickId]: track } },
  };
}

export function trickMilestoneKey(petId: string, trickId: string): string {
  return `milestone:trick:${trickId}:${petId}`;
}

export function failBand(progress: number): 'early' | 'mid' | 'almost' {
  if (progress < 34) {
    return 'early';
  }
  if (progress < 67) {
    return 'mid';
  }
  return 'almost';
}
