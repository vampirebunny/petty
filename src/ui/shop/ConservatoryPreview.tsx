import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Canvas, Picture, Skia } from '@shopify/react-native-skia';
import type { SkPicture } from '@shopify/react-native-skia';

import { resolveBreedById, spawnActor } from '../../actor';
import { HOUSE_POINTS, houseSlot, houseWorld, startHouse, stepHouse } from '../../actor/conservatory';
import type { HouseRun } from '../../actor/conservatory';
import type { Actor } from '../../actor/types';
import { applyVariant } from '../../actor/variation';
import type { PetState } from '../../sim/types';
import { clipHouseOutside, drawConservatory } from '../skia/conservatory';
import { drawActor } from '../skia/pet';

type Props = {
  pet: PetState;
  reducedMotion: boolean;
  onAdd: () => void;
  onClose: () => void;
};

const width = 320;
const height = 280;
const prop = {
  kind: 'dogHouse',
  id: 'dogHouse',
  x: 168,
  y: 214,
  w: 260,
  restMultiplier: 2.5,
  flip: false,
};
const floor = { yMin: 40, yMax: 260 };
const opts = { detail: true, sparkles: false, night: 0 };

function recordHouse(actor: Actor | null, seconds: number, reducedMotion: boolean): SkPicture {
  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, width, height));
  drawConservatory(canvas, prop, 'back', opts);
  const resolved = actor ? resolveBreedById(actor.breedId, actor.look) : null;
  const breed = actor && resolved ? applyVariant(resolved, actor.variant) : null;
  const slot = actor ? houseSlot(prop, actor.x) : 'out';
  const drawPet = () => {
    if (actor && breed) {
      drawActor(canvas, actor, breed, floor, seconds, null, false, reducedMotion);
    }
  };
  if (slot !== 'out') {
    drawPet();
  }
  drawConservatory(canvas, prop, 'front', opts);
  if (slot === 'cross') {
    canvas.save();
    clipHouseOutside(canvas, prop);
    drawPet();
    canvas.restore();
  } else if (slot === 'out') {
    drawPet();
  }
  return recorder.finishRecordingAsPicture();
}

export function ConservatoryPreview({ pet, reducedMotion, onAdd, onClose }: Props) {
  const [picture, setPicture] = useState(() => recordHouse(null, 0, reducedMotion));

  useEffect(() => {
    const door = houseWorld(prop, HOUSE_POINTS.A.x, HOUSE_POINTS.A.y);
    const actor = spawnActor(
      {
        id: pet.id,
        breedId: pet.breedId,
        ageDays: pet.ageDays,
        weight: pet.weight,
        vitality: pet.vitality,
        equipped: pet.equipped,
        look: pet.look,
        seed: pet.attributes.seed,
        asleep: false,
        energy: 0.4,
      },
      { x: door.x - 36, y: door.y },
    );
    let run: HouseRun = startHouse(prop, 0.2, true);
    let restTicks = 0;
    let frame = 0;
    if (reducedMotion) {
      const rest = houseWorld(prop, HOUSE_POINTS.R.x, HOUSE_POINTS.R.y);
      actor.x = rest.x;
      actor.y = rest.y;
      actor.pose.lie = 1;
      actor.pose.eyes = 1;
      actor.pose.headRest = 1;
      frame = 1;
    }
    const paint = () => setPicture(recordHouse(actor, frame * 0.05, reducedMotion));
    const first = setTimeout(paint, 0);
    if (reducedMotion) {
      return () => clearTimeout(first);
    }
    const timer = setInterval(() => {
      const stepped = stepHouse(run, prop, actor, 0.05, Math.random, false);
      if (stepped.move) {
        const dx = stepped.move.x - actor.x;
        const dy = stepped.move.y - actor.y;
        const dist = Math.hypot(dx, dy);
        const step = 4.2;
        if (dist <= step) {
          actor.x = stepped.move.x;
          actor.y = stepped.move.y;
        } else {
          actor.x += (dx / dist) * step;
          actor.y += (dy / dist) * step;
        }
      }
      actor.face = run.holdFace ? run.face : actor.face;
      actor.octant = actor.face >= 0 ? 'E' : 'W';
      actor.octantFrom = actor.octant;
      actor.pose.lie = run.lie;
      actor.pose.eyes = run.eyes;
      actor.pose.headRest = run.headRest;
      actor.pose.headTurn = run.headTurn;
      actor.pose.stretch = run.stretch;
      actor.pose.paw = run.paw;
      if (run.phase === 'rest') {
        restTicks += 1;
      } else {
        restTicks = 0;
      }
      if (stepped.done || run.phase === 'done' || restTicks > 36) {
        actor.x = door.x - 36;
        actor.y = door.y;
        actor.pose.lie = 0;
        actor.pose.eyes = 0;
        restTicks = 0;
        run = startHouse(prop, Math.random(), true);
      }
      frame += 1;
      paint();
    }, 50);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [pet, reducedMotion]);

  return (
    <View style={styles.sheet}>
      <Text style={styles.title}>Glass Conservatory</Text>
      <Canvas style={{ width, height }}>
        <Picture picture={picture} />
      </Canvas>
      <View style={styles.row}>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.ghost}>
          <Text style={styles.ghostText}>Close</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            onAdd();
            onClose();
          }}
          style={styles.add}
        >
          <Text style={styles.addText}>Add</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: '#FFF8F3',
    borderRadius: 28,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  title: { fontSize: 18, fontWeight: '700', color: '#5C4638' },
  row: { flexDirection: 'row', gap: 12 },
  ghost: { paddingHorizontal: 18, paddingVertical: 10 },
  ghostText: { color: '#8A6A58', fontWeight: '600' },
  add: { backgroundColor: '#F48BBE', borderRadius: 16, paddingHorizontal: 22, paddingVertical: 10 },
  addText: { color: '#fff', fontWeight: '700' },
});
