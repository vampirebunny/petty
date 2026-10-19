import { useEffect, useMemo, useState } from 'react';
import { PanResponder, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Canvas, Picture, Skia } from '@shopify/react-native-skia';

import { breedsFor, createWorld, spawnActor, todAt } from '../actor';
import { previewStageHeight } from '../actor/scenes';
import { stageWidth } from '../actor/geometry';
import { previewBackdrop, previewHome, previewScene } from '../actor/previewScene';
import { visualLifespanDays } from '../sim/config';
import type { Look } from '../sim/types';
import type { Breed } from '../actor';
import { drawWorld } from '../ui/skia/world';

// Dev-only: every breed side by side, to check that each one reads on shape and markings alone.
const sameCoat = '#c98a4b';
const cellWidth = 230;
const cellHeight = cellWidth * (previewStageHeight / stageWidth);
const noon = todAt(12);

type View3 = { sameColor: boolean; silhouette: boolean; threeQuarter: boolean; ageDays: number };

function BreedCell({ breed, options }: { breed: Breed; options: View3 }) {
  const picture = useMemo(() => {
    const look: Look | null = options.sameColor
      ? { coat: sameCoat, pattern: 'none' }
      : null;
    const actor = spawnActor(
      { id: breed.id, breedId: breed.id, ageDays: options.ageDays, weight: 0, vitality: 0.75, equipped: {}, asleep: false, look },
      previewHome,
    );
    actor.pose.headTurn = options.threeQuarter ? 1 : 0;
    const world = createWorld([actor], 1, previewScene);
    world.reducedMotion = true;
    world.silhouette = options.silhouette;
    const recorder = Skia.PictureRecorder();
    const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, cellWidth, cellHeight));
    drawWorld(canvas, world, cellWidth, cellHeight, noon, true, previewStageHeight);
    return recorder.finishRecordingAsPicture();
  }, [breed, options.ageDays, options.sameColor, options.silhouette, options.threeQuarter]);

  useEffect(() => {
    return () => {
      // The canvas may still be showing the old picture for a frame.
      setTimeout(() => picture.dispose(), 1000);
    };
  }, [picture]);

  return (
    <View style={styles.cell}>
      <Canvas pointerEvents="none" style={{ width: cellWidth, height: cellHeight, backgroundColor: previewBackdrop }}>
        <Picture picture={picture} />
      </Canvas>
      <Text style={styles.cellLabel}>{breed.name}</Text>
    </View>
  );
}

function stageName(ageDays: number): string {
  const p = ageDays / visualLifespanDays;
  if (p < 0.2) {
    return 'puppy / kitten';
  }
  if (p < 0.6) {
    return 'adult';
  }
  return 'senior';
}

// A small draggable slider, since the project has no slider dependency.
function StageSlider({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [width, setWidth] = useState(1);
  const responder = useMemo(() => {
    const pick = (x: number) => onChange(Math.round(Math.min(1, Math.max(0, x / width)) * visualLifespanDays));
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => pick(event.nativeEvent.locationX),
      onPanResponderMove: (event) => pick(event.nativeEvent.locationX),
    });
  }, [onChange, width]);
  const fraction = value / visualLifespanDays;
  return (
    <View style={styles.track} onLayout={(event) => setWidth(event.nativeEvent.layout.width)} {...responder.panHandlers}>
      <View pointerEvents="none" style={[styles.fill, { width: `${fraction * 100}%` }]} />
      <View pointerEvents="none" style={[styles.thumb, { left: `${fraction * 100}%` }]} />
    </View>
  );
}

export function DebugBreedsScreen({ onClose }: { onClose: () => void }) {
  const [sameColor, setSameColor] = useState(false);
  const [silhouette, setSilhouette] = useState(false);
  const [threeQuarter, setThreeQuarter] = useState(false);
  const [ageDays, setAgeDays] = useState(0);
  const options = { sameColor, silhouette, threeQuarter, ageDays };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Breed identity</Text>
        <Pressable onPress={onClose} hitSlop={12}>
          <Text style={styles.close}>Close</Text>
        </Pressable>
      </View>
      <View style={styles.controls}>
        <View style={styles.toggle}>
          <Text style={styles.label}>Same color</Text>
          <Switch value={sameColor} onValueChange={setSameColor} />
        </View>
        <View style={styles.toggle}>
          <Text style={styles.label}>Silhouette only</Text>
          <Switch value={silhouette} onValueChange={setSilhouette} />
        </View>
        <View style={styles.toggle}>
          <Text style={styles.label}>3/4 head</Text>
          <Switch value={threeQuarter} onValueChange={setThreeQuarter} />
        </View>
        <Text style={styles.label}>
          Life stage: {stageName(ageDays)} ({ageDays} days)
        </Text>
        <StageSlider value={ageDays} onChange={setAgeDays} />
      </View>
      <ScrollView>
        {(['dog', 'cat'] as const).map((species) => (
          <View key={species}>
            <Text style={styles.section}>{species === 'dog' ? 'Dogs' : 'Cats'}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator>
              {breedsFor(species).map((breed) => (
                <BreedCell key={breed.id} breed={breed} options={options} />
              ))}
            </ScrollView>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F4F7FB', paddingTop: 52 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8 },
  title: { fontSize: 20, fontWeight: '600', color: '#243044' },
  close: { fontSize: 16, color: '#3b6fd8' },
  controls: { paddingHorizontal: 16, paddingBottom: 12, gap: 6 },
  toggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 14, color: '#243044' },
  section: { fontSize: 16, fontWeight: '600', color: '#243044', paddingHorizontal: 16, paddingTop: 10 },
  cell: { margin: 8, alignItems: 'center' },
  cellLabel: { marginTop: 4, fontSize: 13, color: '#243044' },
  track: { height: 32, borderRadius: 16, backgroundColor: '#dbe3ee', justifyContent: 'center' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 16, backgroundColor: '#9db8ee' },
  thumb: { position: 'absolute', width: 24, height: 24, borderRadius: 12, marginLeft: -12, backgroundColor: '#3b6fd8' },
});
