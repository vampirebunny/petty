import { sceneById } from '../../actor/scenes';
import { testPet } from '../../sim/__fixtures__/pets';
import type { Stats } from '../../sim/types';
import { activityById, legalActivities } from '../activities';
import { generateGroupPlaydate, offerGroupActivities } from '../group';
import { formatFriendNames, toggleFriend } from '../party';
import { createGroupPlaydateRecord, createPlaydateRecord } from '../record';
import { emptyPlaydateSave, rememberPlaydate } from '../save';
import { snapshotFromFriend, snapshotPet } from '../snapshot';
import type { PetSnapshot } from '../types';

const stats = (value: number): Stats => ({
  stamina: value,
  agility: value,
  intelligence: value,
  boldness: value,
  affection: value,
  obedience: value,
});

function friend(id: string, name: string): PetSnapshot {
  const card = snapshotFromFriend(id, {
    name,
    breedId: 'retriever',
    look: { coat: '#d9a441' },
    equipped: { jacket: 'hoodie' },
    owned: [{ slot: 'jacket', id: 'hoodie' }],
    ageDays: 16,
    weight: 0,
    vitality: 1,
    seed: 2,
    originArchetype: 'athlete',
    attributes: stats(40),
    potential: stats(80),
  });
  if (!card) {
    throw new Error(id);
  }
  return card;
}

describe('friend playdates', () => {
  it('stops at five friends and clears a second tap', () => {
    let selected: string[] = [];
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f']) {
      selected = toggleFriend(selected, id);
    }
    expect(selected).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(toggleFriend(selected, 'c')).toEqual(['a', 'b', 'd', 'e']);
    expect(formatFriendNames(['Miso', 'Pip', 'Boo'])).toBe('Miso, Pip, and Boo');
  });

  it('keeps a worn outfit that is owned and does not add anything else', () => {
    const snap = snapshotFromFriend('maple', {
      name: 'Maple',
      breedId: 'retriever',
      look: { coat: '#d9a441' },
      equipped: { jacket: 'hoodie', hat: 'crown' },
      owned: [
        { slot: 'jacket', id: 'hoodie' },
        { slot: 'boots', id: 'red' },
      ],
      ageDays: 16,
      weight: 0,
      vitality: 1,
      seed: 1,
      originArchetype: 'charmer',
      attributes: stats(40),
      potential: stats(80),
    });
    expect(snap?.equipped).toEqual({ jacket: 'hoodie' });
    expect(snap?.source).toBe('friend');
  });

  it('records one friend as a pair playdate', () => {
    const pet = testPet(1, 'retriever', 1_700_000_000_000, 'Pip', 'pet');
    const partner = friend('one', 'Miso');
    const activity = activityById('nap');
    if (!activity) {
      throw new Error('nap');
    }
    const record = createPlaydateRecord({
      pet,
      partner,
      activity,
      sceneId: 'livingroom',
      outfit: {},
      seed: 4,
      createdAt: '2026-10-26T12:00:00.000Z',
      ownerId: 'owner',
    });
    expect(record.version).toBe(2);
    expect(record.party).toBeUndefined();
    expect(legalActivities(snapshotPet(pet, {}, '', 'self'), partner, 'livingroom').some((entry) => entry.id === 'conga')).toBe(false);
  });

  it('offers three stable group activities and keeps every pet on the floor', () => {
    const guests = [friend('a', 'Miso'), friend('b', 'Boo')];
    const first = offerGroupActivities(guests, 'livingroom', '2026-10-26');
    const again = offerGroupActivities(guests, 'livingroom', '2026-10-26');
    expect(first.map((entry) => entry.id)).toEqual(again.map((entry) => entry.id));
    expect(first).toHaveLength(3);
    expect(new Set(first.map((entry) => entry.id)).size).toBe(3);

    const floor = sceneById('livingroom').floor;
    const pet = testPet(1, 'retriever', 1_700_000_000_000, 'Pip', 'pet');
    for (const id of ['conga', 'line', 'wave', 'pass'] as const) {
      const activity = activityById(id);
      if (!activity) {
        throw new Error(id);
      }
      const record = createGroupPlaydateRecord({
        pet,
        guests,
        activity,
        sceneId: 'livingroom',
        outfit: {},
        seed: 9,
        createdAt: '2026-10-26T12:00:00.000Z',
        ownerId: 'owner',
      });
      expect(record.version).toBe(3);
      expect(record.party).toHaveLength(2);
      expect(record.petB.snapshotId).toBe(guests[0].snapshotId);
      const slots = new Set(record.beats.map((beat) => beat.slot).filter((slot) => slot != null));
      expect([...slots].sort()).toEqual([0, 1, 2]);
      for (const beat of record.beats) {
        if (beat.params?.x == null || beat.params.y == null) {
          continue;
        }
        expect(beat.params.x).toBeGreaterThanOrEqual(floor.xMin);
        expect(beat.params.x).toBeLessThanOrEqual(floor.xMax);
        expect(beat.params.y).toBeGreaterThanOrEqual(floor.yMin);
        expect(beat.params.y).toBeLessThanOrEqual(floor.yMax);
      }
      const generated = generateGroupPlaydate({ pets: [record.petA, ...guests], activity, sceneId: 'livingroom' });
      expect(generated.beats).toEqual(record.beats);
    }
  });

  it('stores a bond for each friend', () => {
    const pet = testPet(1, 'retriever', 1_700_000_000_000, 'Pip', 'pet');
    const guests = [friend('a', 'Miso'), friend('b', 'Boo'), friend('c', 'Nori')];
    const activity = activityById('wave');
    if (!activity) {
      throw new Error('wave');
    }
    const record = createGroupPlaydateRecord({
      pet,
      guests,
      activity,
      sceneId: 'bedroom',
      outfit: {},
      seed: 3,
      createdAt: '2026-10-26T15:00:00.000Z',
      ownerId: 'owner',
    });
    const remembered = rememberPlaydate(emptyPlaydateSave(), record, 50);
    const book = remembered.save.relationships[pet.id];
    expect(Object.keys(book ?? {}).sort()).toEqual(guests.map((guest) => guest.snapshotId).sort());
    expect(book?.[guests[0].snapshotId]?.playdateCount).toBe(1);
    expect(book?.[guests[2].snapshotId]?.bond).toBe(record.outcome.bondDelta);
  });
});
