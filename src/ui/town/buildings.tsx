import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Ellipse, G, Line, Path, Rect } from 'react-native-svg';

import type { Foliage } from '../../actor/sky';
import type { RoadSpot } from '../../sim/road';
import { StadiumIcon } from './StadiumIcon';
import { usePulse } from './motion';
import { SeasonalFlowers } from './blooms';
import { leafColor } from './townSky';

const ink = {
  stroke: '#4B3B7A',
  strokeWidth: 3,
  strokeLinejoin: 'round' as const,
  strokeLinecap: 'round' as const,
};

function Art({ width, label, children }: { width: number; label: string; children: ReactNode }) {
  return (
    <Svg width={width} height={width * 0.9} viewBox="0 0 200 180" accessibilityRole="image" accessibilityLabel={label}>
      {children}
    </Svg>
  );
}

function Puff({
  cx,
  cy,
  r,
  width,
  reduced,
  delay,
}: {
  cx: number;
  cy: number;
  r: number;
  width: number;
  reduced: boolean;
  delay: number;
}) {
  const t = useSharedValue(0);
  const still = useSharedValue(reduced ? 1 : 0);
  const unit = width / 200;
  useEffect(() => {
    still.value = reduced ? 1 : 0;
    if (reduced) {
      cancelAnimation(t);
      t.value = 0;
      return () => cancelAnimation(t);
    }
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration: 3200 }), -1, false));
    return () => cancelAnimation(t);
  }, [delay, reduced, still, t]);
  const style = useAnimatedStyle(() => {
    if (still.value) {
      return { opacity: 0.85, transform: [{ translateY: 0 }, { scale: 1 }] };
    }
    const p = t.value;
    const fade = p < 0.3 ? p / 0.3 : 1 - (p - 0.3) / 0.7;
    return {
      opacity: Math.max(0, fade) * 0.95,
      transform: [{ translateY: (6 - 18 * p) * unit }, { scale: 0.6 + 0.65 * p }],
    };
  });
  const size = r * 2 * unit;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: (cx - r) * unit,
          top: (cy - r) * unit,
          width: size,
          height: size,
          borderRadius: size,
          backgroundColor: '#FFFFFF',
        },
        style,
      ]}
    />
  );
}

function Twinkle({
  cx,
  cy,
  width,
  reduced,
  delay,
}: {
  cx: number;
  cy: number;
  width: number;
  reduced: boolean;
  delay: number;
}) {
  const wave = usePulse(reduced, 1400, delay);
  const unit = width / 200;
  const style = useAnimatedStyle(() => ({ opacity: 1 - wave.value * 0.75 }));
  const size = 5.2 * unit;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: (cx - 2.6) * unit,
          top: (cy - 2.6) * unit,
          width: size,
          height: size,
          borderRadius: size,
          backgroundColor: '#FFE9A8',
        },
        style,
      ]}
    />
  );
}

const marquee = [
  [44, 48, 0],
  [58, 48, 700],
  [72, 48, 0],
  [128, 48, 700],
  [142, 48, 0],
  [156, 48, 700],
  [44, 64, 700],
  [58, 64, 0],
  [72, 64, 700],
  [128, 64, 0],
  [142, 64, 700],
  [156, 64, 0],
] as const;

