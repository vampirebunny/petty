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
  standings: { handle: string; votes: number }[];
  voted: boolean;
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
  if (Number.isFinite(parsed)) {
    return parsed;
  }
  const iso = Date.parse(value.replace(' ', 'T'));
  return Number.isFinite(iso) ? iso : null;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
    return null;
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
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

function lookNumberOf(value: unknown): 1 | 2 | 3 | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  if (n === 1 || n === 2 || n === 3) {
    return n;
  }
  return null;
}

function piecesOf(value: unknown): FrozenPiece[] {
  let piecesRaw = value;
  const nested = asObject(piecesRaw);
  if (nested) {
    piecesRaw = nested.pieces ?? piecesRaw;
  }
  return asArray(piecesRaw).map(pieceOf).filter((piece) => piece != null) as FrozenPiece[];
}

function looksOf(value: unknown): FrozenLook[] {
  const raw = asArray(value);
  const looks: FrozenLook[] = [];
  for (const item of raw) {
    const row = asObject(item);
    if (!row) {
      continue;
    }
    const number = lookNumberOf(row.look_number ?? row.lookNumber);
    if (number == null) {
      continue;
    }
    looks.push({ lookNumber: number, pieces: piecesOf(row.pieces) });
  }
  if (looks.length === 0) {
    raw.forEach((item, index) => {
      if (index > 2) {
        return;
      }
      const row = asObject(item);
      if (!row) {
        return;
      }
      looks.push({ lookNumber: (index + 1) as 1 | 2 | 3, pieces: piecesOf(row.pieces) });
    });
  }
  looks.sort((a, b) => a.lookNumber - b.lookNumber);
  return looks;
}

function petOf(value: unknown, petName: string): RunwayPetSnap | null {
  const row = asObject(value);
  if (!row) {
    return null;
  }
  const look = asObject(row.look);
  if (!look || typeof look.coat !== 'string') {
    return null;
  }
  const breedId = str(row.breedId) ?? str(row.breed_id);
  if (!breedId) {
    return null;
  }
  const ageDays = typeof row.ageDays === 'number' ? row.ageDays : 0;
  const weight = typeof row.weight === 'number' ? row.weight : 1;
  return {
    snapshotId: str(row.snapshotId) ?? str(row.snapshot_id) ?? `snap-${breedId}`,
    source: row.source === 'npc' || row.source === 'friend' || row.source === 'self' ? row.source : 'friend',
    name: str(row.name) ?? petName,
    species: row.species === 'cat' ? 'cat' : 'dog',
    breedId,
    look: look as Look,
    ageDays,
    weight,
  };
}

function standingsOf(value: unknown): { handle: string; votes: number }[] {
  const rows: { handle: string; votes: number }[] = [];
  for (const item of asArray(value)) {
    const row = asObject(item);
    if (!row) {
      continue;
    }
    const handle = str(row.handle);
    const votes = typeof row.votes === 'number' ? row.votes : typeof row.votes === 'string' ? Number(row.votes) : NaN;
    if (!handle || !Number.isFinite(votes)) {
      continue;
    }
    rows.push({ handle, votes });
  }
  return rows;
}

