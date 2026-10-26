import { useEffect, useId } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { mixHexColor } from '../../actor/color';

const topColor = '#D9CCFF';
const bottomColor = '#A98BFF';
const ledgeColor = '#7E62D6';

type Props = {
  pressed?: boolean;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

export function LilacFace({ pressed = false, height = 44, radius = 16, style, children }: Props) {
  const ledge = 3;
  const drop = useSharedValue(0);
  const gradientId = `lilac${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const top = pressed ? mixHexColor(topColor, '#000000', 0.05) : topColor;
  const bottom = pressed ? mixHexColor(bottomColor, '#000000', 0.05) : bottomColor;

  useEffect(() => {
    drop.value = pressed ? withTiming(1, { duration: 80 }) : withSpring(0, { damping: 14, stiffness: 220 });
  }, [drop, pressed]);

  const faceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: drop.value * ledge }],
  }));

  return (
    <View style={[styles.outer, { paddingBottom: ledge, borderRadius: radius }]}>
      <View pointerEvents="none" style={[styles.ledge, { top: ledge, backgroundColor: ledgeColor, borderRadius: radius }]} />
      <Animated.View style={[styles.face, { minHeight: height, borderRadius: radius }, style, faceStyle]}>
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={top} />
              <Stop offset="1" stopColor={bottom} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradientId})`} />
        </Svg>
        <View pointerEvents="none" style={styles.highlight} />
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { alignSelf: 'stretch' },
  ledge: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  face: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  highlight: {
    position: 'absolute',
    top: 5,
    left: 16,
    right: 16,
    height: 10,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    opacity: 0.45,
  },
});
