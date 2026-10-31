import { useEffect } from 'react';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Ellipse, G, Line, Path, Rect } from 'react-native-svg';

import { curvePath, roadCubics, type CloudSpec, type TownLayout } from './map';
import { usePulse } from './motion';
import type { GroundPaint, TownChrome } from './townSky';

const cloudPath = 'M20 40 Q4 40 6 28 Q8 18 22 20 Q26 6 44 8 Q56 0 70 8 Q90 4 94 18 Q114 18 114 30 Q114 40 100 40 Z';

function RoundTree({ x, y, r, paint, snow }: { x: number; y: number; r: number; paint: GroundPaint; snow: boolean }) {
  return (
    <G stroke={paint.ink} strokeWidth={2.5} strokeLinejoin="round">
      <Rect x={x - 4} y={y} width={8} height={r * 0.85} fill={paint.trunk} />
      <Circle cx={x} cy={y - r * 0.15} r={r} fill={paint.leaf} />
      {snow ? <Ellipse cx={x} cy={y - r * 0.55} rx={r * 0.72} ry={r * 0.28} fill="#FFFFFF" /> : null}
    </G>
  );
}

function Pine({ x, y, h, paint, snow }: { x: number; y: number; h: number; paint: GroundPaint; snow: boolean }) {
  const top = y - h;
  return (
    <G stroke={paint.ink} strokeWidth={2.5} strokeLinejoin="round">
      <Rect x={x - 4} y={y} width={8} height={12} fill={paint.trunk} />
      <Path d={`M${x - 18} ${y} L${x} ${top} L${x + 18} ${y} Z`} fill={paint.pine} />
      {snow ? <Path d={`M${x - 10} ${top + 10} L${x} ${top} L${x + 10} ${top + 10} Z`} fill="#FFFFFF" /> : null}
    </G>
  );
}

function Flowers({ dots }: { dots: { x: number; y: number; r: number; fill: string }[] }) {
  return (
    <G>
      {dots.map((dot) => (
        <Circle key={`${dot.x}-${dot.y}`} cx={dot.x} cy={dot.y} r={dot.r} fill={dot.fill} />
      ))}
    </G>
  );
}

const portraitFlowers = [
  { x: 200, y: 40, r: 3.5, fill: '#F7A9C9' },
  { x: 212, y: 48, r: 3, fill: '#FFD45E' },
  { x: 30, y: 110, r: 3, fill: '#F7A9C9' },
  { x: 190, y: 250, r: 3.5, fill: '#C9B8F5' },
  { x: 200, y: 244, r: 3, fill: '#FFD45E' },
  { x: 360, y: 380, r: 3.5, fill: '#F7A9C9' },
  { x: 190, y: 420, r: 3, fill: '#C9B8F5' },
  { x: 30, y: 600, r: 3.5, fill: '#FFD45E' },
  { x: 350, y: 680, r: 3, fill: '#F7A9C9' },
  { x: 200, y: 570, r: 3, fill: '#FFD45E' },
];

const wideFlowers = [
  { x: 320, y: 90, r: 3.5, fill: '#F7A9C9' },
  { x: 332, y: 98, r: 3, fill: '#FFD45E' },
  { x: 620, y: 80, r: 3.5, fill: '#C9B8F5' },
  { x: 880, y: 96, r: 3, fill: '#F7A9C9' },
  { x: 460, y: 290, r: 3.5, fill: '#FFD45E' },
  { x: 720, y: 280, r: 3, fill: '#F7A9C9' },
  { x: 1000, y: 300, r: 3.5, fill: '#C9B8F5' },
  { x: 560, y: 650, r: 3, fill: '#FFD45E' },
  { x: 900, y: 660, r: 3.5, fill: '#F7A9C9' },
  { x: 240, y: 640, r: 3, fill: '#C9B8F5' },
];

function PortraitPatches({ paint }: { paint: GroundPaint }) {
  return (
    <G>
      <Ellipse cx={40} cy={250} rx={150} ry={95} fill={paint.light} />
      <Ellipse cx={370} cy={470} rx={160} ry={105} fill={paint.light} />
      <Ellipse cx={300} cy={40} rx={140} ry={70} fill={paint.light} />
      <Ellipse cx={195} cy={724} rx={280} ry={70} fill={paint.dark} />
      <Ellipse cx={372} cy={214} rx={40} ry={15} fill={paint.water} stroke={paint.waterLine} strokeWidth={3} />
    </G>
  );
}

function WidePatches({ paint }: { paint: GroundPaint }) {
  return (
    <G>
      <Ellipse cx={200} cy={120} rx={260} ry={110} fill={paint.light} />
      <Ellipse cx={900} cy={330} rx={300} ry={90} fill={paint.light} />
      <Ellipse cx={600} cy={722} rx={700} ry={90} fill={paint.dark} />
      <Ellipse cx={180} cy={452} rx={84} ry={30} fill={paint.water} stroke={paint.waterLine} strokeWidth={3} />
    </G>
  );
}

