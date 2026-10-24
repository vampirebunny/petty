const listeners = new Set<() => void>();

export function onAgeGateRefresh(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function requestAgeGateRefresh(): void {
  for (const listener of listeners) {
    listener();
  }
}
