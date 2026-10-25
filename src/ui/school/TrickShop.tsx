import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { Lock, Sparkles, X } from 'lucide-react-native';

import { PawCoin } from '../../components/currency/PawCoin';
import { ageAllowsTrick, tricksForSpecies, type TrickListing } from '../../sim/tricks';
import type { PetState, Trait } from '../../sim/types';
import { CandyShell, GRAY, WHITE, candyInk, tints } from '../candy';
import { TrickDemo } from './TrickDemo';

const traitLabel: Record<Trait, string> = {
  stamina: 'Stamina',
  agility: 'Agility',
  intelligence: 'Intelligence',
  boldness: 'Boldness',
  affection: 'Affection',
  obedience: 'Obedience',
};

type Props = {
  pet: PetState;
  species: 'dog' | 'cat';
  balance: number;
  reducedMotion: boolean;
  onBuy: (trick: TrickListing) => void;
};

export function TrickShop({ pet, species, balance, reducedMotion, onBuy }: Props) {
  const tricks = tricksForSpecies(species);
  const [open, setOpen] = useState<TrickListing | null>(null);
  const spin = useSharedValue(0);
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Trick Shop</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {tricks.map((trick) => {
          const owned = pet.training[trick.id];
          const locked = !ageAllowsTrick(pet.ageDays, trick.minAgeStage);
          const tint = owned || locked ? GRAY : tints.lilac;
          const ink = candyInk(tint);
          const chip = owned?.mastered ? 'Learned ✓' : owned ? 'In Training' : locked ? 'Unlocks at older age' : null;
          return (
            <Pressable key={trick.id} accessibilityRole="button" onPress={() => setOpen(trick)} style={styles.cardHit}>
              <CandyShell tint={tint} radius={22} uid={trick.id.replace(/[^a-zA-Z0-9]/g, '')} style={styles.card}>
                <View style={[styles.bubble, { shadowColor: tint.lip }]}>
                  {locked && !owned ? (
                    <Lock size={22} color={tint.icon} />
                  ) : (
                    <Sparkles size={22} color={tint.icon} />
                  )}
                </View>
                <Text style={[styles.name, { color: ink }]} numberOfLines={1}>
                  {trick.name}
                </Text>
                {chip ? (
                  <Text style={[styles.chip, { color: ink }]} numberOfLines={2}>
                    {chip}
                  </Text>
                ) : (
                  <View style={styles.priceRow}>
                    <PawCoin size={16} spinAngle={spin} shine={false} />
                    <Text style={[styles.price, { color: ink }]}>{trick.priceBoops}</Text>
                  </View>
                )}
              </CandyShell>
            </Pressable>
          );
        })}
      </ScrollView>
      <Modal visible={open != null} transparent animationType={reducedMotion ? 'none' : 'fade'} onRequestClose={() => setOpen(null)}>
        {open ? (
          <Pressable style={styles.scrim} onPress={() => setOpen(null)}>
            <Pressable style={styles.sheet} onPress={() => undefined}>
              <Preview
                trick={open}
                pet={pet}
                species={species}
                balance={balance}
                onClose={() => setOpen(null)}
                onBuy={() => {
                  const trick = open;
                  setOpen(null);
                  onBuy(trick);
                }}
              />
            </Pressable>
          </Pressable>
        ) : null}
      </Modal>
    </View>
  );
}

function Preview({
  trick,
  pet,
  species,
  balance,
  onClose,
  onBuy,
}: {
  trick: TrickListing;
  pet: PetState;
  species: 'dog' | 'cat';
  balance: number;
  onClose: () => void;
  onBuy: () => void;
}) {
  const owned = pet.training[trick.id];
  const locked = !owned && !ageAllowsTrick(pet.ageDays, trick.minAgeStage);
  const affordable = balance >= trick.priceBoops;
  const tint = tints.lilac;
  const ink = candyInk(tint);
  return (
    <CandyShell tint={tint} radius={28} uid="trickpreview" style={styles.preview}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.close}>
        <X size={18} color={ink} />
      </Pressable>
      <TrickDemo species={species} trickId={trick.id} width={240} />
      <Text style={[styles.previewName, { color: ink }]}>{trick.name}</Text>
      {trick.propName ? <Text style={[styles.blurb, { color: ink }]}>Includes a {trick.propName}</Text> : null}
      <Text style={[styles.blurb, { color: ink }]}>{trick.description}</Text>
      <View style={styles.traits}>
        {trick.attributesRaised.map((trait) => (
          <Text key={trait} style={[styles.trait, { color: ink }]}>
            {traitLabel[trait]}
          </Text>
        ))}
      </View>
      {owned ? (
        <Text style={[styles.owned, { color: ink }]}>{owned.mastered ? 'Learned ✓' : 'In Training'}</Text>
      ) : locked ? (
        <Text style={[styles.owned, { color: ink }]}>Unlocks at older age</Text>
      ) : (
        <Pressable
          accessibilityRole="button"
          disabled={!affordable}
          onPress={onBuy}
          style={[styles.buy, !affordable && styles.buyOff]}
        >
          <Text style={styles.buyText}>{affordable ? `Learn for ${trick.priceBoops} Boops` : 'Not enough Boops'}</Text>
        </Pressable>
      )}
    </CandyShell>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, marginBottom: 16 },
  title: { color: '#243044', fontSize: 15, fontWeight: '800',  },
  row: { gap: 12, paddingVertical: 4 },
  cardHit: { width: 132 },
  card: { alignItems: 'center', gap: 6, paddingTop: 12, paddingHorizontal: 10, paddingBottom: 12, minHeight: 148 },
  bubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WHITE,
  },
  name: { fontSize: 14, fontWeight: '900',  },
  chip: { fontSize: 11, fontWeight: '800', textAlign: 'center',  },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  price: { fontSize: 14, fontWeight: '900',  },
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(36, 24, 48, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: { width: '100%', maxWidth: 360 },
  preview: { alignItems: 'center', gap: 8, padding: 18, paddingTop: 36 },
  close: { position: 'absolute', top: 12, right: 12, padding: 6 },
  previewName: { fontSize: 22, fontWeight: '900',  },
  blurb: { fontSize: 15, fontWeight: '700', textAlign: 'center',  },
  traits: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  trait: {
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: '800',
  },
  owned: { fontSize: 16, fontWeight: '900',  },
  buy: {
    alignSelf: 'stretch',
    backgroundColor: tints.lilac.icon,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buyOff: { opacity: 0.45 },
  buyText: { color: WHITE, fontSize: 16, fontWeight: '900',  },
});
