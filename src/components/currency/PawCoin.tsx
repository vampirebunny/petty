import { useEffect, useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Path, Rect } from 'react-native-svg';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

type Props = {
  size: number;
  spinAngle: SharedValue<number>;
  shine: boolean;
  shineMs?: number;
};

function Paw({ fill, dx, dy }: { fill: string; dx: number; dy: number }) {
  return (
    <G fill={fill} transform={`translate(${dx} ${dy})`}>
      <Ellipse cx={0} cy={9} rx={13} ry={10} />
      <Circle cx={-14} cy={-5} r={5} />
      <Circle cx={-5} cy={-13} r={5.5} />
      <Circle cx={5} cy={-13} r={5.5} />
      <Circle cx={14} cy={-5} r={5} />
    </G>
  );
}

export function PawCoin({ size, spinAngle, shine, shineMs = 1600 }: Props) {
  const clipId = `paw-shine-${useId().replace(/:/g, '')}`;
  const shineT = useSharedValue(0);

  useEffect(() => {
    if (!shine) {
      cancelAnimation(shineT);
      shineT.value = 0;
      return;
    }
    shineT.value = 0;
    shineT.value = withRepeat(withTiming(1, { duration: shineMs, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(shineT);
  }, [shine, shineMs, shineT]);

  const wideProps = useAnimatedProps(() => {
    const t = shineT.value;
    const sweep = t < 0.45 ? 0 : (t - 0.45) / 0.55;
    return { x: -90 + sweep * 170 };
  });
  const thinProps = useAnimatedProps(() => {
    const t = shineT.value;
    const sweep = t < 0.45 ? 0 : (t - 0.45) / 0.55;
    return { x: -74 + sweep * 170 };
  });

  const edgeStyle = useAnimatedStyle(() => {
    const turn = (spinAngle.value * Math.PI) / 180;
    const width = size * 0.11 * Math.abs(Math.sin(turn));
    return {
      width,
      opacity: width < 0.5 ? 0 : 1,
    };
  });
  const faceStyle = useAnimatedStyle(() => {
    const turn = (spinAngle.value * Math.PI) / 180;
    return {
      transform: [{ scaleX: Math.max(0.001, Math.abs(Math.cos(turn))) }],
    };
  });
  const darkenStyle = useAnimatedStyle(() => {
    const turn = (spinAngle.value * Math.PI) / 180;
    return { opacity: 0.15 * Math.abs(Math.sin(turn)) };
  });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.edge,
          { height: size, borderRadius: size / 2 },
          edgeStyle,
        ]}
      >
        <View style={styles.stripe} />
      </Animated.View>
      <Animated.View style={[{ width: size, height: size }, faceStyle]}>
        <Svg width={size} height={size} viewBox="-48 -48 96 96">
          <Defs>
            <ClipPath id={clipId}>
              <Circle r={44} />
            </ClipPath>
          </Defs>
          <Circle r={47} fill="#B47A10" />
          <Circle r={44} fill="#EDAE2A" />
          <Circle r={36} fill="#D99A1C" />
          <Circle r={34.5} fill="#F7C548" />
          <Paw fill="#FFE7A3" dx={-1.6} dy={-1.6} />
          <Paw fill="#A9730D" dx={1.4} dy={1.4} />
          <Paw fill="#D4961A" dx={0} dy={0} />
          <Path
            d="M-39 -12 A41 41 0 0 1 -12 -39"
            fill="none"
            stroke="#FFFFFF"
            strokeOpacity={0.75}
            strokeWidth={3}
            strokeLinecap="round"
          />
          <Path
            d="M30 26 A40 40 0 0 1 22 33"
            fill="none"
            stroke="#FFF3C9"
            strokeOpacity={0.6}
            strokeWidth={2}
            strokeLinecap="round"
          />
          {shine ? (
            <G clipPath={`url(#${clipId})`}>
              <G transform="rotate(28)">
                <AnimatedRect animatedProps={wideProps} y={-80} width={12} height={160} fill="#FFFFFF" opacity={0.55} />
                <AnimatedRect animatedProps={thinProps} y={-80} width={4} height={160} fill="#FFFFFF" opacity={0.4} />
              </G>
            </G>
          ) : null}
        </Svg>
        <Animated.View
          pointerEvents="none"
          style={[styles.darken, { borderRadius: size / 2 }, darkenStyle]}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  edge: {
    position: 'absolute',
    backgroundColor: '#B47A10',
    overflow: 'hidden',
    alignItems: 'center',
  },
  stripe: {
    width: '38%',
    height: '100%',
    backgroundColor: '#C98A12',
  },
  darken: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000000',
  },
});
