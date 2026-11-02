import { outfitSlots, wardrobe } from '../../actor/wardrobe';
import { rememberActiveDefs, resetRemoteDefsForTest } from '../../economy/remoteDefs';
import type { ShopCatalog, ShopListing } from '../../economy/shop';
import { runwayConfig } from '../config';
import { soloShowRack } from '../rack';
import { buildSoloShow, dressNpcModels, pickNpcModels } from '../npcs';

let mockCatalog: ShopCatalog | null = null;

jest.mock('../../economy/shopState', () => ({
  loadShopCatalog: () => mockCatalog,
}));

function listing(partial: Pick<ShopListing, 'id'> & Partial<ShopListing>): ShopListing {
  return {
    name: partial.id,
    category: 'clothes',
    shop: 'always',
    price: 100,
    sort: 0,
    stackable: false,
    tier: 'standard',
    ...partial,
  };
}

describe('runway npc dress', () => {
  it('picks a configurable number of models with unique styles when possible', () => {
    const models = pickNpcModels({ id: 'show-a' });
    expect(models.length).toBe(runwayConfig.npcCount);
    const styles = models.map((pet) => pet.style);
    expect(new Set(styles).size).toBe(styles.length);
  });

  it('never uses player-claimed costumes and freezes three looks each', () => {
    const showId = 'show-claim';
    const themeId = 'royal';
    const rack = soloShowRack(showId);
    const claimed = rack.slice(0, 2).map((piece) => piece.id);
    const models = pickNpcModels({ id: showId });
    const dressed = dressNpcModels(showId, themeId, claimed, models, rack);
    expect(dressed.length).toBe(runwayConfig.npcCount);
    for (const sub of dressed) {
      expect(sub.looks.length).toBe(3);
      for (const look of sub.looks) {
        expect(look.pieces.length).toBeGreaterThan(0);
      }
      for (const id of sub.claimedCostumeIds) {
        expect(claimed).not.toContain(id);
        expect(rack.some((piece) => piece.id === id)).toBe(true);
      }
    }
    const allCostumeClaims = dressed.flatMap((sub) => sub.claimedCostumeIds);
    expect(new Set(allCostumeClaims).size).toBe(allCostumeClaims.length);
  });

  it('builds a solo show with the player first then npcs from leftovers', () => {
    const showId = 'solo-owner-1-fixed';
    const claimedId = soloShowRack(showId)[0]!.id;
    const show = buildSoloShow({
      ownerId: 'owner-1',
      themeId: 'space',
      trackId: 'fashion-show-music',
      showId,
      pet: {
        snapshotId: 'self',
        source: 'self',
        name: 'Maple',
        species: 'dog',
        breedId: 'retriever',
        look: { coat: '#C9A27A' },
        ageDays: 10,
        weight: 0,
      },
      playerLooks: [
        { lookNumber: 1, wardrobe: { hat: 'beanie' }, costumes: [claimedId] },
        { lookNumber: 2, wardrobe: { boots: 'rain' }, costumes: [claimedId] },
        { lookNumber: 3, wardrobe: { neckwear: 'collar' }, costumes: [] },
      ],
    });
    expect(show.mode).toBe('solo');
    expect(show.soloRackIds?.length).toBe(8);
    expect(show.submissions[0]?.pet.name).toBe('Maple');
    expect(show.submissions.length).toBe(1 + runwayConfig.npcCount);
    const npcClaims = show.submissions.slice(1).flatMap((sub) => sub.claimedCostumeIds);
    expect(npcClaims).not.toContain(claimedId);
  });

  it('wears rotating collection colorways and skips exclusive and limited colorways', () => {
    const shapes: Record<(typeof outfitSlots)[number], string[]> = {
      hat: ['beanie', 'cap', 'bucket'],
      glasses: ['square', 'red-rim', 'heart'],
      neckwear: ['collar', 'bandana', 'scarf'],
      jacket: ['sweater', 'hoodie', 'puffer'],
      boots: ['rain', 'sneaker', 'hightop'],
    };
    const collectionIds = outfitSlots.flatMap((slot) => shapes[slot].map((shape) => `${slot}:${shape}.autumn-plaid`));
    const catOnly = 'hat:beret.strawberry-milk';
    const dogOnly = 'hat:party.mint-choc';
    const exclusiveId = 'hat:crown.rainbow-sherbet';
    const limitedId = 'glasses:star.midnight-stars';
    const remoteIds = [...collectionIds, catOnly, dogOnly, exclusiveId, limitedId];

    resetRemoteDefsForTest();
    rememberActiveDefs(
      {
        version: 1,
        items: remoteIds.map((id) => {
          const [slot, wearId] = id.split(':');
          const shape = wearId.split('.')[0];
          return {
            id,
            name: id,
            species: id === catOnly ? (['cat'] as const) : id === dogOnly ? (['dog'] as const) : null,
            def: { v: 1, kind: 'outfit', slot, shape, label: id, colorway: { c: '#ffffff' } },
          };
        }),
      },
      () => {},
    );

    const blocked = outfitSlots.flatMap((slot) =>
      wardrobe[slot].items.map((item) =>
        listing({ id: `${slot}:${item.id}`, tier: 'exclusive', shop: 'rotation', price: null, slot, wearId: item.id }),
      ),
    );
    mockCatalog = {
      version: 1,
      items: [
        ...blocked,
        ...collectionIds.map((id) => {
          const [slot, wearId] = id.split(':');
          return listing({ id, theme: 'autumn-plaid', slot: slot as ShopListing['slot'], wearId });
        }),
        listing({ id: catOnly, theme: 'strawberry-milk', slot: 'hat', wearId: 'beret.strawberry-milk', species: ['cat'] }),
        listing({ id: dogOnly, theme: 'mint-choc', slot: 'hat', wearId: 'party.mint-choc', species: ['dog'] }),
        listing({
          id: exclusiveId,
          theme: 'rainbow-sherbet',
          shop: 'rotation',
          tier: 'exclusive',
          slot: 'hat',
          wearId: 'crown.rainbow-sherbet',
        }),
        listing({
          id: limitedId,
          theme: 'midnight-stars',
          shop: 'featured',
          tier: 'limited',
          slot: 'glasses',
          wearId: 'star.midnight-stars',
        }),
      ],
      bundles: [],
      pickSlots: ['clothes'],
      noRepeatDays: 5,
      dealPct: 20,
    };

    try {
      const showId = 'show-collections';
      const models = pickNpcModels({ id: showId });
      const dressed = dressNpcModels(showId, 'royal', [], models, soloShowRack(showId));
      const allowed = new Set([
        ...collectionIds.map((id) => id.split(':')[1]),
        'beret.strawberry-milk',
        'party.mint-choc',
      ]);
      let wardrobePieces = 0;
      for (const sub of dressed) {
        for (const look of sub.looks) {
          for (const piece of look.pieces) {
            if (piece.kind !== 'wardrobe') {
              continue;
            }
            wardrobePieces += 1;
            expect(allowed.has(piece.id)).toBe(true);
            expect(piece.id).not.toBe('crown.rainbow-sherbet');
            expect(piece.id).not.toBe('star.midnight-stars');
            if (sub.pet.species === 'dog') {
              expect(piece.id).not.toBe('beret.strawberry-milk');
            }
            if (sub.pet.species === 'cat') {
              expect(piece.id).not.toBe('party.mint-choc');
            }
          }
        }
      }
      expect(wardrobePieces).toBeGreaterThan(0);
    } finally {
      mockCatalog = null;
      resetRemoteDefsForTest();
    }
  });
});
