import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { Canvas, Picture, Skia } from '@shopify/react-native-skia';

import { createWorld, sceneById, spawnActor, todAt } from '../actor';
import { actorSourceOf } from '../playdate/snapshot';
import type { PetSnapshot } from '../playdate/types';
import { drawWorld } from './skia/world';

type Props = {
  snapshot: PetSnapshot;
  width: number;
  height: number;
  // Frames the pet large enough to read a hat, coat, and boots.
  focus?: boolean;
};

// One still frame of a snapshot, so a partner card can show the pet without running the home sim.
export function SnapshotStill({ snapshot, width, height, focus = false }: Props) {
  const picture = useMemo(() => {
    const scene = sceneById('livingroom');
    const at = focus ? { x: 320, y: 460 } : { x: 320, y: 470 };
    const actor = spawnActor(actorSourceOf(snapshot), at);
    // A single sim step is capped at 50ms, which freezes the head mid-turn and stacks the eyes.
    // Draw the settled sit the home pet reaches when it faces the camera.
    actor.pose.sit = 1;
    actor.pose.headTurn = 1;
    actor.blinkT = 2;
    const world = createWorld([actor], snapshot.seed || 1, scene);
    const recorder = Skia.PictureRecorder();
    const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, width, height));
    drawWorld(canvas, world, width, height, todAt(14), true, undefined, focus ? { x: 320, y: 400, zoom: 3.2 } : undefined, undefined, {
      sky: null,
    });
    return recorder.finishRecordingAsPicture();
  }, [focus, height, snapshot, width]);

  return (
    <Canvas style={[styles.canvas, { width, height }]} pointerEvents="none">
      <Picture picture={picture} />
    </Canvas>
  );
}

const styles = StyleSheet.create({
  canvas: {
    borderRadius: 12,
    overflow: 'hidden',
  },
});
