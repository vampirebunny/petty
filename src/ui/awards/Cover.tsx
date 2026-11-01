import { useId } from 'react';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop, Text } from 'react-native-svg';

import { fontFamily } from '../font';
import { svgId } from './svgId';

export type CoverKind = 'ladder' | 'friend';
export type CoverIcon = 'host' | 'crew' | 'front';
export type CoverMaterial = 'bronze' | 'silver' | 'gold' | 'platinum';

type Props = {
  kind?: CoverKind;
  level?: 1 | 2 | 3 | 4;
  icon?: CoverIcon;
  material?: CoverMaterial;
  earned?: boolean;
  size?: number;
};

const MATERIALS: Record<CoverMaterial, [string, string, string, string, string]> = {
  bronze: ['#FFD9B3', '#E79B5E', '#B9652C', '#8E4A1C', '#FFFFFF'],
  silver: ['#FFFFFF', '#CBD3E1', '#8E9AB3', '#5E6A86', '#2E3A56'],
  gold: ['#FFF4B8', '#FFCF4A', '#E0A21A', '#9A640A', '#5A3A00'],
  platinum: ['#FFFFFF', '#E2E9F3', '#A9B8CF', '#5F7396', '#2E3A56'],
};

const LOCKED = ['#FFFFFF', '#F1ECF8', '#E4DDF1', '#B8AED6', '#B8AED6'] as const;