function HomeArt({ width, reducedMotion }: { width: number; reducedMotion: boolean }) {
  return (
    <View style={{ width, height: width * 0.9 }} pointerEvents="none">
      <Art width={width} label="Home">
        <Ellipse cx={100} cy={166} rx={76} ry={9} fill="#4B3B7A" opacity={0.12} />
        <G {...ink}>
          <Rect x={128} y={34} width={18} height={34} rx={3} fill="#D9584A" />
          <Rect x={125} y={30} width={24} height={8} rx={3} fill="#F47C6C" />
          <Circle cx={44} cy={150} r={11} fill="#9FE3B4" />
          <Circle cx={157} cy={150} r={11} fill="#9FE3B4" />
          <Rect x={50} y={80} width={100} height={78} rx={6} fill="#FFF1DE" />
          <Path d="M36 90 L100 36 L164 90 Q166 96 159 96 L41 96 Q34 96 36 90 Z" fill="#F47C6C" />
          <Path d="M58 80 L100 45" fill="none" stroke="#FFFFFF" strokeWidth={4} opacity={0.7} />
          <Circle cx={100} cy={72} r={10} fill="#B9E2FF" />
          <Path d="M100 62 V82 M90 72 H110" fill="none" strokeWidth={2} />
          <Rect x={60} y={106} width={22} height={20} rx={4} fill="#B9E2FF" />
          <Rect x={118} y={106} width={22} height={20} rx={4} fill="#B9E2FF" />
          <Path d="M64 115 L70 109 M122 115 L128 109" fill="none" stroke="#FFFFFF" strokeWidth={2.5} />
          <Rect x={57} y={126} width={28} height={8} rx={3} fill="#F47C6C" />
          <Rect x={115} y={126} width={28} height={8} rx={3} fill="#F47C6C" />
          <Circle cx={63} cy={123} r={3} fill="#FFD45E" strokeWidth={1.5} />
          <Circle cx={71} cy={122} r={3} fill="#D9584A" strokeWidth={1.5} />
          <Circle cx={79} cy={123} r={3} fill="#FFD45E" strokeWidth={1.5} />
          <Circle cx={121} cy={123} r={3} fill="#D9584A" strokeWidth={1.5} />
          <Circle cx={129} cy={122} r={3} fill="#FFD45E" strokeWidth={1.5} />
          <Circle cx={137} cy={123} r={3} fill="#D9584A" strokeWidth={1.5} />
          <Path d="M88 156 V130 Q88 116 100 116 Q112 116 112 130 V156 Z" fill="#C98A66" />
          <Circle cx={106} cy={139} r={2} fill="#4B3B7A" stroke="none" />
          <Rect x={46} y={154} width={108} height={8} rx={4} fill="#E8D3B0" />
          <Ellipse cx={100} cy={165} rx={15} ry={4} fill="#FFD45E" />
        </G>
      </Art>
      <Puff cx={141} cy={20} r={6} width={width} reduced={reducedMotion} delay={0} />
      <Puff cx={151} cy={10} r={4.5} width={width} reduced={reducedMotion} delay={1600} />
    </View>
  );
}

function ShopArt({ width }: { width: number }) {
  return (
    <View style={{ width, height: width * 0.9 }} pointerEvents="none">
    <Art width={width} label="Pet Shop">
      <Ellipse cx={100} cy={166} rx={78} ry={9} fill="#4B3B7A" opacity={0.12} />
      <G {...ink}>
        <Rect x={40} y={74} width={120} height={84} rx={8} fill="#FFD86B" />
        <Path d="M86 50 V60 M114 50 V60" fill="none" strokeWidth={2.5} />
        <Circle cx={72} cy={35} r={7} fill="#FFE9A8" />
        <Circle cx={72} cy={47} r={7} fill="#FFE9A8" />
        <Circle cx={128} cy={35} r={7} fill="#FFE9A8" />
        <Circle cx={128} cy={47} r={7} fill="#FFE9A8" />
        <Rect x={72} y={31} width={56} height={20} rx={8} fill="#FFE9A8" stroke="none" />
        <Path d="M72 31 H128 M72 51 H128" fill="none" />
        <Ellipse cx={100} cy={44} rx={5} ry={4} fill="#2FA595" stroke="none" />
        <Circle cx={93.5} cy={38.5} r={2.2} fill="#2FA595" stroke="none" />
        <Circle cx={98} cy={35.5} r={2.2} fill="#2FA595" stroke="none" />
        <Circle cx={102.5} cy={35.5} r={2.2} fill="#2FA595" stroke="none" />
        <Circle cx={106.5} cy={38.5} r={2.2} fill="#2FA595" stroke="none" />
        <Rect x={30} y={58} width={140} height={24} rx={8} fill="#FFFFFF" />
        <Rect x={44} y={59.5} width={14} height={21} fill="#3CC4B0" stroke="none" />
        <Rect x={72} y={59.5} width={14} height={21} fill="#3CC4B0" stroke="none" />
        <Rect x={100} y={59.5} width={14} height={21} fill="#3CC4B0" stroke="none" />
        <Rect x={128} y={59.5} width={14} height={21} fill="#3CC4B0" stroke="none" />
        <Rect x={156} y={59.5} width={12} height={21} rx={5} fill="#3CC4B0" stroke="none" />
        <Rect x={30} y={58} width={140} height={24} rx={8} fill="none" />
        <Circle cx={37} cy={84} r={7} fill="#3CC4B0" />
        <Circle cx={51} cy={84} r={7} fill="#FFFFFF" />
        <Circle cx={65} cy={84} r={7} fill="#3CC4B0" />
        <Circle cx={79} cy={84} r={7} fill="#FFFFFF" />
        <Circle cx={93} cy={84} r={7} fill="#3CC4B0" />
        <Circle cx={107} cy={84} r={7} fill="#FFFFFF" />
        <Circle cx={121} cy={84} r={7} fill="#3CC4B0" />
        <Circle cx={135} cy={84} r={7} fill="#FFFFFF" />
        <Circle cx={149} cy={84} r={7} fill="#3CC4B0" />
        <Circle cx={163} cy={84} r={7} fill="#FFFFFF" />
        <Rect x={50} y={100} width={56} height={42} rx={6} fill="#B9E2FF" />
        <Path d="M56 112 L64 104 M58 120 L72 106" fill="none" stroke="#FFFFFF" strokeWidth={2.5} />
        <Circle cx={81} cy={131} r={3} fill="#FFF6E6" strokeWidth={1.5} />
        <Circle cx={81} cy={137} r={3} fill="#FFF6E6" strokeWidth={1.5} />
        <Circle cx={97} cy={131} r={3} fill="#FFF6E6" strokeWidth={1.5} />
        <Circle cx={97} cy={137} r={3} fill="#FFF6E6" strokeWidth={1.5} />
        <Rect x={81} y={131} width={16} height={6} fill="#FFF6E6" stroke="none" />
        <Path d="M81 131 H97 M81 137 H97" fill="none" strokeWidth={1.5} />
        <Path d="M116 156 V112 Q116 102 130 102 Q144 102 144 112 V156 Z" fill="#2FA595" />
        <Rect x={123} y={110} width={14} height={14} rx={4} fill="#B9E2FF" strokeWidth={2} />
        <Circle cx={139} cy={134} r={2} fill="#4B3B7A" stroke="none" />
        <Rect x={36} y={154} width={128} height={8} rx={4} fill="#F2B84B" />
        <Circle cx={160} cy={141} r={9} fill="#9FE3B4" />
        <Path d="M152 148 L168 148 L165 160 L155 160 Z" fill="#FFAD7A" />
      </G>
    </Art>
    </View>
  );
}

