import { defaultObserver, moonAt, solarDay, solarHour, sunAltitude } from './astronomy';
import type { MoonState, Observer, SolarDay } from './astronomy';
import { seasonAt } from './seasons';
import type { SeasonState } from './seasons';
import { weatherAt } from './weather';
import type { WeatherState } from './weather';

export * from './astronomy';
export * from './seasons';
export * from './weather';

/** Everything about the sky and the season at one moment. Cheap to call every frame (cached). */
export type SkyState = {
  date: Date;
  observer: Observer;
  solar: SolarDay;
  /** Clock time remapped so sunrise is 06:00 and sunset 18:00. */
  solarHour: number;
  /** Real sun altitude in degrees. */
  sunAltitude: number;
  moon: MoonState;
  season: SeasonState;
  weather: WeatherState;
};

let last: { key: number; state: SkyState } | null = null;

export function skyAt(date: Date = new Date(), observer: Observer = defaultObserver()): SkyState {
  // Ten-second buckets: nothing in the sky moves faster than that.
  const key = Math.floor(date.getTime() / 10000) * 1000 + Math.round(observer.lat * 7 + observer.lng);
  if (last && last.key === key) {
    const weather = weatherAt(date, observer);
    if (weather !== last.state.weather) {
      last.state = { ...last.state, weather };
    }
    return last.state;
  }
  const state: SkyState = {
    date,
    observer,
    solar: solarDay(date, observer),
    solarHour: solarHour(date, observer),
    sunAltitude: sunAltitude(date, observer),
    moon: moonAt(date),
    season: seasonAt(date, observer.lat),
    weather: weatherAt(date, observer),
  };
  last = { key, state };
  return state;
}
