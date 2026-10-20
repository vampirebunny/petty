import { useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import type { Ref } from 'react';
import { AppState, StyleSheet } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { Canvas, Picture, Skia } from '@shopify/react-native-skia';
import type { SkPicture } from '@shopify/react-native-skia';

import {
  createWorld,
  cuddleBackPath,
  cuddleTouch,
  cuddleZoneAt,
  endCuddle,
  frameDt,
  sceneById,
  setWorldScene,
  settleOnResume,
  spawnActor,
  startUserTask,
  statusOf,
  syncActor,
  syncWorldFood,
  syncWorldWater,
  takeBowlDrinks,
  takeMeals,
  takeCuddleOut,
  takeSounds,
  takeWeightDelta,
  todAt,
  update,
} from '../actor';
import { useStageSize } from './useStageSize';
import type { CuddleOut, CuddleTouch, CuddleZone, Scene, TimeOfDay, World } from '../actor';
import { playVoice } from '../audio/voice';
import { attributeScore } from '../sim';
import type { Cue, PetState } from '../sim/types';
import { drawWorld } from './skia/world';

// What the home screen can ask of the pet while Cuddle is on. Points are stage coordinates.
export type CuddleHandle = {
  zoneAt: (x: number, y: number) => CuddleZone | null;
  touch: (touch: CuddleTouch) => void;
  phase: () => string | null;
  backPath: () => { from: { x: number; y: number }; to: { x: number; y: number } } | null;
};

type Props = {
  cuddleActive?: boolean;
  cuddleRef?: Ref<CuddleHandle>;
  onCuddleEvent?: (event: CuddleOut | { type: 'interrupted' }) => void;
  pet: PetState;
  cueKind: Cue['kind'];
  cueToken: number;
  drop?: { x: number; y: number };
  flick?: { vx: number; vy: number; vz: number };
  hour: number | null;
  reducedMotion: boolean;
  sceneOverride?: Scene | null;
  onStatus?: (status: string) => void;
  onWeightDelta: (delta: number) => void;
  onDrank?: (fromBowl: boolean) => void;
  onAte?: () => void;
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
    asleep: pet.asleep,
    cuddleAffinity: Math.min(1, Math.max(0, attributeScore(pet, 'affection') / 100)),
    energy: Math.min(1, Math.max(0, pet.needs.energy / 100)),
    mood: Math.min(1, Math.max(0, pet.needs.happiness / 100)),
    stats: {
      stamina: Math.min(1, Math.max(0, attributeScore(pet, 'stamina') / 100)),
      agility: Math.min(1, Math.max(0, attributeScore(pet, 'agility') / 100)),
      boldness: Math.min(1, Math.max(0, attributeScore(pet, 'boldness') / 100)),
      obedience: Math.min(1, Math.max(0, attributeScore(pet, 'obedience') / 100)),
    },
  };
}

