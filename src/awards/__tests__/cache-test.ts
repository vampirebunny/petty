import { mapAwardRow, mapDefinitionRow, mapProgressRow, ribbonFacts } from '../cache';

it('maps an awards row and ignores a broken one', () => {
  const row = mapAwardRow({
    id: 'a1',
    pet_id: 'pet-1',
    award_definition_id: 'career_hurdles_gold',
    source: 'race',
    race_id: 'race-1',
    show_id: null,
    placing: 1,
    earned_at: '2026-11-01T12:00:00Z',
    config_version: 1,
    pet_snapshot: { name: 'Maple' },
  });
  expect(row).toEqual({
    id: 'a1',
    petId: 'pet-1',
    definitionId: 'career_hurdles_gold',
    source: 'race',
    raceId: 'race-1',
    showId: null,
    placing: 1,
    earnedAt: '2026-11-01T12:00:00Z',
    configVersion: 1,
    snapshot: { name: 'Maple' },
  });
  expect(mapAwardRow({ id: 'x' })).toBeNull();
});

it('maps an award whose earned_at is a Date', () => {
  const row = mapAwardRow({
    id: 'a2',
    pet_id: 'pet-1',
    award_definition_id: 'stamp_space_debut',
    source: 'runway',
    earned_at: new Date('2026-11-01T12:00:00Z'),
    config_version: 1,
  });
  expect(row?.definitionId).toBe('stamp_space_debut');
  expect(row?.earnedAt).toBe('2026-11-01T12:00:00.000Z');
});

it('maps lifetime progress and a definition', () => {
  expect(
    mapProgressRow({
      pet_id: null,
      counter_key: 'lifetime_wins',
      value: '3',
    }),
  ).toEqual({ petId: null, key: 'lifetime_wins', value: 3 });
  expect(
    mapDefinitionRow({
      id: 'class_weave_novice',
      family: 'race',
      kind: 'trophy',
      track: 'class',
      event_type: 'weave',
      class: 'novice',
      threshold: 3,
      size: 2,
      art_key: 'class:weave:novice',
    }),
  ).toMatchObject({
    id: 'class_weave_novice',
    eventType: 'weave',
    class: 'novice',
    threshold: 3,
    size: 2,
  });
});

it('unions leftover ribbons by race id when the cache is empty', () => {
  expect(
    ribbonFacts('pet-1', [
      { raceId: 'r1', event: 'funRun', classId: 'open', place: 1 },
      { raceId: 'r1', event: 'funRun', classId: 'open', place: 2 },
      { raceId: 'r2', event: 'hurdles', classId: 'novice', place: 3 },
      { raceId: 'skip', event: 'hurdles', classId: 'novice', place: 4 },
    ]),
  ).toEqual([
    { raceId: 'r1', event: 'funRun', classId: 'open', place: 1 },
    { raceId: 'r2', event: 'hurdles', classId: 'novice', place: 3 },
  ]);
});
