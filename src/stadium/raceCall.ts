type Listener = (raceId: string | null) => void;

const listeners = new Set<Listener>();
let pending: { raceId: string | null } | null = null;

// A tap on the race notification. Held until Home is listening, so a cold start still reaches the gate.
export function requestGate(raceId: string | null): void {
  if (listeners.size === 0) {
    pending = { raceId };
    return;
  }
  listeners.forEach((listener) => listener(raceId));
}

export function onGateRequest(listener: Listener): () => void {
  listeners.add(listener);
  if (pending) {
    const { raceId } = pending;
    pending = null;
    listener(raceId);
  }
  return () => {
    listeners.delete(listener);
  };
}
