import { useId } from 'react';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Line, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

function idOf(prefix: string, raw: string): string {
  return `${prefix}${raw.replace(/[^a-zA-Z0-9]/g, '')}`;
}

// "Spotted!": a scout squirrel in its acorn-cap helmet, caught by the laser dot.
export function AcornAttackIcon({ size }: { size: number }) {
  const raw = useId();
  const tile = idOf('aaT', raw);
  const lawn = idOf('aaL', raw);
  const tail = idOf('aaS', raw);
  const body = idOf('aaB', raw);
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512">
      <Defs>
        <ClipPath id={tile}>
          <Rect x={0} y={0} width={512} height={512} rx={114} />
        </ClipPath>
        <LinearGradient id={lawn} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#a4e58f" />
          <Stop offset="1" stopColor="#69b95a" />
        </LinearGradient>
        <LinearGradient id={tail} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#e6a96c" />
          <Stop offset="1" stopColor="#c98447" />
        </LinearGradient>
        <RadialGradient id={body} cx="0.38" cy="0.3" r="0.8">
          <Stop offset="0" stopColor="#d08a4e" />
          <Stop offset="1" stopColor="#a8652f" />
        </RadialGradient>
      </Defs>
      <G clipPath={`url(#${tile})`}>
        <Rect x={0} y={0} width={512} height={512} fill={`url(#${lawn})`} />
        <G rotation={-24} origin="256, 256" fill="#ffffff" opacity={0.16}>
          <Rect x={-300} y={-140} width={1100} height={78} />
          <Rect x={-300} y={16} width={1100} height={78} />
          <Rect x={-300} y={172} width={1100} height={78} />
          <Rect x={-300} y={328} width={1100} height={78} />
          <Rect x={-300} y={484} width={1100} height={78} />
        </G>
        <G stroke="#4f9a45" strokeWidth={7} strokeLinecap="round" fill="none">
          <Path d="M70 430l-8-22M84 432v-26M98 430l8-22" />
          <Path d="M410 120l-7-19M422 122v-23M434 120l7-19" />
          <Path d="M88 150l-6-17M98 152v-20M108 150l6-17" />
        </G>
        <Line x1={120} y1={560} x2={246} y2={168} stroke="#ff4f7a" strokeOpacity={0.3} strokeWidth={34} strokeLinecap="round" />
        <Line x1={120} y1={560} x2={246} y2={168} stroke="#ff2d55" strokeWidth={14} strokeLinecap="round" />
        <Line x1={120} y1={560} x2={246} y2={168} stroke="#ffd3dd" strokeWidth={5} strokeLinecap="round" />
        <G x={236} y={304} scale={8}>
          <Ellipse cx={2} cy={17} rx={12} ry={3.6} fill="#2d5a22" opacity={0.25} />
          <Path d="M3 8C23 6 25 -22 8 -26C3 -27 -1 -24 2 -20C14 -16 12 -2 -1 4Z" fill={`url(#${tail})`} />
          <Path d="M9 -22C14 -19 15 -10 11 -2" fill="none" stroke="#f0c28f" strokeWidth={1.4} strokeLinecap="round" opacity={0.8} />
          <Ellipse cx={0} cy={7} rx={10} ry={10.5} fill={`url(#${body})`} />
          <Ellipse cx={0} cy={9} rx={6} ry={7} fill="#f4dcb8" />
          <Ellipse cx={-5} cy={16} rx={3.5} ry={2.2} fill="#a8652f" />
          <Ellipse cx={5} cy={16} rx={3.5} ry={2.2} fill="#a8652f" />
          <Ellipse cx={-5.5} cy={7} rx={2.4} ry={2} fill="#b8743f" />
          <Ellipse cx={5.5} cy={7} rx={2.4} ry={2} fill="#b8743f" />
          <Circle cx={0} cy={-6} r={10} fill={`url(#${body})`} />
          <Ellipse cx={-7} cy={-14.5} rx={3} ry={4.5} rotation={-17} origin="-7, -14.5" fill="#b8743f" />
          <Ellipse cx={7} cy={-14.5} rx={3} ry={4.5} rotation={17} origin="7, -14.5" fill="#b8743f" />
          <Ellipse cx={-7} cy={-14} rx={1.5} ry={2.6} rotation={-17} origin="-7, -14" fill="#f1a8a0" />
          <Ellipse cx={7} cy={-14} rx={1.5} ry={2.6} rotation={17} origin="7, -14" fill="#f1a8a0" />
          <Ellipse cx={0} cy={-2.5} rx={4.6} ry={3.4} fill="#f4dcb8" />
          <Ellipse cx={-3.8} cy={-7.4} rx={2.5} ry={2.8} fill="#2c1d33" />
          <Ellipse cx={3.8} cy={-7.4} rx={2.5} ry={2.8} fill="#2c1d33" />
          <Circle cx={-3.4} cy={-8.6} r={0.9} fill="#ffffff" />
          <Circle cx={4.2} cy={-8.6} r={0.9} fill="#ffffff" />
          <Path d="M-6.8 -11.4L-2.2 -12.6M6.8 -11.4L2.2 -12.6" stroke="#4a2c1c" strokeWidth={1.2} strokeLinecap="round" />
          <Ellipse cx={0} cy={-4.4} rx={1.5} ry={1.05} fill="#5a3324" />
          <Ellipse cx={0} cy={-1.3} rx={1.3} ry={1.6} fill="#5a3324" />
          <Ellipse cx={-6.6} cy={-3.6} rx={1.8} ry={1.1} fill="#f1a8a0" opacity={0.7} />
          <Ellipse cx={6.6} cy={-3.6} rx={1.8} ry={1.1} fill="#f1a8a0" opacity={0.7} />
          <Path
            d="M-8.8 -14C-8.8 -17.4 -4.8 -19 0 -19C4.8 -19 8.8 -17.4 8.8 -14C8.8 -12.6 4.8 -11.6 0 -11.6C-4.8 -11.6 -8.8 -12.6 -8.8 -14Z"
            fill="#7d4c27"
          />
          <Path d="M-6 -17L-3 -12.2M-2.5 -18.2L0.5 -11.8M1 -18.5L4 -12M4.6 -17.6L7 -13" stroke="#5f3819" strokeWidth={0.7} strokeLinecap="round" />
          <Path d="M0 -19C0.2 -20.6 1.2 -21.6 2.4 -22" stroke="#5f3819" strokeWidth={1.3} strokeLinecap="round" fill="none" />
        </G>
        <Circle cx={246} cy={168} r={30} fill="#ff2d55" opacity={0.3} />
        <Circle cx={246} cy={168} r={14} fill="#ff2d55" />
        <Circle cx={242} cy={164} r={5} fill="#ffd3dd" />
      </G>
    </Svg>
  );
}
