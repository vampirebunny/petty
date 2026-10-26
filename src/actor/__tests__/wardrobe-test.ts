import { catalog } from '../../economy/catalog';
import { generateCast, npcMayWear } from '../../playdate/npcs';
import { migrateEquipped, starterCloset, withStarter } from '../closet';
import { jacketHasSleeves, neckBackMode, outfitSlots, wardrobe, wearItem } from '../wardrobe';
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
      label: 'Sunny Scarf',
      colorway: { c: '#e8c53a' },
    });
    expect(wearItem('neckwear', 'bell')?.shape).toBe('collar');
    expect(wearItem('neckwear', 'bell')?.colorway.accent).toBe('bell');
    expect(wearItem('neckwear', 'gold')?.shape).toBe('collar');
    expect(wearItem('neckwear', 'gold')?.colorway.accent).toBe('studs');
    expect(wearItem('jacket', 'rain')).toMatchObject({ id: 'rain', shape: 'raincoat', colorway: { c: '#f2c230' } });
    expect(wearItem('jacket', 'puffer')?.colorway).toEqual({ c: '#f28c28', d: '#ffe0c2' });
    const hoodie = wearItem('jacket', 'hoodie');
    expect(hoodie).toMatchObject({ id: 'hoodie', label: 'Cozy Pink Hoodie', shape: 'hoodie', colorway: { c: '#FF9FCB', d: '#8A5AD6' } });
    expect(jacketHasSleeves(hoodie!)).toBe(true);
    expect(jacketHasSleeves(wearItem('jacket', 'sweater')!)).toBe(true);
    expect(jacketHasSleeves(wearItem('jacket', 'rain')!)).toBe(false);
    expect(jacketHasSleeves(wearItem('jacket', 'puffer')!)).toBe(false);
    expect(jacketHasSleeves(wearItem('jacket', 'vest')!)).toBe(false);
  });

  it('adds the catalog art pieces by shape', () => {
    const ids = [
      ['neckwear', 'bandana-cherry', 'bandana'],
      ['neckwear', 'scarf-stripe', 'scarf'],
      ['neckwear', 'bandana-gingham', 'bandana'],
      ['neckwear', 'bowtie', 'bowtie'],
      ['neckwear', 'bowtie-plaid', 'bowtie'],
      ['glasses', 'heart', 'heart'],
      ['glasses', 'heart-sky', 'heart'],
      ['glasses', 'star', 'star'],
      ['hat', 'beanie-pink', 'beanie'],
      ['hat', 'beanie-stripe', 'beanie'],
      ['hat', 'cap', 'cap'],
      ['hat', 'cap-sky', 'cap'],
      ['hat', 'bucket', 'bucket'],
      ['hat', 'bucket-daisy', 'bucket'],
      ['hat', 'beret', 'beret'],
      ['hat', 'top-velvet', 'top'],
      ['hat', 'crown', 'crown'],
      ['boots', 'rain-blue', 'rain'],
      ['boots', 'sneaker-pink', 'sneaker'],
      ['boots', 'sneaker-gold', 'hightop'],
      ['jacket', 'puffer-mint', 'puffer'],
      ['jacket', 'sweater-lilac', 'sweater'],
      ['jacket', 'puffer-rainbow', 'puffer'],
    ] as const;
    expect(ids).toHaveLength(23);
    for (const [slot, id, shape] of ids) {
      expect(wearItem(slot, id)).toMatchObject({ id, shape });
    }
    expect(wearItem('hat', 'top')?.colorway.d).toBe('#f4dede');
    expect(wearItem('hat', 'top-velvet')?.patternParts).toEqual(['band']);
    expect(wearItem('jacket', 'puffer-rainbow')?.colorway.pattern).toBeUndefined();
    expect(wearItem('jacket', 'puffer-rainbow')?.colorway.baffles).toEqual([
      '#FF8CC4',
      '#FFB15C',
      '#FFE16B',
      '#8FE3A8',
      '#7EC8F5',
      '#B9A2F5',
    ]);
    expect(neckBackMode('bowtie')).toBe('band');
    expect(neckBackMode('scarf')).toBe('knot');
  });

  it('uses the same name in the closet and the shop seed', () => {
    // The seed file is the shop_items.name source. Node types are not in this app's tsconfig.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as { readFileSync: (path: string, encoding: string) => string };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path') as { join: (...parts: string[]) => string };
    const sql = fs.readFileSync(path.join(process.cwd(), 'scripts/seed-shop-catalog.sql'), 'utf8');
    const rows = [...sql.matchAll(/\('((?:hat|glasses|neckwear|jacket|boots):[^']+)', '([^']+)'/g)];
    expect(rows.length).toBe(36);
    for (const [, id, name] of rows) {
      const [slot, wearId] = id.split(':') as [OutfitSlot, string];
      expect(wearItem(slot, wearId)?.label).toBe(name);
      const def = catalog.find((item) => item.slot === slot && item.wearId === wearId);
      expect(def?.name).toBe(name);
    }
  });

  it('keeps exclusive and limited clothes off npc partners', () => {
    expect(npcMayWear('hat', 'beanie', null)).toBe(true);
    expect(npcMayWear('hat', 'crown', null)).toBe(false);
    expect(npcMayWear('jacket', 'hoodie', null)).toBe(false);
    const catalogRows = {
      items: [
        { id: 'hat:crown', tier: 'limited' },
        { id: 'glasses:star', tier: 'exclusive' },
        { id: 'jacket:hoodie', tier: 'standard' },
      ],
    };
    expect(npcMayWear('hat', 'crown', catalogRows)).toBe(false);
    expect(npcMayWear('glasses', 'star', catalogRows)).toBe(false);
    expect(npcMayWear('jacket', 'hoodie', catalogRows)).toBe(true);
    expect(npcMayWear('neckwear', 'scarf', catalogRows)).toBe(true);
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
