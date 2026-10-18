import { mulberry } from './mulberry';

export type DayPhase = 'Night' | 'Dawn' | 'Morning' | 'Afternoon' | 'Dusk' | 'Evening';

export type Rgba = {
  r: number;
  g: number;
  b: number;
  a: number;
};

export type TimeOfDay = {
  hour: number;
  phase: DayPhase;
  top: string;
  bot: string;
  tint: string;
  inTint: string;
  tintChannels: Rgba;
  inTintChannels: Rgba;
  dark: number;
};

type Keyframe = {
  h: number;
  top: string;
  bot: string;
  tint: [number, number, number, number];
  inTint: [number, number, number, number];
  dark: number;
};

const night = {
  top: '#0b1030',
  bot: '#1f2a55',
  tint: [10, 14, 50, 0.4] as [number, number, number, number],
  inTint: [12, 20, 85, 0.5] as [number, number, number, number],
  dark: 1,
};

export const todKeys: Keyframe[] = [
  { h: 0, ...night },
  { h: 4.75, ...night },
  { h: 6.25, top: '#6f7cc0', bot: '#f7b98f', tint: [255, 170, 120, 0.1], inTint: [255, 175, 130, 0.1], dark: 0.45 },
  { h: 8, top: '#8cc8ee', bot: '#fde9cc', tint: [255, 236, 200, 0.05], inTint: [255, 236, 200, 0.04], dark: 0.05 },
  { h: 10.5, top: '#a3d5f2', bot: '#e6f4f4', tint: [255, 255, 255, 0], inTint: [255, 255, 255, 0], dark: 0 },
  { h: 14, top: '#a9d8f0', bot: '#e2f3f8', tint: [255, 255, 255, 0], inTint: [255, 255, 255, 0], dark: 0 },
  { h: 16.5, top: '#9cc9ec', bot: '#f8e5bd', tint: [255, 205, 130, 0.08], inTint: [255, 205, 130, 0.07], dark: 0.05 },
  { h: 18, top: '#5d62ad', bot: '#ff9c6c', tint: [255, 140, 80, 0.14], inTint: [255, 150, 90, 0.13], dark: 0.4 },
  { h: 19.75, top: '#2e3a7a', bot: '#8a5f9e', tint: [30, 30, 100, 0.26], inTint: [38, 40, 120, 0.34], dark: 0.8 },
  { h: 21.5, ...night },
  { h: 24, ...night },
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(t: number): number {
  const u = clamp(t, 0, 1);
  return u * u * (3 - 2 * u);
}

function channel(hex: string): [number, number, number] {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function mixHex(from: string, to: string, t: number): string {
  const a = channel(from);
  const b = channel(to);
  return `#${a
    .map((part, index) => Math.round(part + (b[index] - part) * t).toString(16).padStart(2, '0'))
    .join('')}`;
}

function mixChannels(from: [number, number, number, number], to: [number, number, number, number], t: number): Rgba {
  return {
    r: from[0] + (to[0] - from[0]) * t,
    g: from[1] + (to[1] - from[1]) * t,
    b: from[2] + (to[2] - from[2]) * t,
    a: from[3] + (to[3] - from[3]) * t,
  };
}

function rgbaString(color: Rgba): string {
  return `rgba(${Math.round(color.r)},${Math.round(color.g)},${Math.round(color.b)},${color.a.toFixed(3)})`;
}

export function phaseOf(hour: number): DayPhase {
  const h = ((hour % 24) + 24) % 24;
  if (h < 5) {
    return 'Night';
  }
  if (h < 7.5) {
    return 'Dawn';
  }
  if (h < 12) {
    return 'Morning';
  }
  if (h < 17) {
    return 'Afternoon';
  }
  if (h < 19) {
    return 'Dusk';
  }
  if (h < 21.5) {
    return 'Evening';
  }
  return 'Night';
}

export function todAt(hour: number): TimeOfDay {
  const h = ((hour % 24) + 24) % 24;
  let index = 0;
  while (index < todKeys.length - 2 && h >= todKeys[index + 1].h) {
    index += 1;
  }
  const from = todKeys[index];
  const to = todKeys[index + 1];
  const span = to.h - from.h;
  const t = smoothstep(span === 0 ? 0 : (h - from.h) / span);
  const tintChannels = mixChannels(from.tint, to.tint, t);
  const inTintChannels = mixChannels(from.inTint, to.inTint, t);
  return {
    hour: h,
    phase: phaseOf(h),
    top: mixHex(from.top, to.top, t),
    bot: mixHex(from.bot, to.bot, t),
    tint: rgbaString(tintChannels),
    inTint: rgbaString(inTintChannels),
    tintChannels,
    inTintChannels,
    dark: from.dark + (to.dark - from.dark) * t,
  };
}

// Fixed star field: [x 0-1, y 0-0.85, size, twinkle phase].
export const stars: readonly (readonly [number, number, number, number])[] = (() => {
  const roll = mulberry(11);
  const list: [number, number, number, number][] = [];
  for (let i = 0; i < 46; i += 1) {
    const x = roll();
    const y = roll() * 0.85;
    const size = 0.7 + roll() * 1.1;
    const phase = roll() * 6.28;
    list.push([x, y, size, phase]);
  }
  return list;
})();
