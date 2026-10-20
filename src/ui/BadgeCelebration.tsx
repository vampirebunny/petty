import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Award } from 'lucide-react-native';

type Props = {
  title: string;
  reducedMotion: boolean;
  onDone: () => void;
};

const colors = ['#FF9F5A', '#4FC98A', '#FF7BA5', '#8E7BFF', '#FFD166', '#5AC8FA'];
const particles = Array.from({ length: 12 }, (_, i) => ({
  angle: (i / 12) * Math.PI * 2,
  distance: 110 + (i % 3) * 28,
  color: colors[i % colors.length],
}));

function Particle({ angle, distance, color, still }: { angle: number; distance: number; color: string; still: boolean }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(1, { duration: still ? 0 : 900, easing: Easing.out(Easing.cubic) });
  }, [still, t]);
  const style = useAnimatedStyle(() => ({
    opacity: still ? 0 : 1 - t.value,
    transform: [
      { translateX: Math.cos(angle) * distance * t.value },
      { translateY: Math.sin(angle) * distance * t.value },
      { scale: 1 - t.value * 0.4 },
    ],
  }));
  return <Animated.View style={[styles.particle, { backgroundColor: color }, style]} />;
}

// Badge pops in with a spring and a wobble while confetti bursts out, then clears itself.
export function BadgeCelebration({ title, reducedMotion, onDone }: Props) {
  const pop = useSharedValue(reducedMotion ? 1 : 0);
  const wobble = useSharedValue(0);
  const fade = useSharedValue(1);

  useEffect(() => {
    if (!reducedMotion) {
      pop.value = withSpring(1, { damping: 7, stiffness: 140 });
      wobble.value = withDelay(
        250,
        withSequence(withTiming(1, { duration: 120 }), withTiming(-1, { duration: 200 }), withTiming(0, { duration: 120 })),
      );
    }
    fade.value = withDelay(2200, withTiming(0, { duration: 350 }));
    const timer = setTimeout(onDone, 2600);
    return () => clearTimeout(timer);
  }, [fade, onDone, pop, reducedMotion, wobble]);

  const badge = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value }, { rotate: `${wobble.value * 10}deg` }],
  }));
  const wrap = useAnimatedStyle(() => ({ opacity: fade.value }));

  return (
    <Animated.View style={[styles.overlay, wrap]} pointerEvents="none" accessible accessibilityLiveRegion="polite" accessibilityLabel={`Badge earned: ${title}`}>
      <View style={styles.center}>
        {particles.map((particle) => (
          <Particle key={particle.angle} {...particle} still={reducedMotion} />
        ))}
        <Animated.View style={[styles.badge, badge]}>
          <Award size={56} strokeWidth={2.2} color="#8A4210" fill="#FFD166" />
        </Animated.View>
        <Text style={styles.caption}>Badge earned!</Text>
        <Text style={styles.title}>{title}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(36,48,68,0.35)',
    zIndex: 50,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  badge: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: '#FFF3C4',
    borderWidth: 4,
    borderColor: '#FFFFFF',
    borderBottomWidth: 8,
    borderBottomColor: '#F7C49A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  particle: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  caption: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 10,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
  },
});
