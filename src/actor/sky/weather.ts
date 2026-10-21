import { sunAltitude } from './astronomy';
import type { Observer } from './astronomy';

// Weather is a pure function of time and place, so it needs no saved state, every screen agrees on
// it, and two friends in the same city see the same shower. Time is cut into 6-hour windows; each
// window may hold one rain or snow event with its own start, length and strength.

export type Precip = 'rain' | 'snow';

export type WeatherState = {
  precip: Precip | null;
  /** 0 to 1; ramps in and out at the edges of a shower. */
  intensity: number;
  /** Cloud darkening, 0 clear to 1 heavy overcast. Starts before the rain and lingers after it. */
  overcast: number;
  /** How many fair-weather clouds drift by today, 0 to 1. */
  clouds: number;
  /** Signed wind, -1 to 1 (positive blows left to right). */
  wind: number;
  /** Wet ground after rain, 0 to 1 (puddles, darker paths). */
  wetness: number;
  /** Settled snow on the ground and on things, 0 to 1. Lingers for a day or so. */
  snowCover: number;
  /** Rainbow strength, 0 to 1. Rare: some showers that end while the sun is low. */
  rainbow: number;
};

export const WEATHER_CONFIG = {
  /** Chance that a 6-hour window holds a shower, by month (Jan first). About 8% of the time overall. */
  eventChance: [0.3, 0.28, 0.32, 0.34, 0.34, 0.3, 0.3, 0.3, 0.28, 0.28, 0.3, 0.3],
  /** Share of showers that fall as snow, by month, where it is cold enough (|lat| >= 30). */
  snowShare: [0.65, 0.6, 0.25, 0, 0, 0, 0, 0, 0, 0, 0.08, 0.45],
  /** Share of showers ending at a low sun that leave a rainbow. */
  rainbowChance: 0.25,
};

type Event = { kind: Precip; start: number; end: number; peak: number; rainbow: boolean };

const WINDOW = 360;

let override: Partial<WeatherState> | null = null;

/**
 * Force the weather for a dev menu or screenshots, e.g. { precip: 'rain', intensity: 0.8 } or
 * { rainbow: 1 }. Fields left out keep their computed values. Pass null to follow the schedule.
 */
export function setWeatherOverride(next: Partial<WeatherState> | null): void {
  override = next;
}

function hash(a: number, b: number, c: number): number {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function rng(seed: number, salt: number): () => number {
  let i = 0;
  return () => hash(seed, salt, (i += 1));
}

function localMonth(minute: number, lat: number): number {
  const month = new Date(minute * 60000).getMonth();
  return lat < 0 ? (month + 6) % 12 : month;
}

const eventCache = new Map<string, Event | null>();

function eventIn(windowIndex: number, observer: Observer): Event | null {
  const place = Math.round(observer.lat) * 1000 + Math.round(observer.lng);
  const key = `${windowIndex}:${place}`;
  const cached = eventCache.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const r = rng(windowIndex, place);
  const startOfWindow = windowIndex * WINDOW;
  const month = localMonth(startOfWindow, observer.lat);
  let event: Event | null = null;
  if (r() < WEATHER_CONFIG.eventChance[month]) {
    const cold = Math.abs(observer.lat) >= 30;
    const kind: Precip = cold && r() < WEATHER_CONFIG.snowShare[month] ? 'snow' : 'rain';
    const length = kind === 'snow' ? 70 + r() * 170 : 40 + r() * 110;
    const start = startOfWindow + r() * (WINDOW - 30);
    event = { kind, start, end: start + length, peak: 0.35 + r() * 0.65, rainbow: kind === 'rain' && r() < WEATHER_CONFIG.rainbowChance };
  }
  if (eventCache.size > 400) {
    eventCache.clear();
  }
  eventCache.set(key, event);
  return event;
}

function ramp(minute: number, start: number, end: number, rise: number, fall: number): number {
  if (minute < start - rise || minute > end + fall) {
    return 0;
  }
  if (minute < start) {
    return (minute - (start - rise)) / rise;
  }
  if (minute > end) {
    return 1 - (minute - end) / fall;
  }
  return 1;
}

const cache = { minute: NaN, place: NaN, state: null as WeatherState | null };

export function weatherAt(date: Date, observer: Observer): WeatherState {
  const minute = date.getTime() / 60000;
  const place = observer.lat * 1000 + observer.lng;
  // Weather moves slowly; recompute a few times a minute, not every frame.
  if (cache.state && Math.abs(minute - cache.minute) < 0.25 && cache.place === place) {
    return override ? { ...cache.state, ...override } : cache.state;
  }
  const w = Math.floor(minute / WINDOW);
  let precip: Precip | null = null;
  let intensity = 0;
  let overcast = 0;
  let wetness = 0;
  let snowCover = 0;
  let rainbow = 0;
  for (let i = w - 8; i <= w + 1; i += 1) {
    const e = eventIn(i, observer);
    if (!e) {
      continue;
    }
    // A little gusting inside the shower so it never looks like a flat loop.
    const falling = ramp(minute, e.start + 12, e.end - 18, 12, 18) * e.peak * (0.8 + 0.2 * Math.sin(minute * 0.35 + e.start));
    if (falling > intensity) {
      intensity = falling;
      precip = e.kind;
    }
    overcast = Math.max(overcast, ramp(minute, e.start, e.end, 45, 40) * (0.55 + 0.45 * e.peak));
    if (e.kind === 'rain' && minute > e.start) {
      const after = Math.max(0, minute - e.end);
      wetness = Math.max(wetness, Math.min(1, (Math.min(minute, e.end) - e.start) / 25) * Math.exp(-after / 70));
    }
    if (e.kind === 'snow' && minute > e.start) {
      const fallen = Math.min(1, ((Math.min(minute, e.end) - e.start) * e.peak) / 90);
      const after = Math.max(0, minute - e.end);
      snowCover = Math.max(snowCover, fallen * Math.exp(-after / (60 * 20)));
    }
    if (e.rainbow && minute > e.end - 8 && minute < e.end + 24) {
      const alt = sunAltitude(new Date(e.end * 60000), observer);
      if (alt > 2 && alt < 42) {
        rainbow = Math.max(rainbow, ramp(minute, e.end - 2, e.end + 16, 6, 8));
      }
    }
  }
  if (intensity < 0.02) {
    precip = null;
    intensity = 0;
  }
  const day = Math.floor((minute - date.getTimezoneOffset()) / 1440);
  const r = rng(day, 7);
  const clouds = 0.1 + r() * 0.6;
  const direction = r() < 0.5 ? -1 : 1;
  const wind = direction * Math.min(1, 0.15 + r() * 0.3 + intensity * 0.45 + overcast * 0.15);
  const state: WeatherState = { precip, intensity, overcast, clouds, wind, wetness, snowCover, rainbow };
  cache.minute = minute;
  cache.place = place;
  cache.state = state;
  return override ? { ...state, ...override } : state;
}
