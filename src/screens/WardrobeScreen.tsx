import { useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Shirt } from 'lucide-react-native';

import type { OwnedItem } from '../actor/closet';
import type { Equipped, OutfitSlot, PetState } from '../sim/types';
import { seenDailyOutfitTooltip, setSeenDailyOutfitTooltip } from '../storage/dailyOutfitTip';
import { BoopCounter } from '../ui/BoopCounter';
import { useOpenedDuoBoopEdge, useOpenedDuoTopInset } from '../ui/useDeviceOrientation';
import { CandyButton } from '../ui/closet/CandyButton';
import { CandySwitch } from '../ui/closet/CandySwitch';
import { closet } from '../ui/closet/closetStyle';
import { fontFamily } from '../ui/font';
import { FunModal } from '../ui/FunModal';
import { CandyTooltip } from '../ui/tips/CandyTooltip';
import { WardrobePicker } from '../ui/WardrobePicker';

type Props = {
  pet: PetState;
  owned: readonly OwnedItem[];
  equipped: Equipped;
  boops: number;
  onEquip: (slot: OutfitSlot, itemId: string | null) => void;
  dailyOutfitOn: boolean;
  onDailyOutfit: (on: boolean) => void;
  onPickDailyOutfit: () => void;
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
  dailyOutfitOn,
  onDailyOutfit,
  onPickDailyOutfit,
  onClose,
  onOpenStore,
  reducedMotion,
  title,
}: Props) {
  const duoTop = useOpenedDuoTopInset();
  const boopEdge = useOpenedDuoBoopEdge();
  const rootRef = useRef<View>(null);
  const switchRef = useRef<View>(null);
  const [tipOn, setTipOn] = useState(() => !seenDailyOutfitTooltip());
  const [askToday, setAskToday] = useState(false);
  const [bounds, setBounds] = useState({ width: 0, height: 0 });
  const [tipTarget, setTipTarget] = useState<{ x: number; y: number } | null>(null);

  function placeTip() {
    rootRef.current?.measureInWindow((rx, ry, rw, rh) => {
      switchRef.current?.measureInWindow((sx, sy, sw, sh) => {
        const nextTarget = { x: sx - rx + sw / 2, y: sy - ry + sh / 2 };
        setBounds((current) => (current.width === rw && current.height === rh ? current : { width: rw, height: rh }));
        setTipTarget((current) => (current && current.x === nextTarget.x && current.y === nextTarget.y ? current : nextTarget));
      });
    });
  }

  function dismissTip() {
    setSeenDailyOutfitTooltip(true);
    setTipOn(false);
  }

  function onSwitch() {
    if (dailyOutfitOn) {
      onDailyOutfit(false);
      return;
    }
    onDailyOutfit(true);
    setAskToday(true);
  }

  return (
    <View ref={rootRef} style={[styles.root, { paddingTop: 64 + duoTop }]} onLayout={placeTip}>
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
        footer={
          <View style={styles.footer}>
            <CandyButton label="Continue" onPress={onClose} style={styles.continue} />
            <View ref={switchRef} collapsable={false} onLayout={placeTip} style={styles.toggleWrap}>
              <Pressable
                accessibilityRole="switch"
                accessibilityLabel="Automatically choose a new outfit each day"
                accessibilityState={{ checked: dailyOutfitOn }}
                onPress={onSwitch}
                style={styles.toggle}
              >
                <Text style={styles.toggleLabel}>Automatically choose a new outfit each day</Text>
                <CandySwitch on={dailyOutfitOn} />
              </Pressable>
            </View>
          </View>
        }
      />
      {tipOn ? (
        <Pressable style={styles.tipCatch} onPress={dismissTip} accessibilityLabel="Dismiss tip">
          {tipTarget && bounds.width > 0 ? (
            <CandyTooltip
              flavor="style"
              icon={Shirt}
              text="Want a new look every day? Turn this on!"
              boldWord="every day"
              target={tipTarget}
              bounds={bounds}
              reducedMotion={reducedMotion}
            />
          ) : null}
        </Pressable>
      ) : null}
      {askToday ? (
        <FunModal
          title="Choose today's outfit?"
          body="Yes picks from the closet now. Start tomorrow keeps this look."
          icon={Shirt}
          tint="lilac"
          reducedMotion={reducedMotion}
          primary={{ label: 'Yes', onPress: () => { onPickDailyOutfit(); setAskToday(false); } }}
          secondary={{ label: 'Start tomorrow', onPress: () => setAskToday(false) }}
        />
      ) : null}
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
  footer: {
    alignSelf: 'stretch',
    paddingHorizontal: 16,
  },
  toggleWrap: {
    alignSelf: 'stretch',
  },
  continue: {
    alignSelf: 'stretch',
    marginHorizontal: 0,
  },
  toggle: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
    marginBottom: 4,
  },
  toggleLabel: {
    flex: 1,
    color: closet.ink,
    fontSize: 15,
    lineHeight: 20,
    fontFamily: fontFamily.extraBold,
  },
  tipCatch: {
    ...StyleSheet.absoluteFill,
    zIndex: 40,
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
