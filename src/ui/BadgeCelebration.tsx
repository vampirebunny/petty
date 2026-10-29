import { useEffect, useId } from 'react';
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
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { PawPrint } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

type Props = {
  title: string;
  caption?: string;
  Icon?: LucideIcon;
  reducedMotion: boolean;
  onDone: () => void;
};

// Trick-learned medal: purple rosette, ribbons, and gold coin.

const TRICK = {
  rosetteTop: '#D9D0FF',
  rosetteBottom: '#A794FF',
  rosetteShade: '#7D69E6',
  ribbonLeft: ['#FFB3D1', '#F27AA9'] as const,
  ribbonRight: ['#A6EFCB', '#4FC98A'] as const,
  pill: '#8E7BFF',
  pillShade: '#6A57DB',
};

const VB_W = 160;
const VB_H = 190;
const CX = 80;
const CY = 78;

function scallopPath(cx: number, cy: number, R: number, n: number) {
  const chord = 2 * R * Math.sin(Math.PI / n);
  const rb = (chord * 0.62).toFixed(2);
  let d = '';
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    const x = (cx + R * Math.cos(a)).toFixed(2);
    const y = (cy + R * Math.sin(a)).toFixed(2);
    d += i === 0 ? `M${x} ${y}` : ` A${rb} ${rb} 0 0 1 ${x} ${y}`;
  }
  return `${d} Z`;
}

const ROSETTE = scallopPath(CX, CY, 60, 16);
const RIBBON_L = 'M56 100 L84 110 L60 182 L47 171 L33 179 Z';
const RIBBON_L_FOLD = 'M72 105 L84 110 L60 182 L55 178 Z';
const RIBBON_R = 'M104 100 L76 110 L100 182 L113 171 L127 179 Z';
const RIBBON_R_FOLD = 'M88 105 L76 110 L100 182 L105 178 Z';

function svgId(prefix: string, raw: string) {
  return `${prefix}${raw.replace(/[^a-zA-Z0-9]/g, '')}`;
}

function Medal() {
  const raw = useId();
  const ribL = svgId('ribL', raw);
  const ribR = svgId('ribR', raw);
  const rosette = svgId('rose', raw);
  const coinRim = svgId('rim', raw);
  const coinFace = svgId('face', raw);
  const gloss = svgId('gloss', raw);
  return (
    <Svg width={VB_W} height={VB_H} viewBox={`0 0 ${VB_W} ${VB_H}`}>
      <Defs>
        <LinearGradient id={ribL} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={TRICK.ribbonLeft[0]} />
          <Stop offset="1" stopColor={TRICK.ribbonLeft[1]} />
        </LinearGradient>
        <LinearGradient id={ribR} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={TRICK.ribbonRight[0]} />
          <Stop offset="1" stopColor={TRICK.ribbonRight[1]} />
        </LinearGradient>
        <LinearGradient id={rosette} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={TRICK.rosetteTop} />
          <Stop offset="1" stopColor={TRICK.rosetteBottom} />
        </LinearGradient>
        <LinearGradient id={coinRim} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFE58F" />
          <Stop offset="1" stopColor="#F2AE33" />
        </LinearGradient>
        <RadialGradient id={coinFace} cx="50%" cy="38%" r="65%">
          <Stop offset="0" stopColor="#FFF8D6" />
          <Stop offset="0.6" stopColor="#FFE07A" />
          <Stop offset="1" stopColor="#FFC94A" />
        </RadialGradient>
        <LinearGradient id={gloss} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.9" />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </LinearGradient>
      </Defs>

      <Path d={RIBBON_L} fill={`url(#${ribL})`} />
      <Path d={RIBBON_L_FOLD} fill="#000000" opacity={0.12} />
      <Path d={RIBBON_R} fill={`url(#${ribR})`} />
      <Path d={RIBBON_R_FOLD} fill="#000000" opacity={0.12} />

      <G transform="translate(0, 6)">
        <Path d={ROSETTE} fill={TRICK.rosetteShade} />
      </G>
      <Path d={ROSETTE} fill={`url(#${rosette})`} />
      <G rotation={-28} origin="62, 40">
        <Ellipse cx={62} cy={40} rx={20} ry={7} fill="#FFFFFF" opacity={0.5} />
      </G>

      <Circle cx={CX} cy={CY + 4} r={46} fill="#C98118" />
      <Circle cx={CX} cy={CY} r={46} fill={`url(#${coinRim})`} />
      <Circle cx={CX} cy={CY + 1} r={37} fill="#E39B2A" opacity={0.55} />
      <Circle cx={CX} cy={CY} r={37} fill={`url(#${coinFace})`} />
      <Ellipse cx={CX} cy={CY - 22} rx={27} ry={11} fill={`url(#${gloss})`} />
    </Svg>
  );
}

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
    <Animated.View style={[medalStyles.glow, style]}>
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
  return <Animated.View style={[medalStyles.confetti, wide ? medalStyles.confettiWide : null, { backgroundColor: color }, style]} />;
}

export function BadgeCelebration({ title, caption = 'New trick learned!', Icon = PawPrint, reducedMotion, onDone }: Props) {
  const pop = useSharedValue(reducedMotion ? 1 : 0);
  const wobble = useSharedValue(0);
  const textIn = useSharedValue(reducedMotion ? 1 : 0);
  const fade = useSharedValue(1);

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
    const timer = setTimeout(onDone, 2800);
    return () => clearTimeout(timer);
  }, [fade, onDone, pop, reducedMotion, textIn, wobble]);

  const popStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value }],
  }));
  const medalStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${wobble.value * 9}deg` }],
  }));
  const textStyle = useAnimatedStyle(() => ({
    opacity: textIn.value,
    transform: [{ translateY: (1 - textIn.value) * 14 }],
  }));
  const wrap = useAnimatedStyle(() => ({ opacity: fade.value }));

  return (
    <Animated.View
      style={[medalStyles.overlay, wrap]}
      pointerEvents="none"
      accessible
      accessibilityLiveRegion="polite"
      accessibilityLabel={`${caption} ${title}`}
    >
      <View style={medalStyles.center}>
        <View style={medalStyles.stage}>
          <Glow still={reducedMotion} />
          {!reducedMotion && confetti.map(({ key, ...piece }) => <Confetti key={key} {...piece} />)}
          <Animated.View style={[medalStyles.medal, popStyle]}>
            <Animated.View style={[medalStyles.rosette, medalStyle]}>
              <Medal />
            </Animated.View>
            <View style={medalStyles.iconSlot}>
              <View style={medalStyles.paw}>
                <Icon size={44} strokeWidth={2.4} color="#9A4A12" />
              </View>
            </View>
          </Animated.View>
        </View>

        <Animated.View style={[medalStyles.textBlock, textStyle]}>
          <View style={[medalStyles.pill, { backgroundColor: TRICK.pill, borderBottomColor: TRICK.pillShade }]}>
            <Text style={medalStyles.pillText}>{caption}</Text>
          </View>
          <Text style={medalStyles.title} numberOfLines={2}>
            {title}
          </Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const medalStyles = StyleSheet.create({
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
    width: VB_W,
    height: VB_H,
  },
  rosette: {
    width: VB_W,
    height: VB_H,
    transformOrigin: '50% 41%',
  },
  paw: {
    transform: [{ rotate: '-52deg' }],
  },
  iconSlot: {
    position: 'absolute',
    left: CX - 26,
    top: CY - 26,
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
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
