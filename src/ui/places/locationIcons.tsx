import { useId, type ReactNode } from 'react';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Polygon, Rect, Stop } from 'react-native-svg';

import type { SpotId } from './spots';

const viewW = 120;
const viewH = 124;

export function iconHeight(width: number): number {
  return (width * viewH) / viewW;
}

function useSvgId(prefix: string): string {
  return `${prefix}${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
}

function IconSvg({ size, children }: { size: number; children: ReactNode }) {
  return (
    <Svg width={size} height={iconHeight(size)} viewBox={`0 0 ${viewW} ${viewH}`} pointerEvents="none">
      {children}
    </Svg>
  );
}

function Shade({ id, y1, y2, top, bottom }: { id: string; y1: number; y2: number; top: string; bottom: string }) {
  return (
    <LinearGradient id={id} gradientUnits="userSpaceOnUse" x1="0" y1={y1} x2="0" y2={y2}>
      <Stop offset="0" stopColor={top} />
      <Stop offset="1" stopColor={bottom} />
    </LinearGradient>
  );
}

function SofaShapes({ fill }: { fill: string }) {
  return (
    <G fill={fill}>
      <Rect x={22} y={28} width={76} height={44} rx={18} />
      <Rect x={8} y={52} width={28} height={42} rx={14} />
      <Rect x={84} y={52} width={28} height={42} rx={14} />
      <Rect x={28} y={62} width={64} height={30} rx={12} />
      <Rect x={18} y={88} width={10} height={14} rx={4} />
      <Rect x={92} y={88} width={10} height={14} rx={4} />
    </G>
  );
}

export function SofaIcon({ size }: { size: number }) {
  const grad = useSvgId('so');
  return (
    <IconSvg size={size}>
      <Defs>
        <Shade id={grad} y1={24} y2={104} top="#FFC9A6" bottom="#F27A4B" />
      </Defs>
      <Ellipse cx={60} cy={115} rx={42} ry={6} fill="#F27A4B" opacity={0.22} />
      <G transform="translate(0, 6)">
        <SofaShapes fill="#D35A2E" />
      </G>
      <SofaShapes fill={`url(#${grad})`} />
      <Path d="M60 67 V87" stroke="#E2693B" strokeWidth={3} strokeLinecap="round" opacity={0.55} />
      <Ellipse cx={44} cy={38} rx={14} ry={5} fill="#FFFFFF" opacity={0.75} />
      <Circle cx={64} cy={37} r={2.5} fill="#FFFFFF" opacity={0.75} />
      <Ellipse cx={17} cy={61} rx={4} ry={3} fill="#FFFFFF" opacity={0.6} />
    </IconSvg>
  );
}

function BedShapes({ fill }: { fill: string }) {
  return (
    <G fill={fill}>
      <Rect x={10} y={24} width={24} height={78} rx={12} />
      <Rect x={14} y={62} width={96} height={30} rx={12} />
      <Rect x={94} y={52} width={18} height={50} rx={9} />
      <Rect x={40} y={88} width={10} height={14} rx={4} />
    </G>
  );
}

export function BedIcon({ size }: { size: number }) {
  const grad = useSvgId('be');
  return (
    <IconSvg size={size}>
      <Defs>
        <Shade id={grad} y1={22} y2={104} top="#C9CFFF" bottom="#7480F2" />
      </Defs>
      <Ellipse cx={60} cy={115} rx={46} ry={6} fill="#7480F2" opacity={0.22} />
      <G transform="translate(0, 6)">
        <BedShapes fill="#5560D6" />
      </G>
      <BedShapes fill={`url(#${grad})`} />
      <Rect x={38} y={47} width={28} height={19} rx={9.5} fill="#FFFFFF" />
      <Rect x={58} y={54} width={40} height={22} rx={10} fill="#E4E7FF" />
      <Path d="M66 60 H90" stroke="#B9C0FF" strokeWidth={3} strokeLinecap="round" />
      <Ellipse cx={18} cy={38} rx={3.5} ry={7} fill="#FFFFFF" opacity={0.7} />
      <Ellipse cx={102} cy={60} rx={3} ry={5} fill="#FFFFFF" opacity={0.6} />
      <Path d="M78 22 h9 l-9 10 h9" fill="none" stroke="#8C96F5" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M94 10 h6 l-6 7 h6" fill="none" stroke="#B3BAFA" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
    </IconSvg>
  );
}

