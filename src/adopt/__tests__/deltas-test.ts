import { breedById } from '../../actor/breeds';
import { archetypeStrong } from '../../sim/config';
import { generateOffers } from '../../sim/offers';
import { offerDeltas } from '../deltas';

it('is the offer value minus the best of the other two, for any seed', () => {
  const husky = breedById('husky')!;
  for (let seed = 1; seed <= 40; seed += 1) {
    const offers = generateOffers(seed * 7919, 'dog', 'husky', husky.attributeRanges);
    for (const offer of offers) {
      const deltas = offerDeltas(offer, offers);
      for (const trait of Object.keys(deltas) as (keyof typeof deltas)[]) {
        const best = Math.max(...offers.filter((o) => o !== offer).map((o) => o.potential[trait]));
        expect(deltas[trait]).toBe(offer.potential[trait] - best);
      }
      // strong attributes sit highest in their own set, so they never trail the others
      for (const trait of archetypeStrong[offer.archetype]) {
        expect(deltas[trait]).toBeGreaterThanOrEqual(0);
      }
    }
  }
});
