import type { Colorway } from '../actor/wardrobe';
import type { Look } from '../sim/types';
import type { CostumeSlot, FrozenLook, FrozenPiece, LocalRunwayShow, RunwayPetSnap, RunwaySubmission } from './types';

const slots: readonly CostumeSlot[] = ['hat', 'glasses', 'neckwear', 'jacket', 'boots', 'back'];

export type RunwayContestant = {
  playerId: string;
  handle: string;
  petName: string | null;
  status: string;
  submitted: boolean;
  submissionId: string | null;
  isMe: boolean;
  /** Null until results are revealed. */
  voteCount: number | null;
};

export type RunwayShowDetail = {
  id: string;
  themeId: string;
  trackId: string;
  hostPlayerId: string;
  hostHandle: string;
  amHost: boolean;
  invitesSentAt: number;
  deadlineAt: number;
  votingOpensAt: number | null;
  pollClosesAt: number | null;
  resultsRevealedAt: number | null;
  createdAt: number;
  myStatus: string;
  myVoteSubmissionId: string | null;
  canPeek: boolean;
  claimedCostumeIds: string[];
  contestants: RunwayContestant[];
  submissions: RunwaySubmission[];
};

export type RunwayShowSummary = {
  id: string;
  themeId: string;
  trackId: string;
  hostHandle: string;
  myStatus: string;
  deadlineAt: number | null;
  votingOpensAt: number | null;
  pollClosesAt: number | null;
  resultsRevealedAt: number | null;
  createdAt: number;
  amHost: boolean;
  contestantCount: number;
  submittedCount: number;
  winnerHandles: string[];
};

export type RecentInvitee = { userId: string; handle: string };

export type ShowStep = 'join' | 'backstage' | 'status' | 'vote' | 'results' | 'judge';

function millis(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function strList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string');
}

function isSlot(value: string): value is CostumeSlot {
  return (slots as readonly string[]).includes(value);
}

function pieceOf(value: unknown): FrozenPiece | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const row = value as Record<string, unknown>;
  const id = str(row.id);
  const slot = str(row.slot);
  const kind = row.kind === 'costume' || row.kind === 'wardrobe' ? row.kind : null;
  const label = str(row.label);
  const shape = str(row.shape);
  const color = row.colorway;
  if (!id || !slot || !isSlot(slot) || !kind || !label || !shape || !color || typeof color !== 'object') {
    return null;
  }
  const c = str((color as { c?: unknown }).c);
  if (!c) {
    return null;
  }
  const colorway = color as Colorway;
  return {
    id,
    slot,
    kind,
    label,
    shape,
    colorway: { ...colorway, c },
    ...(Array.isArray(row.patternParts) ? { patternParts: row.patternParts.filter((part): part is string => typeof part === 'string') } : {}),
    ...(typeof row.lensTint === 'string' ? { lensTint: row.lensTint } : {}),
  };
}

function looksOf(value: unknown): FrozenLook[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const looks: FrozenLook[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const number = (item as { look_number?: unknown }).look_number;
    if (number !== 1 && number !== 2 && number !== 3) {
      continue;
    }
    const pieces = Array.isArray((item as { pieces?: unknown }).pieces)
      ? ((item as { pieces: unknown[] }).pieces.map(pieceOf).filter((piece) => piece != null) as FrozenPiece[])
      : [];
    looks.push({ lookNumber: number, pieces });
  }
  return looks;
}

function petOf(value: unknown, petName: string): RunwayPetSnap | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const row = value as Record<string, unknown>;
  const look = row.look;
  if (!look || typeof look !== 'object' || typeof (look as { coat?: unknown }).coat !== 'string') {
    return null;
  }
  const breedId = str(row.breedId);
  if (!breedId) {
    return null;
  }
  const ageDays = typeof row.ageDays === 'number' ? row.ageDays : 0;
  const weight = typeof row.weight === 'number' ? row.weight : 1;
  return {
    snapshotId: str(row.snapshotId) ?? `snap-${breedId}`,
    source: row.source === 'npc' || row.source === 'friend' || row.source === 'self' ? row.source : 'friend',
    name: str(row.name) ?? petName,
    species: row.species === 'cat' ? 'cat' : 'dog',
    breedId,
    look: look as Look,
    ageDays,
    weight,
  };
}

function submissionsOf(value: unknown): RunwaySubmission[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const rows: RunwaySubmission[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const row = item as Record<string, unknown>;
    const submissionId = str(row.submission_id);
    const petName = str(row.pet_name) ?? 'Pet';
    const pet = petOf(row.pet_snapshot, petName);
    const looks = looksOf(row.looks);
    const submittedAt = millis(row.submitted_at);
    if (!submissionId || !pet || looks.length === 0 || submittedAt == null) {
      continue;
    }
    rows.push({
      submissionId,
      playerId: str(row.player_id) ?? undefined,
      pet,
      looks,
      submittedAt,
      claimedCostumeIds: strList(row.claimed_costume_ids),
    });
  }
  return rows;
}

