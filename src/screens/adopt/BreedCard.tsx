import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Breed } from '../../actor';
import { traits } from '../../sim';
import { AttributeBar } from './AttributeBar';
import { traitLabel } from './labels';

type Props = {
  breed: Breed;
  selected: boolean;
  onSelect: () => void;
};

// A breed with its six potential ranges and their numbers. Ranges are potential ceilings, not
// starting values.
export function BreedCard({ breed, selected, onSelect }: Props) {
  return (
    <Pressable
      style={[styles.card, selected && styles.selected]}
      onPress={onSelect}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{breed.name}</Text>
        <Text style={styles.tag}>Potential</Text>
      </View>
      <Text style={styles.blurb} numberOfLines={2}>
        {breed.blurb}
      </Text>
      <View style={styles.bars}>
        {traits.map((trait) => (
          <AttributeBar
            key={trait}
            label={traitLabel[trait]}
            range={breed.attributeRanges[trait]}
            showNumbers
          />
        ))}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 280,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    gap: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selected: {
    borderColor: '#243044',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  title: {
    fontSize: 18,
    color: '#243044',
  },
  tag: {
    fontSize: 12,
    color: '#5C6B80',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  blurb: {
    fontSize: 14,
    color: '#5C6B80',
    minHeight: 36,
  },
  bars: {
    gap: 5,
  },
});
