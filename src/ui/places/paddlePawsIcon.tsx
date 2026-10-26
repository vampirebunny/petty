import { useId } from 'react';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

function idOf(prefix: string, raw: string): string {
  return `${prefix}${raw.replace(/[^a-zA-Z0-9]/g, '')}`;
}

export function PaddlePawsIcon({ size }: { size: number }) {
  const raw = useId();
  const sea = idOf('ppS', raw);
  const glow = idOf('ppG', raw);
  const paw = idOf('ppP', raw);
  const clip = idOf('ppC', raw);
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id={sea} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#a6ecf2" />
          <Stop offset="1" stopColor="#3a92c8" />
        </LinearGradient>
        <RadialGradient id={glow} cx="0.32" cy="0.28" r="0.7">
          <Stop offset="0" stopColor="#ffffff" stopOpacity={0.7} />
          <Stop offset="1" stopColor="#ffffff" stopOpacity={0} />
        </RadialGradient>
        <LinearGradient id={paw} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#ffb3d4" />
          <Stop offset="0.5" stopColor="#ff7eb8" />
          <Stop offset="1" stopColor="#e2569b" />
        </LinearGradient>
        <ClipPath id={clip}>
          <Rect width={100} height={100} rx={24} />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#${clip})`}>
        <Rect width={100} height={100} fill={`url(#${sea})`} />
        <Circle cx={50} cy={48} r={34} fill="#ffffff" opacity={0.28} />
        <Circle cx={50} cy={48} r={30} fill={`url(#${glow})`} />
        <Circle cx={50} cy={48} r={30} fill="none" stroke="#ffffff" strokeWidth={3} opacity={0.9} />
        <Ellipse cx={38} cy={36} rx={6} ry={3} fill="#ffffff" opacity={0.8} />
        <G fill={`url(#${paw})`}>
          <Ellipse cx={50} cy={56} rx={12} ry={10} />
          <Circle cx={38} cy={42} r={5.2} />
          <Circle cx={46} cy={36} r={5.2} />
          <Circle cx={54} cy={36} r={5.2} />
          <Circle cx={62} cy={42} r={5.2} />
        </G>
      </G>
    </Svg>
  );
}
