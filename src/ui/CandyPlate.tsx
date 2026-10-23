import { useEffect, useId, useState } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { candyFlavors, candyLayout } from './candyTokens';
import type { CandyFlavorName } from './candyTokens';
import { fontFamily } from './font';

const SPARKLE = 'M5 0 C5.6 3.4 6.6 4.4 10 5 C6.6 5.6 5.6 6.6 5 10 C4.4 6.6 3.4 5.6 0 5 C3.4 4.4 4.4 3.4 5 0 Z';

type PlateProps = {
  flavor: CandyFlavorName;
  height: number;
  radius: number;
  pill?: boolean;
  pressed?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

// Glossy candy body: ledge, radial face, bottom shade, shine, glint, and a white rim.
export function CandyPlate({ flavor, height, radius, pill = false, pressed = false, style, children }: PlateProps) {
  const uid = useId().replace(/:/g, '');
  const tone = candyFlavors[flavor];
  const restLedge = pill ? candyLayout.pillLedge : candyLayout.ledge;
  const lip = pressed ? candyLayout.pressedLedge : restLedge;
  const sink = pressed ? candyLayout.sink : 0;
  const shine = pill ? 22 : 42;
  const [width, setWidth] = useState(0);
  const shineWidth = width * 0.86;
  return (
    <View
      style={[styles.stack, { height: height + restLedge }, style]}
      onLayout={(event) => {
        const next = event.nativeEvent.layout.width;
        if (next !== width) {
          setWidth(next);
        }
      }}
    >
      <View
        pointerEvents="none"
        style={[
          styles.ledge,
          {
            top: sink + lip,
            height,
            borderRadius: radius,
            backgroundColor: tone.ledge,
            shadowColor: tone.edge,
          },
        ]}
      />
      <View
        style={[
          styles.face,
          {
            height,
            borderRadius: radius,
            borderWidth: 1.5,
            borderColor: 'rgba(255,255,255,0.55)',
            transform: [{ translateY: sink }],
          },
        ]}
      >
        <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <RadialGradient id={`body${uid}`} cx="32%" cy="18%" rx="120%" ry="95%" fx="32%" fy="18%">
              <Stop offset="0" stopColor={tone.stops[0]} />
              <Stop offset="0.32" stopColor={tone.stops[1]} />
              <Stop offset="0.72" stopColor={tone.stops[2]} />
              <Stop offset="1" stopColor={tone.stops[3]} />
            </RadialGradient>
            <LinearGradient id={`shade${uid}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={tone.edge} stopOpacity="0" />
              <Stop offset="1" stopColor={tone.edge} stopOpacity="0.3" />
            </LinearGradient>
            <LinearGradient id={`shine${uid}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.95" />
              <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.35" />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
            </LinearGradient>
          </Defs>
          {width > 0 ? (
            <G>
              <Rect x={0} y={0} width={width} height={height} rx={radius} fill={`url(#body${uid})`} />
              <Rect x={0} y={height * 0.6} width={width} height={height * 0.4} fill={`url(#shade${uid})`} />
              <Rect
                x={width * 0.07}
                y={4}
                width={shineWidth}
                height={shine}
                rx={Math.min(radius - 4, shine / 2)}
                fill={`url(#shine${uid})`}
              />
              {tone.gloss ? (
                <G rotation={-25} origin="18, 14">
                  <Ellipse cx="18" cy="14" rx="5.5" ry="3" fill="#FFFFFF" />
                </G>
              ) : null}
            </G>
          ) : null}
        </Svg>
        {children}
      </View>
    </View>
  );
}

type BubbleProps = {
  flavor: CandyFlavorName;
  size: number;
  children?: ReactNode;
};

export function PearlBubble({ flavor, size, children }: BubbleProps) {
  const uid = useId().replace(/:/g, '');
  const tone = candyFlavors[flavor];
  return (
    <View style={[styles.bubble, { width: size, height: size, borderRadius: size / 2, shadowColor: tone.label }]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <RadialGradient id={`pearl${uid}`} cx="35%" cy="28%" rx="70%" ry="70%">
            <Stop offset="0" stopColor="#FFFFFF" />
            <Stop offset="0.42" stopColor="#FFFFFF" />
            <Stop offset="1" stopColor={tone.bubble} />
          </RadialGradient>
          <LinearGradient id={`pearlShade${uid}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0.55" stopColor={tone.icon} stopOpacity="0" />
            <Stop offset="1" stopColor={tone.icon} stopOpacity="0.28" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={size} height={size} rx={size / 2} fill={`url(#pearl${uid})`} />
        <Rect x="0" y="0" width={size} height={size} rx={size / 2} fill={`url(#pearlShade${uid})`} />
      </Svg>
      {children}
    </View>
  );
}

type NeedProps = {
  label: string;
  reducedMotion: boolean;
  children: ReactNode;
};

export function NeedFrame({ label, reducedMotion, children }: NeedProps) {
  const big = useSharedValue(1);
  const small = useSharedValue(1);
  useEffect(() => {
    if (reducedMotion) {
      return undefined;
    }
    big.value = withRepeat(withSequence(withTiming(1.1, { duration: 800 }), withTiming(0.8, { duration: 800 })), -1, true);
    small.value = withRepeat(withSequence(withTiming(0.8, { duration: 800 }), withTiming(1.1, { duration: 800 })), -1, true);
    return () => {
      cancelAnimation(big);
      cancelAnimation(small);
    };
  }, [big, reducedMotion, small]);
  const bigStyle = useAnimatedStyle(() => ({ transform: [{ scale: big.value }], opacity: 0.55 + big.value * 0.35 }));
  const smallStyle = useAnimatedStyle(() => ({ transform: [{ scale: small.value }], opacity: 0.45 + small.value * 0.35 }));
  return (
    <View style={styles.need}>
      <View pointerEvents="none" style={styles.halo} />
      <View pointerEvents="none" style={styles.outline} />
      {children}
      <View pointerEvents="none" style={styles.needBadge}>
        <Text style={styles.needText}>{label}</Text>
      </View>
      <Animated.View pointerEvents="none" style={[styles.sparkBig, reducedMotion ? styles.sparkStill : bigStyle]}>
        <Svg viewBox="0 0 10 10" width={16} height={16}>
          <Path d={SPARKLE} fill="#FFD34D" />
        </Svg>
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.sparkSmall, reducedMotion ? styles.sparkStill : smallStyle]}>
        <Svg viewBox="0 0 10 10" width={11} height={11}>
          <Path d={SPARKLE} fill="#9FD0FF" />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    position: 'relative',
    alignSelf: 'stretch',
  },
  ledge: {
    position: 'absolute',
    left: 0,
    right: 0,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  face: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    overflow: 'hidden',
  },
  bubble: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 5,
    elevation: 3,
  },
  need: {
    position: 'relative',
  },
  halo: {
    position: 'absolute',
    left: -4,
    right: -4,
    top: -2,
    bottom: 4,
    borderRadius: 34,
    backgroundColor: 'rgba(255,140,192,0.35)',
  },
  outline: {
    position: 'absolute',
    left: -2,
    right: -2,
    top: -2,
    bottom: 6,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  needBadge: {
    position: 'absolute',
    top: -8,
    alignSelf: 'center',
    backgroundColor: '#C2256F',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    zIndex: 2,
    shadowColor: '#8E184F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  needText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: fontFamily.fredokaBold,
  },
  sparkBig: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 16,
    height: 16,
  },
  sparkSmall: {
    position: 'absolute',
    bottom: 10,
    left: -4,
    width: 11,
    height: 11,
  },
  sparkStill: {
    opacity: 0.9,
  },
});
