import { useId } from 'react';
import Svg, { Defs, G, LinearGradient, Path, RadialGradient, Stop, Text } from 'react-native-svg';

import { fontFamily } from '../font';
import { svgId } from './svgId';

export type BadgeIcon =
  | 'home'
  | 'calendar'
  | 'trick'
  | 'prop'
  | 'chest'
  | 'outfit'
  | 'paws'
  | 'flag'
  | 'first'
  | 'up'
  | 'podium'
  | 'flame'
  | 'heart'
  | 'stars'
  | 'acorn';

export type BadgeColor = 'pink' | 'blue' | 'green' | 'purple' | 'orange' | 'yellow';
export type BadgeTier = 'none' | 'bronze' | 'silver' | 'gold';

type Props = {
  icon?: BadgeIcon;
  color?: BadgeColor;
  tier?: BadgeTier;
  earned?: boolean;
  size?: number;
};

const COLORS: Record<BadgeColor, [string, string, string, string]> = {
  pink: ['#FFD6E5', '#F28AB3', '#D9608F', '#A93F6C'],
  blue: ['#D6ECFF', '#6DB3F2', '#3E86D0', '#2A5F9E'],
  green: ['#D7F5E2', '#7DCB9E', '#4FA978', '#2F7A52'],
  purple: ['#E7DEFF', '#A98BE0', '#7E5CC8', '#563A9A'],
  orange: ['#FFE3CC', '#FFAA6B', '#E9813E', '#A9531C'],
  yellow: ['#FFF3C2', '#FFD45E', '#E8B020', '#9A6A0A'],
};

const RIMS: Record<Exclude<BadgeTier, 'none'>, [string, string, string]> = {
  bronze: ['#FFD9B3', '#E79B5E', '#A8642E'],
  silver: ['#FFFFFF', '#CBD3E1', '#8E9AB3'],
  gold: ['#FFF4B8', '#FFCF4A', '#D99A12'],
};

const ACCENTS: Partial<Record<BadgeIcon, string>> = {
  home: '#FF6F9C',
  calendar: '#FF8A8A',
  outfit: '#FFD45E',
  flag: '#2E2A5A',
  chest: '#E0A21A',
  podium: '#FFD45E',
  flame: '#FFD45E',
  acorn: '#C98A5A',
};

function circ(x: number, y: number, r: number): string {
  return `M${x - r} ${y} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0 Z`;
}

function ell(x: number, y: number, rx: number, ry: number): string {
  return `M${x - rx} ${y} a${rx} ${ry} 0 1 0 ${2 * rx} 0 a${rx} ${ry} 0 1 0 ${-2 * rx} 0 Z`;
}

function star(cx: number, cy: number, outer: number, inner: number): string {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 ? inner : outer;
    d += `${i ? 'L' : 'M'}${(cx + rad * Math.cos(a)).toFixed(2)} ${(cy + rad * Math.sin(a)).toFixed(2)} `;
  }
  return `${d}Z`;
}

function paw(x: number, y: number, s: number): string {
  return (
    circ(x - 3.6 * s, y - 1.6 * s, 1.5 * s) +
    circ(x - 1.3 * s, y - 4 * s, 1.5 * s) +
    circ(x + 1.3 * s, y - 4 * s, 1.5 * s) +
    circ(x + 3.6 * s, y - 1.6 * s, 1.5 * s) +
    ell(x, y + 1.8 * s, 3.3 * s, 2.7 * s)
  );
}

