import { useId } from 'react';
import Svg, { Circle, Defs, G, LinearGradient, Path, Polygon, RadialGradient, Rect, Stop, Text } from 'react-native-svg';

import { fontFamily } from '../font';
import { type AwardEvent, eventEmblems } from './eventEmblems';
import { svgId } from './svgId';

export type RibbonPlacing = 1 | 2 | 3;
export type RibbonClass = 'none' | 'beginner' | 'novice' | 'open' | 'expert' | 'championship' | 'veteran';

type Props = {
  placing?: RibbonPlacing;
  cls?: RibbonClass;
  event?: Exclude<AwardEvent, 'none'>;
  size?: number;
};

const PLACE: Record<string, [string, string, string, string, string]> = {
  '1': ['#CFEAFF', '#5FB0F5', '#2F7FD0', '#1F5FA8', '1ST'],
  '2': ['#FFD6D6', '#F58A8A', '#D45A5A', '#A33A3A', '2ND'],
  '3': ['#FFF2B0', '#FFD24A', '#E3A51A', '#9A6A0A', '3RD'],
};

const CLASS: Record<RibbonClass, [string, string]> = {
  beginner: ['#DDF7E6', '#8FDDA8'],
  novice: ['#E3F3FF', '#9FD4FA'],
  open: ['#EEE7FF', '#BBA6F2'],
  expert: ['#FFE6D2', '#FFB27A'],
  championship: ['#FFE3EF', '#F59AC2'],
  veteran: ['#F4F7FB', '#BFC8D8'],
  none: ['#FFFFFF', '#F6EBD6'],
};

export function Ribbon({ placing = 1, cls = 'novice', event = 'run', size = 132 }: Props) {
  const raw = useId();
  const roseId = svgId('rr', raw);
  const tailId = svgId('rt', raw);
  const classId = svgId('rc', raw);
  const discId = svgId('rd', raw);
  const p = PLACE[String(placing)] ?? PLACE['1'];
  const c = CLASS[cls];
  const ic = eventEmblems[event];
  const width = Math.round((size * 100) / 132);

  return (
    <Svg width={width} height={size} viewBox="0 0 100 132" accessible accessibilityLabel={`${p[4]} place ribbon`}>
      <Defs>
        <RadialGradient id={roseId} cx="0.38" cy="0.3" r="0.75">
          <Stop offset="0" stopColor={p[0]} />
          <Stop offset="0.55" stopColor={p[1]} />
          <Stop offset="1" stopColor={p[2]} />
        </RadialGradient>
        <LinearGradient id={tailId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={p[1]} />
          <Stop offset="1" stopColor={p[2]} />
        </LinearGradient>
        <LinearGradient id={classId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c[0]} />
          <Stop offset="1" stopColor={c[1]} />
        </LinearGradient>
        <LinearGradient id={discId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={p[0]} />
          <Stop offset="0.6" stopColor={p[1]} />
        </LinearGradient>
      </Defs>
      <Polygon points="37,66 25,128 35.5,120 45,128 50,72" fill={`url(#${tailId})`} stroke={p[3]} strokeWidth={2.5} strokeLinejoin="round" />
      <Polygon points="63,66 75,128 64.5,120 55,128 50,72" fill={`url(#${tailId})`} stroke={p[3]} strokeWidth={2.5} strokeLinejoin="round" />
      <Path d="M30 80 L27 110" stroke="#FFFFFF" strokeWidth={2.5} strokeLinecap="round" opacity={0.4} />
      <Circle cx={50} cy={50} r={44} fill={`url(#${roseId})`} stroke={p[3]} strokeWidth={2.5} />
      <Circle cx={50} cy={50} r={37} fill="none" stroke={p[2]} strokeWidth={11} strokeDasharray="2.4 4.4" opacity={0.55} />
      <Path d="M17 38 Q26 14 52 10" fill="none" stroke="#FFFFFF" strokeWidth={5} strokeLinecap="round" opacity={0.55} />
      <Circle cx={50} cy={50} r={28} fill={`url(#${classId})`} stroke={p[3]} strokeWidth={2.5} />
      <Circle cx={50} cy={47} r={19} fill={`url(#${discId})`} stroke={p[3]} strokeWidth={2.5} />
      <Path d="M37 41 Q42 32 52 31" fill="none" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" opacity={0.6} />
      <G transform="translate(50 46) scale(1.25)">
        {ic.fill ? <Path d={ic.fill} fill="#FFFFFF" stroke={p[3]} strokeWidth={1.4} /> : null}
        {ic.stroke ? <Path d={ic.stroke} fill="none" stroke={p[3]} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" /> : null}
        {ic.stroke ? <Path d={ic.stroke} fill="none" stroke="#FFFFFF" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" /> : null}
      </G>
      <Rect x={31} y={62} width={38} height={14} rx={5} fill={p[3]} />
      <Text x="50" y="73" textAnchor="middle" fontFamily={fontFamily.fredokaBold} fontWeight="800" fontSize="11" fill="#FFFFFF">
        {p[4]}
      </Text>
    </Svg>
  );
}
