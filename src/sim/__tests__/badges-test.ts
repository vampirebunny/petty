import { emptyPlaydateSave, petHasCompletedPlaydate } from '../../playdate/save';
import { testPet } from '../__fixtures__/pets';
import { awardedBadgeIds, syncBadges } from '../badges';
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

it('rewrites a saved blue-ribbon to first-win and does not grant it again', () => {
  const saved: PetState = {
    ...pup(),
    level: 10,
    lastOpenedDay: '2026-06-01',
    openedDays: 1,
    openedStreak: 1,
    badges: ['welcome-home', 'blue-ribbon'],
    badgeXpSkipped: ['welcome-home', 'blue-ribbon'],
    ribbons: [{ raceId: 'race-1', event: 'funRun', classId: 'beginner', place: 1, at: noon(1) }],
  };
  const xp = saved.xpTotal;
  const migrated = syncBadges(saved, noon(1));
  expect(migrated.badges).toContain('first-win');
  expect(migrated.badges).not.toContain('blue-ribbon');
  expect(migrated.badges.filter((id) => id === 'first-win')).toHaveLength(1);
  expect(migrated.badgeXpSkipped).toContain('first-win');
  expect(migrated.badgeXpSkipped).not.toContain('blue-ribbon');
  expect(migrated.xpTotal).toBe(xp);
  expect(awardedBadgeIds(saved, migrated)).toEqual([]);
  const again = syncBadges(migrated, noon(1));
  expect(again).toBe(migrated);
});

it('grants First Win for a first-place ribbon', () => {
  const pet = syncBadges(
    {
      ...pup(),
      ribbons: [{ raceId: 'race-1', event: 'funRun', classId: 'beginner', place: 1, at: noon(1) }],
    },
    noon(1),
  );
  expect(pet.badges).toContain('first-win');
  expect(pet.badges).not.toContain('blue-ribbon');
});

it('grants Ribbon Rack from leftover ribbons, one per race id', () => {
  const ribbons = [1, 2, 3, 1, 2, 3].map((place, index) => ({
    raceId: index === 5 ? 'race-5' : `race-${index + 1}`,
    event: 'funRun',
    classId: 'open',
    place,
    at: noon(1),
  }));
  const pet = syncBadges({ ...pup(), ribbons }, noon(1));
  expect(pet.badges).toContain('ribbon-rack-bronze');
  expect(pet.badges).not.toContain('ribbon-rack-silver');
});

it('reads a completed playdate from the saved relationships', () => {
  const save = emptyPlaydateSave();
  expect(petHasCompletedPlaydate(save, 'pet')).toBe(false);
  save.relationships.pet = { pal: { bond: 1, playdateCount: 1, lastPlaydateAt: 't' } };
  expect(petHasCompletedPlaydate(save, 'pet')).toBe(true);
});
