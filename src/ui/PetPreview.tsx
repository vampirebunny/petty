import { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Canvas, Picture, Skia } from '@shopify/react-native-skia';
import type { SkPicture } from '@shopify/react-native-skia';

import { breedById, createWorld, frameDt, spawnActor, syncActor, todAt, update } from '../actor';
import type { World } from '../actor';
import { stageWidth } from '../actor/geometry';
import { previewStageHeight } from '../actor/scenes';
import { previewBackdrop, previewHome, previewScene } from '../actor/previewScene';
import type { Look } from '../sim/types';
import { drawWorld } from './skia/world';

type Props = {
  species: 'dog' | 'cat';
  breedId: string | null;
  look: Look | null;
  // Fit the preview into this height, keeping the stage's proportions. Defaults to full width.
  height?: number;
};

// Shown while the pet is a puppy or kitten, since that is the pet the user is adopting.
const previewSource = {
  id: 'preview',
  ageDays: 0,
  weight: 0,
  vitality: 0.75,
  equipped: {},
  asleep: false,
};

const fallbackBreed = { dog: 'retriever', cat: 'domesticShorthair' } as const;
const noon = todAt(12);
const frameMs = 1000 / 30;

function newWorld(breedId: string, look: Look | null): World {
  const world = createWorld([spawnActor({ ...previewSource, breedId, look }, previewHome)], 1, previewScene);
  // The pet stays put in the preview: reduced motion skips the idle wander.
  world.reducedMotion = true;
  world.noNap = true;
  return world;
}

// A small Skia view of the pet being adopted. It only draws: the actor, scene, and look all
// come from the same data the home screen uses.
export function PetPreview({ species, breedId, look, height }: Props) {
  const { width } = useWindowDimensions();
  const ratio = previewStageHeight / stageWidth;
  const fullWidth = Math.min(560, Math.max(240, width - 40));
  const viewWidth = height ? Math.min(fullWidth, height / ratio) : fullWidth;
  const viewHeight = viewWidth * ratio;
  const breed = breedId ?? fallbackBreed[species];
  const [picture, setPicture] = useState<SkPicture | null>(null);
  const worldRef = useRef<World | null>(null);
  const retired = useRef<{ picture: SkPicture; at: number }[]>([]);
  const live = useRef<SkPicture | null>(null);

  // Rebuild the world when the species changes (a dog's idle state does not carry over to a cat),
  // and update the actor in place when only the breed or look changes.
  useEffect(() => {
    const world = worldRef.current;
    const actor = world?.actors[0];
    if (!world || !actor || breedById(actor.breedId)?.species !== species) {
      worldRef.current = newWorld(breed, look);
    } else {
      syncActor(actor, { ...previewSource, breedId: breed, look });
    }
  }, [breed, look, species]);

  useEffect(() => {
    let raf = 0;
    let last = Date.now();
    let lastDraw = 0;
    let running = true;
    let active = AppState.currentState === 'active';

    const draw = () => {
      const world = worldRef.current;
      if (!world) {
        return;
      }
      const recorder = Skia.PictureRecorder();
      const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, viewWidth, viewHeight));
      drawWorld(canvas, world, viewWidth, viewHeight, noon, true, previewStageHeight);
      const next = recorder.finishRecordingAsPicture();
      const now = Date.now();
      if (live.current) {
        retired.current.push({ picture: live.current, at: now });
      }
      live.current = next;
      setPicture(next);
      while (retired.current.length > 0 && retired.current[0].at < now - 1000) {
        retired.current.shift()?.picture.dispose();
      }
    };

    const loop = () => {
      if (!running) {
        return;
      }
      const now = Date.now();
      const world = worldRef.current;
      if (world) {
        update(world, frameDt(now - last, active));
      }
      last = now;
      if (now - lastDraw >= frameMs) {
        lastDraw = now;
        draw();
      }
      if (active) {
        raf = requestAnimationFrame(loop);
      }
    };
    raf = requestAnimationFrame(loop);

    const subscription = AppState.addEventListener('change', (status) => {
      const wasActive = active;
      active = status === 'active';
      if (active && !wasActive) {
        last = Date.now();
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(loop);
      }
    });
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      subscription.remove();
    };
  }, [viewHeight, viewWidth]);

  return (
    <View style={[styles.frame, { width: viewWidth, height: viewHeight, backgroundColor: previewBackdrop }]}>
      <Canvas pointerEvents="none" style={{ width: viewWidth, height: viewHeight }}>
        {picture ? <Picture picture={picture} /> : null}
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignSelf: 'center',
    borderRadius: 12,
    overflow: 'hidden',
  },
});
