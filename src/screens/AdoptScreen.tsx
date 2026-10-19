import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { newSeed } from '../adopt/seed';
import {
  breedById,
  breedsFor,
  coatStylesFor,
  defaultLook,
  earOptions,
  isCoatStyle,
  lookWithCoat,
  tailOptions,
} from '../actor';
import type { Breed, Species } from '../actor/types';
import { attributesFor, generateOffers } from '../sim';
import type { Look, PetAttributes } from '../sim';
import { loadDraft, saveDraft } from '../storage/session';
import type { AdoptionDraft } from '../storage/session';
import { PetPreview } from '../ui/PetPreview';
import { BreedCard } from './adopt/BreedCard';
import { LookPicker } from './adopt/LookPicker';
import { ChooseScreen } from './adopt/ChooseScreen';
import { NameScreen } from './adopt/NameScreen';
import { StepIndicator } from './adopt/StepIndicator';

type Props = {
  onAdopt: (breedId: string, attributes: PetAttributes, look: Look, name: string) => void;
};

// Keep as much of the previous look as the next breed allows; fill the rest from its defaults.
function lookForBreed(breed: Breed, previous: Look | null): Look {
  const defaults = defaultLook(breed);
  if (!previous) {
    return defaults;
  }
  const style = coatStylesFor(breed).find((candidate) => isCoatStyle(previous, candidate));
  const ears = earOptions[breed.species];
  const tails = tailOptions[breed.species];
  return {
    ...(style ? lookWithCoat(defaults, style) : defaults),
    ear: ears.some((option) => option.id === previous.ear) ? previous.ear : defaults.ear,
    tail: tails.some((option) => option.id === previous.tail) ? previous.tail : defaults.tail,
  };
}

function firstBreed(species: Species): Breed {
  return breedsFor(species)[0];
}

function SpeciesToggle({
  species,
  onChange,
}: {
  species: Species;
  onChange: (species: Species) => void;
}) {
  return (
    <View style={styles.speciesRow} accessibilityRole="tablist">
      {(['dog', 'cat'] as const).map((option) => {
        const on = option === species;
        return (
          <Pressable
            key={option}
            style={[styles.speciesChip, on && styles.speciesChipOn]}
            onPress={() => onChange(option)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
          >
            <Text style={[styles.speciesLabel, on && styles.speciesLabelOn]}>{option === 'dog' ? 'Dog' : 'Cat'}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function AdoptScreen({ onAdopt }: Props) {
  const [draft, setDraft] = useState<AdoptionDraft | null>(null);
  const draftRef = useRef<AdoptionDraft | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadDraft().then((saved) => {
      if (cancelled) {
        return;
      }
      // A new seed is created once, and saved right away, before any attribute set is shown.
      let next: AdoptionDraft =
        saved ?? { seed: newSeed(), species: 'dog', breedId: null, look: null, step: 'design' };
      // Design screen always needs a breed so the preview and look options have something to show.
      if (next.breedId == null || !breedById(next.breedId)) {
        const breed = firstBreed(next.species);
        next = { ...next, breedId: breed.id, look: lookForBreed(breed, next.look), step: next.step };
      } else if (next.look == null) {
        next = { ...next, look: defaultLook(breedById(next.breedId)!) };
      }
      if (next.step === 'name' && next.archetype == null) {
        next = { ...next, step: 'offers' };
      }
      if (!saved || saved.breedId == null || saved.look == null || next.step !== saved.step) {
        void saveDraft(next);
      }
      draftRef.current = next;
      setDraft(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback((patch: Partial<AdoptionDraft>) => {
    const current = draftRef.current;
    if (!current) {
      return;
    }
    const next = { ...current, ...patch };
    draftRef.current = next;
    setDraft(next);
    void saveDraft(next);
  }, []);

  const setSpecies = useCallback(
    (species: Species) => {
      const current = draftRef.current;
      if (!current || species === current.species) {
        return;
      }
      const breed = firstBreed(species);
      update({
        species,
        breedId: breed.id,
        look: lookForBreed(breed, current.look),
        step: 'design',
      });
    },
    [update],
  );

  const setBreed = useCallback(
    (breed: Breed) => {
      const current = draftRef.current;
      if (!current) {
        return;
      }
      update({
        breedId: breed.id,
        look: lookForBreed(breed, current.look),
      });
    },
    [update],
  );

  const breed = draft?.breedId ? breedById(draft.breedId) : null;
  const offers = useMemo(
    () => (draft && breed ? generateOffers(draft.seed, breed.species, breed.id, breed.attributeRanges) : []),
    [draft, breed],
  );

  if (draft == null) {
    return (
      <View style={styles.root}>
        <Text style={styles.title}>Boop Boop</Text>
      </View>
    );
  }

  const species: Species = draft.species;

  if (draft.step === 'offers' && breed && draft.look && offers.length > 0) {
    return (
      <ChooseScreen
        breed={breed}
        look={draft.look}
        offers={offers}
        selected={draft.archetype ?? offers[0].archetype}
        onSelect={(archetype) => update({ archetype })}
        onBack={() => update({ step: 'design' })}
        onNext={() => update({ archetype: draft.archetype ?? offers[0].archetype, step: 'name' })}
      />
    );
  }

  if (draft.step === 'name' && breed && draft.look && draft.archetype) {
    const picked = draft.archetype;
    return (
      <NameScreen
        breed={breed}
        look={draft.look}
        archetype={picked}
        name={draft.name ?? ''}
        onChangeName={(name) => update({ name })}
        onBack={() => update({ step: 'offers' })}
        onMeet={(name) =>
          onAdopt(
            breed.id,
            attributesFor(draft.seed, breed.species, breed.id, breed.attributeRanges, picked),
            draft.look as Look,
            name,
          )
        }
      />
    );
  }

  if (breed && draft.look) {
    return (
      <View style={styles.root}>
        <View style={styles.sticky}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Adopt</Text>
            <StepIndicator step={1} />
          </View>
          <SpeciesToggle species={species} onChange={setSpecies} />
          <PetPreview species={species} breedId={breed.id} look={draft.look} />
        </View>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <LookPicker breed={breed} look={draft.look} onChange={(look) => update({ look })} />
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Breed</Text>
            <Text style={styles.body}>Potential ranges for each breed.</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.breedRow}
              style={styles.breedScroll}
            >
              {breedsFor(species).map((option) => (
                <BreedCard
                  key={option.id}
                  breed={option}
                  selected={option.id === breed.id}
                  onSelect={() => setBreed(option)}
                />
              ))}
            </ScrollView>
          </View>
          <Pressable style={styles.choice} onPress={() => update({ step: 'offers' })}>
            <Text style={styles.choiceLabel}>Continue</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Boop Boop</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F4F7FB',
    paddingTop: 56,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sticky: {
    paddingHorizontal: 20,
    gap: 12,
    paddingBottom: 8,
    backgroundColor: '#F4F7FB',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D0D8E3',
    zIndex: 1,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 20,
  },
  title: {
    fontSize: 32,
    color: '#243044',
  },
  body: {
    fontSize: 15,
    color: '#5C6B80',
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 13,
    color: '#5C6B80',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  breedScroll: {
    marginHorizontal: -20,
  },
  breedRow: {
    paddingHorizontal: 20,
    gap: 12,
  },
  speciesRow: {
    flexDirection: 'row',
    gap: 8,
  },
  speciesChip: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  speciesChipOn: {
    backgroundColor: '#243044',
  },
  speciesLabel: {
    fontSize: 16,
    color: '#243044',
  },
  speciesLabelOn: {
    color: '#fff',
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
