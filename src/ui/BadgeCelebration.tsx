import { useEffect, useId, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { Badge } from './awards/Badge';
import { svgId } from './awards/svgId';
import { BadgeMedal } from './badges/BadgeMedal';

type Props = {
  title: string;
  caption?: string;
  badgeId?: string;
  reducedMotion: boolean;
  onDone: () => void;
};

const PIN = 168;
const PILL = { fill: '#8E7BFF', shade: '#6A57DB' };

function Glow({ still }: { still: boolean }) {
  const raw = useId();
  const glow = svgId('glow', raw);
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (!still) {
      pulse.value = withRepeat(
        withSequence(withTiming(1.08, { duration: 700 }), withTiming(0.94, { duration: 700 })),
        -1,
        true,
      );
    }
  }, [pulse, still]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  return (
    <Animated.View style={[styles.glow, style]}>
      <Svg width={260} height={260}>
        <Defs>
          <RadialGradient id={glow} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFF4C2" stopOpacity="0.85" />
            <Stop offset="0.55" stopColor="#FFD1E6" stopOpacity="0.35" />
            <Stop offset="1" stopColor="#FFD1E6" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={130} cy={130} r={130} fill={`url(#${glow})`} />
      </Svg>
    </Animated.View>
  );
}

const CONFETTI_COLORS = ['#FF9F5A', '#4FC98A', '#FF7BA5', '#8E7BFF', '#FFD166', '#5AC8FA'];
const confetti = Array.from({ length: 18 }, (_, i) => ({
  key: i,
  angle: (i / 18) * Math.PI * 2 + (i % 2 ? 0.12 : -0.08),
  distance: 105 + (i % 3) * 30,
  spin: (i % 2 ? 1 : -1) * (240 + (i % 4) * 90),
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  wide: i % 3 === 0,
}));

function Confetti({ angle, distance, spin, color, wide }: Omit<(typeof confetti)[number], 'key'>) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) });
  }, [t]);
  const style = useAnimatedStyle(() => ({
    opacity: t.value < 0.7 ? 1 : 1 - (t.value - 0.7) / 0.3,
    transform: [
      { translateX: Math.cos(angle) * distance * t.value },
      { translateY: Math.sin(angle) * distance * t.value + 70 * t.value * t.value },
      { rotate: `${spin * t.value}deg` },
    ],
  }));
  return <Animated.View style={[styles.confetti, wide ? styles.confettiWide : null, { backgroundColor: color }, style]} />;
}

export function BadgeCelebration({ title, caption = 'New skill learned!', badgeId, reducedMotion, onDone }: Props) {
  const pop = useSharedValue(reducedMotion ? 1 : 0);
  const wobble = useSharedValue(0);
  const textIn = useSharedValue(reducedMotion ? 1 : 0);
  const fade = useSharedValue(1);

  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);
  useEffect(() => {
    if (!reducedMotion) {
      pop.value = withSpring(1, { damping: 7, stiffness: 140 });
      wobble.value = withDelay(
        250,
        withSequence(withTiming(1, { duration: 120 }), withTiming(-1, { duration: 200 }), withTiming(0, { duration: 120 })),
      );
      textIn.value = withDelay(300, withSpring(1, { damping: 12, stiffness: 160 }));
    }
    fade.value = withDelay(2400, withTiming(0, { duration: 350 }));
    const timer = setTimeout(() => onDoneRef.current(), 2800);
    return () => clearTimeout(timer);
  }, [fade, pop, reducedMotion, textIn, wobble]);

  const popStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value }, { rotate: `${wobble.value * 9}deg` }],
  }));
  const textStyle = useAnimatedStyle(() => ({
    opacity: textIn.value,
    transform: [{ translateY: (1 - textIn.value) * 14 }],
  }));
  const wrap = useAnimatedStyle(() => ({ opacity: fade.value }));

  return (
    <Animated.View
      style={[styles.overlay, wrap]}
      pointerEvents="none"
      accessible
      accessibilityLiveRegion="polite"
      accessibilityLabel={`${caption} ${title}`}
    >
      <View style={styles.center}>
        <View style={styles.stage}>
          <Glow still={reducedMotion} />
          {!reducedMotion && confetti.map(({ key, ...piece }) => <Confetti key={key} {...piece} />)}
          <Animated.View style={[styles.medal, popStyle]}>
            {badgeId ? <BadgeMedal id={badgeId} size={PIN} /> : <Badge icon="stars" color="purple" tier="none" size={PIN} />}
          </Animated.View>
        </View>

        <Animated.View style={[styles.textBlock, textStyle]}>
          <View style={[styles.pill, { backgroundColor: PILL.fill, borderBottomColor: PILL.shade }]}>
            <Text style={styles.pillText}>{caption}</Text>
          </View>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(36,48,68,0.4)',
    zIndex: 50,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  stage: {
    width: 260,
    height: 230,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: 260,
    height: 260,
  },
  medal: {
    width: PIN,
    height: PIN,
  },
  confetti: {
    position: 'absolute',
    width: 9,
    height: 14,
    borderRadius: 3,
  },
  confettiWide: {
    width: 14,
    height: 8,
  },
  textBlock: {
    alignItems: 'center',
    marginTop: 4,
    paddingHorizontal: 24,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
    borderBottomWidth: 4,
    marginBottom: 8,
  },
  pillText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '900',
    textAlign: 'center',
    textShadowColor: 'rgba(36,48,68,0.45)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 6,
  },
});
