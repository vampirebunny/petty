import { useEffect, useState } from 'react';

import { skyAt, type SkyState } from '../../actor/sky';
import { todAt } from '../../actor/timeOfDay';

type Rgb = [number, number, number];

export type GroundPaint = {
  ground: string;
  light: string;
  dark: string;
  pathOuter: string;
  pathInner: string;
  pathDash: string;
  leaf: string;
  pine: string;
  bush: string;
  water: string;
  waterLine: string;
  trunk: string;
  ink: string;
};

export type TownChrome = {
  header: string;
  title: string;
  sub: string;
  pill: string;
  pillText: string;
  tint: string;
  night: boolean;
  snow: boolean;
  rainMix: number;
  snowMix: number;
  cloud: string;
  cloudAlpha: number;
  rain: string;
};

type Palette = {
  bg: string;
  hill: string;
  hill2: string;
  pathEdge: string;
  path: string;
  dash: string;
  tree: string;
  tree2: string;
  bush: string;
  pond: string;
  pondEdge: string;
};

const clear: Palette = {
  bg: '#D3F1DE',
  hill: '#E3F7EA',
  hill2: '#C6EBD3',
  pathEdge: '#E2CDA6',
  path: '#FFF6E6',
  dash: '#F1E2C6',
  tree: '#9FE3B4',
  tree2: '#7FD3A0',
  bush: '#BFEFD4',
  pond: '#A9DAF7',
  pondEdge: '#7CC4F5',
};

const rain: Palette = {
  bg: '#BFDCCB',
  hill: '#CFE6D8',
  hill2: '#B2D6C1',
  pathEdge: '#D2C3A4',
  path: '#EDE6D8',
  dash: '#E0D6C0',
  tree: '#8FD3A6',
  tree2: '#6FC290',
  bush: '#A9DDBE',
  pond: '#93C6EA',
  pondEdge: '#6AA9DB',
};

const snow: Palette = {
  bg: '#EEF4FA',
  hill: '#FFFFFF',
  hill2: '#E2ECF6',
  pathEdge: '#C9D6E4',
  path: '#F8FBFF',
  dash: '#E1E9F2',
  tree: '#CFEBD9',
  tree2: '#A9DCBB',
  bush: '#FFFFFF',
  pond: '#DDEFFA',
  pondEdge: '#A9CBE6',
};

function rgb(hex: string): Rgb {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

function mixHex(from: string, to: string, t: number): string {
  const u = Math.min(1, Math.max(0, t));
  const [ar, ag, ab] = rgb(from);
  const [br, bg, bb] = rgb(to);
  const channel = (a: number, b: number) => Math.round(a + (b - a) * u).toString(16).padStart(2, '0');
  return `#${channel(ar, br)}${channel(ag, bg)}${channel(ab, bb)}`.toUpperCase();
}

function mixPalette(from: Palette, to: Palette, t: number): Palette {
  return {
    bg: mixHex(from.bg, to.bg, t),
    hill: mixHex(from.hill, to.hill, t),
    hill2: mixHex(from.hill2, to.hill2, t),
    pathEdge: mixHex(from.pathEdge, to.pathEdge, t),
    path: mixHex(from.path, to.path, t),
    dash: mixHex(from.dash, to.dash, t),
    tree: mixHex(from.tree, to.tree, t),
    tree2: mixHex(from.tree2, to.tree2, t),
    bush: mixHex(from.bush, to.bush, t),
    pond: mixHex(from.pond, to.pond, t),
    pondEdge: mixHex(from.pondEdge, to.pondEdge, t),
  };
}

function paintOf(palette: Palette): GroundPaint {
  return {
    ground: palette.bg,
    light: palette.hill,
    dark: palette.hill2,
    pathOuter: palette.pathEdge,
    pathInner: palette.path,
    pathDash: palette.dash,
    leaf: palette.tree,
    pine: palette.tree2,
    bush: palette.bush,
    water: palette.pond,
    waterLine: palette.pondEdge,
    trunk: '#C98A66',
    ink: '#4B3B7A',
  };
}

/** Map colors from the same sky the rooms use. Morning and afternoon stay the day palette. */
export function townLook(sky: SkyState): { paint: GroundPaint; chrome: TownChrome } {
  const weather = sky.weather;
  const rainMix =
    weather.precip === 'rain'
      ? Math.max(weather.wetness, weather.intensity, weather.overcast * 0.65)
      : weather.overcast * 0.28;
  const snowMix = Math.max(weather.snowCover, weather.precip === 'snow' ? weather.intensity : 0);
  const mixed = mixPalette(mixPalette(clear, rain, rainMix), snow, snowMix);
  const tod = todAt(sky.solarHour);
  const phase = tod.phase;
  const night = phase === 'Night' || phase === 'Evening';
  const tint = phase === 'Morning' || phase === 'Afternoon' ? 'transparent' : tod.tint;
  const header =
    night ? '#1A1533' : phase === 'Dawn' ? '#FDF1EA' : phase === 'Dusk' ? '#FBE8E4' : '#F5F6FB';
  return {
    paint: paintOf(mixed),
    chrome: {
      header,
      title: night ? '#F4F0FF' : '#2A2B4A',
      sub: night ? '#C2B8E8' : '#5E5A85',
      pill: night ? '#2E2458' : '#FFFFFF',
      pillText: night ? '#F4F0FF' : '#2A2B4A',
      tint,
      night,
      snow: snowMix > 0.2,
      rainMix,
      snowMix,
      cloud: mixHex('#FFFFFF', '#9AA9BC', rainMix),
      cloudAlpha: rainMix > 0.45 ? 0.9 : night ? 0.35 : 0.75,
      rain: night ? '#9FB8D8' : '#6E93BA',
    },
  };
}

export function useTownSky(reducedMotion: boolean): { sky: SkyState; now: number } {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), reducedMotion ? 10000 : 80);
    return () => clearInterval(id);
  }, [reducedMotion]);
  return { sky: skyAt(new Date(now)), now };
}
