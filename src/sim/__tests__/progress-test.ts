import { applyReveal } from '../../parkFinds/collection';
import { testPet } from '../__fixtures__/pets';
import { applyEvent } from '../events';
import { ensureProgress, grantEverydayXp, noteTutorialAction, onParkFindRecorded, xpToReach } from '../progress';
import { trickListing } from '../tricks';
import type { PetState } from '../types';

function pup(): PetState {
  return testPet(4, 'retriever', 1_700_000_000_000, 'Maple', 'pet');
}

it('sums the level curve to the brief totals', () => {
  expect(xpToReach(40)).toBeCloseTo(6900, 4);
  expect(xpToReach(60)).toBeCloseTo(19900, 4);
});

it('levels once for each tutorial action, in any order, and does not spend XP', () => {
  let pet = pup();
  pet = applyEvent(pet, { type: 'pet' }).state;
  pet = applyEvent(pet, { type: 'equip', slot: 'hat', itemId: 'hat:top' }).state;
  expect(pet.level).toBe(3);
  expect(pet.xpTotal).toBe(0);

  pet = applyEvent(pet, { type: 'pet' }).state;
  expect(pet.level).toBe(3);

  pet = applyEvent(pet, { type: 'feed' }).state;
  pet = applyEvent(pet, { type: 'refillWater' }).state;
  pet = applyEvent(pet, { type: 'setScene', sceneId: 'school' }).state;
  pet = applyEvent(pet, { type: 'fetch' }).state;
  pet = applyEvent(pet, { type: 'beginRest' }).state;
  expect(pet.level).toBe(8);
  expect(pet.xpTotal).toBe(0);
});

it('counts a park find as one level whenever it happens', () => {
  let early = pup();
  const first = applyReveal(early.parkFinds, 'perfect-stick', 1);
  early = onParkFindRecorded({ ...early, parkFinds: first.next }, 'perfect-stick', true, 'common', 1);
  expect(early.level).toBe(2);
  expect(early.xpTotal).toBe(0);

  const again = applyReveal(early.parkFinds, 'perfect-stick', 2);
  early = onParkFindRecorded({ ...early, parkFinds: again.next }, 'perfect-stick', false, 'common', 2);
  expect(early.level).toBe(2);

  let saved = pup();
  saved = {
    ...saved,
    parkFinds: {
      firstFindVisitDone: true,
      pendingRevealModal: null,
      items: [
        {
          itemId: 'perfect-stick',
          count: 2,
          firstFoundAt: 1,
          lastFoundAt: 1,
          firstFindRewarded: true,
          seen: true,
        },
      ],
    },
  };
  saved = noteTutorialAction(saved, 'feed');
  expect(saved.level).toBe(2);
  saved = ensureProgress(saved);
  expect(saved.level).toBe(3);
  expect(saved.tutorialSeen).toContain('parkFind');
  expect(saved.xpTotal).toBe(0);
});

it('pays first-find XP only from level 10 and only once', () => {
  let early = pup();
  const first = applyReveal(early.parkFinds, 'perfect-stick', 1);
  early = onParkFindRecorded({ ...early, parkFinds: first.next }, 'perfect-stick', true, 'common', 1);
  expect(early.level).toBe(2);
  expect(early.xpTotal).toBe(0);
  expect(early.parkFinds.items[0]?.firstFindRewarded).toBe(true);

  let grown = { ...pup(), level: 10 };
  const found = applyReveal(grown.parkFinds, 'tennis-ball', 1);
  grown = onParkFindRecorded({ ...grown, parkFinds: found.next }, 'tennis-ball', true, 'common', 1);
  expect(grown.xpTotal).toBe(10);
  const again = applyReveal(grown.parkFinds, 'tennis-ball', 2);
  grown = onParkFindRecorded({ ...grown, parkFinds: again.next }, 'tennis-ball', false, 'common', 2);
  expect(grown.xpTotal).toBe(10);
});

it('caps everyday XP at 100 and ignores it during the tutorial', () => {
  const now = Date.UTC(2026, 5, 2, 15, 0, 0);
  expect(grantEverydayXp(pup(), now).xpTotal).toBe(0);

  let pet = { ...pup(), level: 10 };
  for (let i = 0; i < 60; i += 1) {
    pet = grantEverydayXp(pet, now);
  }
  expect(pet.xpIntoLevel).toBe(100);
  expect(pet.level).toBe(10);
});

it('marks prop tricks advanced and the others basic', () => {
  expect(trickListing('dog_spin')?.category).toBe('basic');
  expect(trickListing('dog_hurdle')?.category).toBe('advanced');
  expect(trickListing('cat_jump_up')?.category).toBe('advanced');
});
