const listeners = new Set<() => void>();

/** A playdate push arrived. Listeners refresh the unseen count and do not open a screen. */
export function onFriendPlaydatePush(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function noteFriendPlaydatePush(): void {
  for (const listener of listeners) {
    listener();
  }
}
