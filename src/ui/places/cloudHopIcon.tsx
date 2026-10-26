import { useId } from 'react';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

function idOf(prefix: string, raw: string): string {
  return `${prefix}${raw.replace(/[^a-zA-Z0-9]/g, '')}`;
}

export function CloudHopIcon({ size }: { size: number }) {
  const raw = useId();
  const sky = idOf('cpS', raw);
  const glow = idOf('cpG', raw);
  const paw = idOf('cpP', raw);
  const trail = idOf('cpT', raw);
  const clip = idOf('cpC', raw);
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id={sky} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#ffc6e1" />
          <Stop offset="0.55" stopColor="#e2cbff" />
          <Stop offset="1" stopColor="#a7dcff" />
        </LinearGradient>
        <RadialGradient id={glow} cx="0.28" cy="0.18" r="0.6">
          <Stop offset="0" stopColor="#ffffff" stopOpacity={0.55} />
          <Stop offset="1" stopColor="#ffffff" stopOpacity={0} />
        </RadialGradient>
        <LinearGradient id={paw} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#ff9fd0" />
          <Stop offset="0.55" stopColor="#ee5fa6" />
          <Stop offset="1" stopColor="#cf3f8a" />
        </LinearGradient>
        <LinearGradient id={trail} x1="24" y1="74" x2="44" y2="50" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#ffffff" stopOpacity={0} />
          <Stop offset="1" stopColor="#ffffff" stopOpacity={0.95} />
        </LinearGradient>
        <ClipPath id={clip}>
          <Rect width={100} height={100} rx={24} />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#${clip})`}>
        <Rect width={100} height={100} fill={`url(#${sky})`} />
        <Rect width={100} height={100} fill={`url(#${glow})`} />
        <G opacity={0.7}>
          <G fill="#d9b8f0">
            <Circle cx={21.6} cy={31.4} r={4.2} />
            <Circle cx={27.6} cy={28.4} r={6} />
            <Circle cx={34.8} cy={30.2} r={4.8} />
            <Circle cx={39} cy={32} r={3.6} />
            <Rect x={18} y={30.8} width={24} height={4.8} rx={2.4} />
          </G>
          <G fill="#ffffff">
            <Circle cx={21.6} cy={30} r={4.2} />
            <Circle cx={27.6} cy={27} r={6} />
            <Circle cx={34.8} cy={28.8} r={4.8} />
            <Circle cx={39} cy={30.6} r={3.6} />
            <Rect x={18} y={29.4} width={24} height={4.8} rx={2.4} />
          </G>
        </G>
        <G fill="#d9b8f0">
          <Circle cx={61.4} cy={64.6} r={6.3} />
          <Circle cx={70.4} cy={60.1} r={9} />
          <Circle cx={81.2} cy={62.8} r={7.2} />
          <Circle cx={87.5} cy={65.5} r={5.4} />
          <Rect x={56} y={63.7} width={36} height={7.2} rx={3.6} />
        </G>
        <G fill="#ffffff">
          <Circle cx={61.4} cy={62} r={6.3} />
          <Circle cx={70.4} cy={57.5} r={9} />
          <Circle cx={81.2} cy={60.2} r={7.2} />
          <Circle cx={87.5} cy={62.9} r={5.4} />
          <Rect x={56} y={61.1} width={36} height={7.2} rx={3.6} />
        </G>
        <Path d="M24 74 Q28 56 44 50" fill="none" stroke={`url(#${trail})`} strokeWidth={5.5} strokeLinecap="round" />
        <G fill="#d9b8f0">
          <Circle cx={11.8} cy={87.6} r={9.1} />
          <Circle cx={24.8} cy={81.1} r={13} />
          <Circle cx={40.4} cy={85} r={10.4} />
          <Circle cx={49.5} cy={88.9} r={7.8} />
          <Rect x={4} y={86.3} width={52} height={14} rx={5.2} />
        </G>
        <G fill="#ffffff">
          <Circle cx={11.8} cy={84} r={9.1} />
          <Circle cx={24.8} cy={77.5} r={13} />
          <Circle cx={40.4} cy={81.4} r={10.4} />
          <Circle cx={49.5} cy={85.3} r={7.8} />
          <Rect x={4} y={82.7} width={52} height={18} rx={5.2} />
        </G>
        <Ellipse cx={20} cy={72.5} rx={6} ry={2.2} fill="#ffffff" opacity={0.9} />
        <G transform="translate(55 40) rotate(-20)">
          <G fill="#ffffff">
            <Ellipse cx={0} cy={6} rx={12.6} ry={11.1} />
            <Circle cx={-11} cy={-4} r={6.2} />
            <Circle cx={-4} cy={-11.2} r={6.2} />
            <Circle cx={4} cy={-11.2} r={6.2} />
            <Circle cx={11} cy={-4} r={6.2} />
          </G>
          <G fill="#b5357a" transform="translate(0.8 1.8)">
            <Ellipse cx={0} cy={6} rx={11} ry={9.5} />
            <Circle cx={-11} cy={-4} r={4.6} />
            <Circle cx={-4} cy={-11.2} r={4.6} />
            <Circle cx={4} cy={-11.2} r={4.6} />
            <Circle cx={11} cy={-4} r={4.6} />
          </G>
          <G fill={`url(#${paw})`}>
            <Ellipse cx={0} cy={6} rx={11} ry={9.5} />
            <Circle cx={-11} cy={-4} r={4.6} />
            <Circle cx={-4} cy={-11.2} r={4.6} />
            <Circle cx={4} cy={-11.2} r={4.6} />
            <Circle cx={11} cy={-4} r={4.6} />
          </G>
          <G fill="#ffffff" opacity={0.7}>
            <G transform="translate(-4 1.6) rotate(-18)">
              <Ellipse cx={0} cy={0} rx={4.6} ry={2.2} />
            </G>
            <Ellipse cx={-12.4} cy={-5.8} rx={1.8} ry={1.1} />
            <Ellipse cx={-5.4} cy={-13} rx={1.8} ry={1.1} />
            <Ellipse cx={2.6} cy={-13} rx={1.8} ry={1.1} />
            <Ellipse cx={9.6} cy={-5.8} rx={1.8} ry={1.1} />
          </G>
        </G>
      </G>
    </Svg>
  );
}
