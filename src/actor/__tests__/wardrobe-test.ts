import { generateCast } from '../../playdate/npcs';
import { migrateEquipped, starterCloset, withStarter } from '../closet';
import { outfitSlots, wardrobe, wearItem } from '../wardrobe';
import type { OutfitSlot } from '../../sim/types';

describe('wardrobe closet', () => {
  it('maps old collar, bandana, and coat slots', () => {
    expect(migrateEquipped({ collar: 'teal', hat: 'beanie' })).toEqual({ neckwear: 'collar', hat: 'beanie' });
    expect(migrateEquipped({ collar: 'gold', bandana: 'yellow' })).toEqual({ neckwear: 'bandana' });
    expect(migrateEquipped({ collar: 'gold' })).toEqual({ neckwear: 'gold' });
    expect(migrateEquipped({ coat: 'sweater', boots: 'red' })).toEqual({ jacket: 'sweater', boots: 'red' });
    expect(migrateEquipped({ glasses: 'round' })).toEqual({ glasses: 'square' });
    expect(migrateEquipped({ neckwear: 'scarf', collar: 'red' })).toEqual({ neckwear: 'scarf' });
  });

  it('grants the starter closet and keeps an equipped item', () => {
    const closet = withStarter({ owned: [] }, { jacket: 'sweater' });
    for (const item of starterCloset) {
      expect(closet.owned).toContainEqual(item);
    }
    expect(closet.owned).toContainEqual({ slot: 'jacket', id: 'sweater' });
    expect(withStarter(closet, { jacket: 'sweater' }).owned).toEqual(closet.owned);
    expect(starterCloset.some((item) => item.id === 'bell')).toBe(false);
    expect(wardrobe.neckwear.items.some((item) => item.id === 'bell')).toBe(true);
  });

  it('dresses npc partners from the full catalog', () => {
    const cast = generateCast('owner-wardrobe');
    expect(cast.length).toBeGreaterThan(0);
    for (const pet of cast) {
      for (const [slot, id] of Object.entries(pet.equipped)) {
        expect(outfitSlots).toContain(slot);
        expect(wearItem(slot as OutfitSlot, id)?.id).toBe(id);
      }
    }
  });
});
