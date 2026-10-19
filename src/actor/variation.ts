import { breedById } from './breeds';
import { mulberry, seedOf } from './mulberry';
import { earProfiles } from './data/breedShapes';
import type { Breed } from './types';

// Small per-pet differences inside a breed. They come from the pet seed only, so a pet looks the same
// every time, and the user never picks them.
export type Variant = {
  // Multiplies the breed's ear size, within +-10%.
  earSize: number;
  // Multiplies tail width on fluffy tails.
  tailFluff: number;
  // Scales how strongly derived markings show (1 is the breed's own strength).
  markingIntensity: number;
  // A rare dog with one erect ear that flops.
  oneEarFlop: boolean;
};

export const neutralVariant: Variant = { earSize: 1, tailFluff: 1, markingIntensity: 1, oneEarFlop: false };

export const oneEarFlopChance = 0.08;

export function variantFor(seed: number | undefined, breedId: string): Variant {
  const breed = breedById(breedId);
  if (seed == null || !breed) {
    return neutralVariant;
  }
  const roll = mulberry(seedOf(`${seed}:${breedId}`));
  const earSize = 0.9 + 0.2 * roll();
  const tailFluff = 0.85 + 0.35 * roll();
  const markingIntensity = 0.8 + 0.2 * roll();
  const flopRoll = roll();
  const erectDog = breed.species === 'dog' && earProfiles[breed.earType].rises;
  return { earSize, tailFluff, markingIntensity, oneEarFlop: erectDog && flopRoll < oneEarFlopChance };
}

// The breed with a pet's variation applied.
export function applyVariant(breed: Breed, variant: Variant): Breed {
  return {
    ...breed,
    earSize: breed.earSize * variant.earSize,
    tailFluff: variant.tailFluff,
    markingIntensity: variant.markingIntensity,
    oneEarFlop: variant.oneEarFlop,
  };
}
