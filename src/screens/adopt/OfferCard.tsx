import { Pressable, StyleSheet, Text, View } from 'react-native';

import { archetypeNames, archetypeStrong, traits } from '../../sim';
import type { AttributeSet } from '../../sim';
import { AttributeBar } from './AttributeBar';
import { traitLabel } from './labels';

type Props = {
  offer: AttributeSet;
  onPress?: () => void;
};

// One of the three attribute sets for the pet. It shows the exact potentials, with the two
// attributes this archetype is strong in highlighted.
export function OfferCard({ offer, onPress }: Props) {
  const strong = archetypeStrong[offer.archetype];
  return (
    <Pressable style={styles.card} onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined}>
      <View style={styles.header}>
        <Text style={styles.title}>{archetypeNames[offer.archetype]}</Text>
        <Text style={styles.tag}>Potential</Text>
      </View>
      <View style={styles.bars}>
        {traits.map((trait) => (
          <AttributeBar
            key={trait}
            label={traitLabel[trait]}
            value={offer.potential[trait]}
            highlight={strong.includes(trait)}
            showNumbers
          />
        ))}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    gap: 8,
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
  bars: {
    gap: 5,
  },
});
