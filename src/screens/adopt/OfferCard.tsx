import { Pressable, StyleSheet, Text, View } from 'react-native';

import { archetypeNames, archetypeStrong, traits } from '../../sim';
import type { AttributeSet, BreedRanges } from '../../sim';
import { AttributeBar } from './AttributeBar';
import { traitLabel } from './labels';

type Props = {
  offer: AttributeSet;
  ranges: BreedRanges;
  onPress?: () => void;
};

// One of the three pups. Each row highlights the breed's potential range, with a line at this
// pup's starting score and a dot and number for its potential. The two attributes this
// archetype is strong in are highlighted.
export function OfferCard({ offer, ranges, onPress }: Props) {
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
            range={ranges[trait]}
            start={offer.current[trait]}
            marker={offer.potential[trait]}
            highlight={strong.includes(trait)}
            showNumbers
          />
        ))}
      </View>
      <Text style={styles.legend}>Shaded: breed range. Line: starting. Dot: potential.</Text>
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
  legend: {
    fontSize: 11,
    color: '#5C6B80',
  },
});
