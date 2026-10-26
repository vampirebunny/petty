import { useId } from 'react';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

function useSvgId(prefix: string): string {
  return `${prefix}${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
}

export function HomeCottage({ width, height }: { width: number; height: number }) {
  const wall = useSvgId('hw');
  const roof = useSvgId('hr');
  return (
    <Svg width={width} height={height} viewBox="0 0 120 124">
      <Defs>
        <LinearGradient id={wall} x1="0" y1="48" x2="0" y2="108">
          <Stop offset="0" stopColor="#FFE3C4" />
          <Stop offset="1" stopColor="#F3B27A" />
        </LinearGradient>
        <LinearGradient id={roof} x1="0" y1="16" x2="0" y2="58">
          <Stop offset="0" stopColor="#FFD0E4" />
          <Stop offset="1" stopColor="#F08AB8" />
        </LinearGradient>
      </Defs>
      <Ellipse cx={60} cy={116} rx={46} ry={6} fill="#E7A06A" opacity={0.28} />
      <G transform="translate(0, 5)">
        <Path d="M18 52 H102 V104 H18 Z" fill="#E09A62" />
        <Path d="M10 54 L60 16 L110 54 Z" fill="#D46B9A" />
      </G>
      <Path d="M18 52 H102 V104 H18 Z" fill={`url(#${wall})`} />
      <Path d="M10 54 L60 16 L110 54 Z" fill={`url(#${roof})`} />
      <Rect x={78} y={30} width={14} height={28} rx={3} fill="#F6C9A2" />
      <Rect x={74} y={26} width={22} height={8} rx={2} fill="#E7A0C4" />
      <Rect x={44} y={70} width={28} height={34} rx={8} fill="#C47A4A" />
      <Circle cx={66} cy={88} r={2} fill="#FFFFFF" />
      <Rect x={28} y={64} width={16} height={16} rx={4} fill="#FFFFFF" opacity={0.9} />
      <Rect x={78} y={64} width={16} height={16} rx={4} fill="#FFFFFF" opacity={0.9} />
      <Path
        d="M60 28 C63 34 70 36 70 42 C70 48 65 52 60 52 C55 52 50 48 50 42 C50 36 57 34 60 28 Z"
        fill="#FFFFFF"
      />
      <Ellipse cx={34} cy={28} rx={8} ry={3.5} fill="#FFFFFF" opacity={0.7} />
    </Svg>
  );
}
