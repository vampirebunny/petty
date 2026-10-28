import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Canvas, Picture, Skia } from '@shopify/react-native-skia';
import type { SkPicture } from '@shopify/react-native-skia';
import { Pressable } from 'react-native-gesture-handler';

import { breedsFor, coatStyles, spawnActor } from '../actor';
import type { Breed } from '../actor/types';
import type { Facing } from '../actor/data/facing';
import type { WearItem } from '../actor/wardrobe';
import type { OutfitSlot } from '../sim/types';
import { useContentWidth } from '../ui/PhoneColumn';
import { drawActor } from '../ui/skia/pet';
import { theme } from '../ui/theme';

type Generated = WearItem & { theme: string };

type PoseId = 'side' | 'sit' | 'three';

type WarningRow = { id: string };

const poses: { id: PoseId; label: string; octant: Facing; sit: number }[] = [
  { id: 'side', label: 'Side', octant: 'E', sit: 0 },
  { id: 'sit', label: 'Sit', octant: 'E', sit: 1 },
  { id: 'three', label: '3/4', octant: 'SE', sit: 0 },
];

const coatIds = ['cream', 'gold', 'ginger', 'midnight'] as const;

const stageW = 112;
const stageH = 148;

function loadSheet(): { items: Generated[]; warnings: Set<string> } {
  if (typeof __DEV__ === 'undefined' || !__DEV__) {
    return { items: [], warnings: new Set() };
  }
  const items = require('../../tools/colorways/generated/colorways.json') as Generated[];
  const rows = require('../../tools/colorways/generated/warnings.json') as WarningRow[];
  return { items, warnings: new Set(rows.map((row) => row.id)) };
}

const sheet = loadSheet();

function coatHex(id: string): string {
  const style = coatStyles.dog.find((entry) => entry.id === id) ?? coatStyles.cat.find((entry) => entry.id === id);
  return style?.coat ?? '#f1ece4';
}

function withCoat(breed: Breed, coat: string): Breed {
  return { ...breed, coat, baseRule: undefined };
}

function shot(item: WearItem, breed: Breed, pose: (typeof poses)[number]): SkPicture {
  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, stageW, stageH));
  canvas.clear(Skia.Color('#f4efe6'));
  const actor = spawnActor(
    {
      id: item.id,
      breedId: breed.id,
      ageDays: 16,
      weight: 0,
      vitality: 1,
      equipped: { [item.slot]: item.id },
      wearDefs: { [item.slot]: item },
      asleep: false,
      seed: 2,
    },
    { x: stageW / 2, y: stageH * 0.72 },
  );
  actor.octant = pose.octant;
  actor.octantFrom = pose.octant;
  actor.octantTarget = pose.octant;
  actor.octantBlend = 1;
  actor.face = 1;
  actor.blinkT = 2;
  actor.pose.sit = pose.sit;
  drawActor(canvas, actor, breed, { yMin: 0, yMax: stageH }, 0, null, false, true);
  return recorder.finishRecordingAsPicture();
}

function Cell({
  item,
  breed,
  pose,
  coats,
  warned,
  width,
}: {
  item: Generated;
  breed: Breed;
  pose: (typeof poses)[number];
  coats: boolean;
  warned: boolean;
  width: number;
}) {
  const pictures = useMemo(() => {
    if (!coats) {
      return [shot(item, breed, pose)];
    }
    return coatIds.map((id) => shot(item, withCoat(breed, coatHex(id)), pose));
  }, [breed, coats, item, pose]);
  return (
    <View style={[styles.cell, { width }]}>
      <View style={styles.pets}>
        {pictures.map((picture, index) => (
          <Canvas key={coatIds[index] ?? 'one'} style={styles.stage} pointerEvents="none">
            <Picture picture={picture} />
          </Canvas>
        ))}
      </View>
      <View style={styles.caption}>
        {warned ? <View style={styles.dot} /> : null}
        <Text numberOfLines={2} style={styles.captionText}>
          {item.id}
        </Text>
      </View>
    </View>
  );
}

