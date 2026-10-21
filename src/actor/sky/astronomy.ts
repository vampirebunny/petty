import { MOON_BASE_MINUTE, MOON_FIRST_QUARTER, MOON_GAPS } from './moonCalendar';

// Where the sky is seen from. Only latitude really matters (day length and season); longitude
// shifts solar noon away from 12:00 on the clock.
export type Observer = { lat: number; lng: number };

export type SolarDay = {
  /** Local clock hours (e.g. 6.92 = 06:55). NaN in polar day or night. */
  sunrise: number;
  solarNoon: number;
  sunset: number;
  /** Highest sun altitude of the day, in degrees. */
  noonAltitude: number;
  /** -1 polar night, 0 normal, 1 midnight sun. */
  polar: -1 | 0 | 1;
};

export type MoonPhaseName =
  | 'new'
  | 'waxing crescent'
  | 'first quarter'
  | 'waxing gibbous'
  | 'full'
  | 'waning gibbous'
  | 'last quarter'
  | 'waning crescent';

export type MoonState = {
  /** 0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter, back to 1 = new. */
  phase: number;
  /** Lit fraction of the disc, 0 to 1. */
  illumination: number;
  waxing: boolean;
  name: MoonPhaseName;
};

const RAD = Math.PI / 180;
const SYNODIC_MINUTES = 29.530588853 * 24 * 60;

// Representative coordinates per time zone, so day length and seasons feel local without
// asking for location permission. Anything missing falls back to the zone's UTC offset.
const ZONES: Record<string, [number, number]> = {
  'America/New_York': [40.7, -74.0],
  'America/Toronto': [43.7, -79.4],
  'America/Detroit': [42.3, -83.0],
  'America/Chicago': [41.9, -87.6],
  'America/Denver': [39.7, -105.0],
  'America/Phoenix': [33.4, -112.1],
  'America/Los_Angeles': [34.1, -118.2],
  'America/Vancouver': [49.3, -123.1],
  'America/Anchorage': [61.2, -149.9],
  'Pacific/Honolulu': [21.3, -157.9],
  'America/Mexico_City': [19.4, -99.1],
  'America/Bogota': [4.7, -74.1],
  'America/Lima': [-12.0, -77.0],
  'America/Sao_Paulo': [-23.5, -46.6],
  'America/Argentina/Buenos_Aires': [-34.6, -58.4],
  'America/Santiago': [-33.4, -70.7],
  'Europe/London': [51.5, -0.1],
  'Europe/Dublin': [53.3, -6.3],
  'Europe/Lisbon': [38.7, -9.1],
  'Europe/Madrid': [40.4, -3.7],
  'Europe/Paris': [48.9, 2.4],
  'Europe/Berlin': [52.5, 13.4],
  'Europe/Amsterdam': [52.4, 4.9],
  'Europe/Rome': [41.9, 12.5],
  'Europe/Stockholm': [59.3, 18.1],
  'Europe/Warsaw': [52.2, 21.0],
  'Europe/Athens': [38.0, 23.7],
  'Europe/Istanbul': [41.0, 29.0],
  'Europe/Moscow': [55.8, 37.6],
  'Africa/Cairo': [30.0, 31.2],
  'Africa/Lagos': [6.5, 3.4],
  'Africa/Nairobi': [-1.3, 36.8],
  'Africa/Johannesburg': [-26.2, 28.0],
  'Asia/Dubai': [25.2, 55.3],
  'Asia/Kolkata': [22.6, 88.4],
  'Asia/Bangkok': [13.8, 100.5],
  'Asia/Ho_Chi_Minh': [10.8, 106.7],
  'Asia/Singapore': [1.35, 103.8],
  'Asia/Jakarta': [-6.2, 106.8],
  'Asia/Manila': [14.6, 121.0],
  'Asia/Shanghai': [31.2, 121.5],
  'Asia/Hong_Kong': [22.3, 114.2],
  'Asia/Seoul': [37.6, 127.0],
  'Asia/Tokyo': [35.7, 139.7],
  'Australia/Perth': [-31.95, 115.9],
  'Australia/Sydney': [-33.9, 151.2],
  'Australia/Melbourne': [-37.8, 145.0],
  'Pacific/Auckland': [-36.8, 174.8],
};

let observerOverride: Observer | null = null;

/** Pin the observer (tests, or a real location if the app ever has one). Pass null to go back to the time-zone guess. */
export function setObserver(observer: Observer | null): void {
  observerOverride = observer;
}

export function defaultObserver(): Observer {
  if (observerOverride) {
    return observerOverride;
  }
  let zone = '';
  try {
    zone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
  } catch {
    zone = '';
  }
  const known = ZONES[zone];
  if (known) {
    return { lat: known[0], lng: known[1] };
  }
  // Standard-time offset (the larger of January and July, so daylight saving is ignored).
  const year = new Date().getFullYear();
  const offset = Math.max(new Date(year, 0, 1).getTimezoneOffset(), new Date(year, 6, 1).getTimezoneOffset());
  return { lat: zone.startsWith('Australia') || zone.includes('Auckland') ? -34 : 40, lng: -offset / 4 };
}

function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / 86400000);
}

