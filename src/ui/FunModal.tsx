import { useEffect, useId } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { LucideIcon } from 'lucide-react-native';

import { playPointPop } from '../audio/badge';
import { CandyShell, Sparkle, candyInk, tints } from './candy';
import type { TintName } from './candy';
import { iconStroke } from './theme';

type ButtonSpec = {
  label: string;
  onPress: () => void;
};

type Props = {
  title: string;
  body: string;
  icon: LucideIcon;
  tint?: TintName;
  sparkle?: boolean;
  primary: ButtonSpec;
  secondary?: ButtonSpec;
  reducedMotion: boolean;
};

export function FunModal({ title, body, icon: Icon, tint = 'sky', sparkle = false, primary, secondary, reducedMotion }: Props) {
  const uid = useId().replace(/:/g, '');
  const flavor = tints[tint];
  const ink = candyInk(flavor);
  const scale = useSharedValue(reducedMotion ? 1 : 0.86);
  useEffect(() => {
    playPointPop();
    scale.value = reducedMotion ? 1 : withSpring(1, { damping: 12, stiffness: 180 });
  }, [reducedMotion, scale]);
  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const press = (action: () => void) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    action();
  };
  return (
    <View style={styles.layer} pointerEvents="box-none">
      <View style={styles.dim} />
      <Animated.View style={[styles.card, cardStyle]}>
        <CandyShell tint={flavor} radius={28} uid={uid} style={styles.face}>
          <View style={[styles.badge, { shadowColor: flavor.lip }]}>
            <Icon size={28} strokeWidth={iconStroke + 1} color={flavor.icon} />
          </View>
          {sparkle && !reducedMotion ? <Sparkle style={styles.sparkle} opacity={0.95} /> : null}
          <Text style={[styles.title, { color: ink }]}>{title}</Text>
          <Text style={[styles.body, { color: ink }]}>{body}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => press(primary.onPress)}
            style={({ pressed }) => [styles.hit, pressed && styles.squish]}
          >
            <View style={[styles.primary, { backgroundColor: flavor.icon }]}>
              <Text style={styles.primaryText}>{primary.label}</Text>
            </View>
          </Pressable>
          {secondary ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => press(secondary.onPress)}
              style={({ pressed }) => [styles.hit, pressed && styles.squish]}
            >
              <View style={[styles.secondary, { borderColor: flavor.lip }]}>
                <Text style={[styles.secondaryText, { color: ink }]}>{secondary.label}</Text>
              </View>
            </Pressable>
          ) : null}
        </CandyShell>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 30,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  dim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(36, 48, 68, 0.4)',
  },
  card: {
    width: '100%',
    maxWidth: 360,
  },
  face: {
    alignItems: 'center',
    gap: 10,
    paddingTop: 22,
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  badge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  sparkle: {
    position: 'absolute',
    top: 18,
    right: 28,
    width: 16,
    height: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 21,
  },
  hit: {
    alignSelf: 'stretch',
    minHeight: 48,
  },
  squish: {
    transform: [{ scale: 0.97 }],
  },
  primary: {
    minHeight: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  secondary: {
    minHeight: 48,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  secondaryText: {
    fontSize: 16,
    fontWeight: '800',
  },
});
