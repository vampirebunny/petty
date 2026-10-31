import { useEffect } from 'react';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Ellipse, G, Line, Path, Rect } from 'react-native-svg';

import type { Foliage } from '../../actor/sky';
import { curvePath, roadCubics, type CloudSpec, type TownLayout } from './map';
import { usePulse } from './motion';
import { SeasonalFlowers } from './blooms';
import { leafColor, type GroundPaint, type TownChrome } from './townSky';

const cloudPath = 'M20 40 Q4 40 6 28 Q8 18 22 20 Q26 6 44 8 Q56 0 70 8 Q90 4 94 18 Q114 18 114 30 Q114 40 100 40 Z';

const canopy = [
  { dx: -0.62, dy: -0.2, rr: 0.52 },
  { dx: 0.62, dy: -0.18, rr: 0.5 },
  { dx: -0.28, dy: -0.72, rr: 0.58 },
  { dx: 0.32, dy: -0.78, rr: 0.55 },
  { dx: 0, dy: -1.12, rr: 0.62 },
] as const;

function unit(n: number): number {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

/** Round deciduous tree: the same season cues as the room trees, drawn for the map. */
function RoundTree({
  x,
  y,
  r,
  paint,
  foliage,
  snow,
  seed = 0,
}: {
  x: number;
  y: number;
  r: number;
  paint: GroundPaint;
  foliage: Foliage;
  snow: boolean;
  seed?: number;
}) {
  const trunkH = r * 1.15;
  const crownY = y - trunkH;
  const leafy = foliage.leaves;
  const grow = 0.55 + 0.45 * leafy;
  return (
    <G stroke={paint.ink} strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round">
      <Path d={`M${x - 5} ${y} L${x + 5} ${y} L${x + 3.2} ${crownY} L${x - 3.2} ${crownY} Z`} fill={paint.trunk} />
      <Ellipse cx={x - 5} cy={y - 1} rx={4} ry={2} fill={paint.trunk} />
      <Ellipse cx={x + 5} cy={y - 1} rx={4} ry={2} fill={paint.trunk} />
      {leafy < 0.85 ? (
        <G opacity={1 - leafy * 0.85}>
          <Line x1={x} y1={crownY + 2} x2={x - r * 0.75} y2={crownY - r * 0.55} stroke={paint.trunk} strokeWidth={2.4} />
          <Line x1={x} y1={crownY + 2} x2={x + r * 0.72} y2={crownY - r * 0.6} stroke={paint.trunk} strokeWidth={2.4} />
          <Line x1={x} y1={crownY + 2} x2={x} y2={crownY - r * 1.05} stroke={paint.trunk} strokeWidth={2.2} />
          <Line x1={x - r * 0.4} y1={crownY - r * 0.25} x2={x - r * 0.95} y2={crownY - r * 0.35} stroke={paint.trunk} strokeWidth={1.6} />
          <Line x1={x + r * 0.38} y1={crownY - r * 0.28} x2={x + r * 0.95} y2={crownY - r * 0.3} stroke={paint.trunk} strokeWidth={1.6} />
          {snow ? (
            <G>
              <Line x1={x - r * 0.75} y1={crownY - r * 0.58} x2={x - r * 0.3} y2={crownY - r * 0.2} stroke="#F5F8FF" strokeWidth={2} />
              <Line x1={x + r * 0.72} y1={crownY - r * 0.63} x2={x + r * 0.28} y2={crownY - r * 0.22} stroke="#F5F8FF" strokeWidth={2} />
            </G>
          ) : null}
        </G>
      ) : null}
      {leafy > 0.02
        ? canopy.map((blob, i) => {
            if (unit(i + seed * 13 + 21) > leafy * 1.15) {
              return null;
            }
            const col = leafColor(paint.leaf, foliage, i + seed * 7);
            const cx = x + blob.dx * r;
            const cy = crownY + blob.dy * r;
            const rr = blob.rr * r * grow;
            return (
              <G key={`${seed}-${i}`}>
                <Circle cx={cx + 1.2} cy={cy + 1.5} r={rr} fill={col} opacity={0.72} />
                <Circle cx={cx} cy={cy} r={rr} fill={col} />
                {snow ? <Ellipse cx={cx} cy={cy - rr * 0.55} rx={rr * 0.78} ry={rr * 0.28} fill="#F6F9FF" /> : null}
              </G>
            );
          })
        : null}
      {foliage.blossom > 0.02
        ? Array.from({ length: 8 }, (_, i) => {
            const blob = canopy[i % canopy.length];
            const ang = unit(i + seed + 31) * Math.PI * 2;
            const d = blob.rr * r * (0.2 + unit(i + seed + 32) * 0.7);
            const px = x + blob.dx * r + Math.cos(ang) * d;
            const py = crownY + blob.dy * r + Math.sin(ang) * d;
            return (
              <G key={`bloom-${seed}-${i}`} opacity={foliage.blossom}>
                <Circle cx={px} cy={py} r={2.4} fill={i % 3 === 0 ? '#FFFFFF' : '#F7B9CF'} stroke="none" />
                <Circle cx={px} cy={py} r={0.9} fill="#F2D86A" stroke="none" />
              </G>
            );
          })
        : null}
    </G>
  );
}

function Pine({ x, y, h, paint, snow }: { x: number; y: number; h: number; paint: GroundPaint; snow: boolean }) {
  const top = y - h;
  const mid = y - h * 0.45;
  return (
    <G stroke={paint.ink} strokeWidth={2.5} strokeLinejoin="round">
      <Rect x={x - 4} y={y - 4} width={8} height={16} fill={paint.trunk} />
      <Path d={`M${x - 16} ${y} L${x} ${mid} L${x + 16} ${y} Z`} fill={paint.pine} />
      <Path d={`M${x - 13} ${mid + 4} L${x} ${top} L${x + 13} ${mid + 4} Z`} fill={paint.pine} />
      {snow ? <Path d={`M${x - 9} ${top + 10} L${x} ${top} L${x + 9} ${top + 10} Z`} fill="#FFFFFF" /> : null}
    </G>
  );
}

function Bush({ x, y, r, paint, foliage, snow }: { x: number; y: number; r: number; paint: GroundPaint; foliage: Foliage; snow: boolean }) {
  return (
    <G stroke={paint.ink} strokeWidth={2.4} strokeLinejoin="round">
      <Circle cx={x - r * 0.45} cy={y - r * 0.15} r={r * 0.7} fill={paint.bush} />
      <Circle cx={x + r * 0.42} cy={y - r * 0.12} r={r * 0.65} fill={paint.bush} />
      <Circle cx={x} cy={y - r * 0.45} r={r * 0.85} fill={paint.bush} />
      {foliage.season === 'spring' || foliage.blossom > 0
        ? [0, 1, 2, 3].map((i) => (
            <Circle
              key={`bush-bloom-${i}`}
              cx={x - r * 0.55 + unit(i + 41) * r * 1.1}
              cy={y - r * 0.7 + unit(i + 42) * r * 0.55}
              r={2.2}
              fill={i % 2 ? '#FFFFFF' : '#FFC6DC'}
              stroke="none"
              opacity={Math.max(foliage.blossom, foliage.season === 'spring' ? 0.6 : 0)}
            />
          ))
        : null}
      {foliage.season === 'winter'
        ? [0, 1, 2, 3].map((i) => (
            <Circle
              key={`berry-${i}`}
              cx={x - r * 0.45 + unit(i + 43) * r}
              cy={y - r * 0.55 + unit(i + 44) * r * 0.5}
              r={1.8}
              fill="#D23B3B"
              stroke="none"
            />
          ))
        : null}
      {snow ? <Ellipse cx={x} cy={y - r * 0.85} rx={r * 0.9} ry={r * 0.28} fill="#F6F9FF" /> : null}
    </G>
  );
}

const portraitFlowers = [
  { x: 200, y: 40, r: 3.5 },
  { x: 212, y: 48, r: 3 },
  { x: 30, y: 110, r: 3 },
  { x: 190, y: 250, r: 3.5 },
  { x: 200, y: 244, r: 3 },
  { x: 360, y: 380, r: 3.5 },
  { x: 190, y: 420, r: 3 },
  { x: 30, y: 600, r: 3.5 },
  { x: 350, y: 680, r: 3 },
  { x: 200, y: 570, r: 3 },
];

const wideFlowers = [
  { x: 320, y: 90, r: 3.5 },
  { x: 332, y: 98, r: 3 },
  { x: 620, y: 80, r: 3.5 },
  { x: 880, y: 96, r: 3 },
  { x: 460, y: 290, r: 3.5 },
  { x: 720, y: 280, r: 3 },
  { x: 1000, y: 300, r: 3.5 },
  { x: 560, y: 650, r: 3 },
  { x: 900, y: 660, r: 3.5 },
  { x: 240, y: 640, r: 3 },
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
  const foliage = paint.foliage;
  return (
    <G>
      <RoundTree x={365} y={52} r={18} paint={paint} foliage={foliage} snow={snow} seed={1} />
      <RoundTree x={22} y={334} r={16} paint={paint} foliage={foliage} snow={snow} seed={2} />
      <Pine x={20} y={540} h={34} paint={paint} snow={snow} />
      <RoundTree x={370} y={616} r={17} paint={paint} foliage={foliage} snow={snow} seed={3} />
      <Bush x={350} y={300} r={11} paint={paint} foliage={foliage} snow={snow} />
      <Bush x={40} y={660} r={13} paint={paint} foliage={foliage} snow={snow} />
      <SeasonalFlowers spots={portraitFlowers} foliage={foliage} snow={snow} />
    </G>
  );
}

function WideScenery({ paint, snow }: { paint: GroundPaint; snow: boolean }) {
  const foliage = paint.foliage;
  return (
    <G>
      <RoundTree x={40} y={72} r={18} paint={paint} foliage={foliage} snow={snow} seed={4} />
      <Pine x={300} y={306} h={38} paint={paint} snow={snow} />
      <RoundTree x={600} y={318} r={17} paint={paint} foliage={foliage} snow={snow} seed={5} />
      <Pine x={870} y={300} h={36} paint={paint} snow={snow} />
      <RoundTree x={1150} y={70} r={18} paint={paint} foliage={foliage} snow={snow} seed={6} />
      <RoundTree x={1140} y={672} r={17} paint={paint} foliage={foliage} snow={snow} seed={7} />
      <Pine x={60} y={672} h={34} paint={paint} snow={snow} />
      <Bush x={760} y={660} r={13} paint={paint} foliage={foliage} snow={snow} />
      <Bush x={360} y={650} r={11} paint={paint} foliage={foliage} snow={snow} />
      <SeasonalFlowers spots={wideFlowers} foliage={foliage} snow={snow} />
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
