import { StyleSheet, Text, View } from 'react-native';

import type { OwnedItem } from '../actor/closet';
import type { Equipped, OutfitSlot, PetState } from '../sim/types';
import { CandyButton } from '../ui/closet/CandyButton';
import { closet } from '../ui/closet/closetStyle';
import { fontFamily } from '../ui/font';
import { WardrobePicker } from '../ui/WardrobePicker';

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
        <Text accessibilityRole="header" style={styles.title} numberOfLines={1}>
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
        footer={<CandyButton label="Continue" onPress={onClose} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: closet.page,
    paddingTop: 64,
  },
  header: {
    paddingHorizontal: 16,
    minHeight: 52,
    justifyContent: 'center',
  },
  title: {
    color: closet.ink,
    fontSize: 20,
    fontFamily: fontFamily.black,
  },
});
