type Snapshot = {
  open: boolean;
  prefill: string | null;
  scanning: boolean;
  scanFrom: 'find' | 'code';
  via: 'handle' | 'qr';
};

let snapshot: Snapshot = { open: false, prefill: null, scanning: false, scanFrom: 'find', via: 'handle' };
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function findFriendsSnapshot(): Snapshot {
  return snapshot;
}

export function openFindFriends(prefill?: string | null, via: 'handle' | 'qr' = 'handle'): void {
  snapshot = {
    open: true,
    prefill: prefill && prefill.length > 0 ? prefill : null,
    scanning: false,
    scanFrom: 'find',
    via,
  };
  emit();
}

export function openFriendScanner(from: 'find' | 'code'): void {
  snapshot = {
    open: true,
    prefill: from === 'find' ? snapshot.prefill : null,
    scanning: true,
    scanFrom: from,
    via: snapshot.via,
  };
  emit();
}

export function closeFriendScanner(): void {
  if (snapshot.scanFrom === 'code') {
    snapshot = { open: false, prefill: null, scanning: false, scanFrom: 'find', via: 'handle' };
  } else {
    snapshot = { ...snapshot, scanning: false, via: 'handle' };
  }
  emit();
}

export function closeFindFriends(): void {
  snapshot = { open: false, prefill: null, scanning: false, scanFrom: 'find', via: 'handle' };
  emit();
}

export function onFindFriends(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