function TreeTiers({ fill }: { fill: string }) {
  return (
    <G fill={fill} stroke={fill} strokeWidth={14} strokeLinejoin="round">
      <Polygon points="60,14 82,42 38,42" />
      <Polygon points="60,34 90,68 30,68" />
      <Polygon points="60,56 96,90 24,90" />
    </G>
  );
}

export function TreeIcon({ size }: { size: number }) {
  const grad = useSvgId('tr');
  const paint = `url(#${grad})`;
  return (
    <IconSvg size={size}>
      <Defs>
        <Shade id={grad} y1={8} y2={96} top="#D3F5A2" bottom="#66BE45" />
      </Defs>
      <Ellipse cx={60} cy={116} rx={40} ry={6} fill="#66BE45" opacity={0.25} />
      <Rect x={52} y={90} width={16} height={22} rx={5} fill="#82542C" />
      <Rect x={52} y={86} width={16} height={20} rx={5} fill="#B07843" />
      <G transform="translate(0, 6)">
        <TreeTiers fill="#4B9A33" />
      </G>
      <TreeTiers fill={paint} />
      <Ellipse cx={51} cy={26} rx={6} ry={3.5} fill="#FFFFFF" opacity={0.75} transform="rotate(-35, 51, 26)" />
      <Ellipse cx={42} cy={54} rx={6} ry={3.2} fill="#FFFFFF" opacity={0.55} transform="rotate(-30, 42, 54)" />
      <Ellipse cx={36} cy={78} rx={6} ry={3.2} fill="#FFFFFF" opacity={0.5} transform="rotate(-28, 36, 78)" />
      <Ellipse cx={96} cy={112} rx={11} ry={3} fill="#F26B5B" opacity={0.25} />
      <Circle cx={96} cy={102} r={10} fill="#FF8A78" />
      <Path d="M88 98 C93 102 99 102 104 98" stroke="#FFFFFF" strokeWidth={2.2} fill="none" strokeLinecap="round" opacity={0.85} />
      <Ellipse cx={92} cy={96} rx={3} ry={2} fill="#FFFFFF" opacity={0.8} />
    </IconSvg>
  );
}

function CatioBody({ fill }: { fill: string }) {
  return (
    <G fill={fill} stroke={fill} strokeWidth={10} strokeLinejoin="round">
      <Polygon points="60,16 102,46 18,46" />
      <Rect x={20} y={42} width={80} height={58} rx={8} />
    </G>
  );
}

export function CatioIcon({ size }: { size: number }) {
  const grad = useSvgId('ca');
  return (
    <IconSvg size={size}>
      <Defs>
        <Shade id={grad} y1={10} y2={106} top="#BDF3E6" bottom="#3FBFA6" />
      </Defs>
      <Ellipse cx={60} cy={116} rx={44} ry={6} fill="#3FBFA6" opacity={0.25} />
      <G transform="translate(0, 6)">
        <CatioBody fill="#2E9C86" />
      </G>
      <CatioBody fill={`url(#${grad})`} />
      <Rect x={28} y={50} width={64} height={46} rx={6} fill="#ECFCF8" />
      <Path d="M49 80 L51 67 L58 75 Z M71 80 L69 67 L62 75 Z" fill="#F2A65A" stroke="#F2A65A" strokeWidth={3} strokeLinejoin="round" />
      <Ellipse cx={60} cy={85} rx={13} ry={11} fill="#F2A65A" />
      <Path d="M52 72 L53 69 L56 73 Z M68 72 L67 69 L64 73 Z" fill="#FFC7D6" />
      <Circle cx={55} cy={84} r={1.9} fill="#3A2E4F" />
      <Circle cx={65} cy={84} r={1.9} fill="#3A2E4F" />
      <Path d="M58.5 88 L61.5 88 L60 89.8 Z" fill="#D9707F" />
      <Ellipse cx={54} cy={80} rx={3} ry={1.6} fill="#FFFFFF" opacity={0.55} />
      <Path d="M44 50 V96 M60 50 V96 M76 50 V96 M28 65 H92 M28 80 H92" stroke="#8ADCCB" strokeWidth={2} opacity={0.9} />
      <Rect x={28} y={50} width={64} height={46} rx={6} fill="none" stroke="#33AD95" strokeWidth={2.5} />
      <Ellipse cx={44} cy={31} rx={9} ry={3.5} fill="#FFFFFF" opacity={0.75} transform="rotate(-34, 44, 31)" />
      <Circle cx={60} cy={31} r={4} fill="#FFFFFF" opacity={0.85} />
    </IconSvg>
  );
}

