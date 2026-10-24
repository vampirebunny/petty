export type AuthTransition = 'idle' | 'linking' | 'restoring' | 'reconciling' | 'deleting' | 'reauth';

let transition: AuthTransition = 'idle';
let generation = 0;
const installListeners = new Set<() => void>();

export function authTransition(): AuthTransition {
  return transition;
}

/** Leaving idle bumps the save generation so a save already on `saveQueue` does not write. */
export function setAuthTransition(next: AuthTransition): void {
  if (next !== 'idle' && transition === 'idle') {
    bumpSaveGeneration();
  }
  transition = next;
}

export function saveGeneration(): number {
  return generation;
}

export function bumpSaveGeneration(): number {
  generation += 1;
  return generation;
}

export function onInstallState(listener: () => void): () => void {
  installListeners.add(listener);
  return () => {
    installListeners.delete(listener);
  };
}

export function notifyInstallState(): void {
  bumpSaveGeneration();
  for (const listener of installListeners) {
    listener();
  }
}

let settleRequest: (() => void) | null = null;

export function setSettleRequest(listener: (() => void) | null): void {
  settleRequest = listener;
}

export function requestSettle(): void {
  settleRequest?.();
}
