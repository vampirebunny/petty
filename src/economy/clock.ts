import { activeClient } from '../sync/clientScope';

export function localDay(now: number): string {
  const offset = activeClient()?.utcOffsetMinutes;
  const date = offset == null ? new Date(now) : new Date(now + offset * 60_000);
  const month = String((offset == null ? date.getMonth() : date.getUTCMonth()) + 1).padStart(2, '0');
  const day = String(offset == null ? date.getDate() : date.getUTCDate()).padStart(2, '0');
  const year = offset == null ? date.getFullYear() : date.getUTCFullYear();
  return `${year}-${month}-${day}`;
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
