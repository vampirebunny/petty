import { soloShowRack } from '../rack';
import { buildSoloShow, dressNpcModels, pickNpcModels } from '../npcs';

jest.mock('../../economy/shopState', () => ({
  loadShopCatalog: () => null,
}));

describe('runway npc dress', () => {
  it('picks a configurable number of models with unique styles when possible', () => {
    const models = pickNpcModels({ id: 'show-a' });
    expect(models.length).toBe(3);
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
    expect(dressed.length).toBe(3);
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
    expect(show.submissions.length).toBe(4);
    const npcClaims = show.submissions.slice(1).flatMap((sub) => sub.claimedCostumeIds);
    expect(npcClaims).not.toContain(claimedId);
  });
});