function PortraitScenery({ paint, snow }: { paint: GroundPaint; snow: boolean }) {
  return (
    <G>
      <RoundTree x={365} y={52} r={16} paint={paint} snow={snow} />
      <RoundTree x={22} y={334} r={14} paint={paint} snow={snow} />
      <Pine x={20} y={540} h={32} paint={paint} snow={snow} />
      <RoundTree x={370} y={616} r={15} paint={paint} snow={snow} />
      <Circle cx={350} cy={300} r={10} fill={paint.bush} stroke={paint.ink} strokeWidth={2.5} />
      <Circle cx={40} cy={660} r={12} fill={paint.bush} stroke={paint.ink} strokeWidth={2.5} />
      {snow ? null : <Flowers dots={portraitFlowers} />}
    </G>
  );
}

function WideScenery({ paint, snow }: { paint: GroundPaint; snow: boolean }) {
  return (
    <G>
      <RoundTree x={40} y={72} r={16} paint={paint} snow={snow} />
      <Pine x={300} y={306} h={36} paint={paint} snow={snow} />
      <RoundTree x={600} y={318} r={15} paint={paint} snow={snow} />
      <Pine x={870} y={300} h={34} paint={paint} snow={snow} />
      <RoundTree x={1150} y={70} r={16} paint={paint} snow={snow} />
      <RoundTree x={1140} y={672} r={15} paint={paint} snow={snow} />
      <Pine x={60} y={672} h={32} paint={paint} snow={snow} />
      <Circle cx={760} cy={660} r={12} fill={paint.bush} stroke={paint.ink} strokeWidth={2.5} />
      <Circle cx={360} cy={650} r={10} fill={paint.bush} stroke={paint.ink} strokeWidth={2.5} />
      {snow ? null : <Flowers dots={wideFlowers} />}
    </G>
  );
}

const glintBox = {
  portrait: { x: 348, y: 204, w: 28, h: 5, turn: '-16deg' },
  wide: { x: 128, y: 436, w: 48, h: 6, turn: '-8deg' },
} as const;

export function PondGlint({
  layout,
  scale,
  reducedMotion,
}: {
  layout: TownLayout;
  scale: number;
  reducedMotion: boolean;
}) {
  const pulse = usePulse(reducedMotion, 3000);
  const still = useSharedValue(reducedMotion ? 1 : 0);
  useEffect(() => {
    still.value = reducedMotion ? 1 : 0;
  }, [reducedMotion, still]);
  const style = useAnimatedStyle(() => ({
    opacity: still.value ? 0.8 : 0.25 + pulse.value * 0.7,
  }));
  const box = glintBox[layout.id];
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: box.x * scale,
          top: box.y * scale,
          width: box.w * scale,
          height: box.h * scale,
          borderRadius: box.h * scale,
          backgroundColor: '#FFFFFF',
          transform: [{ rotate: box.turn }],
        },
        style,
      ]}
    />
  );
}

const portraitLamps = [
  { x: 160, y: 150 },
  { x: 175, y: 380 },
  { x: 40, y: 600 },
];

const wideLamps = [
  { x: 300, y: 150 },
  { x: 860, y: 150 },
  { x: 1130, y: 300 },
  { x: 600, y: 560 },
];

function Lamp({ x, y, night, glow }: { x: number; y: number; night: boolean; glow: number }) {
  return (
    <G>
      {night ? <Ellipse cx={x} cy={y - 6} rx={18} ry={14} fill="#FFE08A" opacity={0.35 * glow} /> : null}
      <Line x1={x} y1={y + 22} x2={x} y2={y} stroke="#5A3E8C" strokeWidth={2.5} strokeLinecap="round" />
      <Path
        d={`M${x - 7} ${y} H${x + 7} L${x + 4} ${y - 10} H${x - 4} Z`}
        fill={night ? '#FFE08A' : '#FFF6E6'}
        stroke="#5A3E8C"
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </G>
  );
}

