import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { cleanName, nameLimit } from '../adopt/name';
import { newSeed } from '../adopt/seed';
import { breedById, breedsFor, coatSwatchesFor, defaultLook, earOptions, tailOptions } from '../actor';
import type { Breed, Species } from '../actor/types';
import { attributesFor, generateOffers } from '../sim';
import type { Archetype, Look, PetAttributes } from '../sim';
import { loadDraft, saveDraft } from '../storage/session';
import type { AdoptionDraft } from '../storage/session';
import { PetPreview } from '../ui/PetPreview';
import { BreedCard } from './adopt/BreedCard';
import { LookPicker } from './adopt/LookPicker';
import { OfferCard } from './adopt/OfferCard';

type Props = {
  onAdopt: (breedId: string, attributes: PetAttributes, look: Look, name: string) => void;
};

function sameColor(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

// Keep as much of the previous look as the next breed allows; fill the rest from its defaults.
function lookForBreed(breed: Breed, previous: Look | null): Look {
  const defaults = defaultLook(breed);
  if (!previous) {
    return defaults;
  }
  const coats = coatSwatchesFor(breed);
  const ears = earOptions[breed.species];
  const tails = tailOptions[breed.species];
  return {
    coat: coats.some((color) => sameColor(color, previous.coat)) ? previous.coat : defaults.coat,
    ear: ears.some((option) => option.id === previous.ear) ? previous.ear : defaults.ear,
    tail: tails.some((option) => option.id === previous.tail) ? previous.tail : defaults.tail,
  };
}

function firstBreed(species: Species): Breed {
  return breedsFor(species)[0];
}

function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={8}>
      <Text style={styles.back}>Back</Text>
    </Pressable>
  );
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
  const [archetype, setArchetype] = useState<Archetype | null>(null);
  const [name, setName] = useState('');
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
        next = { ...next, breedId: breed.id, look: lookForBreed(breed, next.look), step: next.step === 'offers' ? 'offers' : 'design' };
      } else if (next.look == null) {
        next = { ...next, look: defaultLook(breedById(next.breedId)!) };
      }
      if (!saved || saved.breedId == null || saved.look == null) {
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

  const step = archetype ? 'name' : draft.step;
  const species: Species = draft.species;
  const chosen = archetype ? offers.find((offer) => offer.archetype === archetype) ?? null : null;
  const readyName = cleanName(name);
  const title = step === 'name' ? 'Name' : step === 'offers' ? 'Choose a set' : 'Adopt';

  if (step === 'design' && breed && draft.look) {
    return (
      <View style={styles.root}>
        <View style={styles.sticky}>
          <Text style={styles.title}>{title}</Text>
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
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{title}</Text>
      {step === 'offers' || step === 'name' ? (
        <PetPreview species={species} breedId={breed?.id ?? null} look={draft.look} />
      ) : null}

      {step === 'offers' && breed ? (
        <View style={styles.stack}>
          <BackButton onPress={() => update({ step: 'design' })} />
          <Text style={styles.body}>Pick one set. Each is a different tradeoff.</Text>
          {offers.map((offer) => (
            <OfferCard key={offer.archetype} offer={offer} onPress={() => setArchetype(offer.archetype)} />
          ))}
        </View>
      ) : null}

      {step === 'name' && chosen && breed && draft.look ? (
        <View style={styles.stack}>
          <BackButton onPress={() => setArchetype(null)} />
          <OfferCard offer={chosen} />
          <TextInput
            value={name}
            onChangeText={(value) => setName(value.slice(0, nameLimit))}
            placeholder="Name"
            maxLength={nameLimit}
            style={styles.input}
            autoCorrect={false}
          />
          <Pressable
            style={[styles.choice, readyName == null && styles.disabled]}
            disabled={readyName == null}
            onPress={() => {
              if (readyName && draft.breedId && draft.look) {
                onAdopt(
                  draft.breedId,
                  attributesFor(draft.seed, breed.species, breed.id, breed.attributeRanges, chosen.archetype),
                  draft.look,
                  readyName,
                );
              }
            }}
          >
            <Text style={styles.choiceLabel}>Bring home</Text>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F4F7FB',
    paddingTop: 56,
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
  screen: {
    flexGrow: 1,
    backgroundColor: '#F4F7FB',
    paddingTop: 72,
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 16,
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
  back: {
    fontSize: 16,
    color: '#5C6B80',
  },
  stack: {
    gap: 12,
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
  disabled: {
    opacity: 0.4,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#243044',
  },
});
