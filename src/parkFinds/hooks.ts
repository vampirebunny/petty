import type { ParkFindFoundEvent } from './types';

type Listener = (event: ParkFindFoundEvent) => void;

const listeners = new Set<Listener>();

export function onParkFindFound(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitParkFindFound(event: ParkFindFoundEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      // Later phases own their handlers; a bad listener must not break the find.
    }
  }
}
