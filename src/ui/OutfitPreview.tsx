import { useEffect, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Canvas, Picture, Skia } from '@shopify/react-native-skia';

import { createWorld, sceneById, spawnActor, todAt } from '../actor';
import type { Equipped, Look } from '../sim/types';
import { drawWorld } from './skia/world';

export type OutfitSubject = {
  breedId: string;
  ageDays: number;
  weight: number;
  vitality: number;
  look: Look;
  seed?: number;
};

type Props = OutfitSubject & {
  equipped: Equipped;
  width: number;
  height: number;
  t: number;
  zoom?: number;
  pose?: OutfitPose;
};

export type OutfitPose = 'idle' | 'sit' | 'lie' | 'walk';
export const outfitPoses: OutfitPose[] = ['idle', 'sit', 'lie', 'walk'];

export function useOutfitClock(reducedMotion: boolean): number {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (reducedMotion) {
      return;
    }
    const timer = setInterval(() => {
      setT((value) => value + 0.08);
    }, 80);
    return () => clearInterval(timer);
  }, [reducedMotion]);
  return reducedMotion ? 0 : t;
}

// Sit is the 3/4 turn used by the gallery. The other poses are side views for checking fit in the lab.
export function OutfitPreview({
  breedId,
  ageDays,
  weight,
  vitality,
  look,
  seed = 1,
  equipped,
  width,
  height,
  t,
  zoom = 3.2,
  pose = 'sit',
}: Props) {
  const picture = useMemo(() => {
    const actor = spawnActor(
      { id: 'outfit', breedId, ageDays, weight, vitality, equipped, look, asleep: false, seed },
      { x: 320, y: 460 },
    );
    actor.blinkT = 2;
    actor.speed = 36;
    if (pose === 'sit') {
      actor.pose.sit = 1;
      actor.pose.headTurn = 1;
    } else if (pose === 'lie') {
      actor.pose.lie = 1;
    } else if (pose === 'walk') {
      actor.pose.walk = 1;
      actor.speed = 60;
      actor.phase = t * 6;
    }
    const world = createWorld([actor], seed || 1, sceneById('livingroom'));
    world.t = t;
    const recorder = Skia.PictureRecorder();
    const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, Math.max(width, 1), Math.max(height, 1)));
    drawWorld(canvas, world, width, height, todAt(14), true, undefined, { x: 320, y: 400, zoom });
    return recorder.finishRecordingAsPicture();
  }, [ageDays, breedId, equipped, height, look, pose, seed, t, vitality, weight, width, zoom]);

  useEffect(() => () => picture.dispose(), [picture]);

  return (
    <Canvas style={[styles.canvas, { width, height }]} pointerEvents="none">
      <Picture picture={picture} />
    </Canvas>
  );
}

const styles = StyleSheet.create({
  canvas: {
    borderRadius: 16,
    overflow: 'hidden',
  },
});
