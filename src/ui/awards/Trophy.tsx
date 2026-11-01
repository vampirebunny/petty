import { useId } from 'react';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg';

import { type AwardEvent, eventEmblems } from './eventEmblems';
import { svgId } from './svgId';

export type TrophyShape = 'cup' | 'handles' | 'plinth' | 'big' | 'grand' | 'star';
export type TrophyMaterial = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'veteran' | 'seasonal';

type Props = {
  shape?: TrophyShape;
  material?: TrophyMaterial;
  event?: AwardEvent;
  earned?: boolean;
  size?: number;
};

const MATERIALS: Record<TrophyMaterial, [string, string, string, string, string, string]> = {
  bronze: ['#FFD9B3', '#E79B5E', '#B9652C', '#8E4A1C', '#C98A5A', '#8E4A1C'],
  silver: ['#FFFFFF', '#CBD3E1', '#8E9AB3', '#5E6A86', '#AEB8CC', '#5E6A86'],
  gold: ['#FFF4B8', '#FFCF4A', '#E0A21A', '#9A640A', '#C98A5A', '#7E4A28'],
  platinum: ['#FFFFFF', '#E2E9F3', '#A9B8CF', '#5F7396', '#6B66A8', '#3E3A72'],
  diamond: ['#F2FDFF', '#A8E9FF', '#52B6E6', '#24739F', '#5A63A8', '#2A2F6A'],
  veteran: ['#FFFFFF', '#CBD3E1', '#8E9AB3', '#5E6A86', '#4B5D96', '#2F3E6E'],
  seasonal: ['#FFE2C6', '#FFAA6B', '#E07436', '#9A4A1C', '#B8693E', '#7A3E22'],
};

const LOCKED = ['#FFFFFF', '#F1ECF8', '#E4DDF1', '#B8AED6', '#F1ECF8', '#E4DDF1'] as const;