function ParkArt({
  width,
  reducedMotion,
  foliage,
  snow,
}: {
  width: number;
  reducedMotion: boolean;
  foliage: Foliage;
  snow: boolean;
}) {
  const hop = usePulse(reducedMotion, 2800);
  const unit = width / 200;
  const ball = useAnimatedStyle(() => ({
    transform: [{ translateY: hop.value < 0.7 ? 0 : -9 * unit * Math.sin(((hop.value - 0.7) / 0.3) * Math.PI) }],
  }));
  const pine = leafColor('#3FA86E', foliage, 4);
  const round = leafColor('#9FE3B4', foliage, 5);
  const arch = leafColor('#3FA86E', foliage, 6);
  const lawn = foliage.season === 'winter' || foliage.lush < 0.35 ? '#D9D2B8' : foliage.season === 'autumn' ? '#D7E3A8' : '#BFEFD4';
  const bare = foliage.leaves < 0.55;
  return (
    <View style={{ width, height: width * 0.9 }} pointerEvents="none">
      <Art width={width} label="Park">
        <Ellipse cx={100} cy={166} rx={82} ry={9} fill="#4B3B7A" opacity={0.12} />
        <G {...ink}>
          <Rect x={165} y={110} width={10} height={16} fill="#7A5535" />
          {bare ? (
            <G>
              <Line x1={170} y1={112} x2={158} y2={72} stroke="#7A5535" strokeWidth={2.5} />
              <Line x1={170} y1={112} x2={182} y2={68} stroke="#7A5535" strokeWidth={2.5} />
              <Line x1={170} y1={90} x2={170} y2={54} stroke="#7A5535" strokeWidth={2.2} />
            </G>
          ) : (
            <G>
              <Path d="M148 112 L170 70 L192 112 Z" fill={pine} />
              <Path d="M153 90 L170 54 L187 90 Z" fill={round} />
            </G>
          )}
          <Rect x={27} y={102} width={10} height={24} fill="#7A5535" />
          {bare ? (
            <G>
              <Line x1={32} y1={102} x2={18} y2={68} stroke="#7A5535" strokeWidth={2.5} />
              <Line x1={32} y1={102} x2={46} y2={64} stroke="#7A5535" strokeWidth={2.5} />
              <Line x1={32} y1={90} x2={32} y2={58} stroke="#7A5535" strokeWidth={2.2} />
            </G>
          ) : (
            <G>
              <Circle cx={32} cy={86} r={25} fill={round} />
              <Circle cx={24} cy={78} r={6} fill="#FFFFFF" opacity={0.6} stroke="none" />
            </G>
          )}
          <Ellipse cx={100} cy={150} rx={90} ry={16} fill={lawn} />
          <Path d="M86 166 L92 120 L108 120 L114 166 Z" fill="#FFF6E6" stroke="#E2CDA6" />
          <Rect x={52} y={80} width={14} height={78} rx={4} fill="#C98A66" />
          <Rect x={134} y={80} width={14} height={78} rx={4} fill="#C98A66" />
          <Path d="M50 88 Q100 40 150 88 L150 100 Q100 54 50 100 Z" fill={arch} />
          <Circle cx={59} cy={78} r={9} fill="#FFD45E" />
          <Circle cx={141} cy={78} r={9} fill="#FFD45E" />
          <Path d="M84 78 V86 M116 78 V86" fill="none" strokeWidth={2} />
          <Rect x={76} y={85} width={48} height={19} rx={6} fill="#FFFFFF" />
          <Ellipse cx={100} cy={97} rx={4.5} ry={3.6} fill="#E784B3" stroke="none" />
          <Circle cx={94.5} cy={92.3} r={1.9} fill="#E784B3" stroke="none" />
          <Circle cx={98.2} cy={89.8} r={1.9} fill="#E784B3" stroke="none" />
          <Circle cx={101.8} cy={89.8} r={1.9} fill="#E784B3" stroke="none" />
          <Circle cx={105.5} cy={92.3} r={1.9} fill="#E784B3" stroke="none" />
          <SeasonalFlowers
            spots={[
              { x: 30, y: 152, r: 3.2 },
              { x: 40, y: 156, r: 2.8 },
              { x: 168, y: 152, r: 3.2 },
            ]}
            foliage={foliage}
            snow={snow}
          />
        </G>
      </Art>
      <Animated.View
        pointerEvents="none"
        style={[{ position: 'absolute', left: 121 * unit, top: 148 * unit, width: 14 * unit, height: 14 * unit }, ball]}
      >
        <Svg width="100%" height="100%" viewBox="121 148 14 14">
          <Circle cx={128} cy={155} r={7} fill="#FFAD7A" stroke="#4B3B7A" strokeWidth={2} />
          <Path d="M122 153 Q128 157 134 153" fill="none" stroke="#FFFFFF" strokeWidth={1.5} />
        </Svg>
      </Animated.View>
    </View>
  );
}

