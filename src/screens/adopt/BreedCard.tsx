import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Breed } from '../../actor';
import { traits } from '../../sim';
import { AttributeBar } from './AttributeBar';
import { traitLabel } from './labels';

type Props = {
  breed: Breed;
  open: boolean;
  onOpen: () => void;
  onChoose: () => void;
};

// A breed with its six potential ranges. Tapping opens it, which shows the exact numbers and
// moves the preview to this breed. The ranges are potential ceilings, not starting values.
export function BreedCard({ breed, open, onOpen, onChoose }: Props) {
  return (
    <Pressable style={[styles.card, open && styles.open]} onPress={onOpen} accessibilityRole="button">
      <View style={styles.header}>
        <Text style={styles.title}>{breed.name}</Text>
        <Text style={styles.tag}>Potential</Text>
      </View>
      <Text style={styles.blurb}>{breed.blurb}</Text>
      <View style={styles.bars}>
        {traits.map((trait) => (
          <AttributeBar
            key={trait}
            label={traitLabel[trait]}
            range={breed.attributeRanges[trait]}
            showNumbers={open}
          />
        ))}
      </View>
      {open ? (
        <Pressable style={styles.choose} onPress={onChoose} accessibilityRole="button">
          <Text style={styles.chooseLabel}>Choose {breed.name}</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    gap: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  open: {
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
  },
  bars: {
    gap: 5,
  },
  choose: {
    marginTop: 4,
    backgroundColor: '#243044',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  chooseLabel: {
    color: '#fff',
    fontSize: 16,
  },
});
