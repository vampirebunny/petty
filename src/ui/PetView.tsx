import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import type { Cue, Mood, Needs } from '../sim/types';

type Props = {
  needs: Needs;
  mood: Mood;
  cue: Cue['kind'];
  cueToken: number;
};

const bodyColor = '#7CB8E8';

export function PetView({ mood, cue, cueToken }: Props) {
  const breath = useSharedValue(1);
  const posture = useSharedValue(0);
  const sag = useSharedValue(1);
  const showZee = useSharedValue(0);
  const reactionX = useSharedValue(0);
  const reactionY = useSharedValue(0);
  const reactionRotate = useSharedValue(0);
  const squash = useSharedValue(1);
  const zee = useSharedValue(0);
  const [yawning, setYawning] = useState(false);

  useEffect(() => {
    const sleeping = mood === 'sleeping' || mood === 'sleepy';
    breath.value = 1;
    breath.value = withRepeat(
      withTiming(sleeping ? 1.025 : 1.04, {
        duration: sleeping ? 2800 : 1500,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true,
    );
    sag.value = mood === 'hungry' ? 0.94 : 1;
    showZee.value = mood === 'sleeping' ? 1 : 0;
    if (mood === 'happy') {
      posture.value = withRepeat(withTiming(-8, { duration: 420 }), -1, true);
    } else {
      posture.value = withTiming(mood === 'sad' ? 18 : mood === 'hungry' ? 8 : 0, { duration: 240 });
    }
    if (mood === 'sleeping') {
      zee.value = withRepeat(withTiming(-18, { duration: 1600 }), -1, true);
    } else {
      cancelAnimation(zee);
      zee.value = 0;
    }
    return () => {
      cancelAnimation(breath);
      cancelAnimation(posture);
      cancelAnimation(zee);
    };
  }, [breath, mood, posture, sag, showZee, zee]);

  useEffect(() => {
    if (cue === 'eat') {
      squash.value = withSequence(
        withTiming(0.82, { duration: 70 }),
        withTiming(1.14, { duration: 70 }),
        withTiming(1, { duration: 70 }),
        withTiming(0.82, { duration: 70 }),
        withTiming(1.14, { duration: 70 }),
        withTiming(1, { duration: 70 }),
        withTiming(0.82, { duration: 70 }),
        withTiming(1.14, { duration: 70 }),
        withTiming(1, { duration: 80 }),
      );
    } else if (cue === 'wiggle') {
      reactionRotate.value = withSequence(
        withTiming(-10, { duration: 70 }),
        withTiming(10, { duration: 80 }),
        withTiming(-8, { duration: 70 }),
        withTiming(0, { duration: 80 }),
      );
      reactionY.value = withSequence(withTiming(-16, { duration: 120 }), withTiming(0, { duration: 180 }));
    } else if (cue === 'purr') {
      reactionX.value = withSequence(
        withTiming(10, { duration: 280 }),
        withTiming(-10, { duration: 320 }),
        withTiming(0, { duration: 280 }),
      );
    } else if (cue === 'stir') {
      reactionX.value = withSequence(
        withTiming(4, { duration: 40 }),
        withTiming(-4, { duration: 40 }),
        withTiming(2, { duration: 40 }),
        withTiming(0, { duration: 40 }),
      );
    } else if (cue === 'yawn') {
      setYawning(true);
      const timer = setTimeout(() => setYawning(false), 700);
      return () => clearTimeout(timer);
    }
  }, [cue, cueToken, reactionRotate, reactionX, reactionY, squash]);

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: reactionX.value },
      { translateY: posture.value + reactionY.value },
      { rotate: `${reactionRotate.value}deg` },
      { scaleX: squash.value },
      { scaleY: breath.value * (2 - squash.value) * sag.value },
    ],
  }));

  const zeeStyle = useAnimatedStyle(() => ({
    opacity: showZee.value * (0.45 + (Math.abs(zee.value) / 18) * 0.55),
    transform: [{ translateY: zee.value }],
  }));

  return (
    <View style={styles.wrap}>
      {mood === 'sleeping' ? <Animated.Text style={[styles.zee, zeeStyle]}>Z</Animated.Text> : null}
      <Animated.View style={[styles.body, bodyStyle]}>
        <Eyes mood={mood} />
        <Mouth mood={mood} yawning={yawning} />
      </Animated.View>
    </View>
  );
}

function Eyes({ mood }: { mood: Mood }) {
  if (mood === 'sleeping') {
    return (
      <View style={styles.faceRow}>
        <View style={styles.closedEye} />
        <View style={styles.closedEye} />
      </View>
    );
  }
  return (
    <View style={styles.faceRow}>
      <View
        style={[
          styles.eye,
          mood === 'sleepy' && styles.eyeHalf,
          mood === 'sad' && styles.eyeDroop,
          mood === 'happy' && styles.eyeBright,
        ]}
      />
      <View
        style={[
          styles.eye,
          mood === 'sleepy' && styles.eyeHalf,
          mood === 'sad' && styles.eyeDroop,
          mood === 'happy' && styles.eyeBright,
        ]}
      />
    </View>
  );
}

function Mouth({ mood, yawning }: { mood: Mood; yawning: boolean }) {
  if (yawning) {
    return <View style={styles.mouthYawn} />;
  }
  if (mood === 'happy') {
    return <View style={styles.mouthWide} />;
  }
  if (mood === 'hungry') {
    return <View style={styles.mouthRound} />;
  }
  if (mood === 'sad') {
    return <View style={styles.mouthDown} />;
  }
  if (mood === 'sleepy' || mood === 'sleeping') {
    return <View style={styles.mouthFlat} />;
  }
  return <View style={styles.mouthSmall} />;
}

const styles = StyleSheet.create({
  wrap: {
    width: 180,
    height: 170,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  body: {
    width: 150,
    height: 112,
    borderRadius: 56,
    backgroundColor: bodyColor,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  faceRow: {
    flexDirection: 'row',
    gap: 28,
    marginTop: 8,
  },
  eye: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#243044',
  },
  eyeHalf: {
    height: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  eyeDroop: {
    transform: [{ rotate: '18deg' }, { translateY: 3 }],
  },
  eyeBright: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#1B2838',
  },
  closedEye: {
    width: 18,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#243044',
    marginTop: 8,
  },
  mouthWide: {
    width: 36,
    height: 18,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    backgroundColor: '#243044',
  },
  mouthSmall: {
    width: 22,
    height: 10,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    backgroundColor: '#243044',
  },
  mouthRound: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#243044',
  },
  mouthFlat: {
    width: 22,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#243044',
  },
  mouthDown: {
    width: 28,
    height: 14,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    backgroundColor: '#243044',
  },
  mouthYawn: {
    width: 22,
    height: 26,
    borderRadius: 11,
    backgroundColor: '#243044',
  },
  zee: {
    position: 'absolute',
    top: 8,
    right: 18,
    fontSize: 22,
    color: '#5C6B80',
  },
});
