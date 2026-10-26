import { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Canvas, Picture, Skia } from '@shopify/react-native-skia';
import type { SkPicture } from '@shopify/react-native-skia';

import { resolveBreedById, spawnActor } from '../../actor';
import { sideOctant } from '../../actor/facing';
import type { Actor } from '../../actor/types';
import type { PetState } from '../../sim/types';
import { drawActor } from '../skia/pet';

type Props = {
  pet: PetState;
  walking: boolean;
  face: 1 | -1;
  reducedMotion: boolean;
  width: number;
  height: number;
};

function sourceOf(pet: PetState) {
  return {
    id: pet.id,
    breedId: pet.breedId,
    ageDays: pet.ageDays,
    weight: pet.weight,
    vitality: pet.vitality,
    equipped: pet.equipped,
    look: pet.look,
    seed: pet.attributes.seed,
    asleep: false,
  };
}

export function TownPet({ pet, walking, face, reducedMotion, width, height }: Props) {
  const [picture, setPicture] = useState<SkPicture | null>(null);
  const actorRef = useRef<Actor | null>(null);
  const petRef = useRef(pet);
  const walkingRef = useRef(walking);
  const faceRef = useRef(face);
  const reducedRef = useRef(reducedMotion);
  const sizeRef = useRef({ width, height });

  useEffect(() => {
    petRef.current = pet;
    walkingRef.current = walking;
    faceRef.current = face;
    reducedRef.current = reducedMotion;
    sizeRef.current = { width, height };
  }, [face, height, pet, reducedMotion, walking, width]);

  const worn = Object.values(pet.equipped).join('|');
  const coat = `${pet.look?.coat ?? ''}:${pet.look?.pattern ?? ''}:${pet.look?.accent ?? ''}:${pet.look?.eyeColor ?? ''}`;

  useEffect(() => {
    actorRef.current = spawnActor(sourceOf(petRef.current), { x: 0, y: 0 });
  }, [coat, pet.ageDays, pet.breedId, pet.id, pet.vitality, pet.weight, worn]);

  useEffect(() => {
    let frame = 0;
    let last = Date.now();
    let clock = 0;
    let alive = true;
    const draw = (actor: Actor) => {
      const breed = resolveBreedById(actor.breedId, actor.look);
      if (!breed || !alive) {
        return;
      }
      const { width: w, height: h } = sizeRef.current;
      const recorder = Skia.PictureRecorder();
      const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, w, h));
      canvas.save();
      canvas.translate(w / 2, h - 2);
      canvas.scale(0.5, 0.5);
      drawActor(canvas, actor, breed, { yMin: 0, yMax: 80 }, clock, null, false, reducedRef.current);
      canvas.restore();
      // Leave the previous picture for GC. dispose() kills it while the canvas can still read it.
      setPicture(recorder.finishRecordingAsPicture());
    };
    const tick = () => {
      if (!alive) {
        return;
      }
      const now = Date.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      clock += dt;
      const actor = actorRef.current;
      if (actor) {
        const current = petRef.current;
        actor.equipped = { ...current.equipped };
        actor.look = current.look ? { ...current.look } : null;
        actor.breedId = current.breedId;
        actor.ageDays = current.ageDays;
        actor.displayAgeDays = current.ageDays;
        actor.weight = current.weight;
        actor.displayWeight = current.weight;
        actor.face = faceRef.current;
        const side = sideOctant(actor.face);
        actor.octant = side;
        actor.octantFrom = side;
        actor.octantTarget = side;
        actor.octantBlend = 1;
        const moving = walkingRef.current && !reducedRef.current;
        actor.pose.walk = moving ? 1 : 0;
        actor.speed = moving ? 70 : 0;
        if (moving) {
          actor.phase += dt * 9;
        }
        if (!reducedRef.current) {
          actor.blinkT -= dt;
          if (actor.blinkT <= 0) {
            actor.blinkT = moving ? 2.4 : 2.6 + Math.random() * 1.6;
          }
        }
        draw(actor);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
    };
  }, []);

  if (!picture) {
    return null;
  }
  return <Canvas style={[styles.canvas, { width, height }]}>{<Picture picture={picture} />}</Canvas>;
}

const styles = StyleSheet.create({
  canvas: {
    backgroundColor: 'transparent',
  },
});