export function ColorwaySheet({ onClose }: { onClose: () => void }) {
  const { width: windowWidth } = useWindowDimensions();
  const contentWidth = useContentWidth();
  const width = Math.min(windowWidth, contentWidth);
  const [species, setSpecies] = useState<'dog' | 'cat'>('dog');
  const [slot, setSlot] = useState<OutfitSlot | 'all'>('all');
  const [themeId, setThemeId] = useState('all');
  const [poseId, setPoseId] = useState<PoseId>('side');
  const [coats, setCoats] = useState(false);

  const breed = breedsFor(species)[0];
  const pose = poses.find((entry) => entry.id === poseId) ?? poses[0];
  const themes = useMemo(() => [...new Set(sheet.items.map((item) => item.theme))], []);
  const slots = useMemo(() => [...new Set(sheet.items.map((item) => item.slot))], []);
  const visible = sheet.items.filter((item) => (slot === 'all' || item.slot === slot) && (themeId === 'all' || item.theme === themeId));
  const columns = coats ? (width >= 900 ? 2 : 1) : width >= 900 ? 4 : width >= 700 ? 3 : 2;
  const cellWidth = Math.floor((width - 24) / columns);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onClose} style={styles.back}>
          <Text style={styles.backLabel}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Colorways</Text>
        <Text style={styles.count}>{visible.length}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ChipRow
          label="Species"
          chips={[
            { id: 'dog', label: 'Dog' },
            { id: 'cat', label: 'Cat' },
          ]}
          selected={species}
          onSelect={(id) => setSpecies(id === 'cat' ? 'cat' : 'dog')}
        />
        <ChipRow
          label="Slot"
          chips={[{ id: 'all', label: 'All' }, ...slots.map((id) => ({ id, label: id }))]}
          selected={slot}
          onSelect={(id) => setSlot(id as OutfitSlot | 'all')}
        />
        <ChipRow
          label="Theme"
          chips={[{ id: 'all', label: 'All' }, ...themes.map((id) => ({ id, label: id }))]}
          selected={themeId}
          onSelect={setThemeId}
        />
        <ChipRow
          label="Pose"
          chips={poses.map((entry) => ({ id: entry.id, label: entry.label }))}
          selected={poseId}
          onSelect={(id) => setPoseId(id as PoseId)}
        />
        <Pressable accessibilityRole="button" style={[styles.coats, coats && styles.coatsOn]} onPress={() => setCoats((current) => !current)}>
          <Text style={[styles.coatsLabel, coats && styles.coatsLabelOn]}>Coats</Text>
        </Pressable>
        {breed ? (
          <View style={styles.grid}>
            {visible.map((item) => (
              <Cell
                key={item.id}
                item={item}
                breed={breed}
                pose={pose}
                coats={coats}
                warned={sheet.warnings.has(item.id)}
                width={cellWidth}
              />
            ))}
          </View>
        ) : null}
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
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  back: { paddingVertical: 8, paddingRight: 4 },
  backLabel: { color: theme.ink, fontSize: 16 },
  title: { color: theme.ink, fontSize: 20, fontWeight: '700', flex: 1 },
  count: { color: theme.ink, fontSize: 14 },
  scroll: { padding: 12, gap: 12, paddingBottom: 48 },
  row: { gap: 6 },
  rowLabel: { color: theme.ink, fontSize: 13, fontWeight: '700' },
  chips: { gap: 8, paddingRight: 8 },
  chip: { backgroundColor: '#E4E8EF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  chipOn: { backgroundColor: '#2f7d5b' },
  chipLabel: { fontSize: 13, color: '#243044' },
  chipLabelOn: { color: '#ffffff' },
  coats: { alignSelf: 'flex-start', backgroundColor: '#E4E8EF', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  coatsOn: { backgroundColor: '#2f7d5b' },
  coatsLabel: { fontSize: 13, color: '#243044', fontWeight: '700' },
  coatsLabelOn: { color: '#ffffff' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { padding: 4, gap: 4 },
  pets: { flexDirection: 'row' },
  stage: { width: stageW, height: stageH, borderRadius: 12, overflow: 'hidden' },
  caption: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#d64545' },
  captionText: { flex: 1, fontSize: 11, color: theme.ink },
});
