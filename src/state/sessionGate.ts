export type AuthTransition = 'idle' | 'linking' | 'restoring' | 'reconciling' | 'deleting' | 'reauth';

let transition: AuthTransition = 'idle';
let generation = 0;
const installListeners = new Set<() => void>();
const transitionListeners = new Set<() => void>();

export function authTransition(): AuthTransition {
  return transition;
}

export function onAuthTransition(listener: () => void): () => void {
  transitionListeners.add(listener);
  return () => {
    transitionListeners.delete(listener);
  };
}

/** Leaving idle bumps the save generation so a save already on `saveQueue` does not write. */
export function setAuthTransition(next: AuthTransition): void {
  if (next !== 'idle' && transition === 'idle') {
    bumpSaveGeneration();
  }
  transition = next;
  for (const listener of transitionListeners) {
    listener();
  }
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

let settleNextInstall = false;
let installFinished: (() => void) | null = null;

/** Reload the pet from SQLite and settle that pet once. Resolves after the reload. */
export function prepareInstalledPet(): Promise<void> {
  settleNextInstall = true;
  return new Promise((resolve) => {
    installFinished = resolve;
    notifyInstallState();
  });
}

export function consumeInstalledSettle(): boolean {
  const due = settleNextInstall;
  settleNextInstall = false;
  return due;
}

export function finishInstalledPet(): void {
  const done = installFinished;
  installFinished = null;
  done?.();
}

let suppressOpenPath = false;

export function setSuppressOpenPath(suppressed: boolean): void {
  suppressOpenPath = suppressed;
}

export function openPathSuppressed(): boolean {
  return suppressOpenPath;
}

let playHereRequest: (() => void) | null = null;

export function setPlayHereRequest(listener: (() => void) | null): void {
  playHereRequest = listener;
}

export function requestPlayHere(): void {
  playHereRequest?.();
}

let lockedSettle: (() => void) | null = null;

export function setLockedSettle(listener: (() => void) | null): void {
  lockedSettle = listener;
}

export function settleUnderLock(): void {
  lockedSettle?.();
}
