import { Circle, G, Line, Path } from 'react-native-svg';

import type { Foliage } from '../../actor/sky';

export type BloomCycle = 'spring' | 'summer' | 'autumn';

export type FlowerSpot = { x: number; y: number; r: number };

const palettes: Record<BloomCycle, readonly string[]> = {
  // Spring tulips and pastels.
  spring: ['#F7B9CF', '#FFFFFF', '#FFE08A', '#C9B8F5', '#F7A9C9'],
  // Summer sunflowers and bright beds.
  summer: ['#FFD45E', '#F28A3C', '#FFE08A', '#F7A9C9', '#E0559A'],
  // Autumn mums still in bloom — warm, not fallen leaves.
  autumn: ['#E9A93B', '#DD6A2E', '#C94A32', '#E8C04A', '#B8562F'],
};

/** Which flowers are out. Winter and snow have none. Late autumn goes bare — no dead blooms. */
export function bloomCycle(foliage: Foliage, snow: boolean): BloomCycle | 'none' {
  if (snow || foliage.season === 'winter') {
    return 'none';
  }
  if (foliage.season === 'spring') {
    return foliage.lush > 0.18 || foliage.blossom > 0.04 ? 'spring' : 'none';
  }
  if (foliage.season === 'summer') {
    return 'summer';
  }
  if (foliage.season === 'autumn' && foliage.lush >= 0.4) {
    return 'autumn';
  }
  return 'none';
}

function bloomOpacity(cycle: BloomCycle, foliage: Foliage): number {
  if (cycle === 'spring') {
    return Math.min(1, 0.55 + Math.max(foliage.blossom, foliage.lush) * 0.5);
  }
  if (cycle === 'autumn') {
    return Math.min(1, 0.45 + foliage.lush * 0.7);
  }
  return 1;
}

function SpringTulip({ x, y, r, fill }: { x: number; y: number; r: number; fill: string }) {
  return (
    <G>
      <Line x1={x} y1={y + r * 0.35} x2={x} y2={y + r * 1.35} stroke="#5E9447" strokeWidth={1.4} strokeLinecap="round" />
      <Path
        d={`M${x - r} ${y + r * 0.15} Q${x - r * 0.7} ${y - r} ${x} ${y - r * 1.05} Q${x + r * 0.7} ${y - r} ${x + r} ${y + r * 0.15} Q${x} ${y + r * 0.45} ${x - r} ${y + r * 0.15} Z`}
        fill={fill}
        stroke="#4B3B7A"
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
    </G>
  );
}

function SummerBloom({ x, y, r, fill, index }: { x: number; y: number; r: number; fill: string; index: number }) {
  if (index % 3 === 0) {
    return (
      <G>
        <Line x1={x} y1={y + r * 0.2} x2={x} y2={y + r * 1.25} stroke="#5E9447" strokeWidth={1.4} strokeLinecap="round" />
        {[0, 1, 2, 3, 4, 5].map((petal) => {
          const a = (petal / 6) * Math.PI * 2;
          return (
            <Circle
              key={petal}
              cx={x + Math.cos(a) * r * 0.55}
              cy={y + Math.sin(a) * r * 0.55}
              r={r * 0.42}
              fill={fill}
              stroke="#4B3B7A"
              strokeWidth={1.2}
            />
          );
        })}
        <Circle cx={x} cy={y} r={r * 0.38} fill="#8B5A2B" stroke="#4B3B7A" strokeWidth={1.2} />
      </G>
    );
  }
  return (
    <G>
      <Line x1={x} y1={y + r * 0.15} x2={x} y2={y + r * 1.2} stroke="#5E9447" strokeWidth={1.4} strokeLinecap="round" />
      <Circle cx={x} cy={y} r={r} fill={fill} stroke="#4B3B7A" strokeWidth={1.5} />
      <Circle cx={x - r * 0.2} cy={y - r * 0.25} r={r * 0.28} fill="#FFFFFF" opacity={0.45} stroke="none" />
    </G>
  );
}

function AutumnMum({ x, y, r, fill }: { x: number; y: number; r: number; fill: string }) {
  return (
    <G>
      <Line x1={x} y1={y + r * 0.2} x2={x} y2={y + r * 1.2} stroke="#7B8A5A" strokeWidth={1.4} strokeLinecap="round" />
      <Circle cx={x} cy={y} r={r} fill={fill} stroke="#4B3B7A" strokeWidth={1.5} />
      <Circle cx={x} cy={y} r={r * 0.62} fill={fill} stroke="#4B3B7A" strokeWidth={1.1} opacity={0.9} />
      <Circle cx={x} cy={y} r={r * 0.28} fill="#FFF4C2" stroke="none" />
    </G>
  );
}

function OneFlower({
  spot,
  cycle,
  index,
}: {
  spot: FlowerSpot;
  cycle: BloomCycle;
  index: number;
}) {
  const fill = palettes[cycle][index % palettes[cycle].length];
  if (cycle === 'spring') {
    return <SpringTulip x={spot.x} y={spot.y} r={spot.r} fill={fill} />;
  }
  if (cycle === 'summer') {
    return <SummerBloom x={spot.x} y={spot.y} r={spot.r} fill={fill} index={index} />;
  }
  return <AutumnMum x={spot.x} y={spot.y} r={spot.r} fill={fill} />;
}

/** Seasonal flower bed for the town grass or the Park lawn. Never draws dead blooms. */
export function SeasonalFlowers({
  spots,
  foliage,
  snow,
}: {
  spots: FlowerSpot[];
  foliage: Foliage;
  snow: boolean;
}) {
  const cycle = bloomCycle(foliage, snow);
  if (cycle === 'none') {
    return null;
  }
  return (
    <G opacity={bloomOpacity(cycle, foliage)}>
      {spots.map((spot, index) => (
        <OneFlower key={`${spot.x}-${spot.y}`} spot={spot} cycle={cycle} index={index} />
      ))}
    </G>
  );
}