function contestantsOf(value: unknown): RunwayContestant[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const rows: RunwayContestant[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const row = item as Record<string, unknown>;
    const playerId = str(row.player_id);
    if (!playerId) {
      continue;
    }
    rows.push({
      playerId,
      handle: str(row.handle) ?? 'friend',
      petName: str(row.pet_name),
      status: str(row.status) ?? 'invited',
      submitted: row.submitted === true,
      submissionId: str(row.submission_id),
      isMe: row.is_me === true,
      voteCount: typeof row.vote_count === 'number' ? row.vote_count : null,
    });
  }
  return rows;
}

export function parseShowDetail(data: unknown): RunwayShowDetail | null {
  if (!data || typeof data !== 'object' || (data as { ok?: unknown }).ok !== true) {
    return null;
  }
  const row = data as Record<string, unknown>;
  const id = str(row.id);
  const themeId = str(row.theme_id);
  const trackId = str(row.track_id);
  const deadlineAt = millis(row.deadline);
  const createdAt = millis(row.created_at) ?? Date.now();
  if (!id || !themeId || !trackId || deadlineAt == null) {
    return null;
  }
  return {
    id,
    themeId,
    trackId,
    hostPlayerId: str(row.host_player_id) ?? '',
    hostHandle: str(row.host_handle) ?? 'host',
    amHost: row.am_host === true,
    invitesSentAt: millis(row.invites_sent_at) ?? createdAt,
    deadlineAt,
    votingOpensAt: millis(row.voting_opens_at),
    pollClosesAt: millis(row.poll_closes_at),
    resultsRevealedAt: millis(row.results_revealed_at),
    createdAt,
    myStatus: str(row.my_status) ?? 'accepted',
    myVoteSubmissionId: str(row.my_vote_submission_id),
    canPeek: row.can_peek === true,
    claimedCostumeIds: strList(row.claimed_costume_ids),
    contestants: contestantsOf(row.contestants),
    submissions: submissionsOf(row.submissions),
  };
}

export function parseShowList(data: unknown): { shows: RunwayShowSummary[]; recent: RecentInvitee[] } | null {
  if (!data || typeof data !== 'object' || (data as { ok?: unknown }).ok !== true) {
    return null;
  }
  const row = data as Record<string, unknown>;
  const shows: RunwayShowSummary[] = [];
  if (Array.isArray(row.shows)) {
    for (const item of row.shows) {
      if (!item || typeof item !== 'object') {
        continue;
      }
      const show = item as Record<string, unknown>;
      const id = str(show.id);
      const themeId = str(show.theme_id);
      if (!id || !themeId) {
        continue;
      }
      shows.push({
        id,
        themeId,
        trackId: str(show.track_id) ?? '',
        hostHandle: str(show.host_handle) ?? 'host',
        myStatus: str(show.my_status) ?? 'accepted',
        deadlineAt: millis(show.deadline),
        votingOpensAt: millis(show.voting_opens_at),
        pollClosesAt: millis(show.poll_closes_at),
        resultsRevealedAt: millis(show.results_revealed_at),
        createdAt: millis(show.created_at) ?? 0,
        amHost: show.am_host === true,
        contestantCount: typeof show.contestant_count === 'number' ? show.contestant_count : 0,
        submittedCount: typeof show.submitted_count === 'number' ? show.submitted_count : 0,
        winnerHandles: strList(show.winner_handles),
      });
    }
  }
  const recent: RecentInvitee[] = [];
  if (Array.isArray(row.recent_invitees)) {
    for (const item of row.recent_invitees) {
      if (!item || typeof item !== 'object') {
        continue;
      }
      const userId = str((item as { user_id?: unknown }).user_id);
      const handle = str((item as { handle?: unknown }).handle);
      if (userId && handle) {
        recent.push({ userId, handle });
      }
    }
  }
  return { shows, recent };
}

/** Where a loaded friend show should open. */
export function routeShow(show: RunwayShowDetail, now: number): ShowStep {
  const revealed = show.resultsRevealedAt != null || (show.pollClosesAt != null && show.pollClosesAt <= now);
  if (revealed) {
    return 'results';
  }
  const votingOpen = show.votingOpensAt != null && show.votingOpensAt <= now;
  if (votingOpen) {
    return show.myVoteSubmissionId ? 'status' : 'vote';
  }
  const submitted = show.myStatus === 'submitted' || show.contestants.some((row) => row.isMe && row.submitted);
  if (show.deadlineAt <= now && !submitted) {
    return 'judge';
  }
  if (submitted) {
    return 'status';
  }
  if (show.myStatus === 'invited') {
    return 'join';
  }
  return 'backstage';
}

export function localShowFromDetail(show: RunwayShowDetail): LocalRunwayShow {
  return {
    id: show.id,
    mode: 'friends',
    themeId: show.themeId,
    trackId: show.trackId,
    hostPlayerId: show.hostPlayerId,
    createdAt: show.createdAt,
    deadlineAt: show.deadlineAt,
    invitesSentAt: show.invitesSentAt,
    submissions: show.submissions,
  };
}

export function mySubmissionId(show: RunwayShowDetail): string | undefined {
  return show.contestants.find((row) => row.isMe)?.submissionId ?? undefined;
}
