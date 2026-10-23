import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { breedById } from '../../actor';
import { archetypeNames, archetypeStrong, traits } from '../../sim';
import type { PetState } from '../../sim';
import { PetPreview } from '../../ui/PetPreview';
import { AttributeBar } from './AttributeBar';
import { OnboardingHeader } from './OnboardingHeader';
import { traitLabel } from './labels';

type Props = {
  pet: PetState;
  onStart: () => void;
};

// Step 4: the first look at the new pet's current and potential scores. No back button, since
// the pet already exists.
export function MeetScreen({ pet, onStart }: Props) {
  const breed = breedById(pet.breedId);
  const strong = archetypeStrong[pet.attributes.archetype];
  const young = breed?.species === 'cat' ? 'Every kitten' : 'Every pup';
  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.intro}>
          <OnboardingHeader title={`Meet ${pet.name}`} step={4} />
          <Text style={styles.body}>
            {breed?.name} · {archetypeNames[pet.attributes.archetype]} · Day 1
          </Text>
        </View>
        <PetPreview species={breed?.species ?? 'dog'} breedId={pet.breedId} look={pet.look} height={150} />
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{pet.name} has a lot of growing to do</Text>
          <Text style={styles.body}>
            {young} starts small. Play, train and care for {pet.name} to fill each bar up to its potential.
          </Text>
          <View style={styles.key}>
            <View style={[styles.swatch, styles.swatchNow]} />
            <Text style={styles.keyLabel}>Now</Text>
            <View style={[styles.swatch, styles.swatchPotential]} />
            <Text style={styles.keyLabel}>Potential</Text>
          </View>
          <View style={styles.bars}>
            {traits.map((trait) => (
              <AttributeBar
                key={trait}
                label={traitLabel[trait]}
                value={pet.attributes.potential[trait]}
                current={pet.attributes.current[trait]}
                highlight={strong.includes(trait)}
              />
            ))}
          </View>
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <Pressable style={styles.choice} onPress={onStart} accessibilityRole="button">
          <Text style={styles.choiceLabel}>Start playing</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F4F7FB',
    paddingTop: 56,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 16,
  },
  intro: {
    gap: 4,
  },
  body: {
    fontSize: 15,
    color: '#5C6B80',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  cardTitle: {
    fontSize: 18,
    color: '#243044',
  },
  key: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  swatch: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  swatchNow: {
    backgroundColor: '#243044',
  },
  swatchPotential: {
    backgroundColor: '#C9D5E4',
    marginLeft: 8,
  },
  keyLabel: {
    fontSize: 13,
    color: '#5C6B80',
  },
  bars: {
    gap: 6,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32,
  },
  choice: {
    backgroundColor: '#243044',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  choiceLabel: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
  },
});
