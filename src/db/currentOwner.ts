import { activeClient } from '../sync/clientScope';

let ownerId: string | null = null;
let ready = false;

export function setCurrentOwner(id: string): void {
  ownerId = id;
}

export function currentOwner(): string {
  const bound = activeClient()?.ownerId;
  if (bound) {
    return bound;
  }
  if (!ownerId) {
    throw new Error('owner not ready');
  }
  return ownerId;
}

export function markOwnerReady(): void {
  ready = true;
}

export function ownerIsReady(): boolean {
  if (activeClient()?.ownerId) {
    return true;
  }
  return ready && ownerId != null;
}