export function Trophy({ shape = 'plinth', material = 'gold', event = 'none', earned = true, size = 120 }: Props) {
  const raw = useId();
  const metalId = svgId('tm', raw);
  const baseId = svgId('tb', raw);
  const emblemId = svgId('te', raw);
  const m = earned ? MATERIALS[material] : LOCKED;
  const width = Math.round((size * 5) / 6);
  const dash = earned ? undefined : '5 4';
  const shine = earned ? 0.75 : 0;
  const shade = earned ? 0.12 : 0;
  const baseShine = earned ? 0.45 : 0;
  const isStar = shape === 'star';
  const ic = eventEmblems[event];

  return (
    <Svg width={width} height={size} viewBox="0 0 100 120" accessible accessibilityLabel={`${earned ? '' : 'Not yet earned: '}${material} ${shape} trophy`}>
      <Defs>
        <LinearGradient id={metalId} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={m[1]} />
          <Stop offset="0.28" stopColor={m[0]} />
          <Stop offset="0.62" stopColor={m[1]} />
          <Stop offset="1" stopColor={m[2]} />
        </LinearGradient>
        <LinearGradient id={baseId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={m[4]} />
          <Stop offset="1" stopColor={m[5]} />
        </LinearGradient>
        <RadialGradient id={emblemId} cx="0.4" cy="0.35" r="0.7">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="1" stopColor={m[0]} />
        </RadialGradient>
      </Defs>
      {shape === 'handles' || shape === 'plinth' ? (
        <G>
          <Path d="M24 38 C8 38 8 63 31 68" fill="none" stroke={m[3]} strokeWidth={9} strokeLinecap="round" strokeDasharray={dash} />
          <Path d="M76 38 C92 38 92 63 69 68" fill="none" stroke={m[3]} strokeWidth={9} strokeLinecap="round" strokeDasharray={dash} />
          <Path d="M24 38 C8 38 8 63 31 68" fill="none" stroke={m[1]} strokeWidth={4.5} strokeLinecap="round" />
          <Path d="M76 38 C92 38 92 63 69 68" fill="none" stroke={m[1]} strokeWidth={4.5} strokeLinecap="round" />
        </G>
      ) : null}
      {shape === 'big' || shape === 'grand' ? (
        <G>
          <Path d="M24 34 C1 31 1 72 33 75" fill="none" stroke={m[3]} strokeWidth={10} strokeLinecap="round" strokeDasharray={dash} />
          <Path d="M76 34 C99 31 99 72 67 75" fill="none" stroke={m[3]} strokeWidth={10} strokeLinecap="round" strokeDasharray={dash} />
          <Path d="M24 34 C1 31 1 72 33 75" fill="none" stroke={m[1]} strokeWidth={5} strokeLinecap="round" />
          <Path d="M76 34 C99 31 99 72 67 75" fill="none" stroke={m[1]} strokeWidth={5} strokeLinecap="round" />
        </G>
      ) : null}
      <Rect x={45} y={80} width={10} height={13} fill={`url(#${metalId})`} stroke={m[3]} strokeWidth={2.5} strokeDasharray={dash} />
      {!isStar ? (
        <G>
          <Path d="M22 30 H78 V50 C78 72 66 84 50 84 C34 84 22 72 22 50 Z" fill={`url(#${metalId})`} stroke={m[3]} strokeWidth={2.5} strokeLinejoin="round" strokeDasharray={dash} />
          <Ellipse cx={50} cy={30} rx={28} ry={4.5} fill={m[2]} stroke={m[3]} strokeWidth={2.5} strokeDasharray={dash} />
          {earned && material === 'diamond' ? <Path d="M36 35 L45 82 M64 35 L55 82 M23 50 H77" stroke="#FFFFFF" strokeWidth={1.6} opacity={0.7} fill="none" /> : null}
          <Path d="M29 37 C28 47 30 56 35 63" fill="none" stroke="#FFFFFF" strokeWidth={5} strokeLinecap="round" opacity={shine} />
          <Path d="M66 70 C70 66 73 60 74 52" fill="none" stroke="#000000" strokeWidth={3} strokeLinecap="round" opacity={shade} />
        </G>
      ) : null}
      {shape === 'grand' ? (
        <G>
          <Path d="M24 29 Q50 4 76 29 Z" fill={`url(#${metalId})`} stroke={m[3]} strokeWidth={2.5} strokeLinejoin="round" strokeDasharray={dash} />
          <Path d="M33 24 Q40 16 48 14" fill="none" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" opacity={shine} />
          <Circle cx={50} cy={10} r={5.5} fill={`url(#${metalId})`} stroke={m[3]} strokeWidth={2.5} strokeDasharray={dash} />
        </G>
      ) : null}
      {isStar ? (
        <G>
          <Polygon
            points="50,18 57.6,39.5 80,40.7 62.4,54 68.6,76 50,64 31.4,76 37.6,54 20,40.7 42.4,39.5"
            fill={`url(#${metalId})`}
            stroke={m[3]}
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeDasharray={dash}
          />
          <Path d="M45 33 L41.5 44" stroke="#FFFFFF" strokeWidth={4} strokeLinecap="round" opacity={shine} />
        </G>
      ) : null}
      {shape === 'cup' || shape === 'handles' || isStar ? (
        <G>
          <Rect x={33} y={92} width={34} height={8} rx={2} fill={`url(#${metalId})`} stroke={m[3]} strokeWidth={2.5} strokeDasharray={dash} />
          <Rect x={26} y={100} width={48} height={14} rx={4} fill={`url(#${metalId})`} stroke={m[3]} strokeWidth={2.5} strokeDasharray={dash} />
          <Path d="M31 104 H52" stroke="#FFFFFF" strokeWidth={2.5} strokeLinecap="round" opacity={shine} />
        </G>
      ) : null}
      {shape === 'plinth' || shape === 'big' || shape === 'grand' ? (
        <G>
          <Rect x={35} y={92} width={30} height={7} rx={2} fill={`url(#${metalId})`} stroke={m[3]} strokeWidth={2.5} strokeDasharray={dash} />
          <Rect x={18} y={99} width={64} height={19} rx={4} fill={`url(#${baseId})`} stroke={m[3]} strokeWidth={2.5} strokeDasharray={dash} />
          <Path d="M23 103 H41" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round" opacity={baseShine} />
          <Rect x={36} y={104.5} width={28} height={8.5} rx={2} fill={`url(#${metalId})`} stroke={m[3]} strokeWidth={1.6} strokeDasharray={dash} />
        </G>
      ) : null}
      {earned && !isStar && event !== 'none' ? (
        <G>
          <Circle cx={50} cy={55} r={12.5} fill={`url(#${emblemId})`} stroke={m[3]} strokeWidth={2.2} />
          <G transform="translate(50 55)">
            {ic.fill ? <Path d={ic.fill} fill={m[3]} /> : null}
            {ic.stroke ? <Path d={ic.stroke} fill="none" stroke={m[3]} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" /> : null}
          </G>
        </G>
      ) : null}
    </Svg>
  );
}
