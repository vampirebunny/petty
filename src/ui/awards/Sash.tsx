import { useId } from 'react';
import Svg, { Defs, Ellipse, G, LinearGradient, Path, Rect, Stop, Text } from 'react-native-svg';

import { fontFamily } from '../font';
import { svgId } from './svgId';

type Props = {
  earned?: boolean;
  size?: number;
};

export function Sash({ earned = true, size = 120 }: Props) {
  const raw = useId();
  const formId = svgId('xf', raw);
  const sashId = svgId('xs', raw);
  const dash = earned ? undefined : '5 4';

  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" accessible accessibilityLabel={`Crowd Favorite sash${earned ? '' : ', not earned yet'}`}>
      <Defs>
        <LinearGradient id={formId} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={earned ? '#FFFBF5' : '#FFFFFF'} />
          <Stop offset="0.6" stopColor={earned ? '#F8E8D6' : '#F6F2FA'} />
          <Stop offset="1" stopColor={earned ? '#E6CBB0' : '#ECE6F4'} />
        </LinearGradient>
        <LinearGradient id={sashId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFD6E5" />
          <Stop offset="0.45" stopColor="#F28AB3" />
          <Stop offset="1" stopColor="#D9608F" />
        </LinearGradient>
      </Defs>
      <Path d="M60 92 V110" stroke={earned ? '#8E5530' : '#B8AED6'} strokeWidth={6.5} strokeLinecap="round" strokeDasharray={dash} />
      <Path d="M60 92 V110" stroke={earned ? '#C98A5A' : '#EDE7F6'} strokeWidth={3.2} strokeLinecap="round" />
      <Ellipse cx={60} cy={112} rx={19} ry={4.5} fill={earned ? '#C98A5A' : '#EDE7F6'} stroke={earned ? '#8E5530' : '#B8AED6'} strokeWidth={2.4} strokeDasharray={dash} />
      <Rect x={54} y={8} width={12} height={11} rx={4} fill={`url(#${formId})`} stroke={earned ? '#A97A58' : '#B8AED6'} strokeWidth={2.2} strokeDasharray={dash} />
      <Path
        d="M38 21 Q60 13 82 21 Q91 25 89 40 Q86 52 80 62 Q87 77 82 93 H38 Q33 77 40 62 Q34 52 31 40 Q29 25 38 21 Z"
        fill={`url(#${formId})`}
        stroke={earned ? '#A97A58' : '#B8AED6'}
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeDasharray={dash}
      />
      <Path d="M37 30 Q35 42 40 52" fill="none" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" opacity={earned ? 0.8 : 0} />
      {earned ? (
        <G>
          <Path d="M78 78 L87 73 L94 97 L85 100 Z" fill="#C9507F" stroke="#A93F6C" strokeWidth={2.2} strokeLinejoin="round" />
          <Path d="M86.5 100.5 L86 105 M89.5 99.5 L90 104 M92.5 98.5 L94 102.5" stroke="#FFD45E" strokeWidth={1.8} strokeLinecap="round" />
          <Path d="M34 29 L46 18 L89 72 L77 83 Z" fill={`url(#${sashId})`} stroke="#A93F6C" strokeWidth={2.4} strokeLinejoin="round" />
          <Path d="M37.6 28.4 L79.3 80.3 M44.4 21.6 L85.9 73.2" stroke="#FFD45E" strokeWidth={1.5} strokeLinecap="round" />
          <Text
            x="61.5"
            y="52.8"
            textAnchor="middle"
            transform="rotate(51.3 61.5 50.5)"
            fontFamily={fontFamily.fredokaBold}
            fontWeight="800"
            fontSize="6.6"
            fill="#6A1A3A"
          >
            CROWD FAVORITE
          </Text>
          <Path d="M42 24 L47 30" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" opacity={0.6} />
        </G>
      ) : (
        <G>
          <Path d="M34 29 L46 18 L89 72 L77 83 Z" fill="#F3EEF8" stroke="#B8AED6" strokeWidth={2.2} strokeLinejoin="round" strokeDasharray="5 4" />
          <Text x="60" y="64" textAnchor="middle" fontFamily={fontFamily.fredokaBold} fontWeight="800" fontSize="26" fill="#8A80B5">
            ?
          </Text>
        </G>
      )}
    </Svg>
  );
}
