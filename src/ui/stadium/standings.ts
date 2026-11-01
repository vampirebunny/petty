export type TimeStanding = {
  key: string;
  name: string;
  finishMs: number | null;
  place: number | null;
  mine: boolean;
};

export function withPlaces<T extends { place: number | null }>(
  rows: T[],
  metric: (row: T) => number | null,
  lowerWins = true,
): T[] {
  const official = rows.length > 0 && rows.every((row) => row.place != null);
  if (official) {
    return [...rows].sort((a, b) => (a.place ?? 0) - (b.place ?? 0));
  }
  const ranked = [...rows].sort((a, b) => {
    const left = metric(a);
    const right = metric(b);
    if (left == null && right == null) {
      return 0;
    }
    if (left == null) {
      return 1;
    }
    if (right == null) {
      return -1;
    }
    return lowerWins ? left - right : right - left;
  });
  return ranked.map((row, index) => ({ ...row, place: index + 1 }));
}

export function withFinishPlaces(rows: TimeStanding[]): TimeStanding[] {
  return withPlaces(rows, (row) => row.finishMs, true);
}

export function minePlaceOf(rows: { mine: boolean; place: number | null }[] | null | undefined): number | null {
  return rows?.find((row) => row.mine)?.place ?? null;
}
