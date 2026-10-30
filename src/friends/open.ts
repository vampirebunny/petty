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
