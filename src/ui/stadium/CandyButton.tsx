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
  lines?: number;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

const roleTint = { primary: tints.pink, go: tints.mint, friends: tints.lilac } as const;

export function CandyButton({ label, role = 'primary', disabled = false, compact = false, lines = 1, onPress, accessibilityLabel, style }: Props) {
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
        style={[styles.hit, compact && styles.compact, style]}
      >
        {({ pressed }) => (
          <View style={[styles.secondary, compact && styles.compactFace, disabled && styles.dim, pressed && !disabled && styles.pressed]}>
            <Text style={[styles.secondaryText, compact && styles.compactText, lines > 1 && styles.wrap]} numberOfLines={lines}>
              {label}
            </Text>
          </View>
        )}
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
      style={[styles.hit, compact && styles.compact, style]}
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
          <Text style={[styles.label, compact && styles.compactText, lines > 1 && styles.wrap, { color: candyInk(tint) }]} numberOfLines={lines}>
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
  pressed: {
    opacity: 0.92,
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
  wrap: {
    textAlign: 'center',
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
