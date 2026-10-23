import { generateCast } from '../../playdate/npcs';
import { migrateEquipped, starterCloset, withStarter } from '../closet';
import { jacketHasSleeves, outfitSlots, wardrobe, wearItem } from '../wardrobe';
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

  it('keeps shipped ids and colors, and maps them onto shapes', () => {
    expect(wearItem('neckwear', 'scarf')).toMatchObject({
      id: 'scarf',
      shape: 'scarf',
      label: 'Yellow scarf',
      colorway: { c: '#e8c53a' },
    });
    expect(wearItem('neckwear', 'bell')?.shape).toBe('collar');
    expect(wearItem('neckwear', 'gold')?.shape).toBe('collar');
    expect(wearItem('jacket', 'rain')).toMatchObject({ id: 'rain', shape: 'raincoat', colorway: { c: '#f2c230' } });
    expect(wearItem('jacket', 'puffer')?.colorway).toEqual({ c: '#f28c28', d: '#ffe0c2' });
    const hoodie = wearItem('jacket', 'hoodie');
    expect(hoodie).toMatchObject({ id: 'hoodie', label: 'Hoodie', shape: 'hoodie', colorway: { c: '#FF9FCB', d: '#8A5AD6' } });
    expect(jacketHasSleeves(hoodie!)).toBe(true);
    expect(jacketHasSleeves(wearItem('jacket', 'sweater')!)).toBe(true);
    expect(jacketHasSleeves(wearItem('jacket', 'rain')!)).toBe(true);
    expect(jacketHasSleeves(wearItem('jacket', 'puffer')!)).toBe(false);
    expect(jacketHasSleeves(wearItem('jacket', 'vest')!)).toBe(false);
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