// NOAA's low-precision solar formulas: good to a minute or two, plenty for a sky.
function solarTerms(date: Date): { decl: number; eqTime: number } {
  const g = ((2 * Math.PI) / 365) * (dayOfYear(date) - 1 + (date.getHours() - 12) / 24);
  const eqTime =
    229.18 *
    (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl =
    0.006918 -
    0.399912 * Math.cos(g) +
    0.070257 * Math.sin(g) -
    0.006758 * Math.cos(2 * g) +
    0.000907 * Math.sin(2 * g) -
    0.002697 * Math.cos(3 * g) +
    0.00148 * Math.sin(3 * g);
  return { decl, eqTime };
}

export function solarDay(date: Date, observer: Observer = defaultObserver()): SolarDay {
  const { decl, eqTime } = solarTerms(date);
  const lat = observer.lat * RAD;
  const tzHours = -date.getTimezoneOffset() / 60;
  const solarNoon = 12 - eqTime / 60 - observer.lng / 15 + tzHours;
  const noonAltitude = 90 - Math.abs(observer.lat - decl / RAD);
  const cosH = (Math.cos(90.833 * RAD) - Math.sin(lat) * Math.sin(decl)) / (Math.cos(lat) * Math.cos(decl));
  if (cosH > 1) {
    return { sunrise: NaN, solarNoon, sunset: NaN, noonAltitude, polar: -1 };
  }
  if (cosH < -1) {
    return { sunrise: NaN, solarNoon, sunset: NaN, noonAltitude, polar: 1 };
  }
  const half = Math.acos(cosH) / RAD / 15;
  return { sunrise: solarNoon - half, solarNoon, sunset: solarNoon + half, noonAltitude, polar: 0 };
}

/** Sun altitude in degrees above the horizon (negative below). */
export function sunAltitude(date: Date, observer: Observer = defaultObserver()): number {
  const { decl, eqTime } = solarTerms(date);
  const tzHours = -date.getTimezoneOffset() / 60;
  const clock = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  const trueSolarMinutes = (clock - tzHours) * 60 + eqTime + 4 * observer.lng;
  const hourAngle = (trueSolarMinutes / 4 - 180) * RAD;
  const lat = observer.lat * RAD;
  const sinAlt = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(hourAngle);
  return Math.asin(Math.max(-1, Math.min(1, sinAlt))) / RAD;
}

/**
 * The clock time remapped so sunrise is 06:00, solar noon 12:00 and sunset 18:00. Feed this to
 * timeOfDay() instead of the raw clock hour and the sky gradient, darkness and the sun all follow
 * the real day: short and late in December, long in June.
 */
export function solarHour(date: Date, observer: Observer = defaultObserver()): number {
  const clock = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  const day = solarDay(date, observer);
  if (day.polar !== 0) {
    // Polar day or night: keep the clock but centre it on solar noon.
    return (((clock - day.solarNoon + 12) % 24) + 24) % 24;
  }
  const { sunrise, solarNoon, sunset } = day;
  if (clock >= sunrise && clock <= solarNoon) {
    return 6 + ((clock - sunrise) / (solarNoon - sunrise)) * 6;
  }
  if (clock > solarNoon && clock <= sunset) {
    return 12 + ((clock - solarNoon) / (sunset - solarNoon)) * 6;
  }
  // Night: sunset to the next sunrise maps onto 18:00 to 06:00.
  const night = 24 - (sunset - sunrise);
  const since = clock > sunset ? clock - sunset : clock + 24 - sunset;
  return (18 + (since / night) * 12) % 24;
}

let phaseMinutes: number[] | null = null;

function phaseTable(): number[] {
  if (!phaseMinutes) {
    const out = [MOON_BASE_MINUTE];
    for (const gap of MOON_GAPS) {
      out.push(out[out.length - 1] + gap);
    }
    phaseMinutes = out;
  }
  return phaseMinutes;
}

function phaseName(phase: number): MoonPhaseName {
  const names: MoonPhaseName[] = [
    'new',
    'waxing crescent',
    'first quarter',
    'waxing gibbous',
    'full',
    'waning gibbous',
    'last quarter',
    'waning crescent',
  ];
  return names[Math.round(phase * 8) % 8];
}

/** The moon's phase for a moment, read from the bundled phase calendar (2024 to 2050). */
export function moonAt(date: Date): MoonState {
  const minute = date.getTime() / 60000;
  const table = phaseTable();
  let phase: number;
  if (minute < table[0] || minute >= table[table.length - 1]) {
    // Outside the calendar: count mean lunations from the nearest end.
    const anchorIndex = minute < table[0] ? 0 : table.length - 1;
    const anchorPhase = ((MOON_FIRST_QUARTER + anchorIndex) % 4) / 4;
    phase = anchorPhase + (minute - table[anchorIndex]) / SYNODIC_MINUTES;
  } else {
    let lo = 0;
    let hi = table.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (table[mid] <= minute) {
        lo = mid;
      } else {
        hi = mid;
      }
    }
    const quarter = (MOON_FIRST_QUARTER + lo) % 4;
    phase = (quarter + (minute - table[lo]) / (table[hi] - table[lo])) / 4;
  }
  phase = ((phase % 1) + 1) % 1;
  return {
    phase,
    illumination: (1 - Math.cos(phase * 2 * Math.PI)) / 2,
    waxing: phase < 0.5,
    name: phaseName(phase),
  };
}

/**
 * Where the moon sits on the same east-to-west arc the sun uses, as 0 (rising) to 1 (setting),
 * or null when it is below the horizon. The moon trails the sun by its phase: a full moon rises
 * at sunset, a first quarter is highest at dusk, a waning crescent rises before dawn.
 * `hour` is the solar-normalized hour (see solarHour).
 */
export function moonArc(hour: number, phase: number): number | null {
  const transit = 12 + phase * 24;
  let offset = (hour - transit) % 24;
  if (offset < -12) {
    offset += 24;
  } else if (offset > 12) {
    offset -= 24;
  }
  const u = (offset + 6) / 12;
  return u > -0.12 && u < 1.12 ? u : null;
}
