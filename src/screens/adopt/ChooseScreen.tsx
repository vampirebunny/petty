import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Breed } from '../../actor/types';
import { archetypeNames } from '../../sim';
import type { Archetype, AttributeSet, Look } from '../../sim';
import { PetPreview } from '../../ui/PetPreview';
import { BackButton } from './BackButton';
import { PupDetail } from './PupDetail';
import { PupTile } from './PupTile';
import { StepIndicator } from './StepIndicator';

type Props = {
  breed: Breed;
  look: Look;
  offers: readonly AttributeSet[];
  selected: Archetype;
  onSelect: (archetype: Archetype) => void;
  onBack: () => void;
  onNext: () => void;
};

// Step 2: pick one of three pups. Three equal tiles, one detail card for the selected pup.
export function ChooseScreen({ breed, look, offers, selected, onSelect, onBack, onNext }: Props) {
  const young = breed.species === 'cat' ? 'kitten' : 'pup';
  const offer = offers.find((candidate) => candidate.archetype === selected) ?? offers[0];
  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <BackButton label="Back to breed" onPress={onBack} />
          <StepIndicator step={2} />
        </View>
        <View style={styles.titles}>
          <Text style={styles.title}>Choose your {young}</Text>
          <Text style={styles.body}>
            Three {breed.name} {young}s. Each is good at something different.
          </Text>
        </View>
        <PetPreview species={breed.species} breedId={breed.id} look={look} height={170} />
        <View style={styles.tiles} accessibilityRole="radiogroup">
          {offers.map((candidate) => (
            <PupTile
              key={candidate.archetype}
              archetype={candidate.archetype}
              selected={candidate.archetype === offer.archetype}
              onSelect={() => onSelect(candidate.archetype)}
            />
          ))}
        </View>
        <PupDetail offer={offer} offers={offers} />
      </ScrollView>
      <View style={styles.footer}>
        <Pressable style={styles.choice} onPress={onNext} accessibilityRole="button">
          <Text style={styles.choiceLabel}>Adopt {archetypeNames[offer.archetype]}</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titles: {
    gap: 4,
  },
  title: {
    fontSize: 32,
    color: '#243044',
  },
  body: {
    fontSize: 15,
    color: '#5C6B80',
  },
  tiles: {
    flexDirection: 'row',
    gap: 8,
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
