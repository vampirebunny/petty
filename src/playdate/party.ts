export const maxPlaydateFriends = 5;

// A second tap clears a checked friend. A sixth friend is ignored.
export function toggleFriend(selected: readonly string[], id: string): string[] {
  if (selected.includes(id)) {
    return selected.filter((item) => item !== id);
  }
  if (selected.length >= maxPlaydateFriends) {
    return selected.slice();
  }
  return [...selected, id];
}

export function formatFriendNames(names: readonly string[]): string {
  if (names.length <= 1) {
    return names[0] ?? '';
  }
  if (names.length === 2) {
    return `${names[0]} and ${names[1]}`;
  }
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}
