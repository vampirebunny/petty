// Seasons for the scenery (tree colour, grass, blossoms) and the seasonal decor calendar.
// Foliage follows the hemisphere; holidays follow the calendar.

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export type DecorTheme = 'halloween' | 'harvest' | 'winterHolidays' | 'valentines' | 'spring' | 'easter' | 'summer';

export type Foliage = {
  season: Season;
  /** How much leaf cover a deciduous tree has, 0 bare to 1 full. */
  leaves: number;
  /** How far the leaves have turned, 0 green to 1 deep autumn. */
  turn: number;
  /** Spring blossom on trees and bushes, 0 to 1. */
  blossom: number;
  /** Grass and lawn liveliness, 0 dormant to 1 lush. */
  lush: number;
};

export type SeasonState = Foliage & { decor: DecorTheme[] };

let decorOverride: DecorTheme[] | null = null;

/** Force a decor set (for a dev menu or screenshots). Pass null to follow the calendar again. */
export function setDecorOverride(themes: DecorTheme[] | null): void {
  decorOverride = themes;
}

function smooth(a: number, b: number, x: number): number {
  const k = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
}

// Day of year (1-366) for a month (1-12) and day, in a non-leap year; close enough for scenery.
function doy(month: number, day: number): number {
  const starts = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  return starts[month - 1] + day;
}

export function foliageFor(date: Date, lat: number): Foliage {
  let day = doy(date.getMonth() + 1, date.getDate());
  if (lat < 0) {
    day = ((day + 182 - 1) % 365) + 1;
  }
  const turn = smooth(doy(9, 15), doy(10, 25), day) * (1 - smooth(doy(12, 5), doy(12, 20), day));
  const fall = smooth(doy(10, 28), doy(11, 28), day);
  const budding = smooth(doy(3, 25), doy(5, 5), day);
  const leaves = day < doy(7, 1) ? budding : 1 - fall;
  const blossom = smooth(doy(3, 22), doy(4, 8), day) * (1 - smooth(doy(4, 25), doy(5, 12), day));
  const lush = day < doy(7, 1) ? 0.35 + 0.65 * smooth(doy(3, 10), doy(5, 15), day) : 1 - 0.65 * smooth(doy(9, 20), doy(11, 30), day);
  let season: Season = 'winter';
  if (day >= doy(3, 20) && day < doy(6, 21)) {
    season = 'spring';
  } else if (day >= doy(6, 21) && day < doy(9, 22)) {
    season = 'summer';
  } else if (day >= doy(9, 22) && day < doy(12, 21)) {
    season = 'autumn';
  }
  return { season, leaves, turn, blossom, lush };
}

// Anonymous Gregorian algorithm.
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

// Fourth Thursday of November.
export function thanksgiving(year: number): Date {
  const first = new Date(year, 10, 1).getDay();
  return new Date(year, 10, 1 + ((4 - first + 7) % 7) + 21);
}

function at(year: number, month: number, day: number): number {
  return new Date(year, month - 1, day).getTime();
}

export function decorFor(date: Date): DecorTheme[] {
  if (decorOverride) {
    return decorOverride;
  }
  const y = date.getFullYear();
  const now = new Date(y, date.getMonth(), date.getDate()).getTime();
  const themes: DecorTheme[] = [];
  const turkey = thanksgiving(y).getTime();
  if (now >= at(y, 10, 1) && now <= at(y, 10, 31)) {
    themes.push('halloween');
  }
  if (now >= at(y, 11, 1) && now <= turkey) {
    themes.push('harvest');
  }
  if (now > turkey || now <= at(y, 1, 6)) {
    themes.push('winterHolidays');
  }
  if (now >= at(y, 2, 1) && now <= at(y, 2, 14)) {
    themes.push('valentines');
  }
  const easter = easterSunday(y).getTime();
  if (now >= easter - 7 * 86400000 && now <= easter + 86400000) {
    themes.push('easter');
  }
  if (now >= at(y, 3, 20) && now <= at(y, 5, 31)) {
    themes.push('spring');
  }
  if (now >= at(y, 6, 21) && now <= at(y, 8, 31)) {
    themes.push('summer');
  }
  return themes;
}

export function seasonAt(date: Date, lat: number): SeasonState {
  return { ...foliageFor(date, lat), decor: decorFor(date) };
}
