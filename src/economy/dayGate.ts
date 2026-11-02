import { accrualNow } from '../db/accountMeta';
import { activeClient } from '../sync/clientScope';
import { calendarDaysBetween, localDay } from './clock';
import { economyConfig } from './economyConfig';

export type DayOwner = {
  lastTrustedTime: number;
  loginLastClaimedDay: string | null;
  utcOffset: number | null;
  dayAcceptedAt: number;
};

function deviceOffset(now: number): number | null {
  const bound = activeClient()?.utcOffsetMinutes;
  if (bound != null) {
    return bound;
  }
  const offset = -new Date(now).getTimezoneOffset();
  return Number.isFinite(offset) ? offset : null;
}

const hourMs = 3_600_000;

/**
 * The local day a grant may count against.
 * Trusted time ignores a wall-clock jump. A timezone change inside the gap
 * does not open a day. Offline, at most the next local day is provisional.
 */
export function acceptedLocalDay(wallNow: number, owner: DayOwner): string | null {
  const trusted = accrualNow(wallNow);
  if (owner.lastTrustedTime > 0 && wallNow < owner.lastTrustedTime && trusted == null) {
    return null;
  }
  if (trusted != null && trusted < owner.lastTrustedTime) {
    return null;
  }
  const basis = trusted ?? wallNow;
  const offset = deviceOffset(basis);
  const gapMs = economyConfig.dayBoundary.minGapHours * hourMs;
  const elapsed = trusted != null && owner.dayAcceptedAt > 0 ? trusted - owner.dayAcceptedAt : 0;
  const zoneJump = owner.utcOffset != null && offset != null && owner.utcOffset !== offset;
  if (zoneJump && elapsed < gapMs) {
    return owner.loginLastClaimedDay;
  }
  const day = localDay(basis);
  if (!owner.loginLastClaimedDay) {
    return day;
  }
  if (day < owner.loginLastClaimedDay) {
    return null;
  }
  const ahead = calendarDaysBetween(owner.loginLastClaimedDay, day);
  if (ahead <= 1) {
    return day;
  }
  if (trusted != null && day <= localDay(trusted)) {
    return day;
  }
  return null;
}
