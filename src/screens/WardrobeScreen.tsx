import { StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';

import type { OwnedItem } from '../actor/closet';
import type { Equipped, OutfitSlot, PetState } from '../sim/types';
import { WardrobePicker } from '../ui/WardrobePicker';
import { minTouch, theme } from '../ui/theme';

type Props = {
  pet: PetState;
  owned: readonly OwnedItem[];
  equipped: Equipped;
  onEquip: (slot: OutfitSlot, itemId: string | null) => void;
  onClose: () => void;
  reducedMotion: boolean;
  title?: string;
};

export function WardrobeScreen({ pet, owned, equipped, onEquip, onClose, reducedMotion, title }: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onClose} style={styles.back}>
          <Text style={styles.backLabel}>Back</Text>
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {title ?? `${pet.name}'s wardrobe`}
        </Text>
      </View>
      <WardrobePicker
        subject={{
          breedId: pet.breedId,
          ageDays: pet.ageDays,
          weight: pet.weight,
          vitality: pet.vitality,
          look: pet.look,
          seed: pet.attributes.seed,
        }}
        owned={owned}
        equipped={equipped}
        onEquip={onEquip}
        reducedMotion={reducedMotion}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F4F7FB',
    paddingTop: 64,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
    minHeight: 52,
  },
  back: {
    minWidth: minTouch,
    minHeight: minTouch,
    justifyContent: 'center',
  },
  backLabel: {
    color: theme.accentDark,
    fontSize: 16,
  },
  title: {
    flex: 1,
    color: theme.ink,
    fontSize: 20,
    fontWeight: '700',
  },
});
