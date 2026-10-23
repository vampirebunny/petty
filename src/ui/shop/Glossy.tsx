import { useEffect, useId } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { mixHexColor } from '../../actor/color';
import { shop } from './theme';

export type GlossVariant = 'mint' | 'pink' | 'white' | 'gold';

const faces: Record<GlossVariant, { top: string; bottom: string; ledge: string }> = {
  mint: { top: shop.mintLight, bottom: shop.mint, ledge: shop.mintLedge },
  pink: { top: shop.pinkLight, bottom: shop.pink, ledge: shop.pinkLedge },
  white: { top: '#FFFFFF', bottom: '#FFEFF7', ledge: shop.pinkLine },
  gold: { top: shop.goldLight, bottom: shop.gold, ledge: shop.goldLedge },
};

export const glossInk: Record<GlossVariant, string> = {
  mint: shop.onMint,
  pink: shop.onPink,
  white: shop.inkStrong,
  gold: shop.onGold,
};

type Props = {
  variant: GlossVariant;
  pressed?: boolean;
  radius?: number;
  ledge?: number;
  highlight?: boolean;
  ledgeColor?: string;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

export function Glossy({
  variant,
  pressed = false,
  radius = 999,
  ledge = 3,
  highlight = false,
  ledgeColor,
  style,
  children,
}: Props) {
  const face = faces[variant];
  const lip = ledgeColor ?? face.ledge;
  const drop = useSharedValue(0);
  const gradientId = `gloss${useId().replace(/:/g, '')}`;
  const top = pressed ? mixHexColor(face.top, '#000000', 0.05) : face.top;
  const bottom = pressed ? mixHexColor(face.bottom, '#000000', 0.05) : face.bottom;

  useEffect(() => {
    drop.value = pressed ? withTiming(1, { duration: 80 }) : withSpring(0, { damping: 14, stiffness: 220 });
  }, [drop, pressed]);

  const faceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: drop.value * ledge }],
  }));

  return (
    <View
      style={[
        styles.outer,
        {
          paddingBottom: ledge,
          borderRadius: radius,
          shadowColor: lip,
        },
      ]}
    >
      <View
        pointerEvents="none"
        style={[styles.ledge, { top: ledge, backgroundColor: lip, borderRadius: radius }]}
      />
      <Animated.View style={[styles.face, { borderRadius: radius }, style, faceStyle]}>
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={top} />
              <Stop offset="1" stopColor={bottom} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradientId})`} />
        </Svg>
        {highlight ? <View pointerEvents="none" style={styles.highlight} /> : null}
        {children}
      </Animated.View>
    </View>
  );
}

type CardProps = {
  face: string;
  ledge: string;
  radius: number;
  ledgeHeight?: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

export function LedgeCard({ face, ledge, radius, ledgeHeight = 4, style, children }: CardProps) {
  return (
    <View style={[styles.cardOuter, { paddingBottom: ledgeHeight, borderRadius: radius }]}>
      <View
        pointerEvents="none"
        style={[styles.ledge, { top: ledgeHeight, backgroundColor: ledge, borderRadius: radius }]}
      />
      <View style={[styles.cardFace, { backgroundColor: face, borderRadius: radius }, style]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  ledge: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  face: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  highlight: {
    position: 'absolute',
    top: 5,
    left: 24,
    right: 24,
    height: 14,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    opacity: 0.48,
  },
  cardOuter: {
    shadowColor: '#B0508C',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  cardFace: { overflow: 'hidden' },
});
