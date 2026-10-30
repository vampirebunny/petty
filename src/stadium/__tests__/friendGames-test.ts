import { parseBoard, parseRace } from '../api';
import { conflictCopy, parseCandidates, parseFriendGameState, parseInvites, splitRecent } from '../friendGames';

jest.mock('../../compliance/supabase', () => ({ getSupabase: () => null }));
jest.mock('../../db/accountMeta', () => ({ noteServerTime: () => undefined }));
jest.mock('../../sync/queue', () => ({ kick: () => undefined }));
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: async () => null, setItem: async () => undefined }));

const startsAt = '2026-10-30T12:05:00.000Z';

it('reads the friends cup and the friend game on the board', () => {
  const race = parseRace({ race_id: 'r1', starts_at: startsAt, event_type: 'hurdles', cup: 'friends', class: 'open', entries: [] });
  expect(race?.cup).toBe('friends');
  expect(parseRace({ race_id: 'r1', starts_at: startsAt, event_type: 'hurdles', cup: 'nope' })?.cup).toBe('open');
  const board = parseBoard({ class: 'novice', slots: [], friend_game_race_id: 'r1' });
  expect(board.friendGameRaceId).toBe('r1');
  expect(parseBoard({ class: 'novice', slots: [] }).friendGameRaceId).toBeNull();
});

it('lists recent invitees first, newest first, capped', () => {
  const rows = parseCandidates({
    ok: true,
    rows: [
      { userId: 'a', handle: 'amy', hasPet: true, missingTrick: null, lastInvitedAt: '2026-10-01T00:00:00Z' },
      { userId: 'b', handle: 'bo', hasPet: true, missingTrick: 'dog_hurdle', lastInvitedAt: null },
      { userId: 'c', handle: 'cy', hasPet: false, lastInvitedAt: '2026-10-20T00:00:00Z' },
      { handle: 'broken' },
    ],
  });
  expect(rows.map((row) => row.userId)).toEqual(['a', 'b', 'c']);
  expect(rows[1]?.missingTrick).toBe('dog_hurdle');
  expect(rows[2]?.hasPet).toBe(false);
  const { recent, rest } = splitRecent(rows);
  expect(recent.map((row) => row.userId)).toEqual(['c', 'a']);
  expect(rest.map((row) => row.userId)).toEqual(['b']);
});

it('parses the waiting room and its members', () => {
  const state = parseFriendGameState({
    ok: true,
    race_id: 'r1',
    status: 'cancelled',
    event_type: 'funRun',
    starts_at: startsAt,
    host_id: 'h',
    mine_host: false,
    host_handle: 'host',
    cancel_reason: 'host_left',
    race: null,
    members: [
      { userId: 'h', handle: 'host', host: true, status: 'host', joined: false },
      { userId: 'me', handle: 'me', status: 'accepted', mine: true, joined: true },
      { userId: 'x', handle: 'x', status: 'weird' },
    ],
  });
  expect(state).toMatchObject({ raceId: 'r1', status: 'cancelled', cancelReason: 'host_left', mineHost: false });
  expect(state?.members.map((member) => member.status)).toEqual(['host', 'accepted', 'pending']);
  expect(state?.members[1]?.joined).toBe(true);
  expect(parseFriendGameState({ ok: false, error: 'not_found' })).toBeNull();
});

it('parses invites and skips broken rows', () => {
  const rows = parseInvites({
    ok: true,
    rows: [
      { raceId: 'r1', hostId: 'h', hostHandle: 'host', hostPetName: 'Rex', eventType: 'obstacle', startsAt },
      { raceId: 'r2', hostId: 'h' },
    ],
  });
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ raceId: 'r1', event: 'obstacle', hostPetName: 'Rex' });
});

it('explains a conflict before accepting', () => {
  const open = conflictCopy(
    { entryId: 'e', raceId: 'r', event: 'funRun', cup: 'open', startsAt: Date.parse(startsAt), hosting: false },
    'Maple',
    'join',
  );
  expect(open).toContain('Maple is signed up for Fun Run');
  expect(open).toContain('withdraws Maple');
  const hosting = conflictCopy({ entryId: 'e', raceId: 'r', event: 'hurdles', cup: 'friends', startsAt: null, hosting: true }, 'Maple', 'start');
  expect(hosting).toContain('cancels that game for everyone');
});
