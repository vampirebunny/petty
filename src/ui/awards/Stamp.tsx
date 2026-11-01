import { useId } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Polygon, Rect, Stop } from 'react-native-svg';

import { fontFamily } from '../font';
import { StampMotifArt, type StampMotif } from './stampMotifs';
import { svgId } from './svgId';

export type StampKind = 'debut' | 'encore' | 'party' | 'rack' | 'star';
export type { StampMotif };

type Props = {
  kind?: StampKind;
  motif?: StampMotif;
  earned?: boolean;
  size?: number;
  paper?: string;
};

const COLORS: Record<StampKind, { fill: string; hi: string; deep: string; line: string; shine: string }> = {
  debut: { fill: '#8FD0F5', hi: '#E3F4FF', deep: '#5FAEE6', line: '#2F78B8', shine: 'M17 38 Q24 18 46 12' },
  encore: { fill: '#9FE3B4', hi: '#E3FAEA', deep: '#6CCB8E', line: '#2F8A55', shine: 'M14 30 Q18 16 34 12' },
  party: { fill: '#F7A9C9', hi: '#FFE6F0', deep: '#E883AC', line: '#B34A74', shine: 'M17 34 Q19 19 36 17' },
  rack: { fill: '#FFC08F', hi: '#FFE8D6', deep: '#F59A5C', line: '#B8612A', shine: 'M16 32 Q17 22 32 21' },
  star: { fill: '#FFD45E', hi: '#FFF4B8', deep: '#F0B520', line: '#A06C08', shine: 'M45 24 L41.5 34' },
};

export function Stamp({ kind = 'debut', motif = 'space', earned = true, size = 120, paper = '#FFFDF7' }: Props) {
  const raw = useId();
  const gradId = svgId('sg', raw);
  const c = COLORS[kind];
  const dash = earned ? undefined : '6 5';
  const stroke = earned ? c.line : '#B8AED6';
  const fill = earned ? `url(#${gradId})` : '#F3EEF8';
  const inner = earned ? '#FFFFFF' : 'transparent';
  const motifPct = kind === 'star' ? 34 : kind === 'rack' ? 44 : 50;
  const motifSize = (size * motifPct) / 100;
  const motifLeft = (size * (kind === 'rack' ? 41 : 50)) / 100 - motifSize / 2;
  const motifTop = (size * (kind === 'star' ? 53 : 50)) / 100 - motifSize / 2;

  return (
    <View style={{ width: size, height: size }} accessible accessibilityLabel={`${kind} stamp${earned ? '' : ', not earned yet'}`}>
      <Svg viewBox="0 0 100 100" width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="0.35" y2="1">
            <Stop offset="0" stopColor={c.hi} />
            <Stop offset="0.55" stopColor={c.fill} />
            <Stop offset="1" stopColor={c.deep} />
          </LinearGradient>
        </Defs>
        {kind === 'debut' ? (
          <>
            <Circle cx={50} cy={50} r={45} fill={fill} stroke={stroke} strokeWidth={3} strokeDasharray={dash} />
            <Circle cx={50} cy={50} r={37} fill="none" stroke={inner} strokeWidth={2} strokeDasharray="4 4" />
          </>
        ) : null}
        {kind === 'encore' ? (
          <>
            <Path d="M16 5 H84 L95 16 V84 L84 95 H16 L5 84 V16 Z" fill={fill} stroke={stroke} strokeWidth={3} strokeLinejoin="round" strokeDasharray={dash} />
            <Path d="M20 13 H80 L87 20 V80 L80 87 H20 L13 80 V20 Z" fill="none" stroke={inner} strokeWidth={2} strokeDasharray="4 4" />
          </>
        ) : null}
        {kind === 'party' ? (
          <>
            <Rect x={8} y={8} width={84} height={84} fill={fill} stroke={stroke} strokeWidth={3} strokeDasharray={dash} />
            <Rect x={8} y={8} width={84} height={84} fill="none" stroke={paper} strokeWidth={9} strokeDasharray="0 12" strokeLinecap="round" />
            <Rect x={17} y={17} width={66} height={66} fill="none" stroke={inner} strokeWidth={2} strokeDasharray="4 4" />
          </>
        ) : null}
        {kind === 'rack' ? (
          <>
            <Path d="M8 14 H92 V40 A10 10 0 0 0 92 60 V86 H8 V60 A10 10 0 0 0 8 40 Z" fill={fill} stroke={stroke} strokeWidth={3} strokeLinejoin="round" strokeDasharray={dash} />
            <Path d="M74 20 V80" stroke={inner} strokeWidth={2} strokeDasharray="4 4" />
            <Circle cx={83} cy={30} r={2.5} fill={inner} />
            <Circle cx={83} cy={70} r={2.5} fill={inner} />
          </>
        ) : null}
        {kind === 'star' ? (
          <>
            <Polygon
              points="50,6 61.8,35.8 93.7,37.8 69,58.2 77,89.2 50,72 23,89.2 31,58.2 6.3,37.8 38.2,35.8"
              fill={fill}
              stroke={stroke}
              strokeWidth={3}
              strokeLinejoin="round"
              strokeDasharray={dash}
            />
            <Polygon
              points="50,22 56.5,39 74,40.5 60.5,51.5 65,68.5 50,59 35,68.5 39.5,51.5 26,40.5 43.5,39"
              fill="none"
              stroke={inner}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeDasharray="3 3"
            />
          </>
        ) : null}
        {earned ? <Path d={c.shine} fill="none" stroke="#FFFFFF" strokeWidth={4.5} strokeLinecap="round" opacity={0.6} /> : null}
      </Svg>
      {earned ? (
        <View style={[styles.motif, { width: motifSize, height: motifSize, left: motifLeft, top: motifTop }]}>
          <StampMotifArt motif={motif} />
        </View>
      ) : (
        <View style={[styles.q, { paddingTop: kind === 'star' ? size * 0.09 : 0 }]}>
          <Text style={[styles.qText, { fontSize: Math.round(size * 0.32) }]}>?</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  motif: {
    position: 'absolute',
  },
  q: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qText: {
    fontFamily: fontFamily.fredokaBold,
    color: '#8A80B5',
  },
});
