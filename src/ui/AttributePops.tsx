import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { playPointPop } from '../audio/badge';
import type { Trait } from '../sim/types';
import { tints } from './candy';

const traitColor: Record<Trait, string> = {
  stamina: tints.peach.icon,
  agility: tints.aqua.icon,
  intelligence: tints.lilac.icon,
  boldness: tints.coral.icon,
  affection: tints.pink.icon,
  obedience: tints.sky.icon,
};

const traitName: Record<Trait, string> = {
  stamina: 'Stamina',
  agility: 'Agility',
  intelligence: 'Intelligence',
  boldness: 'Boldness',
  affection: 'Affection',
  obedience: 'Obedience',
};

type Step = { trait: Trait; delta: number };

type Props = {
  steps: Step[];
  reducedMotion: boolean;
  onDone: () => void;
};

export function AttributePops({ steps, reducedMotion, onDone }: Props) {
  const [index, setIndex] = useState(0);
  const rise = useSharedValue(reducedMotion ? 0 : 12);
  const fade = useSharedValue(reducedMotion ? 1 : 0);
  const step = steps[index];

  useEffect(() => {
    if (!step) {
      return;
    }
    playPointPop();
    rise.value = reducedMotion ? 0 : 12;
    fade.value = reducedMotion ? 1 : 0;
    if (!reducedMotion) {
      rise.value = withTiming(-18, { duration: 1000 });
      fade.value = withTiming(1, { duration: 160 });
    }
    const timer = setTimeout(() => {
      if (index + 1 >= steps.length) {
        onDone();
      } else {
        setIndex(index + 1);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [fade, index, onDone, reducedMotion, rise, step, steps.length]);

  const style = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ translateY: rise.value }],
  }));

  if (!step) {
    return null;
  }
  return (
    <Animated.Text style={[styles.pop, { color: traitColor[step.trait] }, style]} pointerEvents="none">
      +{step.delta} {traitName[step.trait]}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  pop: {
    position: 'absolute',
    top: '28%',
    alignSelf: 'center',
    zIndex: 40,
    fontSize: 22,
    fontWeight: '900',
    textShadowColor: 'rgba(255,255,255,0.9)',
    textShadowRadius: 6,
  },
});
