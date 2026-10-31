import { visibleFriends } from '../slots';

function friend(userId: string, enteredAt: number) {
  return { userId, enteredAt };
}

describe('park friend slots', () => {
  const present = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id, index) => friend(id, 1000 + index));

  it('shows the five who arrived earliest', () => {
    const { shown, waiting } = visibleFriends(present, [], 5);
    expect(shown.map((row) => row.userId)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(waiting.map((row) => row.userId)).toEqual(['f', 'g']);
  });

  it('keeps someone visible when a later friend arrives, then fills the earliest waiter', () => {
    const first = visibleFriends(present, [], 5);
    const withLate = [...present, friend('z', 500)];
    const held = visibleFriends(withLate, first.shown.map((row) => row.userId), 5);
    expect(held.shown.map((row) => row.userId).sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
    const afterLeave = visibleFriends(
      withLate.filter((row) => row.userId !== 'a'),
      held.shown.map((row) => row.userId),
      5,
    );
    expect(afterLeave.shown.map((row) => row.userId).sort()).toEqual(['b', 'c', 'd', 'e', 'z']);
  });
});
