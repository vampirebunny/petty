import { Pressable, StyleSheet, Text, View } from 'react-native';

import { lockHint, trackDefs, tracksFor, type SpeciesId } from '../sim/tracks';
import type { PetState } from '../sim/types';
import { theme } from './theme';

type Props = {
  pet: PetState;
  species: SpeciesId;
  onPractice: (trackId: string) => void;
};

export function TrainingPanel({ pet, species, onPractice }: Props) {
  const tracks = tracksFor(species).filter((def) => def.id !== 'house_training');
  return (
    <View style={styles.box}>
      <Text style={styles.title}>Training</Text>
      {tracks.map((def) => {
        const track = pet.training[def.id];
        if (!track) {
          return null;
        }
        if (!track.unlocked) {
          return (
            <Text key={def.id} style={styles.locked}>
              {lockHint(pet, def) ?? def.name}
            </Text>
          );
        }
        return (
          <View key={def.id} style={styles.row}>
            <View style={styles.copy}>
              <Text style={styles.name}>{def.name}</Text>
              <Text style={styles.meta}>
                {Math.round(track.progress)} / 100 · {track.repsToday} today
              </Text>
            </View>
            {def.button === 'panel' && !track.mastered ? (
              <Pressable onPress={() => onPractice(def.id)} accessibilityRole="button">
                <Text style={styles.practice}>Practice</Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}
      {trackDefs.length === 0 ? <Text style={styles.locked}>No tricks yet.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    marginTop: 8,
    padding: 12,
    borderRadius: 16,
    backgroundColor: theme.surface,
    gap: 8,
  },
  title: {
    color: theme.ink,
    fontWeight: '800',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  copy: {
    flex: 1,
  },
  name: {
    color: theme.ink,
    fontWeight: '700',
  },
  meta: {
    color: theme.ink,
    opacity: 0.7,
    fontSize: 12,
  },
  locked: {
    color: theme.ink,
    opacity: 0.55,
    fontSize: 13,
  },
  practice: {
    color: theme.ink,
    fontWeight: '800',
  },
});
