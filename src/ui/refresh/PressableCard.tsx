import { useEffect, useId, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { CandyFace, type Tint } from '../candy';
import { ui } from './tokens';

type Props = {
  children: ReactNode;
  onPress?: () => void;
  onDisabledPress?: () => void;
  disabled?: boolean;
  reducedMotion?: boolean;
  radius?: number;
  accessibilityLabel?: string;
  selected?: boolean;
  tint?: Tint;
};

export function PressableCard({
  children,
  onPress,
  onDisabledPress,
  disabled = false,
  reducedMotion = false,
  radius = ui.radius.card,
  accessibilityLabel,
  selected = false,
  tint,
}: Props) {
  const uid = useId().replace(/:/g, '');
  const [pressed, setPressed] = useState(false);
  const down = useSharedValue(0);
  useEffect(() => {
    down.value = withTiming(pressed && !disabled && !reducedMotion ? 3 : 0, { duration: reducedMotion ? 0 : 80 });
  }, [disabled, down, pressed, reducedMotion]);
  const faceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: down.value }],
  }));

  const press = () => {
    if (disabled) {
      onDisabledPress?.();
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, selected }}
      onPress={press}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={styles.hit}
    >
      <View
        style={[
          styles.edge,
          { borderRadius: radius, backgroundColor: disabled ? 'transparent' : (tint?.lip ?? ui.cardEdge) },
        ]}
      />
      <Animated.View style={[styles.faceWrap, !disabled && styles.faceLift, tint && !disabled && { shadowColor: tint.lip }, faceStyle]}>
        {disabled ? (
          <View style={[styles.face, styles.disabled, { borderRadius: radius }]}>{children}</View>
        ) : tint ? (
          <View style={[styles.face, styles.candy, { borderRadius: radius }, selected && { borderColor: ui.equipped.main }]}>
            <CandyFace tint={tint} radius={radius} uid={uid} />
            {children}
          </View>
        ) : (
          <LinearGradient
            colors={[ui.card, ui.card, ui.cardSheenBottom]}
            locations={[0, 0.45, 1]}
            style={[styles.face, { borderRadius: radius, borderColor: selected ? ui.equipped.main : ui.card }]}
          >
            {children}
          </LinearGradient>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    minHeight: 44,
    minWidth: 44,
  },
  edge: {
    position: 'absolute',
    top: 5,
    left: 0,
    right: 0,
    bottom: 0,
  },
  faceWrap: {
    shadowColor: ui.ink,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
  },
  faceLift: {
    marginBottom: 5,
  },
  face: {
    borderWidth: 2,
    overflow: 'hidden',
  },
  candy: {
    borderColor: ui.gloss.top,
  },
  disabled: {
    backgroundColor: ui.disabledBg,
    borderColor: ui.disabledBg,
  },
});
