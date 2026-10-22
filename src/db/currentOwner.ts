let ownerId: string | null = null;
let ready = false;

export function setCurrentOwner(id: string): void {
  ownerId = id;
}

export function currentOwner(): string {
  if (!ownerId) {
    throw new Error('owner not ready');
  }
  return ownerId;
}

export function markOwnerReady(): void {
  ready = true;
}

export function ownerIsReady(): boolean {
  return ready && ownerId != null;
}
