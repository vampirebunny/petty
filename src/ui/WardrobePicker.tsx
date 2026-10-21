import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

import type { OwnedItem } from '../actor/closet';
import { outfitSlots, wearItem } from '../actor/wardrobe';
import type { Equipped, OutfitSlot } from '../sim/types';
import { ClosetSection } from './closet/ClosetSection';
import { closet } from './closet/closetStyle';
import { fontFamily } from './font';
import { OutfitPreview, outfitPoses, useOutfitClock, type OutfitPose, type OutfitSubject } from './OutfitPreview';
import { minTouch, theme } from './theme';

type Props = {
  subject: OutfitSubject;
  owned: readonly OwnedItem[];
  equipped: Equipped;
  onEquip: (slot: OutfitSlot, itemId: string | null) => void;
  reducedMotion: boolean;
  footer?: ReactNode;
};

export function PoseChips({ pose, onPose }: { pose: OutfitPose; onPose: (pose: OutfitPose) => void }) {
  return (
    <View style={styles.poses}>
      {outfitPoses.map((entry) => (
        <Pressable
          key={entry}
          accessibilityRole="button"
          accessibilityLabel={`Pose ${entry}`}
          accessibilityState={{ selected: pose === entry }}
          onPress={() => onPose(entry)}
          style={[styles.pose, pose === entry && styles.poseSelected]}
        >
          <Text style={[styles.poseLabel, pose === entry && styles.poseSelectedLabel]}>{entry}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function bump() {
  void Haptics.selectionAsync();
}

export function WardrobePicker({ subject, owned, equipped, onEquip, reducedMotion, footer }: Props) {
  const t = useOutfitClock(reducedMotion);
  const { width } = useWindowDimensions();
  const previewW = Math.min(420, width - 32);
  const previewH = 260;
  const wornLabels = outfitSlots.flatMap((slot) => {
    const label = wearItem(slot, equipped[slot])?.label;
    return label ? [label] : [];
  });

  const equip = (slot: OutfitSlot, itemId: string | null) => {
    onEquip(slot, itemId);
    bump();
  };

  return (
    <View style={styles.root}>
      <View style={styles.sticky}>
        <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <OutfitPreview {...subject} equipped={equipped} width={previewW} height={previewH} t={t} pose="sit" bare />
        </View>
        <View style={styles.status}>
          <Text style={styles.statusText} numberOfLines={2}>
            {wornLabels.length > 0 ? `Wearing: ${wornLabels.join(', ')}` : 'Nothing on yet. Tap something to try it on.'}
          </Text>
        </View>
        {wornLabels.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Take it all off"
            onPress={() => {
              for (const slot of outfitSlots) {
                if (wearItem(slot, equipped[slot])) {
                  onEquip(slot, null);
                }
              }
              bump();
            }}
            style={styles.clear}
          >
            <Text style={styles.clearLabel}>Take it all off</Text>
          </Pressable>
        ) : null}
        {footer}
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {outfitSlots.map((slot) => (
          <ClosetSection
            key={slot}
            slot={slot}
            wornId={equipped[slot]}
            reducedMotion={reducedMotion}
            items={owned.flatMap((item) => {
              if (item.slot !== slot) {
                return [];
              }
              const wear = wearItem(slot, item.id);
              return wear ? [wear] : [];
            })}
            onPress={(itemId, worn) => equip(slot, worn ? null : itemId)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: closet.page,
  },
  sticky: {
    alignItems: 'center',
    gap: 8,
    paddingBottom: 12,
    backgroundColor: closet.page,
  },
  status: {
    alignSelf: 'stretch',
    minHeight: 44,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  statusText: {
    color: closet.status.text,
    fontSize: 13,
    fontFamily: fontFamily.bold,
  },
  clear: {
    alignSelf: 'flex-start',
    marginHorizontal: 16,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: closet.status.buttonBg,
    borderWidth: 2,
    borderColor: closet.status.buttonBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearLabel: {
    color: closet.status.text,
    fontSize: 13,
    fontFamily: fontFamily.extraBold,
  },
  scroll: {
    flex: 1,
    backgroundColor: closet.scroll.bg,
    borderTopWidth: 6,
    borderTopColor: closet.scroll.topBorder,
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 32,
    gap: 14,
  },
  poses: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 8,
  },
  pose: {
    minWidth: 64,
    minHeight: minTouch,
    borderRadius: 8,
    paddingHorizontal: 10,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  poseSelected: {
    backgroundColor: theme.accentDark,
  },
  poseLabel: {
    color: theme.ink,
    fontSize: 14,
  },
  poseSelectedLabel: {
    color: '#fff',
  },
});
