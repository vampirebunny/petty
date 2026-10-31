import { View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Path, SvgXml } from 'react-native-svg';

import { usePulse } from './motion';
import { stadiumXml } from './stadiumXml';

const artW = 320;
const artH = 300;

const pennantPaths = [
  'M49 46.6 Q64 48.6 76 55.6 Q64 60.6 49 64.6 Z',
  'M111 27.5 Q126 29.5 138 36.5 Q126 41.5 111 45.5 Z',
  'M211 27.5 Q226 29.5 238 36.5 Q226 41.5 211 45.5 Z',
  'M273 46.6 Q288 48.6 300 55.6 Q288 60.6 273 64.6 Z',
];

const pennants = [
  { x: 49, y: 46.6, fill: '#FF8FC1', delay: 0 },
  { x: 111, y: 27.5, fill: '#5DB8FF', delay: 200 },
  { x: 211, y: 27.5, fill: '#FFA86B', delay: 400 },
  { x: 273, y: 46.6, fill: '#5FD6A8', delay: 200 },
] as const;

function prepared(xml: string): string {
  let next = xml
    .replace(/id="wall"/g, 'id="stadiumWall"')
    .replace(/url\(#wall\)/g, 'url(#stadiumWall)')
    .replace(/id="gate"/g, 'id="stadiumGate"')
    .replace(/url\(#gate\)/g, 'url(#stadiumGate)');
  for (const d of pennantPaths) {
    next = next.replace(new RegExp(`<path d="${d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*/>`), '');
  }
  return next;
}

const arenaXml = prepared(stadiumXml);

function Pennant({
  x,
  y,
  fill,
  delay,
  width,
  reducedMotion,
}: {
  x: number;
  y: number;
  fill: string;
  delay: number;
  width: number;
  reducedMotion: boolean;
}) {
  const wave = usePulse(reducedMotion, 1600, delay);
  const unit = width / artW;
  const w = 28 * unit;
  const h = 18 * unit;
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: w / 2 },
      { scaleX: 1 - wave.value * 0.2 },
      { skewY: `${-wave.value * 10}deg` },
      { translateX: -w / 2 },
    ],
  }));
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: x * unit, top: y * unit, width: w, height: h }, style]}>
      <Svg width="100%" height="100%" viewBox="0 0 28 18">
        <Path d="M0 0 Q15 2 27 9 Q15 14 0 18 Z" fill={fill} stroke="#5A3E8C" strokeWidth={2.5} strokeLinejoin="round" />
      </Svg>
    </Animated.View>
  );
}

export function StadiumIcon({ width, reducedMotion = false }: { width: number; reducedMotion?: boolean }) {
  const height = (width * artH) / artW;
  return (
    <View style={{ width, height }} pointerEvents="none">
      <SvgXml xml={arenaXml} width={width} height={height} />
      {pennants.map((flag) => (
        <Pennant key={flag.fill} {...flag} width={width} reducedMotion={reducedMotion} />
      ))}
    </View>
  );
}