export function PetView({
  cuddleActive = false,
  cuddleRef,
  onCuddleEvent,
  pet,
  cueKind,
  cueToken,
  drop,
  flick,
  hour,
  reducedMotion,
  sceneOverride,
  onStatus,
  onWeightDelta,
  onDrank,
  onAte,
}: Props) {
  const { viewWidth, viewHeight } = useStageSize();
  const widthRef = useRef(viewWidth);
  const heightRef = useRef(viewHeight);
  widthRef.current = viewWidth;
  heightRef.current = viewHeight;
  const scene = sceneOverride ?? sceneById(pet.sceneId);
  const worldRef = useRef<World>(createWorld([spawnActor(sourceOf(pet))], 1, scene));
  const activeRef = useRef(AppState.currentState === 'active');
  const hourRef = useRef(hour);
  const reducedRef = useRef(reducedMotion);
  const todRef = useRef<TimeOfDay>(todAt(12));
  const todAtMs = useRef(0);
  if (hourRef.current !== hour) {
    todAtMs.current = 0;
  }
  hourRef.current = hour;
  reducedRef.current = reducedMotion;
  const picture = useSharedValue<SkPicture>(
    useMemo(() => {
      const recorder = Skia.PictureRecorder();
      recorder.beginRecording(Skia.XYWHRect(0, 0, viewWidth, viewHeight));
      return recorder.finishRecordingAsPicture();
    }, [viewHeight, viewWidth]),
  );
  const livePicture = useRef<SkPicture | null>(null);
  const retired = useRef<{ picture: SkPicture; at: number }[]>([]);

  const redraw = useCallback(() => {
    const recorder = Skia.PictureRecorder();
    const bounds = Skia.XYWHRect(0, 0, widthRef.current, heightRef.current);
    const canvas = recorder.beginRecording(bounds);
    const now = Date.now();
    if (now - todAtMs.current > 1000) {
      const clock = new Date(now);
      const live = clock.getHours() + clock.getMinutes() / 60 + clock.getSeconds() / 3600;
      todRef.current = todAt(hourRef.current == null ? live : hourRef.current);
      todAtMs.current = now;
    }
    worldRef.current.reducedMotion = reducedRef.current;
    drawWorld(canvas, worldRef.current, widthRef.current, heightRef.current, todRef.current, reducedRef.current);
    const next = recorder.finishRecordingAsPicture();
    const previous = livePicture.current ?? picture.value;
    livePicture.current = next;
    picture.value = next;
    if (previous !== next) {
      retired.current.push({ picture: previous, at: now });
    }
    const staleBefore = now - 1000;
    while (retired.current.length > 0 && retired.current[0].at < staleBefore) {
      const stale = retired.current.shift();
      if (stale && stale.picture !== livePicture.current) {
        stale.picture.dispose();
      }
    }
  }, [picture]);

  useEffect(() => {
    const world = worldRef.current;
    const actor = world.actors[0];
    if (!actor || actor.id !== pet.id) {
      world.actors = [spawnActor(sourceOf(pet))];
      world.items = [];
    } else {
      syncActor(actor, sourceOf(pet));
    }
    syncWorldWater(world, pet.waterLevel);
    syncWorldFood(world, pet.foodInBowl);
    redraw();
  }, [
    pet.ageDays,
    pet.asleep,
    pet.breedId,
    pet.equipped,
    pet.foodInBowl,
    pet.id,
    pet.look,
    pet.vitality,
    pet.waterLevel,
    pet.weight,
    redraw,
  ]);

  useEffect(() => {
    const world = worldRef.current;
    if (world.scene !== scene) {
      setWorldScene(world, scene);
      redraw();
    }
  }, [scene, redraw]);

  const signalStartedAt = pet.care.potty.signal?.startedAt;
  useEffect(() => {
    const actor = worldRef.current.actors[0];
    if (actor && signalStartedAt != null) {
      startUserTask(worldRef.current, actor, 'signal');
      redraw();
    }
  }, [redraw, signalStartedAt]);

  useEffect(() => {
    const actor = worldRef.current.actors[0];
    if (!actor) {
      return;
    }
    const world = worldRef.current;
    if (cueKind === 'idle') {
      startUserTask(world, actor, 'idle');
    } else if (cueKind === 'sit') {
      startUserTask(world, actor, 'sit');
    } else if (cueKind === 'paw') {
      startUserTask(world, actor, 'paw');
    } else if (cueKind === 'speak') {
      startUserTask(world, actor, 'speak');
    } else if (cueKind === 'confused') {
      startUserTask(world, actor, 'confused');
    } else if (cueKind === 'signal') {
      startUserTask(world, actor, 'signal');
    } else if (cueKind === 'potty') {
      startUserTask(world, actor, 'potty');
    } else if (cueKind === 'eat') {
      startUserTask(world, actor, 'eat');
    } else if (cueKind === 'refuse') {
      startUserTask(world, actor, 'refuse');
    } else if (cueKind === 'yawn') {
      startUserTask(world, actor, 'sleep');
    } else if (cueKind === 'purr') {
      startUserTask(world, actor, 'react', 0.8);
    } else if (cueKind === 'wiggle') {
      startUserTask(world, actor, 'react', 0.2);
    } else if (cueKind === 'fetch') {
      startUserTask(world, actor, 'fetch', 1, drop, flick);
    }
    redraw();
  }, [cueKind, cueToken, drop, flick, redraw]);

  useImperativeHandle(
    cuddleRef,
    () => ({
      zoneAt: (x, y) => {
        const actor = worldRef.current.actors[0];
        return actor ? cuddleZoneAt(actor, x, y) : null;
      },
      touch: (touch) => {
        const world = worldRef.current;
        const actor = world.actors[0];
        if (actor) {
          cuddleTouch(world, actor, touch);
        }
      },
      phase: () => worldRef.current.actors[0]?.cuddle?.phase ?? null,
      backPath: () => {
        const actor = worldRef.current.actors[0];
        return actor ? cuddleBackPath(actor) : null;
      },
    }),
    [],
  );

  const cuddleLive = useRef(false);
  const petRef = useRef(pet);
  useEffect(() => {
    petRef.current = pet;
  }, [pet]);
  const onCuddleRef = useRef(onCuddleEvent);
  useEffect(() => {
    onCuddleRef.current = onCuddleEvent;
  }, [onCuddleEvent]);
  useEffect(() => {
    const world = worldRef.current;
    const actor = world.actors[0];
    if (!actor) {
      return;
    }
    if (cuddleActive && !cuddleLive.current) {
      cuddleLive.current = true;
      actor.cuddleAffinity = sourceOf(petRef.current).cuddleAffinity;
      startUserTask(world, actor, 'cuddle');
    } else if (!cuddleActive && cuddleLive.current) {
      cuddleLive.current = false;
      if (actor.task.type === 'cuddle') {
        endCuddle(actor);
      }
    }
  }, [cuddleActive]);

  const pendingWeight = useRef(0);
  const onWeightRef = useRef(onWeightDelta);
  useEffect(() => {
    onWeightRef.current = onWeightDelta;
  }, [onWeightDelta]);
  const flushWeight = useCallback((force: boolean) => {
    const delta = pendingWeight.current;
    if (Math.abs(delta) <= 0.00001) {
      pendingWeight.current = 0;
      return;
    }
    if (!force && Math.abs(delta) < 0.01) {
      return;
    }
    pendingWeight.current = 0;
    onWeightRef.current(delta);
  }, []);

  const onStatusRef = useRef(onStatus);
  useEffect(() => {
    onStatusRef.current = onStatus;
  }, [onStatus]);
  const onDrankRef = useRef(onDrank);
  useEffect(() => {
    onDrankRef.current = onDrank;
  }, [onDrank]);
  const onAteRef = useRef(onAte);
  useEffect(() => {
    onAteRef.current = onAte;
  }, [onAte]);
  const statusRef = useRef('');

  const step = useCallback(
    (elapsedMs: number) => {
      const world = worldRef.current;
      update(world, frameDt(elapsedMs, activeRef.current));
      for (const sound of takeSounds(world)) {
        playVoice(sound);
      }
      const meals = takeMeals(world);
      for (let i = 0; i < meals; i += 1) {
        onAteRef.current?.();
      }
      const drinks = takeBowlDrinks(world);
      for (let i = 0; i < drinks; i += 1) {
        onDrankRef.current?.(true);
      }
      const actor = world.actors[0];
      if (actor) {
        for (const out of takeCuddleOut(actor)) {
          onCuddleRef.current?.(out);
        }
        // Another action or a scene change replaced the Cuddle task.
        if (cuddleLive.current && actor.task.type !== 'cuddle') {
          cuddleLive.current = false;
          onCuddleRef.current?.({ type: 'interrupted' });
        }
        pendingWeight.current += takeWeightDelta(actor);
        flushWeight(false);
        const status = statusOf(actor);
        if (status !== statusRef.current) {
          statusRef.current = status;
          onStatusRef.current?.(status);
        }
      }
      redraw();
    },
    [flushWeight, redraw],
  );

  const kick = useRef<() => void>(() => undefined);

  useEffect(() => {
    return () => flushWeight(true);
  }, [flushWeight, pet.id]);

  useEffect(() => {
    let raf = 0;
    let last = Date.now();
    let running = true;
    const loop = () => {
      if (!running) {
        return;
      }
      const now = Date.now();
      step(now - last);
      last = now;
      if (activeRef.current) {
        raf = requestAnimationFrame(loop);
      }
    };
    kick.current = () => {
      cancelAnimationFrame(raf);
      last = Date.now();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
    };
  }, [step]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      const active = status === 'active';
      const returned = active && !activeRef.current;
      activeRef.current = active;
      if (returned) {
        settleOnResume(worldRef.current);
        kick.current();
      }
    });
    return () => subscription.remove();
  }, []);

  return (
    <Canvas pointerEvents="none" style={[styles.canvas, { width: viewWidth, height: viewHeight }]}>
      <Picture picture={picture} />
    </Canvas>
  );
}

const styles = StyleSheet.create({
  canvas: {
    width: '100%',
  },
});
