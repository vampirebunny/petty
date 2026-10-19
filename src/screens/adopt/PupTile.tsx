import { Pressable, StyleSheet, Text } from 'react-native';

import { archetypeNames, archetypeStrong } from '../../sim';
import type { Archetype } from '../../sim';
import { traitLabel } from './labels';

type Props = {
  archetype: Archetype;
  selected: boolean;
  onSelect: () => void;
};

// One choice in the single-choice pup selector. The name drops the leading "The".
export function PupTile({ archetype, selected, onSelect }: Props) {
  const name = archetypeNames[archetype].replace(/^The /, '');
  const strengths = archetypeStrong[archetype].map((trait) => traitLabel[trait]).join(' · ');
  return (
    <Pressable
      style={[styles.tile, selected && styles.selected]}
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${name}, ${strengths}`}
    >
      <Text style={[styles.name, selected && styles.onDark]}>{name}</Text>
      <Text style={[styles.strengths, selected && styles.onDark]}>{strengths}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minHeight: 72,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D0D8E3',
    paddingHorizontal: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  selected: {
    backgroundColor: '#243044',
    borderColor: '#243044',
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#243044',
  },
  strengths: {
    fontSize: 11,
    textAlign: 'center',
    color: '#5C6B80',
  },
  onDark: {
    color: '#fff',
  },
});
