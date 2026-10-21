import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Canvas, Picture, Skia } from '@shopify/react-native-skia';
import { Pressable } from 'react-native-gesture-handler';

import { breedById, spawnActor } from '../actor';
import { facingRing } from '../actor/data/facing';
import { drawActor } from '../ui/skia/pet';
import { RangeControl } from '../ui/DebugPanel';
import { useOutfitClock } from '../ui/OutfitPreview';
import { theme } from '../ui/theme';

const breeds = ['husky', 'pug', 'retriever', 'persian', 'siamese'] as const;
const ages = [
  { label: 'Puppy', days: 0.5 },
  { label: 'Adult', days: 16 },
];
const strides = [
  { label: 'Stand', phase: 0, walk: 0 },
  { label: 'Stride', phase: 1.4, walk: 1 },
];

const cellW = 78;
const cellH = 96;

type Props = {
  reducedMotion: boolean;
  onClose: () => void;
};

export function FacingLab({ reducedMotion, onClose }: Props) {
  const t = useOutfitClock(reducedMotion);
  const [theta, setTheta] = useState(0);
  const rows = breeds.length * ages.length * strides.length;
  const gridW = facingRing.length * cellW;
  const gridH = rows * cellH;

  const grid = useMemo(() => {
    const recorder = Skia.PictureRecorder();
    const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, gridW, gridH));
    canvas.clear(Skia.Color('#f4efe6'));
    const floor = { yMin: 0, yMax: gridH };
    let row = 0;
    for (const breedId of breeds) {
      const breed = breedById(breedId);
      if (!breed) {
        continue;
      }
      for (const age of ages) {
        for (const stride of strides) {
          facingRing.forEach((octant, col) => {
            const actor = spawnActor(
              { id: `${breedId}-${octant}`, breedId, ageDays: age.days, weight: 0, vitality: 1, equipped: {}, asleep: false, seed: 2 },
              { x: col * cellW + cellW / 2, y: row * cellH + cellH * 0.78 },
            );
            actor.octant = octant;
            actor.octantFrom = octant;
            actor.octantTarget = octant;
            actor.octantBlend = 1;
            actor.face = octant === 'W' || octant === 'NW' || octant === 'SW' ? -1 : 1;
            actor.phase = stride.phase;
            actor.pose.walk = stride.walk;
            actor.speed = stride.walk > 0 ? 40 : 0;
            actor.blinkT = 2;
            drawActor(canvas, actor, breed, floor, t, null);
          });
          row += 1;
        }
      }
    }
    return recorder.finishRecordingAsPicture();
  }, [gridH, gridW, t]);

  const slider = useMemo(() => {
    const width = 280;
    const height = 220;
    const recorder = Skia.PictureRecorder();
    const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, width, height));
    canvas.clear(Skia.Color('#efe6d6'));
    const breed = breedById('husky');
    if (breed) {
      const actor = spawnActor(
        { id: 'theta', breedId: 'husky', ageDays: 16, weight: 0, vitality: 1, equipped: {}, asleep: false, seed: 3 },
        { x: width / 2, y: height * 0.72 },
      );
      actor.debugTheta = (theta * Math.PI) / 180;
      actor.phase = reducedMotion ? 1.2 : t * 5;
      actor.pose.walk = 1;
      actor.speed = 48;
      actor.blinkT = 2;
      drawActor(canvas, actor, breed, { yMin: 0, yMax: height }, t, 'ball');
    }
    return recorder.finishRecordingAsPicture();
  }, [reducedMotion, t, theta]);

  useEffect(() => {
    return () => {
      grid.dispose();
      slider.dispose();
    };
  }, [grid, slider]);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onClose} style={styles.back}>
          <Text style={styles.backLabel}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Facing</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.note}>Columns are E SE S SW W NW N NE. Each breed is puppy then adult, standing then mid-stride.</Text>
        <Canvas style={{ width: gridW, height: gridH }} pointerEvents="none">
          <Picture picture={grid} />
        </Canvas>
        <Text style={styles.note}>Theta {Math.round(theta)}°. The husky walks in place. The ball stays at the mouth.</Text>
        <Canvas style={styles.slider} pointerEvents="none">
          <Picture picture={slider} />
        </Canvas>
        <RangeControl label="Theta" min={0} max={360} value={theta} onChange={setTheta} />
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
  scroll: { padding: 16, gap: 12 },
  note: { color: theme.ink, fontSize: 13 },
  slider: { width: 280, height: 220, borderRadius: 16, overflow: 'hidden' },
});
