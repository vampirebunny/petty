import { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet } from 'react-native';
import { Canvas, Picture, Skia } from '@shopify/react-native-skia';
import type { SkPicture } from '@shopify/react-native-skia';

import { breedById, createWorld, frameDt, geomOf, spawnActor, takeSounds, todAt, update } from '../../actor';
import { PET_SIZE, reachOf, rearOf, stageHeight, stageWidth } from '../../actor/geometry';
import type { Equipped, PetState } from '../../sim/types';
import { drawPetOnly } from '../skia/world';
import { shopAnchor, shopPetScene } from './shopFloor';

type Props = {
  pet: PetState;
  equipped: Equipped;
  reducedMotion: boolean;
  width: number;
  height: number;
};

const noon = todAt(14);
const frameMs = 1000 / 30;
const hopMs = 700;

// Body height on the 196px stage, and how much of the card width the pet may use.
const bodyTarget = 164 / 196;
const sideMargin = 0.92;

function petExtent(pet: PetState): { height: number; halfWidth: number } {
  const breed = breedById(pet.breedId);
  const travel = (shopPetScene.floor.xMax - shopPetScene.floor.xMin) / 2;
  if (!breed) {
    return { height: 120, halfWidth: 90 + travel };
  }
  const geom = geomOf(breed, pet.ageDays, pet.weight, pet.vitality);
  const size = PET_SIZE * geom.sc;
  const body = geom.headR * 2.1 + geom.bodyH * 0.55 + Math.abs(geom.hipY);
  return {
    height: body * size * 0.95,
    // Nose or tail, whichever sticks out farther, plus the walk along the counter.
    halfWidth: Math.max(reachOf(geom), rearOf(geom)) * size + travel,
  };
}

// Feet stay on the rug. Tall pets keep the spec height. Long pets zoom out so the whole body stays on stage.
function cameraFor(width: number, height: number, pet: PetState): { x: number; y: number; zoom: number } {
  const fit = Math.min(width / stageWidth, height / stageHeight);
  const extent = petExtent(pet);
  const zoomH = fit > 0 && extent.height > 0 ? (height * bodyTarget) / (extent.height * fit) : 3.2;
  const zoomW = fit > 0 && extent.halfWidth > 0 ? (width * sideMargin) / (extent.halfWidth * 2 * fit) : zoomH;
  const zoom = Math.min(zoomH, zoomW);
  const scale = Math.max(0.001, fit * zoom);
  // The stage clips its rounded bottom, so the paws sit above that edge.
  const feetInset = 18;
  return {
    x: shopAnchor.x,
    y: shopAnchor.y - (height - feetInset - height * 0.62) / scale,
    zoom,
  };
}

function wornKey(equipped: Equipped): string {
  return Object.values(equipped).filter((id) => id && id !== 'none').join('|');
}

export function ShopPet({ pet, equipped, reducedMotion, width, height }: Props) {
  const [picture, setPicture] = useState<SkPicture | null>(null);
  const worldRef = useRef<ReturnType<typeof createWorld> | null>(null);
  const equippedRef = useRef(equipped);
  const reducedRef = useRef(reducedMotion);
  const sizeRef = useRef({ width, height });
  const petRef = useRef(pet);
  const hopUntil = useRef(0);
  const wornSeen = useRef(wornKey(equipped));

  useEffect(() => {
    equippedRef.current = equipped;
    reducedRef.current = reducedMotion;
    sizeRef.current = { width, height };
    petRef.current = pet;
  }, [equipped, height, pet, reducedMotion, width]);

  const worn = wornKey(equipped);
  useEffect(() => {
    const before = new Set(wornSeen.current.split('|').filter(Boolean));
    const added = worn.split('|').filter((id) => id && !before.has(id));
    wornSeen.current = worn;
    if (added.length > 0 && !reducedRef.current) {
      hopUntil.current = Date.now() + hopMs;
    }
  }, [worn]);

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
        energy: Math.min(1, Math.max(0, pet.needs.energy / 100)),
        mood: Math.min(1, Math.max(0, pet.needs.happiness / 100)),
        hydration: Math.min(1, Math.max(0, pet.hydration / 100)),
      },
      shopAnchor,
    );
    const world = createWorld([actor], pet.attributes.seed || 1, shopPetScene);
    world.waterLevel = 0;
    world.reducedMotion = reducedMotion;
    // The shop pet stays awake. Still, pant, purr, walk, and zoomies are fine.
    world.noNap = true;
    worldRef.current = world;
    return () => {
      worldRef.current = null;
    };
    // The shop pet is a preview. Later frames only change what it is wearing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pet.id]);

  useEffect(() => {
    let raf = 0;
    let last = Date.now();
    let lastDraw = 0;
    let running = true;
    let active = AppState.currentState === 'active';

    const draw = () => {
      const world = worldRef.current;
      const box = sizeRef.current;
      if (!world || box.width < 2 || box.height < 2) {
        return;
      }
      const recorder = Skia.PictureRecorder();
      const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, box.width, box.height));
      drawPetOnly(canvas, world, box.width, box.height, noon, cameraFor(box.width, box.height, petRef.current));
      const next = recorder.finishRecordingAsPicture();
      setPicture(next);
    };

    const loop = () => {
      if (!running) {
        return;
      }
      const now = Date.now();
      const world = worldRef.current;
      const actor = world?.actors[0];
      if (world && actor) {
        world.reducedMotion = reducedRef.current;
        actor.equipped = { ...equippedRef.current };
        update(world, frameDt(now - last, active));
        takeSounds(world);
        actor.y = shopAnchor.y;
        actor.vy = 0;
        if (actor.idle.target) {
          actor.idle.target.y = shopAnchor.y;
        }
        if (now < hopUntil.current) {
          const along = 1 - (hopUntil.current - now) / hopMs;
          actor.z = Math.sin(along * Math.PI) * 26;
          actor.pose.wagAmp = 1;
          actor.pose.tailLift = 0.7;
        }
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
        raf = requestAnimationFrame(loop);
      }
    });
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      subscription.remove();
    };
  }, []);

  if (!picture) {
    return null;
  }
  return (
    <Canvas style={styles.canvas} pointerEvents="none">
      <Picture picture={picture} />
    </Canvas>
  );
}

const styles = StyleSheet.create({
  canvas: { ...StyleSheet.absoluteFill },
});
