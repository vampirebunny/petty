import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Canvas, Picture, Skia } from '@shopify/react-native-skia';
import { Pressable } from 'react-native-gesture-handler';

import { breedsFor, spawnActor } from '../actor';
import type { Breed } from '../actor/types';
import type { Facing } from '../actor/data/facing';
import { outfitSlots, wardrobe, type WearItem } from '../actor/wardrobe';
import { useOutfitClock } from '../ui/OutfitPreview';
import { drawActor } from '../ui/skia/pet';
import { theme } from '../ui/theme';
import type { Equipped, OutfitSlot } from '../sim/types';

const stageW = 360;
const stageH = 460;

const ages = [
  { id: 'puppy', label: 'Puppy', days: 0.5 },
  { id: 'adult', label: 'Adult', days: 16 },
  { id: 'senior', label: 'Senior', days: 30 },
] as const;

const poses = [
  { id: 'stand', label: 'Stand' },
  { id: 'walk', label: 'Walk' },
  { id: 'sit', label: 'Sit' },
  { id: 'lie', label: 'Lie' },
  { id: 'belly', label: 'Belly' },
] as const;

const views: { id: string; label: string; octant: Facing; face: 1 | -1 }[] = [
  { id: 'side', label: 'Side', octant: 'E', face: 1 },
  { id: '34', label: '3/4', octant: 'SE', face: 1 },
  { id: 'front', label: 'Front', octant: 'S', face: 1 },
  { id: 'back', label: 'Back', octant: 'W', face: -1 },
];

const gingham: WearItem = {
  id: 'lab-gingham',
  slot: 'neckwear',
  label: 'Gingham Bandana',
  shape: 'bandana',
  colorway: { c: '#E0526A', d: '#FFFFFF', pattern: 'gingham' },
};

const plaidSweater: WearItem = {
  id: 'lab-plaid',
  slot: 'jacket',
  label: 'Plaid Sweater',
  shape: 'sweater',
  colorway: { c: '#C84A4A', d: '#2B3A6B', pattern: 'plaid', parts: { rib: '#F4DEDE' } },
};

const bafflePuffer: WearItem = {
  id: 'lab-baffle',
  slot: 'jacket',
  label: 'Baffle Puffer',
  shape: 'puffer',
  colorway: {
    c: '#FF8CC4',
    baffles: ['#FF8CC4', '#FFB15C', '#FFE16B', '#8FE3A8', '#7EC8F5', '#B9A2F5'],
  },
};

const coloredSole: WearItem = {
  id: 'lab-sole',
  slot: 'boots',
  label: 'Colored Sole',
  shape: 'sneaker',
  colorway: { c: '#f4f4f4', d: '#d64545', parts: { sole: '#112233' } },
};

const samples: Partial<Record<OutfitSlot, WearItem>>[] = [
  { neckwear: gingham, jacket: plaidSweater, boots: coloredSole },
  { neckwear: gingham, jacket: bafflePuffer, boots: coloredSole },
];

type PoseId = (typeof poses)[number]['id'];
type AgeId = (typeof ages)[number]['id'];

type Props = {
  reducedMotion: boolean;
  onClose: () => void;
};

function darkBreed(breed: Breed): Breed {
  return { ...breed, coat: '#1b1512', baseRule: undefined };
}

