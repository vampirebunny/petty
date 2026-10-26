let phase: AgeGatePhase = 'loading';
const listeners = new Set<(next: AgeGatePhase) => void>();

export type AgeGatePhase = 'loading' | 'consent' | 'unavailable' | 'ready';

export function readAgeGatePhase(): AgeGatePhase {
  return phase;
}

export function setAgeGatePhase(next: AgeGatePhase): void {
  if (phase === next) {
    return;
  }
  phase = next;
  for (const listener of listeners) {
    listener(phase);
  }
}

export function onAgeGatePhase(listener: (next: AgeGatePhase) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
