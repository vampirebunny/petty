import { StyleSheet, Text, View } from 'react-native';

import { offerDeltas } from '../../adopt/deltas';
import { archetypeBlurbs, archetypeNames, archetypeStrong, traits } from '../../sim';
import type { AttributeSet } from '../../sim';
import { AttributeBar } from './AttributeBar';
import { traitLabel } from './labels';

type Props = {
  offer: AttributeSet;
  offers: readonly AttributeSet[];
};

// The selected pup: its name and blurb, then each attribute's potential with the gain over the
// other two pups. Everything comes from the offers and archetype data.
export function PupDetail({ offer, offers }: Props) {
  const strong = archetypeStrong[offer.archetype];
  const deltas = offerDeltas(offer, offers);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{archetypeNames[offer.archetype]}</Text>
      <Text style={styles.blurb}>{archetypeBlurbs[offer.archetype]}</Text>
      <View style={styles.bars}>
        {traits.map((trait) => (
          <AttributeBar
            key={trait}
            label={traitLabel[trait]}
            value={offer.potential[trait]}
            delta={deltas[trait]}
            highlight={strong.includes(trait)}
            showNumbers
          />
        ))}
      </View>
      <Text style={styles.footer}>Max potential out of 100. All three pups add up to the same total.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  title: {
    fontSize: 18,
    color: '#243044',
  },
  blurb: {
    fontSize: 14,
    color: '#5C6B80',
  },
  bars: {
    gap: 6,
  },
  footer: {
    fontSize: 12,
    color: '#5C6B80',
  },
});
