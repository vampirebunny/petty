import { emptyPlaydateSave, petHasCompletedPlaydate } from '../../playdate/save';
import { testPet } from '../__fixtures__/pets';
import { syncBadges } from '../badges';
import type { PetState } from '../types';

function noon(day: number): number {
  return new Date(2026, 5, day, 12).getTime();
}

function pup(day = 1): PetState {
  return testPet(4, 'retriever', noon(day), 'Maple', 'pet');
}

function master(pet: PetState, ids: string[]): PetState {
  const training = { ...pet.training };
  for (const id of ids) {
    const current = training[id];
    training[id] = {
      ...(current ?? {
        id,
        progress: 0,
        unlocked: true,
        mastered: false,
        focusUsed: 0,
        restUntil: null,
        hadNoTreat: false,
        pendingPenalty: false,
        lastPracticedAt: null,
        source: 'starter' as const,
      }),
      mastered: true,
      progress: 100,
    };
  }
  return { ...pet, training };
}

it('awards Welcome Home on the first check and skips its XP before level 10', () => {
  const pet = syncBadges(pup(), noon(1));
  expect(pet.badges).toContain('welcome-home');
  expect(pet.badgeXpSkipped).toContain('welcome-home');
  expect(pet.xpTotal).toBe(0);
  expect(pet.openedDays).toBe(1);
  const again = syncBadges(pet, noon(1));
  expect(again).toBe(pet);
});

it('pays badge XP only from level 10', () => {
  const grown = syncBadges({ ...pup(), level: 10 }, noon(1));
  expect(grown.badges).toContain('welcome-home');
  expect(grown.badgeXpSkipped).toEqual([]);
  expect(grown.xpTotal).toBe(50);
});

it('awards Came Back only on the day after adoption', () => {
  const born = syncBadges(pup(1), noon(1));
  expect(born.badges).not.toContain('came-back');
  const next = syncBadges(born, noon(2));
  expect(next.badges).toContain('came-back');

  const late = syncBadges(pup(1), noon(4));
  expect(late.badges).not.toContain('came-back');
  expect(late.openedDays).toBe(1);
});

it('resets the streak after a missed day and does not count untracked days', () => {
  let pet = syncBadges(pup(1), noon(1));
  pet = syncBadges(pet, noon(2));
  expect(pet.openedStreak).toBe(2);
  pet = syncBadges(pet, noon(4));
  expect(pet.openedStreak).toBe(1);
  expect(pet.openedDays).toBe(3);
  pet = syncBadges(pet, noon(5));
  pet = syncBadges(pet, noon(6));
  expect(pet.openedStreak).toBe(3);
  expect(pet.badges).toContain('best-friend-streak-bronze');
  expect(pet.badges).not.toContain('devoted-bronze');
});

it('awards Dressed Up only while something is worn', () => {
  const bare = syncBadges(pup(), noon(1));
  expect(bare.badges).not.toContain('dressed-up');
  const dressed = syncBadges({ ...bare, equipped: { hat: 'hat:top' } }, noon(1));
  expect(dressed.badges).toContain('dressed-up');
});

it('awards trick and find tiers and Playmate from the flag', () => {
  let pet = master(pup(), ['sit', 'speak', 'paw', 'dog_spin', 'dog_down', 'dog_hurdle']);
  pet = {
    ...pet,
    hadPlaydate: true,
    parkFinds: {
      ...pet.parkFinds,
      items: Array.from({ length: 10 }, (_, index) => ({
        itemId: `item-${index}`,
        count: 1,
        firstFoundAt: 1,
        lastFoundAt: 1,
        firstFindRewarded: false,
        seen: true,
      })),
    },
  };
  pet = syncBadges(pet, noon(1));
  expect(pet.badges).toEqual(
    expect.arrayContaining([
      'good-listener',
      'prop-pro',
      'treasure-hunter',
      'playmate',
      'trick-collector-bronze',
      'finder-bronze',
    ]),
  );
  expect(pet.badges).not.toContain('trick-collector-silver');
  expect(pet.badges).not.toContain('off-to-the-races');
});

it('reads a completed playdate from the saved relationships', () => {
  const save = emptyPlaydateSave();
  expect(petHasCompletedPlaydate(save, 'pet')).toBe(false);
  save.relationships.pet = { pal: { bond: 1, playdateCount: 1, lastPlaydateAt: 't' } };
  expect(petHasCompletedPlaydate(save, 'pet')).toBe(true);
});
