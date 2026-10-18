import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { cleanName, nameLimit } from '../adopt/name';
import { newSeed } from '../adopt/seed';
import { breedById, breedsFor, defaultLook } from '../actor';
import type { Species } from '../actor/types';
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

function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={8}>
      <Text style={styles.back}>Back</Text>
    </Pressable>
  );
}

export function AdoptScreen({ onAdopt }: Props) {
  const [draft, setDraft] = useState<AdoptionDraft | null>(null);
  const [openBreed, setOpenBreed] = useState<string | null>(null);
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
      const next: AdoptionDraft = saved ?? { seed: newSeed(), species: 'dog', breedId: null, look: null, step: 'species' };
      if (!saved) {
        void saveDraft(next);
      }
      draftRef.current = next;
      setOpenBreed(next.breedId);
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

  const breed = draft?.breedId ? breedById(draft.breedId) : null;
  const offers = useMemo(
    () => (draft && breed ? generateOffers(draft.seed, breed.species, breed.id, breed.attributeRanges) : []),
    [draft, breed],
  );

  if (draft == null) {
    return (
      <View style={styles.screen}>
        <Text style={styles.title}>Boop Boop</Text>
      </View>
    );
  }

  const step = archetype ? 'name' : draft.step;
  const species: Species = draft.species;
  const previewBreedId = step === 'breed' ? openBreed ?? draft.breedId : draft.breedId;
  const previewBreed = previewBreedId ? breedById(previewBreedId) : null;
  const previewLook = step === 'breed' && previewBreed && previewBreed.id !== draft.breedId ? defaultLook(previewBreed) : draft.look;
  const chosen = archetype ? offers.find((offer) => offer.archetype === archetype) ?? null : null;
  const readyName = cleanName(name);

  const title =
    step === 'name' ? 'Name' : step === 'look' ? 'Look' : step === 'offers' ? 'Choose a set' : step === 'breed' ? 'Breed' : 'Adopt';

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.title}>{title}</Text>
      {step !== 'species' ? <PetPreview species={species} breedId={previewBreed?.id ?? null} look={previewLook} /> : null}

      {step === 'species' ? (
        <View style={styles.stack}>
          <Text style={styles.body}>Choose a species.</Text>
          {(['dog', 'cat'] as const).map((option) => (
            <Pressable
              key={option}
              style={styles.choice}
              onPress={() => {
                const changed = option !== draft.species;
                setOpenBreed(changed ? null : draft.breedId);
                update(
                  changed
                    ? { species: option, breedId: null, look: null, step: 'breed' }
                    : { species: option, step: 'breed' },
                );
              }}
            >
              <Text style={styles.choiceLabel}>{option === 'dog' ? 'Dog' : 'Cat'}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {step === 'breed' ? (
        <View style={styles.stack}>
          <BackButton onPress={() => update({ step: 'species' })} />
          <Text style={styles.body}>Tap a breed to see its potential.</Text>
          {breedsFor(species).map((option) => (
            <BreedCard
              key={option.id}
              breed={option}
              open={openBreed === option.id}
              onOpen={() => setOpenBreed(option.id)}
              onChoose={() => {
                const keepLook = draft.breedId === option.id && draft.look != null;
                update({ breedId: option.id, look: keepLook ? draft.look : defaultLook(option), step: 'look' });
              }}
            />
          ))}
        </View>
      ) : null}

      {step === 'look' && breed && draft.look ? (
        <View style={styles.stack}>
          <BackButton onPress={() => update({ step: 'breed' })} />
          <LookPicker breed={breed} look={draft.look} onChange={(look) => update({ look })} />
          <Pressable style={styles.choice} onPress={() => update({ step: 'offers' })}>
            <Text style={styles.choiceLabel}>Continue</Text>
          </Pressable>
        </View>
      ) : null}

      {step === 'offers' && breed ? (
        <View style={styles.stack}>
          <BackButton onPress={() => update({ step: 'look' })} />
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
    fontSize: 16,
    color: '#243044',
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
