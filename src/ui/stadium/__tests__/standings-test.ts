import { minePlaceOf, withFinishPlaces, withPlaces } from '../standings';

it('assigns 1st from finish times when the server has not ranked yet', () => {
  const ranked = withFinishPlaces([
    { key: 'me', name: 'Maple', finishMs: 12_000, place: null, mine: true },
    { key: 'npc', name: 'NPC', finishMs: 18_000, place: null, mine: false },
  ]);
  expect(minePlaceOf(ranked)).toBe(1);
  expect(ranked[0].key).toBe('me');
});

it('ignores a partial official place until every racer is ranked', () => {
  const ranked = withFinishPlaces([
    { key: 'me', name: 'Maple', finishMs: 12_000, place: 3, mine: true },
    { key: 'npc', name: 'NPC', finishMs: 18_000, place: null, mine: false },
  ]);
  expect(minePlaceOf(ranked)).toBe(1);
});

it('keeps official places when they are present', () => {
  const ranked = withFinishPlaces([
    { key: 'me', name: 'Maple', finishMs: 12_000, place: 2, mine: true },
    { key: 'npc', name: 'NPC', finishMs: 18_000, place: 1, mine: false },
  ]);
  expect(minePlaceOf(ranked)).toBe(2);
  expect(ranked[0].key).toBe('npc');
});

it('ranks dock scores with the longest jump first', () => {
  const ranked = withPlaces(
    [
      { place: null, score: 40, mine: true },
      { place: null, score: 90, mine: false },
    ],
    (row) => row.score,
    false,
  );
  expect(ranked[0].score).toBe(90);
  expect(ranked[1].place).toBe(2);
});