const ICONS: Record<BadgeIcon, { fill: string; stroke: string; accent: string }> = {
  home: { fill: 'M-10 -1 L0 -10 L10 -1 L7.5 -1 V10 H-7.5 V-1 Z', stroke: '', accent: 'M0 6.5 C-4 3.5 -5 1 -3.2 -0.6 C-1.8 -1.8 -0.4 -1 0 0.2 C0.4 -1 1.8 -1.8 3.2 -0.6 C5 1 4 3.5 0 6.5 Z' },
  calendar: { fill: 'M-10 -6 H10 V10 H-10 Z', stroke: 'M-5 -10 V-4 M5 -10 V-4', accent: 'M-10 -6 H10 V-1 H-10 Z M-1 2 H5 V7 H-1 Z' },
  trick: { fill: star(0, 0.5, 11, 4.8), stroke: '', accent: '' },
  prop: { fill: '', stroke: 'M-8 10 V-6 M8 10 V-6 M-11 -3 H11 M-11 3 H11', accent: '' },
  chest: { fill: 'M-10.5 -1 H10.5 V9.5 H-10.5 Z', stroke: '', accent: 'M-10.5 -1 V-4 Q0 -12 10.5 -4 V-1 Z M-2.2 -2 H2.2 V3.5 H-2.2 Z' },
  outfit: { fill: 'M-11 -6 L-1.5 -1 V1 L-11 6 Z M11 -6 L1.5 -1 V1 L11 6 Z', stroke: '', accent: 'M-2.6 -2.6 H2.6 V2.6 H-2.6 Z' },
  paws: { fill: paw(-4.5, 3, 1.05) + paw(5, -4, 0.85), stroke: '', accent: '' },
  flag: { fill: 'M-6 -10 H9 L6 -4.5 L9 1 H-6 Z', stroke: 'M-6 -10 V11', accent: 'M-3 -8 H1 V-4.5 H-3 Z M1 -4.5 H5 V-1 H1 Z' },
  first: { fill: '', stroke: 'M-3.5 -6.5 L1.5 -10 V10 M-4 10 H7', accent: '' },
  up: { fill: 'M0 -11 L10 -0.5 H4.5 V10 H-4.5 V-0.5 H-10 Z', stroke: '', accent: '' },
  podium: { fill: 'M-11.5 10 V1 H-4 V10 Z M-4 10 V-4 H4 V10 Z M4 10 V4 H11.5 V10 Z', stroke: '', accent: star(0, -8.5, 3.6, 1.6) },
  flame: { fill: 'M0 -11 C6 -4.5 8.5 1 6 6.5 C4 10.5 -4 10.5 -6 6.5 C-8.5 1 -4.5 -3.5 0 -11 Z', stroke: '', accent: 'M0 0 C2.6 3 3.2 5.5 2 7.5 C1.2 8.8 -1.2 8.8 -2 7.5 C-3.2 5.5 -2 3 0 0 Z' },
  heart: { fill: 'M0 10 C-9 4 -11.5 -2 -7.8 -6.2 C-4.6 -9.4 -1 -7.6 0 -4.6 C1 -7.6 4.6 -9.4 7.8 -6.2 C11.5 -2 9 4 0 10 Z', stroke: '', accent: '' },
  stars: { fill: star(-5.5, 3.5, 6, 2.6) + star(5.5, 3.5, 6, 2.6) + star(0, -5.5, 6, 2.6), stroke: '', accent: '' },
  acorn: { fill: 'M-6.5 1 C-6.5 8 -2 11 0 11 C2 11 6.5 8 6.5 1 Z', stroke: 'M0 -4 V-9', accent: 'M-8.5 1 C-8.5 -5 8.5 -5 8.5 1 Z' },
};

export function Badge({ icon = 'home', color = 'pink', tier = 'none', earned = true, size = 100 }: Props) {
  const raw = useId();
  const rimId = svgId('br', raw);
  const faceId = svgId('bf', raw);
  const c = COLORS[color];
  const r = tier === 'none' ? (['#FFFFFF', c[0], c[1]] as const) : RIMS[tier];
  const line = earned ? c[3] : '#B8AED6';
  const dash = earned ? undefined : '5 4';
  const ic = ICONS[icon];
  const accent = ACCENTS[icon] ?? '#FFFFFF';

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessible accessibilityLabel={`${icon} badge${tier !== 'none' ? `, ${tier}` : ''}${earned ? '' : ', not earned yet'}`}>
      <Defs>
        <LinearGradient id={rimId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={r[0]} />
          <Stop offset="0.5" stopColor={r[1]} />
          <Stop offset="1" stopColor={r[2]} />
        </LinearGradient>
        <RadialGradient id={faceId} cx="0.38" cy="0.3" r="0.8">
          <Stop offset="0" stopColor={c[0]} />
          <Stop offset="0.55" stopColor={c[1]} />
          <Stop offset="1" stopColor={c[2]} />
        </RadialGradient>
      </Defs>
      <Path
        d="M50 3 Q53 3 56 4.7 L88 23 Q93 26 93 32 V68 Q93 74 88 77 L56 95.3 Q50 98.6 44 95.3 L12 77 Q7 74 7 68 V32 Q7 26 12 23 L44 4.7 Q47 3 50 3 Z"
        fill={earned ? `url(#${rimId})` : '#FAF7FD'}
        stroke={line}
        strokeWidth={2.6}
        strokeLinejoin="round"
        strokeDasharray={dash}
      />
      <Path
        d="M50 14 L81.5 32 V68 L50 86 L18.5 68 V32 Z"
        fill={earned ? `url(#${faceId})` : '#F1ECF8'}
        stroke={line}
        strokeWidth={2.2}
        strokeLinejoin="round"
        strokeDasharray={dash}
      />
      {earned ? <Path d="M24 36 L24 50 M27 31 L44 21" fill="none" stroke="#FFFFFF" strokeWidth={4} strokeLinecap="round" opacity={0.6} /> : null}
      {earned ? (
        <G transform="translate(50 51) scale(1.7)">
          {ic.stroke ? <Path d={ic.stroke} fill="none" stroke={line} strokeWidth={3.6} strokeLinecap="round" strokeLinejoin="round" /> : null}
          {ic.stroke ? <Path d={ic.stroke} fill="none" stroke="#FFFFFF" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" /> : null}
          {ic.fill ? <Path d={ic.fill} fill="#FFFFFF" stroke={line} strokeWidth={1.2} strokeLinejoin="round" /> : null}
          {ic.accent ? <Path d={ic.accent} fill={accent} stroke={line} strokeWidth={0.9} strokeLinejoin="round" /> : null}
        </G>
      ) : (
        <Text x="50" y="61" textAnchor="middle" fontFamily={fontFamily.fredokaBold} fontWeight="800" fontSize="30" fill="#8A80B5">
          ?
        </Text>
      )}
    </Svg>
  );
}