function ShopBody({ fill }: { fill: string }) {
  return (
    <G fill={fill}>
      <Rect x={20} y={44} width={80} height={60} rx={10} />
      <Rect x={10} y={20} width={100} height={32} rx={12} />
    </G>
  );
}

export function ShopIcon({ size }: { size: number }) {
  const grad = useSvgId('sp');
  return (
    <IconSvg size={size}>
      <Defs>
        <Shade id={grad} y1={20} y2={106} top="#DDD1FF" bottom="#957AEE" />
      </Defs>
      <Ellipse cx={60} cy={116} rx={44} ry={6} fill="#957AEE" opacity={0.25} />
      <G transform="translate(0, 6)">
        <ShopBody fill="#7357CF" />
      </G>
      <ShopBody fill={`url(#${grad})`} />
      <Rect x={28} y={20} width={14} height={32} fill="#FFFFFF" opacity={0.6} />
      <Rect x={53} y={20} width={14} height={32} fill="#FFFFFF" opacity={0.6} />
      <Rect x={78} y={20} width={14} height={32} fill="#FFFFFF" opacity={0.6} />
      <Circle cx={20} cy={52} r={7} fill="#F59AC9" />
      <Circle cx={34} cy={52} r={7} fill="#FFFFFF" />
      <Circle cx={48} cy={52} r={7} fill="#F59AC9" />
      <Circle cx={62} cy={52} r={7} fill="#FFFFFF" />
      <Circle cx={76} cy={52} r={7} fill="#F59AC9" />
      <Circle cx={90} cy={52} r={7} fill="#FFFFFF" />
      <Circle cx={104} cy={52} r={6} fill="#F59AC9" />
      <Rect x={26} y={68} width={16} height={16} rx={5} fill="#FFFFFF" opacity={0.8} />
      <Rect x={78} y={68} width={16} height={16} rx={5} fill="#FFFFFF" opacity={0.8} />
      <Rect x={47} y={70} width={26} height={34} rx={9} fill="#6B4FC4" />
      <Circle cx={67} cy={88} r={2.2} fill="#FFFFFF" />
      <Ellipse cx={22} cy={28} rx={7} ry={3} fill="#FFFFFF" opacity={0.8} />
    </IconSvg>
  );
}

export function SchoolIcon({ size }: { size: number }) {
  const grad = useSvgId('sc');
  return (
    <IconSvg size={size}>
      <Defs>
        <Shade id={grad} y1={16} y2={108} top="#FFE7F4" bottom="#F08AB8" />
      </Defs>
      <Ellipse cx={60} cy={116} rx={44} ry={6} fill="#F08AB8" opacity={0.25} />
      <G transform="translate(0, 6)">
        <Path d="M22 48 H98 V100 H22 Z" fill="#C45B8A" />
        <Path d="M16 50 L60 18 L104 50 Z" fill="#C45B8A" />
      </G>
      <Path d="M22 48 H98 V100 H22 Z" fill={`url(#${grad})`} />
      <Path d="M16 50 L60 18 L104 50 Z" fill={`url(#${grad})`} />
      <Rect x={46} y={68} width={28} height={32} rx={8} fill="#7A3E62" />
      <Circle cx={68} cy={84} r={2} fill="#FFFFFF" />
      <Rect x={30} y={58} width={14} height={14} rx={4} fill="#FFFFFF" opacity={0.85} />
      <Rect x={76} y={58} width={14} height={14} rx={4} fill="#FFFFFF" opacity={0.85} />
      <Path d="M78 96 L86 72 L94 96 Z" fill="#F2A3C4" />
      <Rect x={74} y={94} width={24} height={6} rx={3} fill="#E07AA8" />
      <Circle cx={60} cy={34} r={5} fill="#FFE29A" />
    </IconSvg>
  );
}

export const locationIcons = {
  shop: ShopIcon,
  school: SchoolIcon,
  park: TreeIcon,
  livingroom: SofaIcon,
  bedroom: BedIcon,
  catio: CatioIcon,
} satisfies Record<SpotId, ({ size }: { size: number }) => ReactNode>;
