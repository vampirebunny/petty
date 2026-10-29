import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

import { readShopPreviewTip, setShopPreviewTip } from '../../db/accountMeta';
import type { TrickListing } from '../../sim/tricks';
import { trackDef } from '../../sim/tracks';
import type { PetState } from '../../sim/types';
import { fontFamily } from '../font';
import { ground, ink, secondary, white } from './gloss';
import { InTrainingList } from './InTrainingList';
import { LocationPill } from './LocationPill';
import { TrickShop } from './TrickShop';

type Segment = 'training' | 'shop';

type Tip = { id: string; name: string; propName: string | null };

type Props = {
  pet: PetState;
  species: 'dog' | 'cat';
  balance: number;
  ownerId: string;
  ownedPropTypes: string[];
  now: number;
  reducedMotion: boolean;
  disabled: boolean;
  highlightId?: string | null;
  tip?: Tip | null;
  onTrain: (id: string) => void;
  onPerform: (id: string) => void;
  onProps?: () => void;
  onDismissTip: () => void;
  onBuy: (trick: TrickListing) => void;
  onShop: () => void;
  onLeave: () => void;
  pulseLeave?: boolean;
};

export type SchoolControlsHandle = {
  showTraining: () => void;
};

export const SchoolControls = forwardRef<SchoolControlsHandle, Props>(function SchoolControls(
  {
    pet,
    species,
    balance,
    ownerId,
    ownedPropTypes,
    now,
    reducedMotion,
    disabled,
    highlightId,
    tip,
    onTrain,
    onPerform,
    onProps,
    onDismissTip,
    onBuy,
    onShop,
    onLeave,
    pulseLeave,
  },
  ref,
) {
  const scroll = useRef<ScrollView>(null);
  const shopY = useRef(0);
  const driving = useRef(false);
  const driveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewKnown = useRef(readShopPreviewTip());
  const [segment, setSegment] = useState<Segment>('training');
  const [previewTip, setPreviewTip] = useState(false);
  const trainingCount = Object.values(pet.training).filter((track) => {
    if (track.mastered) {
      return false;
    }
    const def = trackDef(track.id);
    return Boolean(def && def.species.includes(species));
  }).length;

  const beginDrive = () => {
    driving.current = true;
    if (driveTimer.current) {
      clearTimeout(driveTimer.current);
    }
    driveTimer.current = setTimeout(() => {
      driving.current = false;
    }, 500);
  };
  const endDrive = () => {
    driving.current = false;
    if (driveTimer.current) {
      clearTimeout(driveTimer.current);
      driveTimer.current = null;
    }
  };

  useImperativeHandle(ref, () => ({
    showTraining() {
      beginDrive();
      setSegment('training');
      scroll.current?.scrollTo({ y: 0, animated: true });
    },
  }));

  const noteShop = () => {
    if (previewKnown.current) {
      return;
    }
    previewKnown.current = true;
    setShopPreviewTip();
    setPreviewTip(true);
  };

  const show = (next: Segment) => {
    beginDrive();
    setSegment(next);
    const y = next === 'training' ? 0 : Math.max(0, shopY.current);
    scroll.current?.scrollTo({ y, animated: true });
    if (next === 'shop' && shopY.current > 0) {
      noteShop();
    }
  };

  return (
    <View style={styles.panel}>
      <LocationPill onLeave={onLeave} pulse={pulseLeave} reducedMotion={reducedMotion} />
      <View style={styles.track}>
        <SegmentButton label={`In Training · ${trainingCount}`} selected={segment === 'training'} onPress={() => show('training')} />
        <SegmentButton label="Trick Shop" selected={segment === 'shop'} onPress={() => show('shop')} />
      </View>
    <ScrollView
      ref={scroll}
      style={styles.scroll}
      contentContainerStyle={styles.content}
      scrollEventThrottle={16}
      keyboardShouldPersistTaps="handled"
      onScroll={(event) => {
        if (driving.current) {
          return;
        }
        const y = event.nativeEvent.contentOffset.y;
        const atShop = shopY.current > 0 && y + 12 >= shopY.current;
        if (atShop) {
          noteShop();
        }
        const next: Segment = atShop ? 'shop' : 'training';
        setSegment((current) => (current === next ? current : next));
      }}
      onMomentumScrollEnd={endDrive}
    >
      <InTrainingList
        pet={pet}
        species={species}
        now={now}
        reducedMotion={reducedMotion}
        disabled={disabled}
        highlightId={highlightId}
        tip={tip}
        onTrain={onTrain}
        onPerform={onPerform}
        onProps={onProps}
        onDismissTip={onDismissTip}
      />
      <View
        onLayout={(event) => {
          shopY.current = event.nativeEvent.layout.y;
        }}
      >
        <TrickShop
          pet={pet}
          species={species}
          balance={balance}
          ownerId={ownerId}
          ownedPropTypes={ownedPropTypes}
          now={now}
          reducedMotion={reducedMotion}
          previewTip={previewTip}
          onDismissPreviewTip={() => setPreviewTip(false)}
          onBuy={onBuy}
          onShop={onShop}
        />
      </View>
    </ScrollView>
    </View>
  );
});

function SegmentButton({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={styles.segmentHit}>
      <View style={[styles.segment, selected ? styles.segmentSelected : null]}>
        <Text style={selected ? styles.segmentOn : styles.segmentOff}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: { flex: 1, backgroundColor: ground, paddingHorizontal: 20, paddingTop: 12, gap: 12 },
  scroll: { flex: 1 },
  content: { paddingBottom: 48, gap: 20 },
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    backgroundColor: '#E7EAF2',
    borderRadius: 22,
    padding: 4,
  },
  segmentHit: { flex: 1, height: 36 },
  segment: { flex: 1, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  segmentSelected: {
    backgroundColor: white,
    shadowColor: '#2B2F4A',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  segmentOn: { fontFamily: fontFamily.fredokaSemibold, fontSize: 14, color: ink },
  segmentOff: { fontFamily: fontFamily.fredokaSemibold, fontSize: 14, color: secondary },
});
