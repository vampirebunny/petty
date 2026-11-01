import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { fontFamily } from '../font';
import { Gloss } from './Gloss';
import { ui } from './tokens';

type Props = {
  label: string;
  accessibilityLabel?: string;
  onPress: () => void;
  disabled?: boolean;
  reducedMotion?: boolean;
  compact?: boolean;
  tone?: 'pink' | 'green';
};

export function PrimaryButton({ label, accessibilityLabel, onPress, disabled = false, reducedMotion = false, compact = false, tone = 'pink' }: Props) {
  const colors = tone === 'green' ? ui.primaryGreen : ui.primary;
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
      {disabled ? null : <Animated.View style={[styles.edge, { borderRadius: ui.radius.pill, backgroundColor: colors.edge }]} />}
      <Animated.View style={faceStyle}>
        <LinearGradient
          colors={disabled ? [ui.disabledBg, ui.disabledBg] : [colors.top, colors.bottom]}
          style={[styles.face, { height, borderRadius: ui.radius.pill, marginBottom: disabled ? 0 : 5 }]}
        >
          {disabled ? null : <Gloss radius={height / 2} />}
          <Text style={[styles.label, { textShadowColor: colors.edge }, disabled && styles.disabledLabel]}>{label}</Text>
        </LinearGradient>
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
    borderWidth: 1.5,
    borderColor: ui.gloss.top,
  },
  edge: {
    position: 'absolute',
    top: 5,
    left: 0,
    right: 0,
    bottom: 0,
  },
  label: {
    color: ui.card,
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 18,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  disabledLabel: {
    color: ui.disabledInk,
  },
});
