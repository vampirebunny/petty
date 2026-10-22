import { useEffect, useId } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Cookie } from 'lucide-react-native';

import { playPointPop } from '../audio/badge';
import type { TreatChoice } from '../treats';
import { CandyShell, Sparkle, candyInk, tints } from './candy';
import { iconStroke } from './theme';

type Props = {
  choices: TreatChoice[];
  note?: string | null;
  reducedMotion: boolean;
  // When set, the sheet starts at this offset so the pet preview above it stays visible.
  top?: number;
  onPick: (treatId: string) => void;
  onClose: () => void;
};

export function TreatPicker({ choices, note, reducedMotion, top, onPick, onClose }: Props) {
  const uid = useId().replace(/:/g, '');
  const flavor = tints.coral;
  const ink = candyInk(flavor);
  const empty = choices.length === 0;
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

  const card = (
    <Animated.View style={[styles.card, cardStyle]}>
      <CandyShell tint={flavor} radius={28} uid={uid} style={styles.face}>
        <View style={[styles.badge, { shadowColor: flavor.lip }]}>
          <Cookie size={28} strokeWidth={iconStroke + 1} color={flavor.icon} />
        </View>
        {!reducedMotion ? <Sparkle style={styles.sparkle} opacity={0.95} /> : null}
        <Text style={[styles.title, { color: ink }]}>{empty ? 'Treats' : 'Pick a treat'}</Text>
        {empty ? <Text style={[styles.body, { color: ink }]}>No treats available.</Text> : null}
        {note ? <Text style={[styles.body, { color: ink }]}>{note}</Text> : null}
        {choices.map((choice) => (
          <Pressable
            key={choice.id}
            accessibilityRole="button"
            accessibilityLabel={`${choice.name}, ${choice.count}`}
            onPress={() => press(() => onPick(choice.id))}
            style={({ pressed }) => [styles.hit, pressed && styles.squish]}
          >
            <View style={[styles.choice, { borderColor: flavor.lip }]}>
              <Text style={[styles.choiceName, { color: ink }]}>{choice.name}</Text>
              <Text style={[styles.choiceCount, { color: ink }]}>{choice.count}</Text>
            </View>
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          onPress={() => press(onClose)}
          style={({ pressed }) => [styles.hit, pressed && styles.squish]}
        >
          <View style={[styles.primary, { backgroundColor: flavor.icon }]}>
            <Text style={styles.primaryText}>{empty ? 'OK' : 'Not now'}</Text>
          </View>
        </Pressable>
      </CandyShell>
    </Animated.View>
  );

  return (
    <View style={[styles.layer, top != null && styles.below, top != null && { top }]} pointerEvents="box-none">
      <View style={styles.dim} />
      {top != null ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          {card}
        </ScrollView>
      ) : (
        card
      )}
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
  below: {
    justifyContent: 'flex-start',
    paddingTop: 12,
  },
  scroll: {
    alignSelf: 'stretch',
    flex: 1,
    maxWidth: 360,
  },
  scrollContent: {
    paddingBottom: 24,
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
  choice: {
    minHeight: 64,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  choiceName: {
    fontSize: 16,
    fontWeight: '900',
  },
  choiceCount: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
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
});
