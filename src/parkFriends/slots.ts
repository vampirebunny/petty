export type SlotFriend = {
  userId: string;
  enteredAt: number;
};

function byArrival(a: SlotFriend, b: SlotFriend): number {
  if (a.enteredAt !== b.enteredAt) {
    return a.enteredAt - b.enteredAt;
  }
  return a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0;
}

/** Keep friends already on screen, then fill empty slots with whoever arrived earliest. */
export function visibleFriends<T extends SlotFriend>(
  present: readonly T[],
  shownIds: readonly string[],
  cap: number,
): { shown: T[]; waiting: T[] } {
  const byId = new Map(present.map((friend) => [friend.userId, friend]));
  const shown: T[] = [];
  for (const id of shownIds) {
    const friend = byId.get(id);
    if (friend && shown.length < cap) {
      shown.push(friend);
    }
  }
  const shownSet = new Set(shown.map((friend) => friend.userId));
  const rest = present.filter((friend) => !shownSet.has(friend.userId)).sort(byArrival);
  while (shown.length < cap && rest.length > 0) {
    const next = rest.shift();
    if (next) {
      shown.push(next);
    }
  }
  shown.sort(byArrival);
  return { shown, waiting: rest };
}