export function ClothingLab({ reducedMotion, onClose }: Props) {
  const t = useOutfitClock(reducedMotion);
  const [species, setSpecies] = useState<'dog' | 'cat'>('dog');
  const [breedId, setBreedId] = useState('retriever');
  const [equipped, setEquipped] = useState<Equipped>({});
  const [sample, setSample] = useState<number | null>(null);
  const [age, setAge] = useState<AgeId>('adult');
  const [pose, setPose] = useState<PoseId>('stand');
  const [viewId, setViewId] = useState('side');
  const [dark, setDark] = useState(false);

  const breeds = breedsFor(species);
  const breed = breeds.find((entry) => entry.id === breedId) ?? breeds[0];
  const wearDefs = sample == null ? undefined : samples[sample];
  const view = views.find((entry) => entry.id === viewId) ?? views[0];
  const ageDays = ages.find((entry) => entry.id === age)?.days ?? 16;

  const picture = (() => {
    const recorder = Skia.PictureRecorder();
    const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, stageW, stageH));
    canvas.clear(Skia.Color('#f4efe6'));
    if (!breed) {
      return recorder.finishRecordingAsPicture();
    }
    const actor = spawnActor(
      {
        id: 'clothing-lab',
        breedId: breed.id,
        ageDays,
        weight: 0,
        vitality: 1,
        equipped,
        wearDefs,
        asleep: false,
        seed: 2,
      },
      { x: stageW / 2, y: stageH * 0.62 },
    );
    actor.octant = view.octant;
    actor.octantFrom = view.octant;
    actor.octantTarget = view.octant;
    actor.octantBlend = 1;
    actor.face = view.face;
    actor.blinkT = 2;
    actor.pose.sit = pose === 'sit' ? 1 : 0;
    actor.pose.lie = pose === 'lie' || pose === 'belly' ? 1 : 0;
    actor.pose.belly = pose === 'belly' ? 1 : 0;
    actor.pose.walk = pose === 'walk' ? 1 : 0;
    actor.phase = pose === 'walk' ? (reducedMotion ? 1.4 : t * 5) : 0;
    actor.speed = pose === 'walk' ? 40 : 0;
    drawActor(canvas, actor, dark ? darkBreed(breed) : breed, { yMin: 0, yMax: stageH }, t, null, false, reducedMotion);
    return recorder.finishRecordingAsPicture();
  })();

  const pickSlot = (slot: OutfitSlot, id: string | undefined) => {
    setSample(null);
    setEquipped((current) => {
      const next = { ...current };
      if (id) {
        next[slot] = id;
      } else {
        delete next[slot];
      }
      return next;
    });
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onClose} style={styles.back}>
          <Text style={styles.backLabel}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Clothing</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Canvas style={styles.stage} pointerEvents="none">
          <Picture picture={picture} />
        </Canvas>
        <ChipRow
          label="Species"
          chips={[
            { id: 'dog', label: 'Dog' },
            { id: 'cat', label: 'Cat' },
          ]}
          selected={species}
          onSelect={(id) => {
            const next = id === 'cat' ? 'cat' : 'dog';
            setSpecies(next);
            const nextBreeds = breedsFor(next);
            if (!nextBreeds.some((entry) => entry.id === breedId)) {
              setBreedId(nextBreeds[0]?.id ?? breedId);
            }
          }}
        />
        <ChipRow
          label="Breed"
          chips={breeds.map((entry) => ({ id: entry.id, label: entry.name }))}
          selected={breed?.id ?? ''}
          onSelect={setBreedId}
        />
        {outfitSlots.map((slot) => (
          <ChipRow
            key={slot}
            label={wardrobe[slot].label}
            chips={[{ id: 'none', label: 'None' }, ...wardrobe[slot].items.map((item) => ({ id: item.id, label: item.label }))]}
            selected={wearDefs?.[slot] ? '' : (equipped[slot] ?? 'none')}
            onSelect={(id) => pickSlot(slot, id === 'none' ? undefined : id)}
          />
        ))}
        <ChipRow label="Age" chips={ages.map((entry) => ({ id: entry.id, label: entry.label }))} selected={age} onSelect={(id) => setAge(id as AgeId)} />
        <ChipRow label="Pose" chips={poses.map((entry) => ({ id: entry.id, label: entry.label }))} selected={pose} onSelect={(id) => setPose(id as PoseId)} />
        <ChipRow label="View" chips={views.map((entry) => ({ id: entry.id, label: entry.label }))} selected={viewId} onSelect={setViewId} />
        <ChipRow
          label="Coat"
          chips={[
            { id: 'breed', label: 'Breed' },
            { id: 'dark', label: 'Dark' },
          ]}
          selected={dark ? 'dark' : 'breed'}
          onSelect={(id) => setDark(id === 'dark')}
        />
        <Pressable
          accessibilityRole="button"
          style={[styles.sample, sample != null && styles.sampleOn]}
          onPress={() => setSample((current) => (current == null ? 0 : (current + 1) % samples.length))}
        >
          <Text style={[styles.sampleLabel, sample != null && styles.sampleLabelOn]}>
            {sample == null ? 'Parts sample' : sample === 0 ? 'Parts: solid rib' : 'Parts: baffles'}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function ChipRow({
  label,
  chips,
  selected,
  onSelect,
}: {
  label: string;
  chips: { id: string; label: string }[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {chips.map((chip) => {
          const on = chip.id === selected;
          return (
            <Pressable key={chip.id} style={[styles.chip, on && styles.chipOn]} onPress={() => onSelect(chip.id)}>
              <Text style={[styles.chipLabel, on && styles.chipLabelOn]}>{chip.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.surface },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 8 },
  back: { paddingVertical: 8, paddingRight: 12 },
  backLabel: { color: theme.ink, fontSize: 16 },
  title: { color: theme.ink, fontSize: 20, fontWeight: '700' },
  scroll: { padding: 16, gap: 12, paddingBottom: 40 },
  stage: { width: stageW, height: stageH, borderRadius: 16, overflow: 'hidden', alignSelf: 'center' },
  row: { gap: 6 },
  rowLabel: { color: theme.ink, fontSize: 13, fontWeight: '700' },
  chips: { gap: 8, paddingRight: 8 },
  chip: { backgroundColor: '#E4E8EF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  chipOn: { backgroundColor: '#2f7d5b' },
  chipLabel: { fontSize: 13, color: '#243044' },
  chipLabelOn: { color: '#ffffff' },
  sample: { alignSelf: 'flex-start', backgroundColor: '#E4E8EF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  sampleOn: { backgroundColor: '#2f7d5b' },
  sampleLabel: { fontSize: 13, color: '#243044' },
  sampleLabelOn: { color: '#ffffff' },
});
