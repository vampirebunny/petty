import type { CachedAward, CachedProgress } from '../cache';
import {
  careerNextTier,
  caseRibbons,
  firstGoals,
  groupRibbons,
  isRacesEmpty,
  raceTotals,
  recentRibbonEvents,
  settingsCardModel,
} from '../caseModel';

function award(partial: Partial<CachedAward> & Pick<CachedAward, 'id' | 'definitionId'>): CachedAward {
  return {
    petId: 'pet-1',
    source: 'race',
    raceId: null,
    showId: null,
    placing: null,
    earnedAt: '2026-11-01T12:00:00Z',
    configVersion: 1,
    snapshot: {},
    ...partial,
  };
}

function progress(key: string, value: number): CachedProgress {
  return { petId: 'pet-1', key, value };
}

it('treats a new pet as empty even with badges elsewhere', () => {
  expect(isRacesEmpty([], [])).toBe(true);
  expect(isRacesEmpty([award({ id: 'a', definitionId: 'ribbon', raceId: 'r1', placing: 1 })])).toBe(false);
  expect(isRacesEmpty([], [{ raceId: 'r1', event: 'hurdles', classId: 'beginner', place: 2 }])).toBe(false);
});

it('counts trophies, ribbons and wins from cache plus leftover ribbons', () => {
  const awards = [
    award({ id: 't', definitionId: 'career_hurdles_bronze' }),
    award({ id: 'r', definitionId: 'ribbon', raceId: 'r1', placing: 1, snapshot: { event_type: 'hurdles' } }),
  ];
  const leftover = [{ raceId: 'r2', event: 'funRun', classId: 'open', place: 1, at: 2 }];
  const ribbons = caseRibbons(awards, leftover);
  const totals = raceTotals(awards, ribbons, [progress('wins:hurdles', 5)]);
  expect(totals.trophies).toBe(1);
  expect(totals.ribbons).toBe(2);
  expect(totals.wins).toBe(5);
});

it('picks the next career tier from the 5 / 15 / 40 / 100 / 250 ladder', () => {
  expect(careerNextTier(0)).toEqual({ tier: null, nextTier: 'bronze', nextNeed: 5 });
  expect(careerNextTier(5)).toEqual({ tier: 'bronze', nextTier: 'silver', nextNeed: 15 });
  expect(careerNextTier(40)).toEqual({ tier: 'gold', nextTier: 'platinum', nextNeed: 100 });
  expect(careerNextTier(250)).toEqual({ tier: 'diamond', nextTier: null, nextNeed: null });
});

it('groups ribbons by event, class and place and keeps the two latest events', () => {
  const ribbons = caseRibbons(
    [
      award({
        id: 'a',
        definitionId: 'ribbon',
        raceId: 'r1',
        placing: 1,
        earnedAt: '2026-11-02T12:00:00Z',
        snapshot: { event_type: 'hurdles', class: 'novice' },
      }),
      award({
        id: 'b',
        definitionId: 'ribbon',
        raceId: 'r2',
        placing: 1,
        earnedAt: '2026-11-03T12:00:00Z',
        snapshot: { event_type: 'hurdles', class: 'novice' },
      }),
      award({
        id: 'c',
        definitionId: 'ribbon',
        raceId: 'r3',
        placing: 2,
        earnedAt: '2026-11-01T12:00:00Z',
        snapshot: { event_type: 'weave', class: 'beginner' },
      }),
      award({
        id: 'd',
        definitionId: 'ribbon',
        raceId: 'r4',
        placing: 3,
        earnedAt: '2026-10-01T12:00:00Z',
        snapshot: { event_type: 'dockDive', class: 'beginner' },
      }),
    ],
    [],
  );
  const groups = groupRibbons(ribbons);
  const hurdles = groups.find((row) => row.event === 'hurdles' && row.place === 1);
  expect(hurdles?.count).toBe(2);
  expect(recentRibbonEvents(groups, 2).map((row) => row.event)).toEqual(['hurdles', 'weave']);
});

it('lists first goals as undone when the case is empty', () => {
  const goals = firstGoals([]);
  expect(goals.every((goal) => !goal.done)).toBe(true);
  expect(goals).toHaveLength(4);
});

it('treats leftover ribbons as a filled Settings card', () => {
  expect(settingsCardModel([], []).empty).toBe(true);
  const leftover = settingsCardModel([], [{ raceId: 'r1', event: 'hurdles', classId: 'novice', place: 1, at: 9 }]);
  expect(leftover.empty).toBe(false);
  expect(leftover.ribbons).toBe(1);
  expect(leftover.shelf[0]).toMatchObject({ kind: 'ribbon', event: 'hurdles', place: 1 });
});

it('picks the three largest trophies and puts the tallest in the middle', () => {
  const model = settingsCardModel([
    award({ id: 'a', definitionId: 'career_hurdles_bronze', earnedAt: '2026-11-01T12:00:00Z' }),
    award({ id: 'b', definitionId: 'range_grand_champion', earnedAt: '2026-11-02T12:00:00Z' }),
    award({ id: 'c', definitionId: 'feat_comeback', earnedAt: '2026-11-03T12:00:00Z' }),
    award({ id: 'd', definitionId: 'career_weave_gold', earnedAt: '2026-11-04T12:00:00Z' }),
  ]);
  expect(model.empty).toBe(false);
  expect(model.trophies).toBe(4);
  expect(model.shelf.map((row) => (row.kind === 'trophy' ? row.definitionId : row.kind))).toEqual([
    'career_weave_gold',
    'range_grand_champion',
    'feat_comeback',
  ]);
});

it('fills a short trophy shelf with the best ribbon', () => {
  const model = settingsCardModel(
    [award({ id: 't', definitionId: 'career_hurdles_bronze' })],
    [
      { raceId: 'r2', event: 'weave', classId: 'beginner', place: 2, at: 4 },
      { raceId: 'r1', event: 'hurdles', classId: 'championship', place: 1, at: 3 },
    ],
  );
  expect(model.shelf).toHaveLength(3);
  expect(model.shelf.some((row) => row.kind === 'trophy')).toBe(true);
  const ribbons = model.shelf.filter((row) => row.kind === 'ribbon');
  expect(ribbons[0]).toMatchObject({ event: 'hurdles', place: 1, classId: 'championship' });
});

it('fills a stamp-only shelf so a first walk is visible', () => {
  const model = settingsCardModel([
    award({ id: 's', definitionId: 'stamp_space_debut', source: 'runway' }),
  ]);
  expect(model.empty).toBe(false);
  expect(model.stamps).toBe(1);
  expect(model.shelf).toEqual([
    expect.objectContaining({ kind: 'stamp', definitionId: 'stamp_space_debut' }),
  ]);
});
