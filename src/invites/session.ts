type Listener = () => void;

const moments = new Set<Listener>();
const pushes = new Set<Listener>();

let pushWaiting = false;

/** A completed player action. App open and the foreground tick do not call this. */
export function noteInviteMoment(): void {
  for (const listener of moments) {
    listener();
  }
}

export function onInviteMoment(listener: Listener): () => void {
  moments.add(listener);
  return () => {
    moments.delete(listener);
  };
}

/** The NPC-invite push was tapped. The envelope is created when Home can show it. */
export function requestNpcInvite(): void {
  pushWaiting = true;
  for (const listener of pushes) {
    listener();
  }
}

export function consumeNpcInviteRequest(): boolean {
  const waiting = pushWaiting;
  pushWaiting = false;
  return waiting;
}

export function onNpcInviteRequest(listener: Listener): () => void {
  pushes.add(listener);
  return () => {
    pushes.delete(listener);
  };
}

let friendGameInvite = false;

export function setFriendGameInviteOpen(open: boolean): void {
  friendGameInvite = open;
}

export function friendGameInviteOpen(): boolean {
  return friendGameInvite;
}
