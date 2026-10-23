import { useEffect, useId, type ReactNode } from 'react';
import { PawPrint } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { fontFamily } from '../font';
import { iconHeight } from './locationIcons';

const bobMs = 3400;
const bobPx = 5;
const pressDrop = 4;
const pressScale = 0.94;

type Props = {
  label: string;
  Icon: ({ size }: { size: number }) => ReactNode;
  size: number;
  bobIndex: number;
  isCurrent?: boolean;
  reducedMotion: boolean;
  onPress: () => void;
};

export function LocationButton({ label, Icon, size, bobIndex, isCurrent = false, reducedMotion, onPress }: Props) {
  const height = iconHeight(size);
  const clock = useSharedValue(0);
  const still = useSharedValue(reducedMotion ? 1 : 0);
  const squish = useSharedValue(0);
  const phase = (bobIndex * 600) / bobMs;

  useEffect(() => {
    still.value = reducedMotion ? 1 : 0;
    if (reducedMotion) {
      cancelAnimation(clock);
      clock.value = 0;
      return;
    }
    clock.value = withRepeat(withTiming(1, { duration: bobMs, easing: Easing.linear }), -1, false);
  }, [clock, reducedMotion, still]);

  const motion = useAnimatedStyle(() => {
    const turn = (clock.value - phase + 1) % 1;
    const bobY = still.value === 1 ? 0 : -bobPx * (0.5 - 0.5 * Math.cos(turn * Math.PI * 2));
    return {
      transform: [{ translateY: bobY + squish.value * pressDrop }, { scale: 1 - squish.value * (1 - pressScale) }],
    };
  });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isCurrent }}
      onPress={onPress}
      onPressIn={() => {
        squish.value = withTiming(1, { duration: 80 });
      }}
      onPressOut={() => {
        squish.value = withSpring(0, { damping: 12, stiffness: 300 });
      }}
      style={styles.hit}
    >
      <Animated.View style={[styles.art, { width: size, height }, motion]}>
        {isCurrent ? <CurrentGlow size={size} height={height} /> : null}
        <Icon size={size} />
        {isCurrent ? <HerePill /> : null}
      </Animated.View>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function CurrentGlow({ size, height }: { size: number; height: number }) {
  const glow = size * 1.06;
  const id = `here${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <Svg
      width={glow}
      height={glow}
      pointerEvents="none"
      style={{ position: 'absolute', left: (size - glow) / 2, top: (height - glow) / 2 }}
    >
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0" stopColor="#FFB084" stopOpacity={0.55} />
          <Stop offset="1" stopColor="#FFB084" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx="50%" cy="50%" r="50%" fill={`url(#${id})`} />
    </Svg>
  );
}

function HerePill() {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={styles.pillAnchor}>
      <View style={styles.pillLip} />
      <View style={styles.pillFace}>
        <PawPrint size={12} strokeWidth={2.4} color="#F27A4B" />
        <Text style={styles.pillText}>{"You're here"}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hit: {
    alignItems: 'center',
    width: '100%',
  },
  art: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginTop: 2,
    fontFamily: fontFamily.black,
    fontSize: 20,
    color: '#2C2F4A',
    textAlign: 'center',
  },
  pillAnchor: {
    position: 'absolute',
    top: -6,
    right: -18,
  },
  pillLip: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 3,
    bottom: -3,
    borderRadius: 999,
    backgroundColor: '#F3D2C0',
  },
  pillFace: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingLeft: 6,
    paddingRight: 8,
    paddingVertical: 3,
  },
  pillText: {
    fontFamily: fontFamily.extraBold,
    fontSize: 12,
    color: '#B4461C',
  },
});
