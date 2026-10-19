import { traits } from '../sim/config';
import type { AttributeSet, Trait } from '../sim/types';

// How far each attribute of an offer sits above the best of the other offers. Zero or negative
// means another pup is as good or better there.
export function offerDeltas(offer: AttributeSet, offers: readonly AttributeSet[]): Record<Trait, number> {
  const others = offers.filter((other) => other.archetype !== offer.archetype);
  const out = {} as Record<Trait, number>;
  for (const trait of traits) {
    const best = others.length > 0 ? Math.max(...others.map((other) => other.potential[trait])) : 0;
    out[trait] = offer.potential[trait] - best;
  }
  return out;
}
