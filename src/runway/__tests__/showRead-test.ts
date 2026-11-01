import { lookForRound } from '../playback';
import {
  joinedShow,
  joinedShowHint,
  mergeShowDetails,
  parseShowDetail,
  showInJoinedLobby,
  showNeedsLooks,
  submissionsAreClosed,
  type RunwayShowDetail,
} from '../showRead';
import type { RunwaySubmission } from '../types';

function submission(id: string, at: number): RunwaySubmission {
  return {
    submissionId: id,
    pet: {
      snapshotId: id,
      source: 'friend',
      name: id,
      species: 'dog',
      breedId: 'retriever',
      look: { coat: '#111' },
      ageDays: 1,
      weight: 1,
    },
    looks: [
      { lookNumber: 1, pieces: [] },
      { lookNumber: 2, pieces: [] },
      { lookNumber: 3, pieces: [] },
    ],
    submittedAt: at,
    claimedCostumeIds: [],
  };
}

function detail(submissions: RunwaySubmission[]): RunwayShowDetail {
  return {
    id: 'show-1',
    themeId: 'royal',
    trackId: 'track',
    hostPlayerId: 'host',
    hostHandle: 'host',
    amHost: true,
    invitesSentAt: 1,
    deadlineAt: 2,
    votingOpensAt: null,
    pollClosesAt: null,
    resultsRevealedAt: null,
    createdAt: 1,
    myStatus: 'submitted',
    myVoteSubmissionId: null,
    canPeek: true,
    claimedCostumeIds: [],
    contestants: [],
    submissions,
    awards: [],
  };
}

describe('friend runway reads', () => {
  it('keeps a friend whose look numbers and timestamp arrived as strings', () => {
    const show = parseShowDetail({
      ok: true,
      id: 'show-1',
      theme_id: 'royal',
      track_id: 'track',
      deadline: '2026-10-31 21:00:00+00',
      submissions: [
        {
          submission_id: 'sub-friend',
          player_id: 'p2',
          pet_name: 'Milo',
          pet_snapshot: JSON.stringify({
            snapshot_id: 'snap-milo',
            name: 'Milo',
            species: 'dog',
            breed_id: 'retriever',
            look: JSON.stringify({ coat: '#abc' }),
            ageDays: 4,
            weight: 1,
          }),
          submitted_at: '2026-10-31 21:05:00+00',
          claimed_costume_ids: [],
          looks: [
            { look_number: '2', pieces: [] },
            { look_number: '1', pieces: [] },
            { lookNumber: '3', pieces: [] },
          ],
        },
      ],
    });
    expect(show?.submissions).toHaveLength(1);
    expect(show?.submissions[0]?.pet.name).toBe('Milo');
    expect(show?.submissions[0]?.pet.breedId).toBe('retriever');
    expect(show?.submissions[0]?.looks.map((look) => look.lookNumber)).toEqual([1, 2, 3]);
    expect(show?.submissions[0]?.submittedAt).toBeGreaterThan(0);
    expect(lookForRound(show?.submissions[0]?.looks ?? [], 1)?.lookNumber).toBe(2);
    expect(show?.awards).toEqual([]);
  });

  it('parses viewer awards on a show', () => {
    const show = parseShowDetail({
      ok: true,
      id: 'show-1',
      theme_id: 'royal',
      track_id: 'track',
      deadline: '2026-10-31T21:00:00Z',
      created_at: '2026-10-31T20:00:00Z',
      contestants: [],
      submissions: [],
      awards: [
        {
          id: 'a1',
          pet_id: 'pet-1',
          award_definition_id: 'stamp_royal_debut',
          source: 'runway',
          show_id: 'show-1',
          earned_at: '2026-11-01T12:00:00Z',
          config_version: 1,
          pet_snapshot: {},
        },
      ],
    });
    expect(show?.awards).toEqual([
      {
        id: 'a1',
        petId: 'pet-1',
        definitionId: 'stamp_royal_debut',
        source: 'runway',
        raceId: null,
        showId: 'show-1',
        placing: null,
        earnedAt: '2026-11-01T12:00:00Z',
        configVersion: 1,
        snapshot: {},
      },
    ]);
  });

  it('merges a friend who submitted after the screen was loaded', () => {
    const earlier = detail([submission('me', 10)]);
    const later = detail([submission('me', 10), submission('friend', 20)]);
    const merged = mergeShowDetails(earlier, later);
    expect(merged.submissions.map((row) => row.submissionId)).toEqual(['me', 'friend']);
  });

  it('keeps a friend the latest payload dropped', () => {
    const earlier = detail([submission('me', 10), submission('friend', 20)]);
    const later = detail([submission('me', 10)]);
    const merged = mergeShowDetails(earlier, later);
    expect(merged.submissions.map((row) => row.submissionId)).toEqual(['me', 'friend']);
  });
});

describe('joined lobby shows', () => {
  const base = {
    amHost: false,
    myStatus: 'accepted',
    deadlineAt: 10_000,
    votingOpensAt: null,
    pollClosesAt: null,
    resultsRevealedAt: null,
    voted: false,
  };

  it('lists shows you started or accepted, and not a pending invite', () => {
    expect(joinedShow({ ...base, amHost: true, myStatus: 'accepted' })).toBe(true);
    expect(joinedShow({ ...base, myStatus: 'submitted' })).toBe(true);
    expect(joinedShow({ ...base, myStatus: 'invited' })).toBe(false);
    expect(joinedShow({ ...base, myStatus: 'declined' })).toBe(true);
    expect(joinedShow({ ...base, myStatus: 'submitted', resultsRevealedAt: 50 })).toBe(true);
    expect(joinedShowHint({ ...base, myStatus: 'declined' }, 1_000)).toBe('You were invited');
  });

  it('sends an open acceptance to looks and a submission to status', () => {
    expect(showNeedsLooks(base, 1_000)).toBe(true);
    expect(joinedShowHint(base, 1_000)).toBe('Select looks');
    expect(joinedShowHint({ ...base, myStatus: 'submitted' }, 1_000)).toBe('You already submitted');
    expect(showNeedsLooks({ ...base, myStatus: 'submitted' }, 1_000)).toBe(false);
  });

  it('drops a closed show from the lobby after it is opened, until voting or results', () => {
    const closed = { ...base, id: 'show-1', deadlineAt: 500 };
    expect(submissionsAreClosed(closed, 1_000)).toBe(true);
    expect(joinedShowHint(closed, 1_000)).toBe('Submissions are closed');
    expect(showInJoinedLobby(closed, 1_000, [], [])).toBe(true);
    expect(showInJoinedLobby(closed, 1_000, [], ['show-1'])).toBe(false);

    const voting = { ...closed, votingOpensAt: 800, pollClosesAt: 5_000 };
    expect(submissionsAreClosed(voting, 1_000)).toBe(false);
    expect(showInJoinedLobby(voting, 1_000, [], ['show-1'])).toBe(true);

    const results = { ...voting, resultsRevealedAt: 900 };
    expect(showInJoinedLobby(results, 1_000, [], ['show-1'])).toBe(true);
    expect(showInJoinedLobby(results, 1_000, ['show-1'], ['show-1'])).toBe(false);
  });
});