function SchoolArt({ width, reducedMotion }: { width: number; reducedMotion: boolean }) {
  const swing = usePulse(reducedMotion, 2400);
  const unit = width / 200;
  const bell = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-12 + swing.value * 24}deg` }],
  }));
  return (
    <View style={{ width, height: width * 0.9 }} pointerEvents="none">
      <Art width={width} label="Training School">
        <Ellipse cx={100} cy={166} rx={84} ry={9} fill="#4B3B7A" opacity={0.12} />
        <G {...ink}>
          <Rect x={88} y={24} width={24} height={34} fill="#FFF1DE" />
          <Path d="M82 28 L100 8 L118 28 Z" fill="#2F5BA8" />
          <Rect x={46} y={84} width={108} height={74} rx={6} fill="#CFE8FF" />
          <Path d="M36 92 L100 46 L164 92 Q166 98 159 98 L41 98 Q34 98 36 92 Z" fill="#4D8FE6" />
          <Path d="M58 84 L100 54" fill="none" stroke="#FFFFFF" strokeWidth={4} opacity={0.6} />
          <Circle cx={100} cy={80} r={9} fill="#FFF6E6" />
          <Path
            d="M100 73.5 L101.7 77.6 L106.2 77.8 L102.7 80.6 L103.9 85 L100 82.5 L96.1 85 L97.3 80.6 L93.8 77.8 L98.3 77.6 Z"
            fill="#FFD45E"
            strokeWidth={1.5}
          />
          <Path d="M58 134 V118 Q58 108 68 108 Q78 108 78 118 V134 Z" fill="#B9E2FF" />
          <Path d="M122 134 V118 Q122 108 132 108 Q142 108 142 118 V134 Z" fill="#B9E2FF" />
          <Path d="M68 108 V134 M132 108 V134" fill="none" strokeWidth={2} />
          <Rect x={86} y={116} width={28} height={40} rx={4} fill="#2F5BA8" />
          <Path d="M100 116 V156" fill="none" strokeWidth={2} />
          <Rect x={40} y={154} width={120} height={8} rx={4} fill="#9FC9F2" />
          <Path d="M166 160 V138 M190 160 V138" fill="none" />
          <Rect x={161} y={132} width={34} height={8} rx={4} fill="#FFFFFF" />
          <Rect x={169} y={133.5} width={5} height={5} fill="#4D8FE6" stroke="none" />
          <Rect x={182} y={133.5} width={5} height={5} fill="#4D8FE6" stroke="none" />
          <Path d="M14 159 L24 130 L34 159 Z" fill="#FFAD7A" />
          <Path d="M18.5 146 L29.5 146" fill="none" stroke="#FFFFFF" strokeWidth={3} />
          <Rect x={10} y={157} width={28} height={6} rx={2} fill="#FFAD7A" />
        </G>
      </Art>
      <Animated.View
        pointerEvents="none"
        style={[{ position: 'absolute', left: 94 * unit, top: 34 * unit, width: 12 * unit, height: 14 * unit }, bell]}
      >
        <Svg width="100%" height="100%" viewBox="94 34 12 14">
          <Path d="M94 46 Q94 34 100 34 Q106 34 106 46 Z" fill="#FFD45E" stroke="#4B3B7A" strokeWidth={2} />
        </Svg>
      </Animated.View>
    </View>
  );
}

function Beam({
  d,
  box,
  width,
  reduced,
  reverse,
}: {
  d: string;
  box: { x: number; y: number; w: number; h: number };
  width: number;
  reduced: boolean;
  reverse?: boolean;
}) {
  const wave = usePulse(reduced, 4000);
  const still = useSharedValue(reduced ? 1 : 0);
  const unit = width / 200;
  const half = (box.h * unit) / 2;
  useEffect(() => {
    still.value = reduced ? 1 : 0;
  }, [reduced, still]);
  const style = useAnimatedStyle(() => {
    const swing = still.value ? 0 : (reverse ? 9 : -9) + (reverse ? -18 : 18) * wave.value;
    return {
      transform: [{ translateY: half }, { rotate: `${swing}deg` }, { translateY: -half }],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', left: box.x * unit, top: box.y * unit, width: box.w * unit, height: box.h * unit }, style]}
    >
      <Svg width="100%" height="100%" viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}>
        <Path d={d} fill="#FFE9A8" opacity={0.6} />
      </Svg>
    </Animated.View>
  );
}

function CatwalkArt({ width, reducedMotion }: { width: number; reducedMotion: boolean }) {
  return (
    <View style={{ width, height: width * 0.9 }} pointerEvents="none">
      <Beam d="M29 152 L6 18 L50 18 Z" box={{ x: 6, y: 18, w: 44, h: 134 }} width={width} reduced={reducedMotion} />
      <Beam d="M171 152 L150 18 L194 18 Z" box={{ x: 150, y: 18, w: 44, h: 134 }} width={width} reduced={reducedMotion} reverse />
      <Art width={width} label="The Catwalk">
        <Ellipse cx={100} cy={166} rx={84} ry={9} fill="#4B3B7A" opacity={0.12} />
        <G {...ink}>
        <Rect x={22} y={148} width={14} height={11} rx={3} fill="#6A4FC0" />
        <Rect x={164} y={148} width={14} height={11} rx={3} fill="#6A4FC0" />
        <Path d="M44 72 A56 42 0 0 1 156 72 Z" fill="#F7A9C9" />
        <Path d="M100 30 L78 72 M100 30 L122 72" fill="none" strokeWidth={2} />
        <Circle cx={100} cy={27} r={5} fill="#FFD45E" />
        <Rect x={44} y={70} width={112} height={88} rx={6} fill="#FFE3F0" />
        <Rect x={36} y={62} width={128} height={24} rx={9} fill="#E0559A" />
        {[48, 57, 66, 75, 125, 134, 143, 152].map((cx) => (
          <Circle key={cx} cx={cx} cy={74} r={2.4} fill="#FFE9A8" stroke="none" />
        ))}
        <Path d="M97 70 Q97 66 100 66 Q103 66 103 68.5 Q103 71 100 72 L88 80 H112 L100 72" fill="none" stroke="#FFFFFF" strokeWidth={2.2} />
        <Rect x={54} y={96} width={26} height={40} rx={6} fill="#B9E2FF" />
        <Path d="M63 104 Q67 100 71 104 L72.5 116 L75 127 L59 127 L61.5 116 Z" fill="#F7A9C9" strokeWidth={2} />
        <Path d="M67 127 V133" fill="none" strokeWidth={2} />
        <Rect x={120} y={96} width={26} height={40} rx={6} fill="#B9E2FF" />
        <Path d="M129 104 Q133 100 137 104 L138.5 116 L141 127 L125 127 L127.5 116 Z" fill="#FFD45E" strokeWidth={2} />
        <Path d="M133 127 V133" fill="none" strokeWidth={2} />
        <Path d="M84 156 V112 Q84 98 100 98 Q116 98 116 112 V156 Z" fill="#4B3B7A" />
        <Path d="M86 155 V112 Q86 101 98 100 Q91 124 96 155 Z" fill="#E0559A" strokeWidth={2} />
        <Path d="M114 155 V112 Q114 101 102 100 Q109 124 104 155 Z" fill="#E0559A" strokeWidth={2} />
        <Rect x={40} y={154} width={120} height={7} rx={3.5} fill="#C9B8F5" />
        <Path d="M85 159 L115 159 L134 178 L66 178 Z" fill="#E0559A" />
        <Path d="M100 162 V175" fill="none" stroke="#FFFFFF" strokeWidth={2} strokeDasharray="3 4" />
        <Path d="M70 156 V144 M130 156 V144" fill="none" strokeWidth={2.5} />
        <Circle cx={70} cy={142} r={3.5} fill="#FFD45E" strokeWidth={2} />
        <Circle cx={130} cy={142} r={3.5} fill="#FFD45E" strokeWidth={2} />
        <Path d="M72 144 Q78 152 84 145 M128 144 Q122 152 116 145" fill="none" stroke="#E784B3" strokeWidth={2.5} />
      </G>
      </Art>
    </View>
  );
}

function ArcadeArt({ width, reducedMotion }: { width: number; reducedMotion: boolean }) {
  return (
    <View style={{ width, height: width * 0.9 }} pointerEvents="none">
      <Art width={width} label="Arcade">
        <Ellipse cx={100} cy={166} rx={78} ry={9} fill="#4B3B7A" opacity={0.12} />
        <G {...ink}>
          <Circle cx={54} cy={44} r={14} fill="#F28A3C" />
          <Circle cx={146} cy={44} r={14} fill="#F28A3C" />
          <Circle cx={54} cy={44} r={6} fill="#FFC48A" stroke="none" />
          <Circle cx={146} cy={44} r={6} fill="#FFC48A" stroke="none" />
          <Rect x={42} y={68} width={116} height={90} rx={10} fill="#FFA65C" />
          <Rect x={32} y={40} width={136} height={32} rx={12} fill="#6A4FC0" />
          <Path
            d="M100 45.5 L103.2 52.2 L110.5 53 L105 58 L106.5 65.2 L100 61.6 L93.5 65.2 L95 58 L89.5 53 L96.8 52.2 Z"
            fill="#FFD45E"
            strokeWidth={2}
          />
          <Rect x={54} y={84} width={58} height={56} rx={6} fill="#DDF0FF" />
          <Path d="M60 96 L68 88 M60 106 L76 90" fill="none" stroke="#FFFFFF" strokeWidth={2.5} />
          <Circle cx={66} cy={132} r={7} fill="#FFC48A" strokeWidth={2} />
          <Circle cx={82} cy={134} r={5.5} fill="#FFD45E" strokeWidth={2} />
          <Circle cx={99} cy={131} r={7} fill="#9FE3B4" strokeWidth={2} />
          <Rect x={54} y={143} width={58} height={9} rx={3} fill="#F28A3C" />
          <Path d="M122 156 V110 Q122 100 136 100 Q150 100 150 110 V156 Z" fill="#6A4FC0" />
          <Rect x={129} y={108} width={14} height={14} rx={4} fill="#B9E2FF" strokeWidth={2} />
          <Rect x={36} y={154} width={128} height={8} rx={4} fill="#C9B8F5" />
        </G>
      </Art>
      {marquee.map(([cx, cy, delay]) => (
        <Twinkle key={`${cx}-${cy}-${delay}`} cx={cx} cy={cy} width={width} reduced={reducedMotion} delay={delay} />
      ))}
    </View>
  );
}

function ShopBall({ width, reduced }: { width: number; reduced: boolean }) {
  const hop = usePulse(reduced, 900);
  const unit = width / 200;
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -hop.value * 8 * unit }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0, width, height: width * 0.9 }, style]}>
      <Svg width={width} height={width * 0.9} viewBox="0 0 200 180">
        <Circle cx={66} cy={132} r={7} fill="#FFAD7A" stroke="#4B3B7A" strokeWidth={2} />
        <Path d="M60 130 Q66 134 72 130" fill="none" stroke="#FFFFFF" strokeWidth={1.5} />
      </Svg>
    </Animated.View>
  );
}

function Claw({ width, reduced }: { width: number; reduced: boolean }) {
  const ride = usePulse(reduced, 1600);
  const unit = width / 200;
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: ride.value * 12 * unit }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0, width, height: width * 0.9 }, style]}>
      <Svg width={width} height={width * 0.9} viewBox="0 0 200 180">
        <Path d="M83 84 V100" fill="none" stroke="#4B3B7A" strokeWidth={2} />
        <Path d="M77 109 Q77 100 83 100 Q89 100 89 109" fill="none" stroke="#4B3B7A" strokeWidth={2.5} />
      </Svg>
    </Animated.View>
  );
}

function WindowGlow({ id, width, height }: { id: RoadSpot; width: number; height: number }) {
  const stadium = id === 'stadium';
  return (
    <Svg width={width} height={height} viewBox={stadium ? '0 0 320 300' : '0 0 200 180'} style={StyleSheet.absoluteFill} pointerEvents="none">
      {id === 'home' ? (
        <G>
          <Ellipse cx={71} cy={116} rx={22} ry={22} fill="#FFE08A" opacity={0.3} />
          <Ellipse cx={129} cy={116} rx={22} ry={22} fill="#FFE08A" opacity={0.3} />
          <Ellipse cx={100} cy={72} rx={18} ry={18} fill="#FFE08A" opacity={0.3} />
          <Rect x={60} y={106} width={22} height={20} rx={4} fill="#FFE08A" stroke="#4B3B7A" strokeWidth={2} />
          <Rect x={118} y={106} width={22} height={20} rx={4} fill="#FFE08A" stroke="#4B3B7A" strokeWidth={2} />
          <Circle cx={100} cy={72} r={10} fill="#FFE08A" stroke="#4B3B7A" strokeWidth={2} />
        </G>
      ) : null}
      {id === 'petShop' ? (
        <G>
          <Ellipse cx={78} cy={121} rx={44} ry={32} fill="#FFE08A" opacity={0.3} />
          <Ellipse cx={130} cy={117} rx={16} ry={16} fill="#FFE08A" opacity={0.3} />
          <Rect x={50} y={100} width={56} height={42} rx={6} fill="#FFE08A" opacity={0.9} stroke="#4B3B7A" strokeWidth={2} />
          <Rect x={123} y={110} width={14} height={14} rx={4} fill="#FFE08A" stroke="#4B3B7A" strokeWidth={2} />
        </G>
      ) : null}
      {id === 'park' ? (
        <G>
          <Ellipse cx={59} cy={78} rx={24} ry={24} fill="#FFE08A" opacity={0.3} />
          <Ellipse cx={141} cy={78} rx={24} ry={24} fill="#FFE08A" opacity={0.3} />
          <Circle cx={59} cy={78} r={9} fill="#FFE08A" stroke="#4B3B7A" strokeWidth={2} />
          <Circle cx={141} cy={78} r={9} fill="#FFE08A" stroke="#4B3B7A" strokeWidth={2} />
        </G>
      ) : null}
      {id === 'trainingSchool' ? (
        <G>
          <Ellipse cx={68} cy={121} rx={24} ry={24} fill="#FFE08A" opacity={0.3} />
          <Ellipse cx={132} cy={121} rx={24} ry={24} fill="#FFE08A" opacity={0.3} />
          <Ellipse cx={100} cy={40} rx={16} ry={16} fill="#FFE08A" opacity={0.3} />
          <Path d="M58 134 V118 Q58 108 68 108 Q78 108 78 118 V134 Z" fill="#FFE08A" stroke="#4B3B7A" strokeWidth={2} />
          <Path d="M122 134 V118 Q122 108 132 108 Q142 108 142 118 V134 Z" fill="#FFE08A" stroke="#4B3B7A" strokeWidth={2} />
          <Circle cx={100} cy={80} r={9} fill="#FFE08A" stroke="#4B3B7A" strokeWidth={2} />
        </G>
      ) : null}
      {id === 'catwalk' ? (
        <G>
          <Ellipse cx={67} cy={116} rx={22} ry={28} fill="#FFE08A" opacity={0.3} />
          <Ellipse cx={133} cy={116} rx={22} ry={28} fill="#FFE08A" opacity={0.3} />
          <Rect x={54} y={96} width={26} height={40} rx={6} fill="#FFE08A" opacity={0.6} stroke="#4B3B7A" strokeWidth={2} />
          <Rect x={120} y={96} width={26} height={40} rx={6} fill="#FFE08A" opacity={0.6} stroke="#4B3B7A" strokeWidth={2} />
          {[48, 57, 66, 75, 125, 134, 143, 152].map((cx) => (
            <Circle key={cx} cx={cx} cy={74} r={3.2} fill="#FFF4C2" />
          ))}
        </G>
      ) : null}
      {id === 'arcade' ? (
        <G>
          <Ellipse cx={83} cy={112} rx={36} ry={32} fill="#FFE08A" opacity={0.35} />
          <Rect x={54} y={84} width={58} height={56} rx={6} fill="#FFE08A" opacity={0.55} />
          <Rect x={129} y={108} width={14} height={14} rx={4} fill="#FFE08A" stroke="#4B3B7A" strokeWidth={2} />
          {[
            [44, 48],
            [58, 48],
            [72, 48],
            [128, 48],
            [142, 48],
            [156, 48],
            [44, 64],
            [58, 64],
            [72, 64],
            [128, 64],
            [142, 64],
            [156, 64],
          ].map(([cx, cy]) => (
            <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={3.2} fill="#FFF4C2" />
          ))}
        </G>
      ) : null}
    </Svg>
  );
}

function SnowCap({ id, width, height }: { id: RoadSpot; width: number; height: number }) {
  const stadium = id === 'stadium';
  return (
    <Svg width={width} height={height} viewBox={stadium ? '0 0 320 300' : '0 0 200 180'} style={StyleSheet.absoluteFill} pointerEvents="none">
      {id === 'home' ? <Path d="M48 78 L100 40 L152 78 Q140 86 128 78 Q116 88 100 80 Q84 88 72 78 Q60 86 48 78 Z" fill="#FFFFFF" /> : null}
      {id === 'petShop' ? (
        <G>
          <Rect x={30} y={53} width={140} height={8} rx={4} fill="#FFFFFF" />
          <Rect x={68} y={25} width={64} height={7} rx={3.5} fill="#FFFFFF" />
        </G>
      ) : null}
      {id === 'park' ? (
        <G>
          <Path d="M52 86 Q100 40 148 86 L144 89 Q100 48 56 89 Z" fill="#FFFFFF" />
          <Path d="M10 82 Q32 54 54 82 Q44 76 32 80 Q20 76 10 82 Z" fill="#FFFFFF" />
          <Path d="M158 80 L170 54 L182 80 Q176 76 170 80 Q164 76 158 80 Z" fill="#FFFFFF" />
        </G>
      ) : null}
      {id === 'trainingSchool' ? (
        <G>
          <Path d="M50 82 L100 46 L150 82 Q140 89 130 82 Q120 90 110 83 Q100 91 90 83 Q80 90 70 82 Q60 89 50 82 Z" fill="#FFFFFF" />
          <Path d="M87 21 L100 8 L113 21 Q106 25 100 21 Q94 25 87 21 Z" fill="#FFFFFF" />
        </G>
      ) : null}
      {id === 'catwalk' ? <Path d="M52 66 Q100 28 148 66 Q136 72 124 66 Q112 74 100 66 Q88 74 76 66 Q64 72 52 66 Z" fill="#FFFFFF" /> : null}
      {id === 'arcade' ? <Path d="M40 68 Q100 52 160 68 L154 74 Q100 60 46 74 Z" fill="#FFFFFF" /> : null}
      {id === 'stadium' ? <Path d="M118 158 L160 128 L202 158 Q190 150 176 156 Q160 146 144 156 Q130 150 118 158 Z" fill="#FFFFFF" /> : null}
    </Svg>
  );
}

export function TownPlace({
  id,
  width,
  reducedMotion,
  night,
  snow,
  foliage,
}: {
  id: RoadSpot;
  width: number;
  reducedMotion: boolean;
  night: boolean;
  snow: boolean;
  foliage: Foliage;
}) {
  const height = id === 'stadium' ? (width * 300) / 320 : width * 0.9;
  const art =
    id === 'home' ? (
      <HomeArt width={width} reducedMotion={reducedMotion} />
    ) : id === 'petShop' ? (
      <ShopArt width={width} />
    ) : id === 'park' ? (
      <ParkArt width={width} reducedMotion={reducedMotion} foliage={foliage} snow={snow} />
    ) : id === 'trainingSchool' ? (
      <SchoolArt width={width} reducedMotion={reducedMotion} />
    ) : id === 'catwalk' ? (
      <CatwalkArt width={width} reducedMotion={reducedMotion} />
    ) : id === 'stadium' ? (
      <StadiumIcon width={width} reducedMotion={reducedMotion} />
    ) : (
      <ArcadeArt width={width} reducedMotion={reducedMotion} />
    );
  return (
    <View style={{ width, height }} pointerEvents="none">
      <View pointerEvents="none" style={night ? styles.nightDim : undefined}>
        {art}
      </View>
      {night ? <WindowGlow id={id} width={width} height={height} /> : null}
      {id === 'petShop' ? <ShopBall width={width} reduced={reducedMotion} /> : null}
      {id === 'arcade' ? <Claw width={width} reduced={reducedMotion} /> : null}
      {snow ? <SnowCap id={id} width={width} height={height} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  nightDim: {
    filter: 'brightness(0.62) saturate(0.85)',
  },
});
