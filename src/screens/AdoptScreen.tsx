import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { cleanName, nameLimit } from '../adopt/name';
import { breedsFor } from '../actor/breeds';
import type { Species } from '../actor/types';
import { createLitter } from '../sim';
import { traits } from '../sim';
import type { LitterMate, Trait, Variant } from '../sim';
import { loadDraft, saveDraft } from '../storage/session';

type Props = {
  onAdopt: (seed: number, breedId: string, variant: Variant, name: string) => void;
};

type Step = 'species' | 'breed' | 'litter' | 'name';

const traitLabel: Record<Trait, string> = {
  stamina: 'Stamina',
  agility: 'Agility',
  intelligence: 'Intelligence',
  boldness: 'Boldness',
  affection: 'Affection',
  obedience: 'Obedience',
};

function scoreLine(mate: LitterMate, trait: Trait): string {
  return `${traitLabel[trait]} ${mate.current[trait]} / ${mate.potential[trait]}`;
}

export function AdoptScreen({ onAdopt }: Props) {
  const [step, setStep] = useState<Step>('species');
  const [species, setSpecies] = useState<Species>('dog');
  const [seed, setSeed] = useState<number | null>(null);
  const [breedId, setBreedId] = useState<string | null>(null);
  const [variant, setVariant] = useState<Variant | null>(null);
  const [name, setName] = useState('');

  useEffect(() => {
    let cancelled = false;
    void loadDraft().then((draft) => {
      if (cancelled) {
        return;
      }
      if (draft) {
        setSeed(draft.seed);
        setBreedId(draft.breedId);
        setStep('litter');
        return;
      }
      setSeed(Math.floor(Math.random() * 1_000_000_000));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (seed == null) {
    return (
      <View style={styles.screen}>
        <Text style={styles.title}>Boop Boop</Text>
      </View>
    );
  }

  const litter = breedId ? createLitter(seed, breedId) : [];
  const chosen = variant == null ? null : litter[variant];
  const readyName = cleanName(name);

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.title}>{step === 'name' ? 'Name' : 'Adopt'}</Text>
      {step === 'species' ? (
        <View style={styles.stack}>
          <Text style={styles.body}>Choose a species.</Text>
          <Pressable
            style={styles.choice}
            onPress={() => {
              setSpecies('dog');
              setStep('breed');
            }}
          >
            <Text style={styles.choiceLabel}>Dog</Text>
          </Pressable>
          <Pressable
            style={styles.choice}
            onPress={() => {
              setSpecies('cat');
              setStep('breed');
            }}
          >
            <Text style={styles.choiceLabel}>Cat</Text>
          </Pressable>
        </View>
      ) : null}
      {step === 'breed' ? (
        <View style={styles.stack}>
          {breedsFor(species).map((breed) => (
            <Pressable
              key={breed.id}
              style={styles.choice}
              onPress={() => {
                setBreedId(breed.id);
                void saveDraft({ seed, breedId: breed.id });
                setStep('litter');
              }}
            >
              <Text style={styles.choiceLabel}>{breed.name}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {step === 'litter' && breedId ? (
        <View style={styles.stack}>
          {litter.map((mate) => (
            <Pressable
              key={mate.variant}
              style={styles.card}
              onPress={() => {
                setVariant(mate.variant);
                setStep('name');
              }}
            >
              <Text style={styles.cardTitle}>{mate.temperament.label}</Text>
              <Text style={styles.meta}>
                {traitLabel[mate.temperament.boosts]} up, {traitLabel[mate.temperament.dampens]} down
              </Text>
              {traits.map((trait) => (
                <Text key={trait} style={styles.meta}>
                  {scoreLine(mate, trait)}
                </Text>
              ))}
            </Pressable>
          ))}
        </View>
      ) : null}
      {step === 'name' && chosen ? (
        <View style={styles.stack}>
          <Text style={styles.body}>{chosen.temperament.label}</Text>
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
              if (readyName && breedId && variant != null) {
                onAdopt(seed, breedId, variant, readyName);
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
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    gap: 4,
  },
  cardTitle: {
    fontSize: 18,
    color: '#243044',
  },
  meta: {
    fontSize: 14,
    color: '#5C6B80',
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
