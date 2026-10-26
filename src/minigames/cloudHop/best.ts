export type PendingScore = {
  score: number;
  meters: number;
  petName: string;
  durationS: number;
};

export function keepBest(current: PendingScore | null, next: PendingScore): PendingScore {
  if (!current || next.score > current.score) {
    return next;
  }
  return current;
}
