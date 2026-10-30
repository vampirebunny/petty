import { testPet } from '../__fixtures__/pets';
import { gameplayConfig } from '../gameplayConfig';
import { parseBoard, parseEntry, parseRace } from '../../stadium/api';
import {
  classForEvent,
  classForLevel,
  dropEndedSignup,
  formatCountdown,
  gatePhase,
  raceReminderAt,
  racesOf,
  isPlayableEvent,
  skillBlock,
  withSignup,
  type RaceSignup,
} from '../stadium';

jest.mock('../../compliance/supabase', () => ({ getSupabase: () => null }));
jest.mock('../../db/accountMeta', () => ({ noteServerTime: () => undefined }));
jest.mock('../../sync/queue', () => ({ kick: () => undefined }));

const now = Date.UTC(2026, 0, 1, 0, 50, 0);
const start = Date.UTC(2026, 0, 1, 0, 55, 0);

function pet() {
  return testPet(4, 'retriever', now, 'Maple', 'pet');
}

function signup(): RaceSignup {
  return { entryId: 'e1', raceId: 'r1', eventId: 'ev1', event: 'funRun', startsAt: start, classId: 'beginner', lane: 1 };
}

it('lets a new pet into the open races and locks the trick races', () => {
  const puppy = pet();
  expect(skillBlock(puppy, 'funRun')).toBeNull();
  expect(skillBlock(puppy, 'dockDive')).toBeNull();
  expect(skillBlock(puppy, 'hurdles')).toBeNull();
  expect(isPlayableEvent('funRun')).toBe(true);
  expect(isPlayableEvent('hurdles')).toBe(true);
  expect(isPlayableEvent('weave')).toBe(false);
  const trained = {
    ...puppy,
    ageDays: 12,
    training: { ...puppy.training, dog_hurdle: { ...puppy.training.sit, mastered: true } },
  };
  expect(isPlayableEvent('obstacle')).toBe(true);
  expect(skillBlock(trained, 'obstacle')?.trickId).toBe(gameplayConfig.races.waiveObstacleSkill ? undefined : 'dog_tunnel');
});

it('picks the class from level', () => {
  expect(classForLevel(1)).toBe('beginner');
  expect(classForLevel(10)).toBe('novice');
  expect(classForLevel(49)).toBe('expert');
  expect(classForLevel(60)).toBe('championship');
});

it('puts every level in one Open Fun Run', () => {
  expect(classForEvent('funRun', 'open', 'beginner')).toBe('open');
  expect(classForEvent('funRun', 'open', 'championship')).toBe('open');
  expect(classForEvent('funRun', 'veteran', 'expert')).toBe('veteran');
  expect(classForEvent('hurdles', 'open', 'novice')).toBe('novice');
});

it('moves through the gate phases on server time', () => {
  expect(gatePhase(start, start - 61_000)).toBe('waiting');
  expect(gatePhase(start, start - 60_000)).toBe('gate');
  expect(gatePhase(start, start - 10_000)).toBe('locked');
  expect(gatePhase(start, start)).toBe('started');
  expect(formatCountdown(42_000)).toBe('0:42');
  expect(formatCountdown(125_400)).toBe('2:06');
});

it('keeps the sign-up for the reminder until the race is finished', () => {
  const entered = withSignup(pet(), signup(), now);
  expect(racesOf(entered).signup?.entryId).toBe('e1');
  expect(racesOf(entered).entered).toBe(false);
  expect(raceReminderAt(entered, now)).toBe(start - 60_000);
  expect(raceReminderAt(entered, start - 30_000)).toBeNull();
  expect(withSignup(entered, signup(), now)).toBe(entered);
  const withdrawn = withSignup(entered, null, now);
  expect(racesOf(withdrawn).signup).toBeNull();
  expect(racesOf(withdrawn).entered).toBe(false);
  expect(dropEndedSignup(entered, start + 1000)).toBe(entered);
  expect(racesOf(dropEndedSignup(entered, start + 5 * 60_000)).signup).toBeNull();
});

it('reads the server board, entry, and race line-up', () => {
  const board = parseBoard({
    class: 'novice',
    species: 'cat',
    config: { capacity: 6 },
    cooldown_until: null,
    active_entry: null,
    slots: [
      {
        id: 7,
        starts_at: '2026-01-01T00:55:00Z',
        events: [
          { id: 'a', event_type: 'funRun', species_allowed: 'both', cup: 'open', state: 'open', signed_up: 2 },
          { id: 'b', event_type: 'hurdles', species_allowed: 'both', required_trick: 'cat_hurdle', state: 'missing_trick' },
          { id: 'c', event_type: 'paris', state: 'open' },
        ],
      },
    ],
  });
  expect(board.classId).toBe('novice');
  expect(board.slots[0].startsAt).toBe(start);
  expect(board.slots[0].events.map((card) => card.state)).toEqual(['open', 'missing_trick']);
  expect(board.slots[0].events[0].signedUp).toBe(2);

  expect(
    parseEntry({ entry_id: 'e', race_id: 'r', event_id: 'v', event_type: 'funRun', starts_at: '2026-01-01T00:55:00Z', class: 'beginner', lane: 3 })?.lane,
  ).toBe(3);
  expect(parseEntry({ entry_id: 'e' })).toBeNull();

  const race = parseRace({
    race_id: 'r',
    status: 'finished',
    class: 'beginner',
    event_type: 'funRun',
    starts_at: '2026-01-01T00:55:00Z',
    entries: [{ entry_id: 'e', lane: 1, pet_name: 'Maple', species: 'dog', status: 'finished', mine: true }],
    npcs: [{ lane: 2, name: 'Pip', species: 'cat' }],
  });
  expect(race?.players[0].mine).toBe(true);
  expect(race?.npcs[0]).toMatchObject({ petName: 'Pip', npc: true, lane: 2 });
});
