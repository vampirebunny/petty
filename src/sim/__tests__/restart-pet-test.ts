import { breedById, defaultLook } from '../../actor/breeds';
import { testPet } from '../__fixtures__/pets';
import { createPet } from '../createPet';
import { attributesFor } from '../offers';
import { carryRestartedPet, restartedSnapshot } from '../restartPet';
import { withFriendGame, withSignup, type RaceSignup } from '../stadium';

const now = Date.UTC(2026, 10, 1);

function signup(): RaceSignup {
  return {
    entryId: 'e1',
    raceId: 'r1',
    eventId: 'ev1',
    event: 'funRun',
    startsAt: now + 60_000,
    classId: 'beginner',
    lane: 1,
  };
}

it('archives the old pet and starts the new one clean, keeping the collection and outfit flag', () => {
  const grown = withFriendGame(
    withSignup(testPet(3, 'retriever', now, 'Maple', 'old-pet'), signup(), now),
    { raceId: 'fr1', event: 'hurdles', startsAt: now + 120_000 },
    now,
  );
  grown.level = 8;
  grown.ageDays = 40;
  grown.badges = ['finder'];
  grown.equipped = { hat: 'crown' };
  grown.dailyOutfitEnabled = true;
  grown.tutorialSeen = ['bowl'];
  grown.seenCoachMarks = ['park'];
  grown.milestones = ['sit'];
  grown.training = { ...grown.training, sit: { ...grown.training.sit, mastered: true } };
  grown.parkFinds = {
    firstFindVisitDone: true,
    items: [
      {
        itemId: 'acorn',
        count: 2,
        firstFoundAt: 1,
        lastFoundAt: 2,
        firstFindRewarded: true,
        seen: true,
      },
    ],
    pendingRevealModal: { itemId: 'acorn', isNew: true, foundAt: 3 },
  };

  const archived = restartedSnapshot(grown, now + 5);
  expect(archived.equipped).toEqual({});
  expect(archived.restartedAt).toBe(now + 5);
  expect(archived.level).toBe(8);
  expect(archived.parkFinds.pendingRevealModal).toBeNull();
  expect(archived.parkFinds.items).toHaveLength(1);
  expect(archived.races?.signup).toBeNull();
  expect(archived.races?.signups).toEqual([]);
  expect(archived.races?.friendGame).toBeNull();
  expect(archived.races?.entered).toBe(false);

  const breed = breedById('retriever');
  if (!breed) {
    throw new Error('retriever missing');
  }
  const created = createPet({
    id: 'new-pet',
    ownerId: 'test-owner',
    name: 'Nori',
    breedId: 'retriever',
    look: defaultLook(breed),
    attributes: attributesFor(9, breed.species, breed.id, breed.attributeRanges, 'athlete'),
    now: now + 10,
  });
  const next = carryRestartedPet(created, archived);

  expect(next.name).toBe('Nori');
  expect(next.level).toBe(1);
  expect(next.ageDays).toBe(0);
  expect(next.xpTotal).toBe(0);
  expect(next.badges).toEqual([]);
  expect(next.milestones).toEqual([]);
  expect(next.equipped).toEqual({});
  expect(next.dailyOutfitEnabled).toBe(true);
  expect(next.tutorialSeen).toEqual(['bowl']);
  expect(next.seenCoachMarks).toEqual(['park']);
  expect(next.parkFinds.firstFindVisitDone).toBe(true);
  expect(next.parkFinds.items).toEqual(archived.parkFinds.items);
  expect(next.parkFinds.pendingRevealModal).toBeNull();
  expect(next.training.sit?.unlocked).toBe(true);
  expect(next.training.sit?.mastered).toBe(false);
  expect(next.training.speak?.unlocked).toBe(true);
  expect(next.training.paw?.unlocked).toBe(false);
});
