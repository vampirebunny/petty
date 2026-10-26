export type LocalBest = { score: number; meters: number; farthest: number };

export type QueuedRun = {
  clientRunId: string;
  score: number;
  meters: number;
  petId: string | null;
};

export type BoardRow = {
  rank: number;
  handle: string;
  score: number;
  meters: number;
  at: string;
  mine: boolean;
};

export type Board = { rows: BoardRow[] };

export const emptyBest: LocalBest = { score: 0, meters: 0, farthest: 0 };

export function enqueueRun(queue: QueuedRun[], next: QueuedRun): QueuedRun[] {
  if (queue.some((row) => row.clientRunId === next.clientRunId)) {
    return queue;
  }
  return [...queue, next];
}

export function keepBest(current: LocalBest, next: { score: number; meters: number }): { best: LocalBest; isBest: boolean } {
  const isBest = next.score > current.score;
  return {
    isBest,
    best: {
      score: isBest ? next.score : current.score,
      meters: isBest ? next.meters : current.meters,
      farthest: Math.max(current.farthest, next.meters),
    },
  };
}

export function rankThisRun(rows: BoardRow[], score: number): number {
  const placed = rows.filter((row) => !row.mine).map((row) => ({ score: row.score, at: row.at, mine: false }));
  placed.push({ score, at: '9999-12-31T23:59:59.000Z', mine: true });
  placed.sort((a, b) => b.score - a.score || a.at.localeCompare(b.at));
  return placed.findIndex((row) => row.mine) + 1;
}

export function mergeLocal(rows: BoardRow[], best: LocalBest): BoardRow[] {
  if (best.score <= 0) {
    return rows.map((row) => ({ ...row }));
  }
  const next = rows.map((row) => ({ ...row }));
  const mine = next.find((row) => row.mine);
  if (!mine) {
    next.push({ rank: 0, handle: '', score: best.score, meters: best.meters, at: '1970-01-01T00:00:00.000Z', mine: true });
  } else if (best.score > mine.score) {
    mine.score = best.score;
    mine.meters = best.meters;
  }
  next.sort((a, b) => b.score - a.score || a.at.localeCompare(b.at));
  return next.map((row, index) => ({ ...row, rank: index + 1 }));
}
