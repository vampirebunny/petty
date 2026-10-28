import type { Scene, TimeOfDay } from '../../actor';
import type { SkyState, WeatherState } from '../../actor/sky';

export type Glow = { x: number; y: number; r: number; a: number };

/** A pet's position this frame, so props can react (bed dips, bush rustles, grass parts). */
export type Contact = { id: string; x: number; y: number; speed: number };

export type LampLight = { x: number; y: number; floorY: number; r: number; a: number };

/** Where light comes from this frame, for shadows and rim light. */
export type LightRig = {
  /** The sun (outdoors) or the main window (indoors, daytime), in stage units. Null when there is none. */
  key: { x: number; y: number } | null;
  /** 0 to 1: how hard and directional the key light is (low when overcast or dark). */
  direct: number;
  /** Shadow length per unit of object height. Long at dawn and dusk. */
  length: number;
  /** Strength of the soft contact shadow under everything. */
  contact: number;
  /** Lit lamps; at night each object's shadow falls away from the nearest one. */
  lamps: LampLight[];
  /** Warm or cool colour for rim light on pets. */
  rim: string;
  rimStrength: number;
};

export type Env = {
  tod: TimeOfDay;
  t: number;
  reduced: boolean;
  bowlFill: number;
  waterLevel: number;
  liftedId?: string | null;
  squishId?: string | null;
  squishAt?: number;
  glows: Glow[];
  // Where a pet is eating or drinking right now, so a bowl can react.
  feeding: { x: number; y: number; kind: 'eat' | 'drink' }[];
  // The rest is optional so any other code that builds an Env keeps compiling; drawWorld fills it all.
  /** Date-driven sky: moon phase, season, decor, weather. */
  sky?: SkyState;
  /** Live signed wind with gusts, -1 to 1. */
  wind?: number;
  contacts?: Contact[];
  light?: LightRig;
  scene?: Scene;
  /** Stage position of the prop being drawn (props draw in local coordinates). */
  anchor?: { x: number; y: number };
  /** Sisal dust from a scratch, in stage coordinates, tied to the piece id. */
  scratches?: { id: string; x: number; y: number; a: number }[];
  /** Extra stage units on each side when the view is wider than the stage. */
  bleed?: number;
};

export const CLEAR_WEATHER: WeatherState = {
  precip: null,
  intensity: 0,
  overcast: 0,
  clouds: 0.3,
  wind: 0.2,
  wetness: 0,
  snowCover: 0,
  rainbow: 0,
};

export function weatherOf(env: Env): WeatherState {
  return env.sky?.weather ?? CLEAR_WEATHER;
}

/** Ambient sway, clouds, and grass refresh about ten times a second. Reduced motion records once. */
export function motionStep(env: { t: number; reduced: boolean }): number {
  return env.reduced ? 0 : Math.round(env.t * 10);
}

// One ambient picture per frame. Rebuilding the lawn, the sky, and every swaying prop on the same
// tick stalls the ball and a running pet.
let recordStamp = Number.NaN;
let recordLeft = 0;

export function takeMotionRecord(t: number): boolean {
  if (t !== recordStamp) {
    recordStamp = t;
    recordLeft = 1;
  }
  if (recordLeft <= 0) {
    return false;
  }
  recordLeft -= 1;
  return true;
}

/** Snow on things: only where it can fall (outdoor scenes and the view through windows). */
export function snowOn(env: Env): number {
  return weatherOf(env).snowCover;
}
