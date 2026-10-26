import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Canvas, Picture, Skia } from '@shopify/react-native-skia';
import type { SkPicture } from '@shopify/react-native-skia';

import { resolveBreedById, spawnActor } from '../../actor';
import { bedCushionPoint, cabanaWidth } from '../../actor/furniture';
import type { Actor } from '../../actor/types';
import { applyVariant } from '../../actor/variation';
import type { PetState } from '../../sim/types';
import { drawPupCabana } from '../skia/cabana';
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
  kind: 'dogHouse' as const,
  id: 'dogHouse',
  x: 160,
  y: 200,
  w: cabanaWidth,
  restMultiplier: 2,
};
const cushion = bedCushionPoint(prop);
const floor = { yMin: 40, yMax: 260 };
const artScale = cabanaWidth / 280;
const fit = Math.min((width - 24) / (252 * artScale), (height - 36) / (209 * artScale));

const approaches = [
  { x: cushion.x - 56, y: cushion.y + 18 },
  { x: cushion.x + 56, y: cushion.y + 12 },
  { x: cushion.x - 8, y: cushion.y - 36 },
  { x: cushion.x + 10, y: cushion.y + 34 },
];

function recordHouse(actor: Actor | null, seconds: number, reducedMotion: boolean): SkPicture {
  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, width, height));
  canvas.save();
  canvas.translate(width / 2, height / 2 + 16);
  canvas.scale(fit, fit);
  canvas.translate(-prop.x, -prop.y);
  drawPupCabana(canvas, prop);
  const resolved = actor ? resolveBreedById(actor.breedId, actor.look) : null;
  const breed = actor && resolved ? applyVariant(resolved, actor.variant) : null;
  if (actor && breed) {
    drawActor(canvas, actor, breed, floor, seconds, null, false, reducedMotion);
  }
  canvas.restore();
  return recorder.finishRecordingAsPicture();
}

export function ConservatoryPreview({ pet, reducedMotion, onAdd, onClose }: Props) {
  const [picture, setPicture] = useState(() => recordHouse(null, 0, reducedMotion));

  useEffect(() => {
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
      approaches[0]!,
    );
    let side = 0;
    let lying = 0;
    let frame = 0;
    if (reducedMotion) {
      actor.x = cushion.x;
      actor.y = cushion.y;
      actor.pose.lie = 1;
      actor.pose.eyes = 1;
      actor.pose.headRest = 1;
    }
    const paint = () => setPicture(recordHouse(actor, frame * 0.05, reducedMotion));
    const first = setTimeout(paint, 0);
    if (reducedMotion) {
      return () => clearTimeout(first);
    }
    const timer = setInterval(() => {
      if (lying > 0) {
        lying -= 1;
        actor.pose.lie = 1;
        actor.pose.eyes = 1;
        actor.pose.headRest = 1;
        if (lying === 0) {
          side = (side + 1) % approaches.length;
          const next = approaches[side]!;
          actor.x = next.x;
          actor.y = next.y;
          actor.pose.lie = 0;
          actor.pose.eyes = 0;
          actor.pose.headRest = 0;
        }
      } else {
        const dx = cushion.x - actor.x;
        const dy = cushion.y - actor.y;
        const dist = Math.hypot(dx, dy);
        actor.face = dx >= 0 ? 1 : -1;
        if (dist < 4) {
          actor.x = cushion.x;
          actor.y = cushion.y;
          lying = 36;
        } else {
          const step = Math.min(3.2, dist);
          actor.x += (dx / dist) * step;
          actor.y += (dy / dist) * step;
        }
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
      <Text style={styles.title}>Pup Cabana</Text>
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