function unit(n: number): number {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

function Precip({
  layout,
  chrome,
  wind,
  now,
  reducedMotion,
}: {
  layout: TownLayout;
  chrome: TownChrome;
  wind: number;
  now: number;
  reducedMotion: boolean;
}) {
  const { width, height } = layout;
  const t = reducedMotion ? 0 : now / 1000;
  const drops = chrome.rainMix > 0.35 ? (layout.id === 'wide' ? 70 : 36) : 0;
  const flakes = chrome.snowMix > 0.2 && chrome.rainMix < 0.55 ? (layout.id === 'wide' ? 40 : 22) : 0;
  return (
    <G>
      {Array.from({ length: drops }, (_, i) => {
        const x0 = unit(i + 3) * width;
        const speed = 0.7 + unit(i + 9) * 0.4;
        const travel = ((t / speed + unit(i + 1)) % 1) * (height + 40) - 20;
        const x = x0 + travel * wind * 0.12;
        return (
          <Line
            key={`drop-${i}`}
            x1={x}
            y1={travel}
            x2={x + wind * 12}
            y2={travel + 14}
            stroke={chrome.rain}
            strokeWidth={1.6}
            strokeLinecap="round"
            opacity={0.35 + chrome.rainMix * 0.5}
          />
        );
      })}
      {Array.from({ length: flakes }, (_, i) => {
        const x0 = unit(i + 21) * width;
        const speed = 6 + unit(i + 4) * 4;
        const travel = ((t / speed + unit(i + 2)) % 1) * (height + 24) - 12;
        const sway = reducedMotion ? 0 : Math.sin(t * 0.7 + i) * 8 + wind * 10;
        const r = 2 + (i % 3);
        return <Circle key={`flake-${i}`} cx={x0 + sway} cy={travel} r={r} fill="#FFFFFF" opacity={0.85} />;
      })}
    </G>
  );
}

function Rainbow({ layout, strength }: { layout: TownLayout; strength: number }) {
  if (strength <= 0) {
    return null;
  }
  const wide = layout.id === 'wide';
  const bands = ['#F47C6C', '#FFD45E', '#9FE3B4', '#7CC4F5', '#C9B8F5'];
  const rx = wide ? 430 : 255;
  const y = wide ? 460 : 380;
  const x0 = wide ? 167 : -60;
  const x1 = wide ? 1027 : 450;
  return (
    <G fill="none" opacity={0.55 + strength * 0.35} strokeLinecap="round">
      {bands.map((stroke, index) => {
        const radius = rx - index * (wide ? 14 : 9);
        return (
          <Path
            key={stroke}
            d={`M${x0} ${y} A${radius} ${radius} 0 0 1 ${x1} ${y}`}
            stroke={stroke}
            strokeWidth={wide ? 12 : 9}
          />
        );
      })}
    </G>
  );
}

export function TownGround({
  layout,
  paint,
  chrome,
  now,
  reducedMotion,
  rainbow,
  wind,
}: {
  layout: TownLayout;
  paint: GroundPaint;
  chrome: TownChrome;
  now: number;
  reducedMotion: boolean;
  rainbow: number;
  wind: number;
}) {
  const strokes = roadCubics(layout).map(curvePath);
  const glow = reducedMotion ? 0.85 : 0.75 + 0.25 * (0.5 + 0.5 * Math.sin(now / 450));
  const lamps = layout.id === 'portrait' ? portraitLamps : wideLamps;
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${layout.width} ${layout.height}`}>
      <Path d={`M0 0 H${layout.width} V${layout.height} H0 Z`} fill={paint.ground} />
      {layout.id === 'portrait' ? <PortraitPatches paint={paint} /> : <WidePatches paint={paint} />}
      {strokes.map((d) => (
        <Path
          key={`out-${d}`}
          d={d}
          stroke={paint.pathOuter}
          strokeWidth={layout.pathOuter}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {strokes.map((d) => (
        <Path
          key={`in-${d}`}
          d={d}
          stroke={paint.pathInner}
          strokeWidth={layout.pathInner}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {strokes.map((d) => (
        <Path
          key={`dash-${d}`}
          d={d}
          stroke={paint.pathDash}
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          strokeDasharray="2 14"
        />
      ))}
      {layout.id === 'portrait' ? <PortraitScenery paint={paint} snow={chrome.snow} /> : <WideScenery paint={paint} snow={chrome.snow} />}
      {lamps.map((lamp) => (
        <Lamp key={`${lamp.x}-${lamp.y}`} x={lamp.x} y={lamp.y} night={chrome.night} glow={glow} />
      ))}
      {chrome.tint === 'transparent' ? null : (
        <Path d={`M0 0 H${layout.width} V${layout.height} H0 Z`} fill={chrome.tint} />
      )}
      <Rainbow layout={layout} strength={rainbow} />
      <Precip layout={layout} chrome={chrome} wind={wind} now={now} reducedMotion={reducedMotion} />
    </Svg>
  );
}

export function TownCloud({
  cloud,
  scale,
  mapWidth,
  reducedMotion,
  fill,
  alpha,
}: {
  cloud: CloudSpec;
  scale: number;
  mapWidth: number;
  reducedMotion: boolean;
  fill: string;
  alpha: number;
}) {
  const travel = useSharedValue(0);
  const span = useSharedValue((mapWidth + cloud.w) * scale);
  const held = useSharedValue(reducedMotion ? 1 : 0);
  const width = cloud.w * scale;
  const phase = cloud.phase;
  useEffect(() => {
    span.value = (mapWidth + cloud.w) * scale;
    held.value = reducedMotion ? 1 : 0;
    if (reducedMotion) {
      travel.value = 0;
      return;
    }
    travel.value = 0;
    travel.value = withRepeat(withTiming(1, { duration: cloud.duration, easing: Easing.linear }), -1, false);
  }, [cloud.duration, cloud.w, held, mapWidth, reducedMotion, scale, span, travel]);
  const style = useAnimatedStyle(() => {
    const along = held.value ? phase : (travel.value + phase) % 1;
    return { transform: [{ translateX: -width + span.value * along }] };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: 0,
          top: cloud.y * scale,
          width,
          height: cloud.h * scale,
          opacity: cloud.opacity * (alpha / 0.75),
        },
        style,
      ]}
    >
      <Svg width="100%" height="100%" viewBox="0 0 120 44">
        <Path d={cloudPath} fill={fill} />
      </Svg>
    </Animated.View>
  );
}
