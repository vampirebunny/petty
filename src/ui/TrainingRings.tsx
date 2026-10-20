import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { ChevronsDown, Hand, Volume2 } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { lockHint, trackDef, trackName } from '../sim/tracks';
import type { PetState } from '../sim/types';
import { iconFor } from './actionIcons';
import { Ring } from './NeedRings';
import type { Need } from './NeedRings';

type Props = {
  pet: PetState;
  species: 'dog' | 'cat';
  onPractice: (trackId: string) => void;
  highlightId?: string | null;
  reducedMotion?: boolean;
};

// Same candy cards as the need rings. Alarm red never applies: a low ring just means not learned yet.
const rings: Record<string, Need> = {
  sit: {
    label: 'Sit',
    Icon: ChevronsDown,
    noAlarm: true,
    tint: { bg: '#DDF0FF', edge: '#A8D4F2', strong: '#4FA8E8', ink: '#134A78' },
    tiers: [
      { min: 75, text: 'Almost!' },
      { min: 50, text: 'Getting it' },
      { min: 25, text: 'Learning' },
      { min: 0, text: 'Tap to train' },
    ],
  },
  speak: {
    label: 'Speak',
    Icon: Volume2,
    noAlarm: true,
    tint: { bg: '#FFF1CC', edge: '#F2D98A', strong: '#F2B632', ink: '#7A5200' },
    tiers: [
      { min: 75, text: 'Almost!' },
      { min: 50, text: 'Getting it' },
      { min: 25, text: 'Learning' },
      { min: 0, text: 'Tap to train' },
    ],
  },
  paw: {
    label: 'Paw',
    Icon: Hand,
    noAlarm: true,
    tint: { bg: '#FFE3EC', edge: '#F5B5C9', strong: '#FF7BA5', ink: '#8A1F4B' },
    tiers: [
      { min: 75, text: 'Almost!' },
      { min: 50, text: 'Getting it' },
      { min: 25, text: 'Learning' },
      { min: 0, text: 'Tap to train' },
    ],
  },
};

const order = ['sit', 'speak', 'paw'];

export function trainingIds(pet: PetState, species: 'dog' | 'cat'): string[] {
  return order.filter((id) => {
    const track = pet.training[id];
    const def = trackDef(id);
    return track && def && def.species.includes(species) && !track.mastered;
  });
}

function needFor(id: string, species: 'dog' | 'cat'): Need {
  const need = rings[id];
  if (id !== 'paw') {
    return need;
  }
  return { ...need, label: trackName(id, species), Icon: iconFor(id, species) ?? Hand };
}

function Spotlight({
  active,
  reducedMotion,
  children,
}: {
  active: boolean;
  reducedMotion: boolean;
  children: ReactNode;
}) {
  const scale = useSharedValue(1);
  useEffect(() => {
    if (!active || reducedMotion) {
      scale.value = 1;
      return;
    }
    scale.value = withRepeat(
      withSequence(withTiming(1.08, { duration: 280 }), withTiming(1, { duration: 280 })),
      6,
      false,
    );
  }, [active, reducedMotion, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Animated.View style={[styles.spot, active && styles.spotOn, style]}>{children}</Animated.View>;
}

export function TrainingRings({ pet, species, onPractice, highlightId, reducedMotion = false }: Props) {
  const ids = trainingIds(pet, species);
  if (ids.length === 0) {
    return null;
  }
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>In Training</Text>
      <View style={styles.row}>
        {ids.map((id) => {
          const track = pet.training[id];
          const def = trackDef(id);
          if (!track || !def) {
            return null;
          }
          const locked = !track.unlocked;
          const fresh = id === highlightId && !locked;
          return (
            <Spotlight key={id} active={fresh} reducedMotion={reducedMotion}>
              <Ring
                need={needFor(id, species)}
                value={track.progress}
                hint={locked ? 'Locked' : fresh ? 'New!' : undefined}
                onPress={locked ? undefined : () => onPractice(id)}
              />
            </Spotlight>
          );
        })}
      </View>
      {ids
        .filter((id) => !pet.training[id]?.unlocked)
        .map((id) => {
          const def = trackDef(id);
          const hint = def ? lockHint(pet, def) : null;
          return hint ? (
            <Text key={id} style={styles.hint}>
              {hint}
            </Text>
          ) : null;
        })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  title: { color: '#243044', fontSize: 15, fontWeight: '800' },
  row: { flexDirection: 'row', justifyContent: 'flex-start', gap: 10 },
  spot: { flex: 1, maxWidth: 112 },
  spotOn: {
    borderRadius: 28,
    shadowColor: '#FF7BA5',
    shadowOpacity: 0.55,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  hint: { fontSize: 12.5, color: '#5C6B80' },
});
