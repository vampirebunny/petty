export function localDay(now: number): string {
  const date = new Date(now);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function nextLocalMidnight(day: string): number {
  const [year, month, date] = day.split('-').map((part) => Number(part));
  return new Date(year, month - 1, date + 1, 0, 0, 0, 0).getTime();
}

export function calendarDaysBetween(fromDay: string, toDay: string): number {
  const from = nextLocalMidnight(fromDay) - 86_400_000;
  const to = nextLocalMidnight(toDay) - 86_400_000;
  return Math.round((to - from) / 86_400_000);
}
