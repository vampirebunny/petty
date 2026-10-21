import { useMemo, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';

import type { OwnedItem } from '../actor/closet';
import { outfitSlots, wardrobe, wearItem } from '../actor/wardrobe';
import type { Equipped, OutfitSlot } from '../sim/types';
import { OutfitPreview, useOutfitClock, type OutfitSubject } from './OutfitPreview';
import { minTouch, theme } from './theme';

type Props = {
  subject: OutfitSubject;
  owned: readonly OwnedItem[];
  equipped: Equipped;
  onEquip: (slot: OutfitSlot, itemId: string | null) => void;
  reducedMotion: boolean;
  footer?: ReactNode;
};

function TilePreview({ subject, slot, itemId, t, width }: { subject: OutfitSubject; slot: OutfitSlot; itemId: string; t: number; width: number }) {
  const equipped = useMemo(() => ({ [slot]: itemId }) as Equipped, [itemId, slot]);
  return <OutfitPreview {...subject} equipped={equipped} width={width} height={128} t={t} zoom={2.8} />;
}

export function WardrobePicker({ subject, owned, equipped, onEquip, reducedMotion, footer }: Props) {
  const t = useOutfitClock(reducedMotion);
  const { width } = useWindowDimensions();
  const previewWidth = Math.min(420, Math.max(260, width - 32));
  const tileWidth = 108;

  return (
    <View style={styles.root}>
      <View style={styles.sticky}>
        <OutfitPreview {...subject} equipped={equipped} width={previewWidth} height={230} t={t} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        {outfitSlots.map((slot) => {
          const worn = equipped[slot];
          const choices = owned.filter((item) => item.slot === slot && wearItem(slot, item.id));
          return (
            <View key={slot} style={styles.section}>
              <Text style={styles.label}>{wardrobe[slot].label}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${wardrobe[slot].label} none`}
                  accessibilityState={{ selected: !worn }}
                  onPress={() => onEquip(slot, null)}
                  style={[styles.none, !worn && styles.selected]}
                >
                  <Text style={[styles.noneLabel, !worn && styles.selectedLabel]}>None</Text>
                </Pressable>
                {choices.map((item) => {
                  const wear = wearItem(slot, item.id);
                  const selected = worn === item.id;
                  return (
                    <Pressable
                      key={`${item.slot}-${item.id}`}
                      accessibilityRole="button"
                      accessibilityLabel={wear?.label ?? item.id}
                      accessibilityState={{ selected }}
                      onPress={() => onEquip(slot, item.id)}
                      style={[styles.tile, selected && styles.selected]}
                    >
                      <TilePreview subject={subject} slot={slot} itemId={item.id} t={t} width={tileWidth} />
                      <Text style={[styles.tileLabel, selected && styles.selectedLabel]} numberOfLines={1}>
                        {wear?.label ?? item.id}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          );
        })}
        {footer}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  sticky: {
    alignItems: 'center',
    paddingBottom: 8,
    backgroundColor: '#F4F7FB',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D0D8E3',
  },
  scroll: {
    padding: 16,
    gap: 16,
    paddingBottom: 32,
  },
  section: {
    gap: 8,
  },
  label: {
    color: theme.ink,
    fontSize: 16,
    fontWeight: '600',
  },
  row: {
    gap: 8,
    alignItems: 'stretch',
  },
  none: {
    width: 72,
    minHeight: minTouch,
    borderRadius: 12,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tile: {
    width: 112,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  selected: {
    borderColor: theme.accentDark,
  },
  noneLabel: {
    color: theme.ink,
    fontSize: 14,
  },
  tileLabel: {
    color: theme.ink,
    fontSize: 12,
    paddingHorizontal: 6,
    paddingBottom: 6,
  },
  selectedLabel: {
    color: theme.accentDark,
    fontWeight: '600',
  },
});
