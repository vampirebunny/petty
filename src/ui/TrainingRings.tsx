import { ChevronsDown, Hand, House, Volume2 } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { lockHint, trackDef } from '../sim/tracks';
import type { PetState } from '../sim/types';
import { Ring } from './NeedRings';
import type { Need } from './NeedRings';

type Props = {
  pet: PetState;
  species: 'dog' | 'cat';
  onPractice: (trackId: string) => void;
};

// Same candy cards as the need rings. Alarm red never applies: a low ring just means not learned yet.
const rings: Record<string, Need> = {
  house_training: {
    label: 'Housebroken',
    Icon: House,
    noAlarm: true,
    tint: { bg: '#E8E2FF', edge: '#C4B8F2', strong: '#8E7BFF', ink: '#3A2A8A' },
    tiers: [
      { min: 75, text: 'Almost!' },
      { min: 50, text: 'Getting it' },
      { min: 25, text: 'Learning' },
      { min: 0, text: 'Just starting' },
    ],
  },
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

const order = ['house_training', 'sit', 'speak', 'paw'];

export function trainingIds(pet: PetState, species: 'dog' | 'cat'): string[] {
  return order.filter((id) => {
    const track = pet.training[id];
    const def = trackDef(id);
    return track && def && def.species.includes(species) && !track.mastered;
  });
}

export function TrainingRings({ pet, species, onPractice }: Props) {
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
          return (
            <Ring
              key={id}
              need={rings[id]}
              value={track.progress}
              hint={locked ? 'Locked' : undefined}
              onPress={locked || id === 'house_training' ? undefined : () => onPractice(id)}
            />
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
  hint: { fontSize: 12.5, color: '#5C6B80' },
});
