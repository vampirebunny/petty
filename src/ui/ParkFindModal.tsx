import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';

import { conditionCopyFor } from '../parkFinds/conditionCopy';
import { findTitle } from '../parkFinds/collection';
import { parkFindColorArt } from '../parkFinds/artMap';
import type { ParkFindCatalogRow } from '../parkFinds/types';
import { CandyShell, candyInk, tints } from './candy';

const rarityColors: Record<string, string> = {
  common: '#CFC3EA',
  uncommon: '#9FE6C6',
  rare: '#9FD3FF',
  legendary: '#F5D76E',
};

type Props = {
  petName: string;
  item: ParkFindCatalogRow;
  isNew: boolean;
  count: number;
  reducedMotion: boolean;
  onAdd: () => void;
};

export function ParkFindModal({ petName, item, isNew, count, reducedMotion, onAdd }: Props) {
  const flavor = tints.orchid;
  const ink = candyInk(flavor);
  const bob = useSharedValue(0);
  const art = parkFindColorArt(item.art_key, '3x');
  const copy = conditionCopyFor(item.condition_type, item.condition_value);

  useEffect(() => {
    if (reducedMotion) return;
    bob.value = withRepeat(
      withSequence(withTiming(-6, { duration: 900 }), withTiming(0, { duration: 900 })),
      -1,
      false,
    );
  }, [bob, reducedMotion]);

  const artStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bob.value }],
  }));

  const side =
    count > 1
      ? `Found ${count} times`
      : copy.modalLine;

  return (
    <View style={styles.backdrop}>
      <CandyShell tint={flavor} radius={28} uid="park-find-modal" style={styles.card}>
        <Text style={[styles.title, { color: ink }]}>{findTitle(petName, item.name)}</Text>
        <View style={styles.glow}>
          <Animated.View style={artStyle}>
            {art ? (
              <Image source={art} style={styles.art} resizeMode="contain" />
            ) : (
              <View style={[styles.art, styles.artFallback]} />
            )}
          </Animated.View>
          {isNew ? (
            <View style={styles.newTag}>
              <Text style={styles.newText}>New!</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.meta}>
          <View
            style={[
              styles.chip,
              item.rarity === 'legendary'
                ? styles.legendary
                : { backgroundColor: rarityColors[item.rarity] ?? rarityColors.common },
            ]}
          >
            <Text style={styles.chipText}>
              {item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1)}
            </Text>
          </View>
          {side ? <Text style={[styles.side, { color: ink }]}>{side}</Text> : null}
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onAdd();
          }}
          style={({ pressed }) => [styles.hit, pressed && styles.pressed]}
        >
          <View style={[styles.button, { backgroundColor: flavor.icon }]}>
            <Text style={styles.buttonText}>Add to collection</Text>
          </View>
        </Pressable>
      </CandyShell>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(20, 12, 40, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 60,
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    padding: 20,
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  glow: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255, 236, 200, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  art: { width: 120, height: 150 },
  artFallback: { backgroundColor: '#CFC3EA', borderRadius: 16 },
  newTag: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FF7AB6',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  newText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  chip: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  legendary: { backgroundColor: '#F5D76E' },
  chipText: { fontWeight: '800', fontSize: 13, color: '#3A2A55' },
  side: { fontSize: 14, fontWeight: '600' },
  hit: { alignSelf: 'stretch', marginTop: 4 },
  pressed: { transform: [{ scale: 0.97 }] },
  button: { borderRadius: 20, paddingVertical: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
