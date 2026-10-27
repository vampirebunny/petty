import { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { Canvas, Picture, Skia } from '@shopify/react-native-skia';
import type { SkPicture } from '@shopify/react-native-skia';

import { breedById, createWorld, defaultLook, frameDt, placeTrickProp, spawnActor, startTrick, todAt, update } from '../../actor';
import type { Actor, World } from '../../actor';
import { geomOf, PET_SIZE, xRangeOf } from '../../actor/geometry';
import { jumpConfig } from '../../actor/jump';
import { previewBackdrop, previewHome, previewScene } from '../../actor/previewScene';
import { drawPetOnly } from '../skia/world';
import { propPoint, type TrickPropType } from '../../sim/trickProps';
import { trickListing } from '../../sim/tricks';

const noon = todAt(12);
const frameMs = 1000 / 30;
const demoBreed = { dog: 'retriever', cat: 'domesticShorthair' } as const;

// The pet starts a short walk before the approach, and the whole course stays on the floor.
function previewLayout(
  actor: Actor,
  type: TrickPropType,
  floor: { xMin: number; xMax: number },
): { petX: number; propX: number } {
  const breed = breedById(actor.breedId);
  const geom = breed ? geomOf(breed, actor.displayAgeDays, actor.displayWeight, actor.vitality) : null;
  const scale = geom ? PET_SIZE * geom.sc : 1;
  const range = geom ? xRangeOf(floor, geom, scale) : { lo: floor.xMin + 48, hi: floor.xMax - 48 };
  const bodyLength = Math.max(scale * 48, 36);
  const endAt = type === 'podium' ? 'off' : type === 'hurdle' || type === 'hoop' ? 'landing' : 'out';
  const approach = propPoint(type, 'approach', 0, 0, -1, bodyLength, jumpConfig.hurdleApproach, jumpConfig.hurdlePast);
  const end = propPoint(type, endAt, 0, 0, -1, bodyLength, jumpConfig.hurdleApproach, jumpConfig.hurdlePast);
  const lead = 72;
  let propX = actor.x - approach.x;
  let petX = actor.x - lead;
  const right = propX + end.x;
  if (right > range.hi - 8) {
    const delta = right - (range.hi - 8);
    propX -= delta;
    petX -= delta;
  }
  if (petX < range.lo + 8) {
    petX = range.lo + 8;
  }
  return { petX, propX };
}

type Props = {
  species: 'dog' | 'cat';
  trickId: string;
  width: number;
  height?: number;
};

// Adult stand-in, default coat, no clothes. Plays the trick's success script.
export function TrickDemo({ species, trickId, width, height: heightProp }: Props) {
  const height = heightProp ?? Math.round(width * 0.72);
  const [picture, setPicture] = useState<SkPicture | null>(null);
  const worldRef = useRef<World | null>(null);

  useEffect(() => {
    const breedId = demoBreed[species];
    const breed = breedById(breedId);
    const world = createWorld(
      [
        spawnActor(
          {
            id: 'trick-demo',
            breedId,
            ageDays: 14,
            weight: 12,
            vitality: 0.8,
            equipped: {},
            look: breed ? defaultLook(breed) : null,
            asleep: false,
          },
          previewHome,
        ),
      ],
      1,
      previewScene,
    );
    world.reducedMotion = true;
    world.noNap = true;
    const actor = world.actors[0];
    const listing = trickListing(trickId);
    if (actor && listing?.propType) {
      const spot = previewLayout(actor, listing.propType, world.scene.floor);
      actor.x = spot.petX;
      placeTrickProp(
        world,
        { instanceId: 'preview', type: listing.propType, sourceTrickId: trickId },
        spot.propX,
        previewHome.y,
      );
    }
    if (actor) {
      startTrick(world, actor, trickId, 'success', listing?.propType ? ['preview'] : []);
    }
    worldRef.current = world;
  }, [species, trickId]);

  useEffect(() => {
    let raf = 0;
    let last = Date.now();
    let lastDraw = 0;
    let running = true;
    let active = AppState.currentState === 'active';
    const draw = () => {
      const world = worldRef.current;
      const actor = world?.actors[0];
      if (!world || !actor) {
        return;
      }
      const recorder = Skia.PictureRecorder();
      const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, width, height));
      drawPetOnly(canvas, world, width, height, noon, { x: actor.x, y: actor.y - 20, zoom: 1.35 });
      setPicture(recorder.finishRecordingAsPicture());
    };
    const loop = () => {
      if (!running) {
        return;
      }
      const now = Date.now();
      const world = worldRef.current;
      const actor = world?.actors[0];
      if (world && actor) {
        if (actor.task.type !== 'trick') {
          startTrick(world, actor, trickId, 'success', world.trickProps.map((prop) => prop.instanceId));
        }
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
  }, [height, trickId, width]);

  return (
    <View style={[styles.frame, { width, height, backgroundColor: previewBackdrop }]}>
      <Canvas pointerEvents="none" style={{ width, height }}>
        {picture ? <Picture picture={picture} /> : null}
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignSelf: 'center',
    borderRadius: 18,
    overflow: 'hidden',
  },
});
