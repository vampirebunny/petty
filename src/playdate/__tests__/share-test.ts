import { incomingPlaydateLabel, playdateTooNew, recordForServer } from '../incoming';
import type { PlaydateRecord } from '../types';

function record(extra: Partial<PlaydateRecord> = {}): PlaydateRecord {
  return {
    version: 2,
    playdateId: '11111111-1111-4111-8111-111111111111',
    ownerId: 'sam',
    createdAt: '2026-11-01T12:00:00.000Z',
    sceneId: 'living',
    hour: 14,
    petA: {
      snapshotId: 'self',
      source: 'self',
      name: 'Biscuit',
      species: 'dog',
      breedId: 'retriever',
      look: { coat: 'cream' },
      equipped: {},
      ageDays: 1,
      weight: 0,
      vitality: 1,
      seed: 1,
      originArchetype: 'charmer',
      currentStyle: 'charmer',
      attributes: { stamina: 1, agility: 1, intelligence: 1, boldness: 1, affection: 1, obedience: 1 },
      potential: { stamina: 1, agility: 1, intelligence: 1, boldness: 1, affection: 1, obedience: 1 },
      favoriteActivities: [],
      partyTricks: [],
      createdAt: '',
    },
    petB: {
      snapshotId: 'friend:alex',
      source: 'friend',
      name: 'Mochi',
      species: 'dog',
      breedId: 'retriever',
      look: { coat: 'cream' },
      equipped: {},
      ageDays: 1,
      weight: 0,
      vitality: 1,
      seed: 1,
      originArchetype: 'charmer',
      currentStyle: 'charmer',
      attributes: { stamina: 1, agility: 1, intelligence: 1, boldness: 1, affection: 1, obedience: 1 },
      potential: { stamina: 1, agility: 1, intelligence: 1, boldness: 1, affection: 1, obedience: 1 },
      favoriteActivities: [],
      partyTricks: [],
      createdAt: '',
    },
    activityId: 'nap',
    outfit: {},
    seed: 1,
    beats: [],
    outcome: { moodDelta: 0, attributeXp: {}, bondDelta: 8, rareEvents: [] },
    ...extra,
  };
}

it('names the friend first on an incoming playdate', () => {
  expect(incomingPlaydateLabel(record(), 'alex', 'Mochi')).toBe('Mochi had a playdate with Biscuit');
});

it('marks a deleted initiator as a former player', () => {
  const saved = record({ initiatorFormer: true });
  saved.petA = { ...saved.petA, name: 'Pup', anonymized: true };
  expect(incomingPlaydateLabel(saved, 'alex', 'Mochi')).toBe('Mochi had a playdate with Pup · Former player');
});

it('strips local flags before upload and treats a future record as too new', () => {
  const saved = record({ syncStatus: 'pending', incoming: true, unwatched: true, version: 4 });
  const sent = recordForServer(saved);
  expect(sent.syncStatus).toBeUndefined();
  expect(sent.incoming).toBeUndefined();
  expect(sent.unwatched).toBeUndefined();
  expect(playdateTooNew(saved)).toBe(true);
  expect(playdateTooNew(record())).toBe(false);
});
