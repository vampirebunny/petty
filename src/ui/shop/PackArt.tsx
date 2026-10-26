import { useEffect, useId, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { G, Path, SvgXml } from 'react-native-svg';

import { packArtHeight, preparePackArt, type Sparkle } from './packDrawing';

const AnimatedG = Animated.createAnimatedComponent(G);

type Props = {
  artKey: string;
  width: number;
  animate: boolean;
};

function loopMs(artKey: string, index: number): number {
  const spread = (artKey.length * 131 + index * 487) % 1500;
  return 1500 + spread;
}

function SparkleStar({ sparkle, animate, duration }: { sparkle: Sparkle; animate: boolean; duration: number }) {
  const pulse = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (!animate) {
      cancelAnimation(pulse);
      cancelAnimation(opacity);
      pulse.value = 1;
      opacity.value = 1;
      return;
    }
    const half = duration / 2;
    const ease = Easing.inOut(Easing.sin);
    pulse.value = withRepeat(
      withSequence(withTiming(0.7, { duration: half, easing: ease }), withTiming(1, { duration: half, easing: ease })),
      -1,
      false,
    );
    opacity.value = withRepeat(
      withSequence(withTiming(0.2, { duration: half, easing: ease }), withTiming(1, { duration: half, easing: ease })),
      -1,
      false,
    );
    return () => {
      cancelAnimation(pulse);
      cancelAnimation(opacity);
    };
  }, [animate, duration, opacity, pulse]);

  const animatedProps = useAnimatedProps(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: sparkle.x },
      { translateY: sparkle.y },
      { scale: sparkle.scale * pulse.value },
    ],
  }));

  return (
    <AnimatedG animatedProps={animatedProps}>
      <Path
        d={sparkle.d}
        fill={sparkle.fill}
        stroke={sparkle.stroke ?? 'none'}
        strokeWidth={sparkle.strokeWidth ?? 0}
      />
    </AnimatedG>
  );
}

export function PackArt({ artKey, width, animate }: Props) {
  const instanceId = `i${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const prepared = useMemo(() => preparePackArt(artKey, instanceId), [artKey, instanceId]);
  if (!prepared) {
    return null;
  }
  const height = packArtHeight(width);
  return (
    <View style={{ width, height }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <SvgXml xml={prepared.body} width={width} height={height} />
      <Svg
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
        viewBox="0 0 120 100"
        width={width}
        height={height}
      >
        {prepared.sparkles.map((sparkle, index) => (
          <SparkleStar
            key={`${sparkle.x}-${sparkle.y}`}
            sparkle={sparkle}
            animate={animate}
            duration={loopMs(artKey, index)}
          />
        ))}
      </Svg>
    </View>
  );
}
