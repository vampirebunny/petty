import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Canvas, Picture, Skia } from '@shopify/react-native-skia';

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

export function ConservatoryPreview({ pet, reducedMotion, onAdd, onClose }: Props) {
  const actorRef = useRef<Actor | null>(null);
  const runRef = useRef<HouseRun | null>(null);
  const restTicks = useRef(0);
  const [frame, setFrame] = useState(0);

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
    actorRef.current = actor;
    runRef.current = startHouse(prop, 0.2, true);
    if (reducedMotion) {
      actor.x = houseWorld(prop, HOUSE_POINTS.R.x, HOUSE_POINTS.R.y).x;
      actor.y = houseWorld(prop, HOUSE_POINTS.R.x, HOUSE_POINTS.R.y).y;
      actor.pose.lie = 1;
      actor.pose.eyes = 1;
      actor.pose.headRest = 1;
      setFrame(1);
      return;
    }
    const timer = setInterval(() => {
      const dog = actorRef.current;
      const run = runRef.current;
      if (!dog || !run) {
        return;
      }
      const stepped = stepHouse(run, prop, dog, 0.05, Math.random, false);
      if (stepped.move) {
        const dx = stepped.move.x - dog.x;
        const dy = stepped.move.y - dog.y;
        const dist = Math.hypot(dx, dy);
        const step = 4.2;
        if (dist <= step) {
          dog.x = stepped.move.x;
          dog.y = stepped.move.y;
        } else {
          dog.x += (dx / dist) * step;
          dog.y += (dy / dist) * step;
        }
      }
      dog.face = run.holdFace ? run.face : dog.face;
      dog.octant = dog.face >= 0 ? 'E' : 'W';
      dog.octantFrom = dog.octant;
      dog.pose.lie = run.lie;
      dog.pose.eyes = run.eyes;
      dog.pose.headRest = run.headRest;
      dog.pose.headTurn = run.headTurn;
      dog.pose.stretch = run.stretch;
      dog.pose.paw = run.paw;
      if (run.phase === 'rest') {
        restTicks.current += 1;
      } else {
        restTicks.current = 0;
      }
      if (stepped.done || run.phase === 'done' || restTicks.current > 36) {
        dog.x = door.x - 36;
        dog.y = door.y;
        dog.pose.lie = 0;
        dog.pose.eyes = 0;
        restTicks.current = 0;
        runRef.current = startHouse(prop, Math.random(), true);
      }
      setFrame((value) => value + 1);
    }, 50);
    return () => clearInterval(timer);
  }, [pet, reducedMotion]);

  const picture = useMemo(() => {
    const recorder = Skia.PictureRecorder();
    const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, width, height));
    const opts = { detail: true, sparkles: false, night: 0 };
    drawConservatory(canvas, prop, 'back', opts);
    const actor = actorRef.current;
    const resolved = actor ? resolveBreedById(actor.breedId, actor.look) : null;
    const breed = actor && resolved ? applyVariant(resolved, actor.variant) : null;
    const slot = actor ? houseSlot(prop, actor.x) : 'out';
    const drawPet = () => {
      if (actor && breed) {
        drawActor(canvas, actor, breed, floor, frame * 0.05, null, false, reducedMotion);
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
  }, [frame, reducedMotion]);

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
