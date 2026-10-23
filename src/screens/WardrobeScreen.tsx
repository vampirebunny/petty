import { Image, StyleSheet, Text, View } from 'react-native';

import type { OwnedItem } from '../actor/closet';
import type { Equipped, OutfitSlot, PetState } from '../sim/types';
import { BoopCounter } from '../ui/BoopCounter';
import { useOpenedDuoBoopEdge, useOpenedDuoTopInset } from '../ui/useDeviceOrientation';
import { CandyButton } from '../ui/closet/CandyButton';
import { closet } from '../ui/closet/closetStyle';
import { fontFamily } from '../ui/font';
import { WardrobePicker } from '../ui/WardrobePicker';

type Props = {
  pet: PetState;
  owned: readonly OwnedItem[];
  equipped: Equipped;
  boops: number;
  onEquip: (slot: OutfitSlot, itemId: string | null) => void;
  onClose: () => void;
  onOpenStore: () => void;
  reducedMotion: boolean;
  title?: string;
};

export function WardrobeScreen({
  pet,
  owned,
  equipped,
  boops,
  onEquip,
  onClose,
  onOpenStore,
  reducedMotion,
  title,
}: Props) {
  const duoTop = useOpenedDuoTopInset();
  const boopEdge = useOpenedDuoBoopEdge();
  return (
    <View style={[styles.root, { paddingTop: 64 + duoTop }]}>
      <View style={styles.header}>
        <Image
          source={require('../../assets/icon.png')}
          style={styles.logo}
          accessibilityLabel="Boop Boop"
          accessibilityIgnoresInvertColors
        />
        <Text
          accessibilityRole="header"
          pointerEvents="none"
          style={[styles.title, boopEdge > 16 ? { marginRight: 132 + (boopEdge - 16) } : null]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
        >
          {title ?? `${pet.name}'s wardrobe`}
        </Text>
        <BoopCounter value={boops} payoutActive={false} pending={0} fromEdge={boopEdge} onPress={onOpenStore} />
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
    height: 52,
    justifyContent: 'center',
  },
  logo: {
    position: 'absolute',
    left: 20,
    top: 2,
    width: 48,
    height: 48,
    borderRadius: 12,
  },
  title: {
    textAlign: 'center',
    // Clears the logo on the left and the Boop total on the right.
    marginLeft: 76,
    marginRight: 132,
    color: closet.ink,
    fontSize: 20,
    fontFamily: fontFamily.black,
  },
});
