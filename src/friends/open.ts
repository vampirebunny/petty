const listeners = new Set<() => void>();

export function requestFriendModal(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function onFriendModalRequest(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const gameListeners = new Set<(raceId: string | null) => void>();

export function requestFriendGame(raceId: string | null): void {
  for (const listener of gameListeners) {
    listener(raceId);
  }
}

export function onFriendGameRequest(listener: (raceId: string | null) => void): () => void {
  gameListeners.add(listener);
  return () => {
    gameListeners.delete(listener);
  };
}

const runwayListeners = new Set<(showId: string | null) => void>();

export function requestRunwayShow(showId: string | null): void {
  for (const listener of runwayListeners) {
    listener(showId);
  }
}

export function onRunwayShowRequest(listener: (showId: string | null) => void): () => void {
  runwayListeners.add(listener);
  return () => {
    runwayListeners.delete(listener);
  };
}

export type RunwayNotice = { showId: string; message: string };

const runwayNoticeListeners = new Set<(notice: RunwayNotice) => void>();
const pendingRunwayNotices: RunwayNotice[] = [];

export function requestRunwayNotice(notice: RunwayNotice): void {
  if (runwayNoticeListeners.size === 0) {
    pendingRunwayNotices.push(notice);
    return;
  }
  for (const listener of runwayNoticeListeners) {
    listener(notice);
  }
}

export function onRunwayNotice(listener: (notice: RunwayNotice) => void): () => void {
  runwayNoticeListeners.add(listener);
  const queued = pendingRunwayNotices.splice(0);
  for (const notice of queued) {
    listener(notice);
  }
  return () => {
    runwayNoticeListeners.delete(listener);
  };
}

export type FriendAcceptNotice = {
  raceId: string;
  message: string;
  /** Hosts and friends who already accepted open the waiting room. Pending invitees open the invite. */
  joined: boolean;
};

const acceptNoticeListeners = new Set<(notice: FriendAcceptNotice) => void>();
const pendingAcceptNotices: FriendAcceptNotice[] = [];

export function requestFriendAcceptNotice(notice: FriendAcceptNotice): void {
  if (acceptNoticeListeners.size === 0) {
    pendingAcceptNotices.push(notice);
    return;
  }
  for (const listener of acceptNoticeListeners) {
    listener(notice);
  }
}

export function onFriendAcceptNotice(listener: (notice: FriendAcceptNotice) => void): () => void {
  acceptNoticeListeners.add(listener);
  const queued = pendingAcceptNotices.splice(0);
  for (const notice of queued) {
    listener(notice);
  }
  return () => {
    acceptNoticeListeners.delete(listener);
  };
}

export type FriendAcceptOpen = { raceId: string; joined: boolean };

const acceptOpenListeners = new Set<(target: FriendAcceptOpen) => void>();
let pendingAcceptOpen: FriendAcceptOpen | null = null;

export function requestFriendAcceptOpen(target: FriendAcceptOpen): void {
  if (acceptOpenListeners.size === 0) {
    pendingAcceptOpen = target;
    return;
  }
  for (const listener of acceptOpenListeners) {
    listener(target);
  }
}

export function onFriendAcceptOpen(listener: (target: FriendAcceptOpen) => void): () => void {
  acceptOpenListeners.add(listener);
  if (pendingAcceptOpen) {
    const target = pendingAcceptOpen;
    pendingAcceptOpen = null;
    listener(target);
  }
  return () => {
    acceptOpenListeners.delete(listener);
  };
}
