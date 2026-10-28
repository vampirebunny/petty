import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import type { ColorFamily } from './order';

export const ground = '#F4F6FB';
export const ink = '#2B2F4A';
export const secondary = '#5F6687';
export const greySurface = '#ECEEF5';
export const cardLip = '#E1E4EF';
export const white = '#FFFFFF';

type FamilyPaint = {
  card: [string, string];
  inset: string;
  drop: string;
  ring: [string, string];
  base: string;
  name: string;
  soft: string;
};

export const familyPaint: Record<ColorFamily, FamilyPaint> = {
  blue: {
    card: ['#E4F1FF', '#C9E1FB'],
    inset: '#A9CBF0',
    drop: '#8DB8E8',
    ring: ['#6FB0F5', '#3E86DB'],
    base: '#2A5FA6',
    name: '#1E3D66',
    soft: 'rgba(111, 176, 245, 0.22)',
  },
  purple: {
    card: ['#F1EAFF', '#DDCDFB'],
    inset: '#C3ABF1',
    drop: '#A98BE6',
    ring: ['#A88BF2', '#7C5CE0'],
    base: '#5536B0',
    name: '#3B2577',
    soft: 'rgba(168, 139, 242, 0.22)',
  },
  orange: {
    card: ['#FFF0E2', '#FFD3AE'],
    inset: '#F2B37E',
    drop: '#E9A064',
    ring: ['#FFC34D', '#F59A12'],
    base: '#B86704',
    name: '#6E340A',
    soft: 'rgba(245, 154, 18, 0.22)',
  },
  mint: {
    card: ['#DDF4EA', '#B6E6D2'],
    inset: '#9AD6BD',
    drop: '#7FC6A8',
    ring: ['#6CC9A6', '#2F9C75'],
    base: '#22704F',
    name: '#1F5741',
    soft: 'rgba(108, 201, 166, 0.22)',
  },
};

export const gold = {
  top: '#FFC34D',
  bottom: '#F59A12',
  inset: '#D97E06',
  base: '#B86704',
  ink: '#5A2E00',
};

type FaceProps = {
  colors: [string, string];
  lip: string;
  shadow: string;
  radius: number;
  pressed?: boolean;
  soft?: string;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

export function GlossyFace({ colors, lip, shadow, radius, pressed = false, soft, style, children }: FaceProps) {
  const uid = `face${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const drop = pressed ? 1 : 4;
  // A huge radius would turn the fill into an ellipse. Cap it at half the height so the ends stay round and the sides stay straight.
  const [corner, setCorner] = useState(Math.min(radius, 30));
  return (
    <View
      style={[
        { paddingBottom: drop, borderRadius: radius },
        { shadowColor: soft ?? shadow, shadowOpacity: soft ? 1 : 0.18, shadowRadius: 9, shadowOffset: { width: 0, height: 4 } },
      ]}
    >
      <View pointerEvents="none" style={[styles.lip, { top: drop, backgroundColor: pressed ? lip : shadow, borderRadius: corner }]} />
      <View
        onLayout={(event) => {
          const next = Math.min(radius, event.nativeEvent.layout.height / 2);
          setCorner((current) => (current === next ? current : next));
        }}
        style={[styles.face, { borderRadius: corner, transform: [{ translateY: pressed ? 3 : 0 }] }, style]}
      >
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <LinearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors[0]} />
              <Stop offset="1" stopColor={colors[1]} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" rx={corner} ry={corner} fill={`url(#${uid})`} />
        </Svg>
        <View pointerEvents="none" style={[styles.sheen, { borderRadius: radius }]} />
        {children}
      </View>
    </View>
  );
}

export function ProgressRing({
  progress,
  color,
  track = white,
  children,
}: {
  progress: number;
  color: string;
  track?: string;
  children?: ReactNode;
}) {
  const size = 60;
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const length = 2 * Math.PI * radius;
  const portion = Math.max(0, Math.min(100, progress)) / 100;
  return (
    <View style={styles.ringBox}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={track} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${length * portion} ${length}`}
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.ringCore}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  lip: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 4,
  },
  face: {
    overflow: 'hidden',
  },
  sheen: {
    position: 'absolute',
    left: '8%',
    right: '8%',
    top: 4,
    height: '40%',
    backgroundColor: 'rgba(255,255,255,0.8)',
    opacity: 0.55,
  },
  ringBox: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCore: {
    position: 'absolute',
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: white,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
