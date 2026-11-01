import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { Canvas, Group, Picture } from '@shopify/react-native-skia';
import { X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import type { OwnedItem } from '../actor/closet';
import { outfitSlots, wearItem } from '../actor/wardrobe';
import type { Equipped, OutfitSlot } from '../sim/types';
import { fontFamily } from './font';
import { OutfitPreview, useOutfitClock, type OutfitSubject } from './OutfitPreview';
import { useLimitedContentWidth } from './PhoneColumn';
import { ItemTile } from './refresh/ItemTile';
import { SlotTabs, type ClosetTab } from './refresh/SlotTabs';
import { ui } from './refresh/tokens';
import { ICON_BOX, itemIconPicture } from './skia/itemIcon';
import { isLandscapeSplit } from './wideLayout';

type Props = {
  subject: OutfitSubject;
  owned: readonly OwnedItem[];
  equipped: Equipped;
  onEquip: (slot: OutfitSlot, itemId: string | null) => void;
  reducedMotion: boolean;
  footer?: ReactNode;
  onShop?: () => void;
};

function bump() {
  void Haptics.selectionAsync();
}

export function WardrobePicker({ subject, owned, equipped, onEquip, reducedMotion, footer, onShop }: Props) {
  const t = useOutfitClock(reducedMotion);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const limited = useLimitedContentWidth();
  const split = limited == null && isLandscapeSplit(windowWidth, windowHeight);
  const width = limited ?? windowWidth;
  const previewW = Math.min(420, (split ? windowWidth / 2 : width) - 32);
  const previewH = 236;
  const [tab, setTab] = useState<ClosetTab>('hat');
  const worn = outfitSlots.flatMap((slot) => {
    const item = wearItem(slot, equipped[slot]);
    return item ? [{ slot, item }] : [];
  });
  const wornTabs = new Set(worn.map((row) => row.slot as ClosetTab));
  const items = owned.flatMap((item) => {
    if (item.slot !== tab) {
      return [];
    }
    const wear = wearItem(tab, item.id);
    return wear ? [wear] : [];
  });

  const equip = (slot: OutfitSlot, itemId: string | null) => {
    onEquip(slot, itemId);
    bump();
  };

  const choices = (
    <>
      <SlotTabs value={tab} onChange={setTab} worn={wornTabs} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.grid}>
        {items.map((item) => (
          <ItemTile
            key={item.id}
            label={item.label}
            state={equipped[tab] === item.id ? 'selected' : 'default'}
            reducedMotion={reducedMotion}
            art={
              <Canvas style={styles.icon}>
                <Group transform={[{ scale: 52 / ICON_BOX }]}>
                  <Picture picture={itemIconPicture(tab, item, ui.card)} />
                </Group>
              </Canvas>
            }
            onPress={() => equip(tab, equipped[tab] === item.id ? null : item.id)}
          />
        ))}
        {onShop ? (
          <ItemTile label="Get more" state="shop" reducedMotion={reducedMotion} onPress={onShop} />
        ) : null}
      </ScrollView>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </>
  );

  const stage = (
    <View style={[styles.sticky, split && styles.previewPane]}>
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <OutfitPreview {...subject} equipped={equipped} width={previewW} height={previewH} t={t} pose="sit" />
      </View>
      <View style={styles.chips}>
        {worn.length === 0 ? <Text style={styles.empty}>Tap something to try it on.</Text> : null}
        {worn.map((row) => (
          <Pressable
            key={row.slot}
            accessibilityRole="button"
            accessibilityLabel={`Take off ${row.item.label}`}
            onPress={() => equip(row.slot, null)}
            style={styles.chip}
          >
            <Text style={styles.chipText} numberOfLines={1}>
              {row.item.label}
            </Text>
            <X size={14} color={ui.ink} />
          </Pressable>
        ))}
        {worn.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Take off all"
            onPress={() => {
              for (const row of worn) {
                onEquip(row.slot, null);
              }
              bump();
            }}
          >
            <Text style={styles.takeAll}>Take off all</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  return (
    <View style={[styles.root, split && styles.split]}>
      {stage}
      {split ? <View style={styles.options}>{choices}</View> : choices}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: ui.bg,
  },
  split: {
    flexDirection: 'row',
  },
  sticky: {
    alignItems: 'center',
    gap: 8,
    paddingBottom: 8,
  },
  previewPane: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 10,
    borderRadius: ui.radius.pill,
    backgroundColor: ui.card,
  },
  chipText: {
    maxWidth: 120,
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 13,
    color: ui.ink,
  },
  empty: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    color: ui.inkMuted,
  },
  takeAll: {
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 13,
    color: ui.takeOff,
    minHeight: 44,
    textAlignVertical: 'center',
  },
  options: {
    flex: 1,
    minWidth: 0,
  },
  scroll: {
    flex: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    padding: 16,
  },
  icon: {
    width: 64,
    height: 52,
  },
  footer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
});