const COVER_BG: Record<CoverMaterial, string> = {
  bronze: '#FFF1E6',
  silver: '#F2F5FA',
  gold: '#FFF6D8',
  platinum: '#EEF3FA',
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

function heart(x: number, y: number, s: number): string {
  return `M${x} ${y + 5 * s} C${x - 5 * s} ${y + 1.5 * s} ${x - 6 * s} ${y - 2 * s} ${x - 3.8 * s} ${y - 4 * s} C${x - 2 * s} ${y - 5.5 * s} ${x - 0.5 * s} ${y - 4.5 * s} ${x} ${y - 3 * s} C${x + 0.5 * s} ${y - 4.5 * s} ${x + 2 * s} ${y - 5.5 * s} ${x + 3.8 * s} ${y - 4 * s} C${x + 6 * s} ${y - 2 * s} ${x + 5 * s} ${y + 1.5 * s} ${x} ${y + 5 * s} Z`;
}

const PAW = circ(43.5, 50, 2.3) + circ(47.6, 46, 2.3) + circ(52.4, 46, 2.3) + circ(56.5, 50, 2.3) + ell(50, 56, 5.4, 4.4);

const ICONS: Record<CoverIcon, { fill: string; stroke: string }> = {
  host: { fill: star(0, 0.5, 8, 3.6), stroke: '' },
  crew: { fill: heart(-3.4, 0.5, 0.85) + heart(3.8, -0.5, 0.75), stroke: '' },
  front: { fill: 'M-5.5 -8 H5.5 V1 H-5.5 Z M-7.5 1 H7.5 V4 H-7.5 Z', stroke: 'M-5.5 4 V8.5 M5.5 4 V8.5' },
};

export function Cover({ kind = 'ladder', level = 1, icon = 'host', material = 'gold', earned = true, size = 120 }: Props) {
  const raw = useId();
  const metalId = svgId('cm', raw);
  const coverId = svgId('cc', raw);
  const m = earned ? MATERIALS[material] : LOCKED;
  const width = Math.round((size * 5) / 6);
  const dash = earned ? undefined : '5 4';
  const shine = earned ? 0.75 : 0;
  const isLadder = kind === 'ladder';
  const framed = isLadder && level >= 3;
  const easel = isLadder && level >= 2;
  const trayY = framed ? 92 : 86;
  const coverT = isLadder ? (level === 1 ? 'translate(0 26) rotate(-5 50 51)' : 'translate(0 0)') : 'translate(0 8)';
  const ic = ICONS[icon];

  return (
    <Svg width={width} height={size} viewBox="0 0 100 120" accessible accessibilityLabel={`${earned ? '' : 'Not yet earned: '}${material} cover`}>
      <Defs>
        <LinearGradient id={metalId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={m[0]} />
          <Stop offset="0.45" stopColor={m[1]} />
          <Stop offset="1" stopColor={m[2]} />
        </LinearGradient>
        <LinearGradient id={coverId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="1" stopColor={earned ? COVER_BG[material] : '#F6F2FA'} />
        </LinearGradient>
      </Defs>
      {easel ? (
        <G>
          <Path d="M50 50 V116 M35 90 L26 116 M65 90 L74 116" stroke={earned ? '#8E5530' : '#B8AED6'} strokeWidth={6.5} strokeLinecap="round" strokeDasharray={dash} />
          <Path d="M50 50 V116 M35 90 L26 116 M65 90 L74 116" stroke={earned ? '#C98A5A' : '#EDE7F6'} strokeWidth={3.2} strokeLinecap="round" />
          <Rect x={24} y={trayY} width={52} height={5} rx={2} fill={earned ? '#C98A5A' : '#EDE7F6'} stroke={earned ? '#8E5530' : '#B8AED6'} strokeWidth={2} strokeDasharray={dash} />
        </G>
      ) : null}
      {framed ? (
        <G>
          <Rect x={19} y={11} width={62} height={81} rx={4} fill={`url(#${metalId})`} stroke={m[3]} strokeWidth={2.5} strokeDasharray={dash} />
          <Path d="M23 15 H44" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round" opacity={shine} />
        </G>
      ) : null}
      <G transform={coverT}>
        <Rect x={26} y={18} width={48} height={66} rx={2.5} fill={`url(#${coverId})`} stroke={earned ? m[3] : '#B8AED6'} strokeWidth={2.4} strokeDasharray={dash} />
        {earned ? (
          <G>
            <Path d="M26 20.5 Q26 18 28.5 18 H71.5 Q74 18 74 20.5 V32 H26 Z" fill={`url(#${metalId})`} />
            <Text x="50" y="29.6" textAnchor="middle" fontFamily={fontFamily.fredokaBold} fontWeight="800" fontSize="11" fill={m[4]}>
              BOOP
            </Text>
            <Circle cx={50} cy={53} r={13} fill="#FFFFFF" stroke={m[3]} strokeWidth={2} />
            <Path d={PAW} fill={m[3]} />
            <Rect x={30} y={71} width={20} height={3} rx={1.5} fill="#D8CDEB" />
            <Rect x={30} y={76.5} width={13} height={3} rx={1.5} fill="#D8CDEB" />
            <Path d="M29 37 V48" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round" opacity={0.7} />
          </G>
        ) : (
          <Text x="50" y="60" textAnchor="middle" fontFamily={fontFamily.fredokaBold} fontWeight="800" fontSize="24" fill="#8A80B5">
            ?
          </Text>
        )}
      </G>
      {isLadder && level >= 4 ? <Rect x={36} y={99} width={28} height={9} rx={2} fill={`url(#${metalId})`} stroke={m[3]} strokeWidth={1.8} strokeDasharray={dash} /> : null}
      {!isLadder ? (
        <G>
          <Circle cx={71} cy={82} r={14} fill={`url(#${metalId})`} stroke={m[3]} strokeWidth={2.4} strokeDasharray={dash} />
          <Path d="M61.5 76 Q64 71 69 70" fill="none" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" opacity={shine} />
          {earned ? (
            <G transform="translate(71 82.5)">
              {ic.stroke ? <Path d={ic.stroke} fill="none" stroke={m[3]} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" /> : null}
              {ic.stroke ? <Path d={ic.stroke} fill="none" stroke="#FFFFFF" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" /> : null}
              {ic.fill ? <Path d={ic.fill} fill="#FFFFFF" stroke={m[3]} strokeWidth={1.2} strokeLinejoin="round" /> : null}
            </G>
          ) : null}
        </G>
      ) : null}
    </Svg>
  );
}
