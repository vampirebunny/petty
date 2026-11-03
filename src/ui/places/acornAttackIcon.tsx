import { useId } from 'react';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

function idOf(prefix: string, raw: string): string {
  return `${prefix}${raw.replace(/[^a-zA-Z0-9]/g, '')}`;
}

export function AcornAttackIcon({ size }: { size: number }) {
  const raw = useId();
  const lawn = idOf('aaL', raw);
  const glow = idOf('aaG', raw);
  const body = idOf('aaB', raw);
  const cap = idOf('aaC', raw);
  const clip = idOf('aaK', raw);
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id={lawn} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#b6e89a" />
          <Stop offset="0.55" stopColor="#7cc96b" />
          <Stop offset="1" stopColor="#4e9a48" />
        </LinearGradient>
        <RadialGradient id={glow} cx="0.5" cy="0.22" r="0.45">
          <Stop offset="0" stopColor="#ffd0e2" stopOpacity={0.95} />
          <Stop offset="1" stopColor="#ffd0e2" stopOpacity={0} />
        </RadialGradient>
        <LinearGradient id={body} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#d8925a" />
          <Stop offset="1" stopColor="#8a4e28" />
        </LinearGradient>
        <LinearGradient id={cap} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#6d4630" />
          <Stop offset="1" stopColor="#3d2618" />
        </LinearGradient>
        <RadialGradient id={clip} cx="0.4" cy="0.3" r="0.8">
          <Stop offset="0" stopColor="#ffffff" />
          <Stop offset="1" stopColor="#ff8fb8" />
        </RadialGradient>
      </Defs>
      <G>
        <Rect width={100} height={100} rx={24} fill={`url(#${lawn})`} />
        <Rect x={0} y={18} width={100} height={16} fill="#86d374" opacity={0.55} />
        <Rect x={0} y={52} width={100} height={16} fill="#86d374" opacity={0.4} />
        <Ellipse cx={50} cy={22} rx={16} ry={8} fill={`url(#${glow})`} />
        <Path d="M50 8 L54 18 L46 18 Z" fill="#ff2d55" />
        <Circle cx={50} cy={20} r={4} fill={`url(#${clip})`} />
        <Path d="M28 34 Q50 28 72 34" stroke="#ff9db8" strokeWidth={2} fill="none" strokeLinecap="round" />
        <Ellipse cx={50} cy={68} rx={16} ry={18} fill={`url(#${body})`} />
        <Ellipse cx={50} cy={54} rx={14} ry={8} fill={`url(#${cap})`} />
        <Path d="M50 46 Q54 40 50 36 Q46 40 50 46" fill="#5a3218" />
        <Circle cx={44} cy={66} r={2.2} fill="#2a160c" />
        <Circle cx={56} cy={66} r={2.2} fill="#2a160c" />
        <Path d="M42 60 L47 63" stroke="#3a2012" strokeWidth={1.4} strokeLinecap="round" />
        <Path d="M58 60 L53 63" stroke="#3a2012" strokeWidth={1.4} strokeLinecap="round" />
      </G>
    </Svg>
  );
}
