import { useId } from 'react';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

function idOf(prefix: string, raw: string): string {
  return `${prefix}${raw.replace(/[^a-zA-Z0-9]/g, '')}`;
}

export function StayIcon({ size }: { size: number }) {
  const raw = useId();
  const tile = idOf('stT', raw);
  const face = idOf('stF', raw);
  const paw = idOf('stP', raw);
  const rim = idOf('stR', raw);
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512">
      <Defs>
        <LinearGradient id={tile} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#c9e9ff" />
          <Stop offset="1" stopColor="#ffc8e3" />
        </LinearGradient>
        <RadialGradient id={face} cx="0.4" cy="0.35" r="0.8">
          <Stop offset="0" stopColor="#ffffff" />
          <Stop offset="1" stopColor="#ffe3f0" />
        </RadialGradient>
        <RadialGradient id={paw} cx="0.38" cy="0.3" r="0.85">
          <Stop offset="0" stopColor="#ffc4de" />
          <Stop offset="0.55" stopColor="#ff79b4" />
          <Stop offset="1" stopColor="#ef5098" />
        </RadialGradient>
        <LinearGradient id={rim} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#cdb8ff" />
          <Stop offset="1" stopColor="#9a7cf0" />
        </LinearGradient>
      </Defs>
      <Rect width={512} height={512} rx={114} fill={`url(#${tile})`} />
      <Rect x={226} y={58} width={60} height={44} rx={14} fill={`url(#${rim})`} />
      <Rect x={240} y={92} width={32} height={30} fill="#9a7cf0" />
      <Rect x={372} y={104} width={44} height={30} rx={12} fill={`url(#${rim})`} transform="rotate(42 394 119)" />
      <Circle cx={256} cy={304} r={176} fill="#7f5fd9" opacity={0.25} />
      <Circle cx={256} cy={290} r={176} fill={`url(#${rim})`} />
      <Circle cx={256} cy={290} r={148} fill={`url(#${face})`} />
      <G stroke="#e7c6dc" strokeWidth={10} strokeLinecap="round">
        <Path d="M256 158v22M256 400v22M124 290h22M366 290h22M163 197l15 15M334 368l15 15M349 197l-15 15M178 368l-15 15" />
      </G>
      <G fill={`url(#${paw})`} transform="translate(256 302) scale(1.45) translate(-80 -86)">
        <Path d="M80 70c22 0 46 22 46 46 0 18-14 26-26 26-8 0-13-4-20-4s-12 4-20 4c-12 0-26-8-26-26 0-24 24-46 46-46z" />
        <Ellipse cx={34} cy={66} rx={15} ry={19} transform="rotate(-22 34 66)" />
        <Ellipse cx={62} cy={38} rx={15} ry={20} transform="rotate(-8 62 38)" />
        <Ellipse cx={98} cy={38} rx={15} ry={20} transform="rotate(8 98 38)" />
        <Ellipse cx={126} cy={66} rx={15} ry={19} transform="rotate(22 126 66)" />
      </G>
      <Ellipse cx={200} cy={200} rx={54} ry={22} fill="#ffffff" opacity={0.7} transform="rotate(-35 200 200)" />
    </Svg>
  );
}
