import type { SkyState } from '../actor/sky';
import { phaseOf } from '../actor/timeOfDay';
import type { ParkFindCatalogRow } from './types';

export type ConditionOverrides = {
  season?: 'spring' | 'summer' | 'fall' | 'winter' | 'autumn';
  weather?: 'rain' | 'snow' | 'rainbow' | null;
  time?: 'dawn' | 'night' | null;
  fullMoon?: boolean;
  /** Local date as Date; used for date windows and time/moon when set. */
  date?: Date;
};

function mmdd(date: Date): number {
  return (date.getMonth() + 1) * 100 + date.getDate();
}

/** Inclusive local date window; may cross new year (e.g. 12-31..01-01). */
export function inDateWindow(date: Date, value: string): boolean {
  const match = /^(\d{2})-(\d{2})\.\.(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }
  const start = Number(match[1]) * 100 + Number(match[2]);
  const end = Number(match[3]) * 100 + Number(match[4]);
  const day = mmdd(date);
  if (start <= end) {
    return day >= start && day <= end;
  }
  return day >= start || day <= end;
}

/**
 * Whether any yearly occurrence of the window overlaps [from, to] (local dates).
 * Used for holiday progress visibility since adoption.
 */
export function dateWindowOccurredSince(from: Date, to: Date, value: string): boolean {
  if (to < from) {
    return false;
  }
  const match = /^(\d{2})-(\d{2})\.\.(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }
  const startM = Number(match[1]);
  const startD = Number(match[2]);
  const endM = Number(match[3]);
  const endD = Number(match[4]);
  const fromY = from.getFullYear();
  const toY = to.getFullYear();
  for (let year = fromY - 1; year <= toY + 1; year += 1) {
    const start = new Date(year, startM - 1, startD, 0, 0, 0, 0);
    let end = new Date(year, endM - 1, endD, 23, 59, 59, 999);
    if (end < start) {
      end = new Date(year + 1, endM - 1, endD, 23, 59, 59, 999);
    }
    if (end >= from && start <= to) {
      return true;
    }
  }
  return false;
}

function mapSeason(season: string): string {
  return season === 'autumn' ? 'fall' : season;
}

export function conditionTrue(
  row: ParkFindCatalogRow,
  sky: SkyState,
  overrides: ConditionOverrides = {},
): boolean {
  const date = overrides.date ?? sky.date;
  const phase = phaseOf(sky.solarHour);
  const season = mapSeason(overrides.season ?? sky.season.season);
  const precip = overrides.weather === undefined
    ? sky.weather.precip
    : overrides.weather === 'rainbow'
      ? null
      : overrides.weather;
  const rainbow =
    overrides.weather === 'rainbow'
      ? true
      : overrides.weather === null
        ? false
        : sky.weather.rainbow > 0.15;
  const timeOverride = overrides.time;
  const isDawn = timeOverride === 'dawn' || (timeOverride == null && phase === 'Dawn');
  const isNight =
    timeOverride === 'night' ||
    (timeOverride == null && (phase === 'Night' || phase === 'Evening'));
  const fullMoon =
    overrides.fullMoon ?? (sky.moon.name === 'full' || sky.moon.illumination >= 0.95);

  switch (row.condition_type) {
    case 'always':
      return true;
    case 'season':
      return mapSeason(row.condition_value ?? '') === season;
    case 'weather':
      if (row.condition_value === 'rainbow') {
        return rainbow;
      }
      return precip === row.condition_value;
    case 'time':
      if (row.condition_value === 'dawn') {
        return isDawn;
      }
      if (row.condition_value === 'night') {
        return isNight;
      }
      return false;
    case 'moon':
      return row.condition_value === 'full' && fullMoon && isNight;
    case 'date_window':
      return row.condition_value ? inDateWindow(date, row.condition_value) : false;
    default:
      return false;
  }
}
