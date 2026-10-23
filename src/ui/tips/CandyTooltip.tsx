import { useEffect, useId, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { LucideIcon } from 'lucide-react-native';
import Svg, { Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { candyFlavors } from '../candyTokens';
import type { CandyFlavorName } from '../candyTokens';
import { fontFamily } from '../font';

type Props = {
  flavor: CandyFlavorName;
  icon: LucideIcon;
  text: string;
  boldWord: string;
  target: { x: number; y: number };
  bounds: { width: number; height: number };
  reducedMotion: boolean;
};

export function CandyTooltip({ flavor, icon: Icon, text, boldWord, target, bounds, reducedMotion }: Props) {
  const uid = useId().replace(/:/g, '');
  const tone = candyFlavors[flavor];
  const [size, setSize] = useState({ width: 200, height: 64 });
  const placeBelow = target.y < size.height + 22;
  const tailGap = 10;
  const left = clamp(target.x - size.width / 2, 16, Math.max(16, bounds.width - size.width - 16));
  const top = placeBelow ? target.y + tailGap : target.y - tailGap - size.height;
  const tailX = clamp(target.x - left, 22, size.width - 22);
  const appear = useSharedValue(reducedMotion ? 1 : 0.6);
  const bob = useSharedValue(0);
  const ringA = useSharedValue(0);
  const ringB = useSharedValue(0);
  useEffect(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    AccessibilityInfo.announceForAccessibility(text);
    if (reducedMotion) {
      appear.value = withTiming(1, { duration: 150 });
      return undefined;
    }
    appear.value = withSpring(1, { damping: 14, stiffness: 180 });
    bob.value = withRepeat(withSequence(withTiming(-2, { duration: 1000 }), withTiming(2, { duration: 1000 })), -1, true);
    ringA.value = withRepeat(withTiming(1, { duration: 1400 }), -1, false);
    const timer = setTimeout(() => {
      ringB.value = withRepeat(withTiming(1, { duration: 1400 }), -1, false);
    }, 700);
    return () => {
      clearTimeout(timer);
      cancelAnimation(bob);
      cancelAnimation(ringA);
      cancelAnimation(ringB);
    };
  }, [appear, bob, reducedMotion, ringA, ringB, text]);
  const bubbleStyle = useAnimatedStyle(() => {
    const scale = appear.value;
    const shift = size.height / 2;
    const pin = placeBelow ? -shift : shift;
    return {
      opacity: reducedMotion ? appear.value : Math.min(1, (appear.value - 0.6) / 0.4),
      transform: reducedMotion
        ? []
        : [{ translateY: bob.value + pin }, { scale }, { translateY: -pin }],
    };
  });
  const ringOne = useAnimatedStyle(() => ({
    opacity: 0.5 * (1 - ringA.value),
    transform: [{ scale: 1 + 0.4 * ringA.value }],
  }));
  const ringTwo = useAnimatedStyle(() => ({
    opacity: 0.5 * (1 - ringB.value),
    transform: [{ scale: 1 + 0.4 * ringB.value }],
  }));
  const boldAt = text.indexOf(boldWord);
  const before = boldAt >= 0 ? text.slice(0, boldAt) : text;
  const after = boldAt >= 0 ? text.slice(boldAt + boldWord.length) : '';
  function onLayout(event: LayoutChangeEvent) {
    const next = {
      width: Math.round(event.nativeEvent.layout.width),
      height: Math.round(event.nativeEvent.layout.height),
    };
    setSize((current) => (current.width === next.width && current.height === next.height ? current : next));
  }
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {!reducedMotion ? (
        <>
          <Animated.View
            pointerEvents="none"
            style={[styles.ring, { left: target.x - 28, top: target.y - 28, borderColor: tone.stops[2] }, ringOne]}
          />
          <Animated.View
            pointerEvents="none"
            style={[styles.ring, { left: target.x - 28, top: target.y - 28, borderColor: tone.stops[2] }, ringTwo]}
          />
        </>
      ) : null}
      <Animated.View
        accessibilityRole="text"
        onLayout={onLayout}
        style={[styles.bubble, { left, top, shadowColor: tone.edge }, bubbleStyle]}
      >
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <LinearGradient id={`tip${uid}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" />
              <Stop offset="1" stopColor="#FFF5FA" />
            </LinearGradient>
            <RadialGradient id={`tipPearl${uid}`} cx="35%" cy="28%" rx="70%" ry="70%">
              <Stop offset="0" stopColor="#FFFFFF" />
              <Stop offset="0.42" stopColor="#FFFFFF" />
              <Stop offset="1" stopColor={tone.bubble} />
            </RadialGradient>
          </Defs>
          <Path d={bubblePath(size.width, size.height, tailX, placeBelow)} fill={`url(#tip${uid})`} />
          <Path
            d={bubblePath(size.width, size.height, tailX, placeBelow)}
            fill="none"
            stroke={tone.stops[1]}
            strokeWidth={2}
          />
        </Svg>
        <View style={[styles.row, placeBelow ? styles.rowBelow : styles.rowAbove]}>
          <View style={styles.pearl}>
            <Svg width={32} height={32}>
              <Rect x="0" y="0" width={32} height={32} rx={16} fill={`url(#tipPearl${uid})`} />
            </Svg>
            <View style={styles.pearlIcon} pointerEvents="none">
              <Icon size={18} color={tone.icon} strokeWidth={2.3} />
            </View>
          </View>
          <Text style={[styles.copy, { color: tone.label }]}>
            {before}
            {boldAt >= 0 ? <Text style={[styles.bold, { color: tone.header }]}>{boldWord}</Text> : null}
            {after}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

function bubblePath(width: number, height: number, tailX: number, tailOnTop: boolean): string {
  const radius = 20;
  const tail = 10;
  const half = 8;
  const bodyTop = tailOnTop ? tail : 0;
  const bodyBottom = tailOnTop ? height : height - tail;
  const left = tailX - half;
  const right = tailX + half;
  const tip = tailOnTop ? 0 : height;
  const body = [
    `M ${radius} ${bodyTop}`,
    `H ${width - radius}`,
    `Q ${width} ${bodyTop} ${width} ${bodyTop + radius}`,
    `V ${bodyBottom - radius}`,
    `Q ${width} ${bodyBottom} ${width - radius} ${bodyBottom}`,
    `H ${radius}`,
    `Q 0 ${bodyBottom} 0 ${bodyBottom - radius}`,
    `V ${bodyTop + radius}`,
    `Q 0 ${bodyTop} ${radius} ${bodyTop}`,
    'Z',
  ].join(' ');
  const point = tailOnTop
    ? `M ${left} ${bodyTop} Q ${tailX} ${tip} ${right} ${bodyTop}`
    : `M ${left} ${bodyBottom} Q ${tailX} ${tip} ${right} ${bodyBottom}`;
  return `${body} ${point}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const styles = StyleSheet.create({
  ring: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
  },
  bubble: {
    position: 'absolute',
    minWidth: 160,
    maxWidth: 240,
    minHeight: 58,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
  },
  rowAbove: {
    paddingTop: 12,
    paddingBottom: 22,
  },
  rowBelow: {
    paddingTop: 22,
    paddingBottom: 12,
  },
  pearl: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pearlIcon: {
    position: 'absolute',
  },
  copy: {
    flex: 1,
    fontSize: 15,
    fontFamily: fontFamily.fredokaSemibold,
  },
  bold: {
    fontFamily: fontFamily.fredokaBold,
  },
});
