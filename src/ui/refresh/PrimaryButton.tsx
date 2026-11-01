import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { fontFamily } from '../font';
import { ui } from './tokens';

type Props = {
  label: string;
  accessibilityLabel?: string;
  onPress: () => void;
  disabled?: boolean;
  reducedMotion?: boolean;
  compact?: boolean;
};

export function PrimaryButton({ label, accessibilityLabel, onPress, disabled = false, reducedMotion = false, compact = false }: Props) {
  const [pressed, setPressed] = useState(false);
  const down = useSharedValue(0);
  useEffect(() => {
    down.value = withTiming(pressed && !disabled && !reducedMotion ? 3 : 0, { duration: reducedMotion ? 0 : 80 });
  }, [disabled, down, pressed, reducedMotion]);
  const faceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: down.value }],
  }));
  const height = compact ? 54 : 56;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={styles.hit}
    >
      <Animated.View style={faceStyle}>
        <LinearGradient
          colors={disabled ? [ui.disabledBg, ui.disabledBg] : [ui.primary.top, ui.primary.bottom]}
          style={[styles.face, { height, borderRadius: ui.radius.pill, marginBottom: disabled ? 0 : 5 }]}
        >
          <Text style={[styles.label, disabled && styles.disabledLabel]}>{label}</Text>
        </LinearGradient>
        {disabled ? null : <Animated.View style={[styles.edge, { borderRadius: ui.radius.pill }]} />}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    alignSelf: 'stretch',
    minHeight: 44,
  },
  face: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  edge: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 5,
    backgroundColor: ui.primary.edge,
  },
  label: {
    color: ui.card,
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 18,
  },
  disabledLabel: {
    color: ui.disabledInk,
  },
});
