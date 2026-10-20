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
  breedById,
  isSceneTravel,
  sceneById,
  sceneForSpecies,
  setWorldScene,
  settleOnResume,
  spawnActor,
  startSceneEnter,
  startSceneExit,
  startUserTask,
  statusOf,
  syncActor,
  syncWorldFood,
  syncWorldWater,
  takeBowlDrinks,
  takeMeals,
  takeCuddleOut,
  takeSounds,
  takeEnergyDelta,
  takeEnergyPops,
  takeHungerDelta,
  takeThirstDelta,
  takeWeightDelta,
  todAt,
  update,
} from '../actor';
import { useStageSize } from './useStageSize';
import type { CuddleOut, CuddleTouch, CuddleZone, Scene, TimeOfDay, World } from '../actor';
import { playVoice } from '../audio/voice';
import { attributeScore, feedHungerDrop } from '../sim';
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
  onEnergyDelta: (delta: number) => void;
  onHungerDelta: (delta: number) => void;
  onThirstDelta: (delta: number) => void;
  onDrank?: (fromBowl: boolean) => void;
  onAte?: () => void;
  onTraveling?: (active: boolean) => void;
  onEnergyPop?: (x: number, y: number) => void;
  onTummyPop?: (x: number, y: number, amount: number) => void;
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
    thirst: Math.min(1, Math.max(0, pet.thirst / 100)),
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
  onEnergyDelta,
  onHungerDelta,
  onThirstDelta,
  onDrank,
  onAte,
  onTraveling,
  onEnergyPop,
  onTummyPop,
}: Props) {
  const { viewWidth, viewHeight } = useStageSize();
  const widthRef = useRef(viewWidth);
  const heightRef = useRef(viewHeight);
  widthRef.current = viewWidth;
  heightRef.current = viewHeight;
  const species = breedById(pet.breedId)?.species === 'cat' ? 'cat' : 'dog';
  const scene = sceneForSpecies(sceneOverride ?? sceneById(pet.sceneId), species);
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
  const travelRef = useRef<{ dest: Scene; phase: 'exit' | 'fade' | 'enter'; fade: number; asleep: boolean } | null>(null);
  const onTravelingRef = useRef(onTraveling);
  onTravelingRef.current = onTraveling;

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
    const fade = travelRef.current?.fade ?? 0;
    if (fade > 0.001) {
      const paint = Skia.Paint();
      paint.setColor(Skia.Color(`rgba(8,10,16,${fade})`));
      canvas.drawRect(bounds, paint);
    }
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
    pet.needs.energy,
    pet.thirst,
    pet.waterLevel,
    pet.weight,
    redraw,
  ]);

  const pendingCue = useRef<{ kind: typeof cueKind; token: number; drop?: typeof drop; flick?: typeof flick } | null>(null);

  const applyCue = useCallback(
    (kind: typeof cueKind, nextDrop?: typeof drop, nextFlick?: typeof flick) => {
      const actor = worldRef.current.actors[0];
      if (!actor || kind === 'none') {
        return;
      }
      const world = worldRef.current;
      if (kind === 'idle') {
        startUserTask(world, actor, 'idle');
      } else if (kind === 'sit') {
        startUserTask(world, actor, 'sit');
      } else if (kind === 'paw') {
        startUserTask(world, actor, 'paw');
      } else if (kind === 'speak') {
        startUserTask(world, actor, 'speak');
      } else if (kind === 'confused') {
        startUserTask(world, actor, 'confused');
      } else if (kind === 'signal') {
        startUserTask(world, actor, 'signal');
      } else if (kind === 'potty') {
        startUserTask(world, actor, 'potty');
      } else if (kind === 'eat') {
        startUserTask(world, actor, 'eat');
      } else if (kind === 'refuse') {
        startUserTask(world, actor, 'refuse');
      } else if (kind === 'yawn') {
        startUserTask(world, actor, 'sleep');
      } else if (kind === 'purr') {
        startUserTask(world, actor, 'react', 0.8);
      } else if (kind === 'wiggle') {
        startUserTask(world, actor, 'react', 0.2);
      } else if (kind === 'fetch') {
        startUserTask(world, actor, 'fetch', 1, nextDrop, nextFlick);
      }
      redraw();
    },
    [redraw],
  );

  const beginTravel = useCallback(
    (dest: Scene) => {
      const world = worldRef.current;
      const actor = world.actors[0];
      if (world.scene === dest && travelRef.current == null) {
        return;
      }
      if (travelRef.current?.dest === dest) {
        return;
      }
      if (reducedRef.current || !actor) {
        travelRef.current = null;
        setWorldScene(world, dest);
        onTravelingRef.current?.(false);
        redraw();
        return;
      }
      const asleep = actor.asleep || actor.task.type === 'sleep';
      if (!travelRef.current || travelRef.current.phase === 'enter') {
        startSceneExit(world, actor);
        travelRef.current = { dest, phase: 'exit', fade: 0, asleep };
        onTravelingRef.current?.(true);
      } else {
        travelRef.current.dest = dest;
        travelRef.current.asleep = asleep || travelRef.current.asleep;
      }
      redraw();
    },
    [redraw],
  );

  useEffect(() => {
    beginTravel(scene);
  }, [beginTravel, scene]);

  const signalStartedAt = pet.care.potty.signal?.startedAt;
  useEffect(() => {
    if (travelRef.current) {
      return;
    }
    const actor = worldRef.current.actors[0];
    if (actor && signalStartedAt != null) {
      startUserTask(worldRef.current, actor, 'signal');
      redraw();
    }
  }, [redraw, signalStartedAt]);

  useEffect(() => {
    if (travelRef.current) {
      pendingCue.current = { kind: cueKind, token: cueToken, drop, flick };
      return;
    }
    applyCue(cueKind, drop, flick);
  }, [applyCue, cueKind, cueToken, drop, flick]);

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
    if (cuddleActive && !cuddleLive.current && !travelRef.current) {
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
  const pendingEnergy = useRef(0);
  const pendingHunger = useRef(0);
  const pendingThirst = useRef(0);
  const onWeightRef = useRef(onWeightDelta);
  const onEnergyRef = useRef(onEnergyDelta);
  const onHungerRef = useRef(onHungerDelta);
  const onThirstRef = useRef(onThirstDelta);
  useEffect(() => {
    onWeightRef.current = onWeightDelta;
    onEnergyRef.current = onEnergyDelta;
    onHungerRef.current = onHungerDelta;
    onThirstRef.current = onThirstDelta;
  }, [onEnergyDelta, onHungerDelta, onThirstDelta, onWeightDelta]);
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
  const flushEnergy = useCallback((force: boolean) => {
    const delta = pendingEnergy.current;
    if (Math.abs(delta) <= 0.00001) {
      pendingEnergy.current = 0;
      return;
    }
    if (!force && Math.abs(delta) < 0.4) {
      return;
    }
    pendingEnergy.current = 0;
    onEnergyRef.current(delta);
  }, []);
  const flushHunger = useCallback((force: boolean) => {
    const delta = pendingHunger.current;
    if (Math.abs(delta) <= 0.00001) {
      pendingHunger.current = 0;
      return;
    }
    if (!force && Math.abs(delta) < 0.4) {
      return;
    }
    pendingHunger.current = 0;
    onHungerRef.current(delta);
  }, []);
  const flushThirst = useCallback((force: boolean) => {
    const delta = pendingThirst.current;
    if (Math.abs(delta) <= 0.00001) {
      pendingThirst.current = 0;
      return;
    }
    if (!force && Math.abs(delta) < 0.4) {
      return;
    }
    pendingThirst.current = 0;
    onThirstRef.current(delta);
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
  const onEnergyPopRef = useRef(onEnergyPop);
  useEffect(() => {
    onEnergyPopRef.current = onEnergyPop;
  }, [onEnergyPop]);
  const onTummyPopRef = useRef(onTummyPop);
  useEffect(() => {
    onTummyPopRef.current = onTummyPop;
  }, [onTummyPop]);
  const hungerRef = useRef(pet.needs.hunger);
  hungerRef.current = pet.needs.hunger;
  const statusRef = useRef('');

  const step = useCallback(
    (elapsedMs: number) => {
      const world = worldRef.current;
      const dt = frameDt(elapsedMs, activeRef.current);
      update(world, dt);
      const travel = travelRef.current;
      const actor = world.actors[0];
      if (travel && actor) {
        if (travel.phase === 'exit') {
          const gate = actor.task.poi?.x ?? 0;
          if (actor.x >= gate - 8) {
            travel.phase = 'fade';
          }
        }
        if (travel.phase === 'fade') {
          travel.fade = Math.min(1, travel.fade + dt / 0.85);
          if (travel.fade >= 1) {
            startSceneEnter(world, actor, travel.dest);
            travel.phase = 'enter';
            travel.fade = 0;
          }
        }
        if (travel.phase === 'enter' && !isSceneTravel(actor)) {
          if (travel.asleep) {
            startUserTask(world, actor, 'sleep');
          }
          travelRef.current = null;
          onTravelingRef.current?.(false);
          const queued = pendingCue.current;
          pendingCue.current = null;
          if (queued) {
            applyCue(queued.kind, queued.drop, queued.flick);
          }
        }
      }
      for (const sound of takeSounds(world)) {
        playVoice(sound);
      }
      const meals = takeMeals(world);
      for (let i = 0; i < meals; i += 1) {
        const hunger = hungerRef.current;
        if (hunger > 0 && actor) {
          const gain = Math.min(feedHungerDrop, hunger);
          const sc = actor.anchors.scale || 1;
          onTummyPopRef.current?.(
            actor.x + actor.face * sc * actor.anchors.head.x,
            actor.y - actor.z + sc * (actor.anchors.head.y - actor.anchors.head.radius) - 18,
            gain,
          );
        }
        onAteRef.current?.();
      }
      const drinks = takeBowlDrinks(world);
      for (let i = 0; i < drinks; i += 1) {
        onDrankRef.current?.(true);
      }
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
        pendingEnergy.current += takeEnergyDelta(actor);
        flushEnergy(false);
        pendingHunger.current += takeHungerDelta(actor);
        flushHunger(false);
        pendingThirst.current += takeThirstDelta(actor);
        flushThirst(false);
        const pops = takeEnergyPops(actor);
        if (pops > 0) {
          const sc = actor.anchors.scale || 1;
          const x = actor.x + actor.face * sc * actor.anchors.head.x;
          const y = actor.y - actor.z + sc * (actor.anchors.head.y - actor.anchors.head.radius) - 18;
          for (let i = 0; i < pops; i += 1) {
            onEnergyPopRef.current?.(x, y);
          }
        }
        const status = statusOf(actor);
        if (status !== statusRef.current) {
          statusRef.current = status;
          onStatusRef.current?.(status);
        }
      }
      redraw();
    },
    [applyCue, flushEnergy, flushHunger, flushThirst, flushWeight, redraw],
  );

  const kick = useRef<() => void>(() => undefined);

  useEffect(() => {
    return () => {
      flushWeight(true);
      flushEnergy(true);
      flushHunger(true);
      flushThirst(true);
    };
  }, [flushEnergy, flushHunger, flushThirst, flushWeight, pet.id]);

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
