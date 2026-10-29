import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { CandyShell, candyInk, tints } from './candy';

type Props = {
  petName: string;
  onLetsSee: () => void;
  reducedMotion: boolean;
};

export function ParkFindPrompt({ petName, onLetsSee, reducedMotion }: Props) {
  const flavor = tints.orchid;
  const ink = candyInk(flavor);
  const y = useSharedValue(reducedMotion ? 0 : -80);
  const opacity = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    y.value = reducedMotion ? 0 : withSpring(0, { damping: 14, stiffness: 160 });
    opacity.value = reducedMotion ? 1 : withTiming(1, { duration: 220 });
  }, [opacity, reducedMotion, y]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View pointerEvents="box-none" style={[styles.wrap, style]}>
      <CandyShell tint={flavor} radius={22} uid="park-find-prompt" style={styles.card}>
        <Text style={[styles.text, { color: ink }]}>
          {petName} seems to have found something!
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Let's see"
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onLetsSee();
          }}
          style={({ pressed }) => [styles.hit, pressed && styles.pressed]}
        >
          <View style={[styles.button, { backgroundColor: flavor.icon }]}>
            <Text style={styles.buttonText}>{"Let's see!"}</Text>
          </View>
        </Pressable>
      </CandyShell>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 56,
    left: 16,
    right: 16,
    zIndex: 40,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
    alignItems: 'center',
  },
  text: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  hit: { alignSelf: 'stretch' },
  pressed: { transform: [{ scale: 0.97 }] },
  button: {
    borderRadius: 18,
    paddingVertical: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
});
