import { useEffect, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Canvas, Picture, Skia } from '@shopify/react-native-skia';

import { createWorld, sceneById, spawnActor, todAt } from '../actor';
import type { Actor, ActorSource } from '../actor/types';
import type { Equipped, Look } from '../sim/types';
import { drawPetOnly, drawWorld } from './skia/world';

export type OutfitSubject = {
  breedId: string;
  ageDays: number;
  weight: number;
  vitality: number;
  look: Look;
  seed?: number;
  asleep?: boolean;
};

type Props = OutfitSubject & {
  equipped: Equipped;
  wearDefs?: ActorSource['wearDefs'];
  backWear?: ActorSource['backWear'];
  width: number;
  height: number;
  t: number;
  zoom?: number;
  pose?: OutfitPose;
  // Skip the room so a caller can paint its own backdrop behind the pet.
  bare?: boolean;
  // World y placed at 62% of the canvas height. The closet lowers this so the pet sits on the rug.
  cameraY?: number;
};

export type OutfitPose = 'idle' | 'sit' | 'lie' | 'walk';

// Same rates the home sim uses for a pet standing still: a slow wag, and a blink that stays open at t = 0.
const IDLE_WAG_RATE = 5;
const BLINK_EVERY = 2.6;
const BLINK_SHUT = 0.12;
const SIT_FOR = 4;
const WALK_FOR = 2.8;
const IDLE_CYCLE = SIT_FOR + WALK_FOR;
const WALK_SPAN = 28;

function faceWalk(actor: Actor, face: 1 | -1): void {
  actor.face = face;
  actor.octant = face > 0 ? 'E' : 'W';
  actor.octantFrom = actor.octant;
  actor.octantTarget = actor.octant;
  actor.octantBlend = 1;
}

function applyPreviewMotion(actor: Actor, t: number, sleeping: boolean, pose: OutfitPose): void {
  if (sleeping) {
    actor.asleep = true;
    actor.pose.sit = 0;
    actor.pose.walk = 0;
    actor.pose.headTurn = 0;
    actor.pose.lie = 1;
    actor.pose.headRest = 1;
    actor.pose.eyes = 1;
    actor.pose.wagAmp = 0;
    actor.pose.breathAmp = 0.03;
    actor.pose.breathRate = 0.35;
    actor.blinkT = 2;
    actor.wagPh = 0;
    actor.breathPh = t * Math.PI * 2 * actor.pose.breathRate;
    actor.x = 320;
    return;
  }
  const loop = pose === 'sit' || pose === 'idle';
  const u = ((t % IDLE_CYCLE) + IDLE_CYCLE) % IDLE_CYCLE;
  const walking = pose === 'walk' || (loop && t > 0 && u >= SIT_FOR);
  if (walking) {
    actor.pose.sit = 0;
    actor.pose.headTurn = 0;
    actor.pose.lie = 0;
    actor.pose.walk = 1;
    actor.speed = 60;
    actor.phase = t * 6;
    if (loop) {
      const walkT = (u - SIT_FOR) / WALK_FOR;
      const goingRight = walkT < 0.5;
      const local = goingRight ? walkT * 2 : (1 - walkT) * 2;
      actor.x = 320 - WALK_SPAN + local * WALK_SPAN * 2;
      faceWalk(actor, goingRight ? 1 : -1);
    }
  } else if (pose === 'sit') {
    actor.pose.walk = 0;
    actor.pose.sit = 1;
    actor.pose.headTurn = 1;
    actor.pose.wagAmp = 0.3;
    actor.x = 320;
    faceWalk(actor, 1);
  }
  actor.breathPh = t * Math.PI * 2 * actor.pose.breathRate;
  actor.wagPh = t * IDLE_WAG_RATE;
  const blink = ((t % BLINK_EVERY) + BLINK_EVERY) % BLINK_EVERY;
  actor.blinkT = blink > BLINK_EVERY - BLINK_SHUT ? BLINK_EVERY - blink : 2;
}

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
  asleep = false,
  equipped,
  wearDefs,
  backWear,
  width,
  height,
  t,
  zoom = 3.2,
  pose = 'sit',
  bare = false,
  cameraY = 400,
}: Props) {
  const picture = useMemo(() => {
    const actor = spawnActor(
      { id: 'outfit', breedId, ageDays, weight, vitality, equipped, wearDefs, backWear, look, asleep: false, seed },
      { x: 320, y: 460 },
    );
    actor.speed = 36;
    const sleeping = asleep || pose === 'lie';
    applyPreviewMotion(actor, t, sleeping, pose);
    const world = createWorld([actor], seed || 1, sceneById('livingroom'));
    world.t = t;
    const recorder = Skia.PictureRecorder();
    const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, Math.max(width, 1), Math.max(height, 1)));
    const camera = { x: 320, y: cameraY, zoom };
    const tod = todAt(14);
    if (bare) {
      drawPetOnly(canvas, world, width, height, tod, camera);
    } else {
      drawWorld(canvas, world, width, height, tod, true, undefined, camera, undefined, { sky: null });
    }
    return recorder.finishRecordingAsPicture();
  }, [ageDays, asleep, backWear, bare, breedId, cameraY, equipped, height, look, pose, seed, t, vitality, wearDefs, weight, width, zoom]);

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
