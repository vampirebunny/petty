import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { newSeed } from '../adopt/seed';
import {
  breedById,
  breedsFor,
  coatStylesFor,
  defaultLook,
  eyeColorsFor,
  isCoatStyle,
  lookWithCoat,
} from '../actor';
import type { Breed, Species } from '../actor/types';
import { attributesFor, generateOffers } from '../sim';
import type { Look, PetAttributes } from '../sim';
import type { AuthCredential } from '../compliance/appleCredential';
import { pingAuthHealth } from '../compliance/authHealth';
import { beginRestore } from '../compliance/restoreAccount';
import { getSupabase } from '../compliance/supabase';
import { onAccountFlags, readAccountLinked } from '../db/accountMeta';
import { refreshShopCatalog } from '../economy/shopSync';
import { loadDraft, saveDraft } from '../storage/session';
import type { AdoptionDraft } from '../storage/session';
import { AccountSheet } from '../ui/AccountSheet';
import { CandyShell, candyInk, tints } from '../ui/candy';
import { fontFamily } from '../ui/font';
import { PetPreview } from '../ui/PetPreview';
import { BreedCard } from './adopt/BreedCard';
import { LookPicker } from './adopt/LookPicker';
import { ChooseScreen } from './adopt/ChooseScreen';
import { NameScreen } from './adopt/NameScreen';
import { OnboardingHeader } from './adopt/OnboardingHeader';

type Props = {
  onAdopt: (breedId: string, attributes: PetAttributes, look: Look, name: string) => void;
  onBusyChange?: (busy: boolean) => void;
};

// Keep as much of the previous look as the next breed allows; fill the rest from its defaults.
function lookForBreed(breed: Breed, previous: Look | null): Look {
  const defaults = defaultLook(breed);
  if (!previous) {
    return defaults;
  }
  const style = coatStylesFor(breed).find((candidate) => isCoatStyle(previous, candidate));
  const next = style ? lookWithCoat(defaults, style) : defaults;
  // Keep the eye color only when this breed lets the user pick one.
  if (previous.eyeColor && eyeColorsFor(breed).some((option) => option.color === previous.eyeColor)) {
    next.eyeColor = previous.eyeColor;
  }
  return next;
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

function useExistingAccount(onBusyChange?: (busy: boolean) => void) {
  const [linked, setLinked] = useState(readAccountLinked);
  const [sheet, setSheet] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const ink = candyInk(tints.sky);

  useEffect(() => onAccountFlags(() => setLinked(readAccountLinked())), []);

  const haveAccount = () => {
    if (busy) {
      return;
    }
    setBusy(true);
    setNote(null);
    void (async () => {
      const online = await pingAuthHealth();
      setBusy(false);
      if (!online) {
        setNote("You'll need internet to sign in.");
        return;
      }
      setSheet(true);
    })();
  };

  const signIn = (credential: AuthCredential) => {
    setSheet(false);
    setBusy(true);
    setSigningIn(true);
    setNote(null);
    onBusyChange?.(true);
    void (async () => {
      try {
        const prior = await getSupabase()?.auth.getSession();
        const session = prior?.data.session;
        const restored = await beginRestore({
          credential,
          guestAccessToken: session?.access_token ?? null,
          guestRefreshToken: session?.refresh_token ?? null,
          guestUserId: session?.user.id ?? null,
          sessionReady: false,
        });
        if (!restored.ok) {
          setSigningIn(false);
          if (!('cancelled' in restored)) {
            setNote(restored.message);
          }
        }
      } finally {
        setBusy(false);
        onBusyChange?.(false);
      }
    })();
  };

  const button = linked || signingIn ? null : (
    <>
      <Pressable accessibilityRole="button" disabled={busy} onPress={haveAccount} style={styles.accountHit}>
        {({ pressed }) => (
          <CandyShell tint={tints.sky} radius={22} uid="adopt-account" pressed={pressed} style={styles.account}>
            <Text style={[styles.accountText, { color: ink }]}>I already have an account</Text>
          </CandyShell>
        )}
      </Pressable>
      {note ? <Text style={styles.accountNote}>{note}</Text> : null}
    </>
  );

  const signInSheet = sheet ? (
    <AccountSheet reason="restore" petName="your pet" onClose={() => setSheet(false)} onCredential={signIn} />
  ) : null;

  return { button, signInSheet };
}

export function AdoptScreen({ onAdopt, onBusyChange }: Props) {
  const [draft, setDraft] = useState<AdoptionDraft | null>(null);
  const draftRef = useRef<AdoptionDraft | null>(null);
  const account = useExistingAccount(onBusyChange);

  useEffect(() => {
    void refreshShopCatalog();
  }, []);

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
    return <View style={styles.root} />;
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
          <OnboardingHeader title="Adopt" step={1} />
          {account.button}
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
        {account.signInSheet}
      </View>
    );
  }

  return <View style={styles.root} />;
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
  accountHit: {
    alignSelf: 'stretch',
  },
  account: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountText: {
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 16,
  },
  accountNote: {
    fontSize: 14,
    fontWeight: '700',
    color: '#7A1E44',
    textAlign: 'center',
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 20,
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