function submissionsOf(value: unknown): RunwaySubmission[] {
  const rows: RunwaySubmission[] = [];
  for (const item of asArray(value)) {
    const row = asObject(item);
    if (!row) {
      continue;
    }
    const submissionId = str(row.submission_id) ?? str(row.submissionId);
    const petName = str(row.pet_name) ?? str(row.petName) ?? 'Pet';
    const pet = petOf(row.pet_snapshot ?? row.petSnapshot, petName);
    const looks = looksOf(row.looks);
    const submittedAt = millis(row.submitted_at ?? row.submittedAt) ?? 0;
    if (!submissionId || !pet || looks.length === 0) {
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
        standings: standingsOf(show.standings),
        voted: show.voted === true,
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

export function votingStillOpen(
  show: { votingOpensAt: number | null; pollClosesAt: number | null; resultsRevealedAt: number | null },
  now: number,
): boolean {
  return (
    show.resultsRevealedAt == null &&
    show.votingOpensAt != null &&
    show.votingOpensAt <= now &&
    (show.pollClosesAt == null || show.pollClosesAt > now)
  );
}

/** A show this player started, accepted, or dismissed. */
export function joinedShow(show: { amHost: boolean; myStatus: string; resultsRevealedAt: number | null }): boolean {
  if (show.myStatus === 'withdrawn') {
    return false;
  }
  if (show.myStatus === 'declined') {
    return !show.amHost;
  }
  if (show.myStatus === 'invited') {
    return show.amHost;
  }
  return show.amHost || show.myStatus === 'accepted' || show.myStatus === 'submitted' || show.myStatus === 'judge';
}

/** Looks are still open for this player to pick. */
export function showNeedsLooks(
  show: { amHost: boolean; myStatus: string; deadlineAt: number | null },
  now: number,
): boolean {
  if (show.myStatus === 'submitted' || show.myStatus === 'judge') {
    return false;
  }
  if (show.deadlineAt != null && show.deadlineAt <= now) {
    return false;
  }
  return show.amHost || show.myStatus === 'accepted';
}

export function joinedShowHint(
  show: {
    amHost: boolean;
    myStatus: string;
    deadlineAt: number | null;
    votingOpensAt: number | null;
    pollClosesAt: number | null;
    resultsRevealedAt: number | null;
    voted: boolean;
  },
  now: number,
): string {
  if (show.resultsRevealedAt != null) {
    return 'Results in';
  }
  if (show.myStatus === 'declined') {
    return 'You were invited';
  }
  if (showNeedsLooks(show, now)) {
    return 'Select looks';
  }
  if (votingStillOpen(show, now)) {
    return show.voted ? 'Vote already cast; polls still open' : 'Cast your vote';
  }
  if (submissionsAreClosed(show, now)) {
    return 'Submissions are closed';
  }
  return 'You already submitted';
}

/** Deadline has passed and this player has nothing to do until voting or results. */
export function submissionsAreClosed(
  show: {
    amHost: boolean;
    myStatus: string;
    deadlineAt: number | null;
    votingOpensAt: number | null;
    pollClosesAt: number | null;
    resultsRevealedAt: number | null;
  },
  now: number,
): boolean {
  if (show.resultsRevealedAt != null || show.myStatus === 'declined' || showNeedsLooks(show, now) || votingStillOpen(show, now)) {
    return false;
  }
  return show.myStatus === 'judge' || (show.deadlineAt != null && show.deadlineAt <= now);
}

/** Joined shows that still belong on the lobby. A seen results card, or a closed-submissions card the player already opened, stays in Past Shows. */
export function showInJoinedLobby(
  show: {
    id: string;
    amHost: boolean;
    myStatus: string;
    deadlineAt: number | null;
    votingOpensAt: number | null;
    pollClosesAt: number | null;
    resultsRevealedAt: number | null;
    voted: boolean;
  },
  now: number,
  seenResults: readonly string[],
  seenClosed: readonly string[],
): boolean {
  if (!joinedShow(show)) {
    return false;
  }
  if (show.resultsRevealedAt != null && seenResults.includes(show.id)) {
    return false;
  }
  return !(submissionsAreClosed(show, now) && seenClosed.includes(show.id));
}

export function lobbyShowLabel(
  show: {
    myStatus: string;
    votingOpensAt: number | null;
    pollClosesAt: number | null;
    resultsRevealedAt: number | null;
    voted: boolean;
  },
  now: number,
): string {
  if (show.myStatus === 'invited') {
    return 'Join';
  }
  if (votingStillOpen(show, now)) {
    return show.voted ? 'Vote already cast; polls still open' : 'Cast your vote';
  }
  return 'Open';
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
  if (show.myStatus === 'invited' || show.myStatus === 'declined') {
    return 'join';
  }
  return 'backstage';
}

/** Keep every friend already parsed, and take a newer copy when the reload has their looks. */
export function mergeShowDetails(previous: RunwayShowDetail, next: RunwayShowDetail): RunwayShowDetail {
  if (previous.id !== next.id) {
    return next;
  }
  const byId = new Map<string, RunwaySubmission>();
  for (const row of previous.submissions) {
    byId.set(row.submissionId, row);
  }
  for (const row of next.submissions) {
    const prior = byId.get(row.submissionId);
    if (!prior || row.looks.length >= prior.looks.length) {
      byId.set(row.submissionId, row);
    }
  }
  return {
    ...next,
    submissions: [...byId.values()].sort((a, b) => a.submittedAt - b.submittedAt),
    contestants: next.contestants.length > 0 ? next.contestants : previous.contestants,
  };
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
