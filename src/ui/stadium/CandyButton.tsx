import { useId } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';

import { CandyShell, GRAY, Sparkle, candyInk, tints } from '../candy';
import { fontFamily } from '../font';
import { minTouch } from '../theme';

// Pink is the primary action, mint is go, lilac is friends, and white is secondary.
export type CandyRole = 'primary' | 'go' | 'friends' | 'secondary';

type Props = {
  label: string;
  role?: CandyRole;
  disabled?: boolean;
  compact?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

const roleTint = { primary: tints.pink, go: tints.mint, friends: tints.lilac } as const;

export function CandyButton({ label, role = 'primary', disabled = false, compact = false, onPress, accessibilityLabel, style }: Props) {
  const uid = useId().replace(/:/g, '');
  const press = () => {
    if (disabled || !onPress) {
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  if (role === 'secondary') {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled }}
        onPress={press}
        style={({ pressed }) => [styles.hit, compact && styles.compact, pressed && !disabled && styles.squish, style]}
      >
        <View style={[styles.secondary, compact && styles.compactFace, disabled && styles.dim]}>
          <Text style={[styles.secondaryText, compact && styles.compactText]}>{label}</Text>
        </View>
      </Pressable>
    );
  }

  const tint = disabled ? GRAY : roleTint[role];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      onPress={press}
      style={({ pressed }) => [styles.hit, compact && styles.compact, pressed && !disabled && styles.squish, style]}
    >
      {({ pressed }) => (
        <CandyShell
          tint={tint}
          radius={compact ? 16 : 24}
          lip={compact ? 4 : 6}
          pressed={pressed && !disabled}
          uid={uid}
          style={[styles.face, compact && styles.compactFace]}
        >
          <Text style={[styles.label, compact && styles.compactText, { color: candyInk(tint) }]} numberOfLines={1}>
            {label}
          </Text>
          {!disabled && !compact ? <Sparkle style={styles.sparkle} opacity={0.9} /> : null}
        </CandyShell>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    alignSelf: 'stretch',
  },
  compact: {
    alignSelf: 'auto',
  },
  squish: {
    transform: [{ scale: 0.97 }],
  },
  face: {
    minHeight: minTouch + 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  compactFace: {
    minHeight: 34,
    paddingHorizontal: 14,
  },
  label: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 18,
  },
  compactText: {
    fontSize: 14,
  },
  sparkle: {
    position: 'absolute',
    top: 8,
    right: 16,
    width: 9,
    height: 9,
  },
  secondary: {
    minHeight: minTouch + 6,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#E4D6F5',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  secondaryText: {
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 16,
    color: '#6B4C7A',
  },
  dim: {
    opacity: 0.55,
  },
});
