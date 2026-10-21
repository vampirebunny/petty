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
  setCuddleGesturing,
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
  beginGreeting,
  patGreeting,
  takePendingGreeting,
  debugFlipFace,
  debugGreeting,
  planGreeting,
  greetingIds,
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
  takeMoodPops,
  takeHungerDelta,
  takeHydrationDelta,
  takeWeightDelta,
  todAt,
  update,
} from '../actor';
import { useStageSize } from './useStageSize';
import type { CuddleOut, CuddleTouch, CuddleZone, Scene, TimeOfDay, World } from '../actor';
import { playVoice } from '../audio/voice';
import { attributeScore, feedEnergyGain, feedHungerDrop } from '../sim';
import type { PointAdd } from './cuddle/pointAdds';
import type { Cue, PetState } from '../sim/types';
import { applyFurniture, furnitureAt, movePiece, syncFurniture } from '../actor/furniture';
import { solarHour } from '../actor/sky';
import { drawWorld } from './skia/world';

// What the home screen can ask of the pet while Cuddle is on. Points are stage coordinates.
export type StageHandle = {
  pat: () => 'bonus' | 'repeat' | 'interrupt' | 'none';
  flipFace: () => void;
  setTimeScale: (scale: number) => void;
  playGreeting: (id: string) => void;
  greetingIds: () => string[];
  label: () => string;
  furnitureAt: (x: number, y: number) => string | null;
  moveFurniture: (pieceId: string, x: number, y: number) => { sceneId: string; x: number; y: number } | null;
};

export type CuddleHandle = {
  zoneAt: (x: number, y: number) => CuddleZone | null;
  touch: (touch: CuddleTouch) => void;
  phase: () => string | null;
  backPath: () => { from: { x: number; y: number }; to: { x: number; y: number } } | null;
  setGesturing: (on: boolean) => void;
};

type Props = {
  cuddleActive?: boolean;
  cuddleRef?: Ref<CuddleHandle>;
  stageRef?: Ref<StageHandle>;
  onCuddleEvent?: (event: CuddleOut | { type: 'interrupted' }) => void;
  pet: PetState;
  cueKind: Cue['kind'];
  cueToken: number;
  drop?: { x: number; y: number };
  flick?: { vx: number; vy: number; vz: number };
  elapsedH?: number;
  hour: number | null;
  reducedMotion: boolean;
  sceneOverride?: Scene | null;
  onStatus?: (status: string) => void;
  onWeightDelta: (delta: number) => void;
  onEnergyDelta: (delta: number) => void;
  onHungerDelta: (delta: number) => void;
  onHydrationDelta: (delta: number) => void;
  onDrank?: (fromBowl: boolean) => void;
  onAte?: () => void;
  onTraveling?: (active: boolean) => void;
  onPointAdds?: (adds: PointAdd[]) => void;
  onGreeting?: (id: string) => void;
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
    hydration: Math.min(1, Math.max(0, pet.hydration / 100)),
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
  elapsedH,
  hour,
  reducedMotion,
  sceneOverride,
  onStatus,
  onWeightDelta,
  onEnergyDelta,
  onHungerDelta,
  onHydrationDelta,
  onDrank,
  onAte,
  onTraveling,
  onPointAdds,
  onGreeting,
  stageRef,
}: Props) {
  const { viewWidth, viewHeight } = useStageSize();
  const widthRef = useRef(viewWidth);
  const heightRef = useRef(viewHeight);
  widthRef.current = viewWidth;
  heightRef.current = viewHeight;
  const species = breedById(pet.breedId)?.species === 'cat' ? 'cat' : 'dog';
  const baseScene = sceneForSpecies(sceneOverride ?? sceneById(pet.sceneId), species);
  const furnitureKey = pet.furniture.map((piece) => piece.id).join('|');
  const placementKey = pet.furniturePlaced
    .map((place) => `${place.pieceId}@${place.sceneId}:${place.x},${place.y}`)
    .join('|');
  const scene = useMemo(
    () => applyFurniture(baseScene, pet.furniture, pet.furniturePlaced),
    [baseScene, furnitureKey, placementKey, pet.furniture, pet.furniturePlaced],
  );
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
      // Sunrise maps to 06:00 and sunset to 18:00, so the sky gradient follows the real day.
      // A debug hour is already on that scale, so it goes straight to todAt.
      const live = solarHour(new Date(now));
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
    pet.hydration,
    pet.waterLevel,
    pet.weight,
    redraw,
  ]);

  const pendingCue = useRef<{ kind: typeof cueKind; token: number; drop?: typeof drop; flick?: typeof flick; elapsedH?: number } | null>(null);
  const petRef = useRef(pet);
  const elapsedRef = useRef(elapsedH);
  const onGreetingRef = useRef(onGreeting);

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
      } else if (kind === 'greet') {
        const current = petRef.current;
        const sleeping = actor.asleep || actor.task.type === 'sleep' || actor.idle.mode === 'nap';
        const plan = planGreeting({
          species: breedById(current.breedId)?.species === 'cat' ? 'cat' : 'dog',
          elapsedH: elapsedRef.current ?? 0,
          energy: current.needs.energy,
          affection: current.attributes.current.affection,
          boldness: current.attributes.current.boldness,
          affectionPotential: current.attributes.potential.affection,
          boldnessPotential: current.attributes.potential.boldness,
          ageDays: current.ageDays,
          vitality: current.vitality,
          asleep: sleeping,
          reduced: reducedRef.current,
          lastId: current.lastGreetingId ?? null,
          rng: world.rng,
        });
        if (plan) {
          const pool = current.toys.includes('ball') ? current.toys : ['ball', ...current.toys];
          world.toyPool = pool;
          beginGreeting(world, actor, plan);
        }
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
    const world = worldRef.current;
    if (world.scene.id !== scene.id) {
      beginTravel(scene);
      return;
    }
    syncFurniture(world.scene, scene);
  }, [beginTravel, scene]);

  useEffect(() => {
    elapsedRef.current = elapsedH;
    if (travelRef.current) {
      pendingCue.current = { kind: cueKind, token: cueToken, drop, flick, elapsedH };
      return;
    }
    applyCue(cueKind, drop, flick);
  }, [applyCue, cueKind, cueToken, drop, elapsedH, flick]);

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
      setGesturing: (on) => {
        const actor = worldRef.current.actors[0];
        if (actor) {
          setCuddleGesturing(actor, on);
        }
      },
    }),
    [],
  );

  useImperativeHandle(
    stageRef,
    () => ({
      pat: () => {
        const actor = worldRef.current.actors[0];
        return actor ? patGreeting(worldRef.current, actor) : 'none';
      },
      flipFace: () => {
        const actor = worldRef.current.actors[0];
        if (actor) {
          debugFlipFace(actor);
        }
      },
      setTimeScale: (scale: number) => {
        worldRef.current.timeScale = scale;
      },
      playGreeting: (id: string) => {
        const actor = worldRef.current.actors[0];
        const current = petRef.current;
        if (!actor) {
          return;
        }
        if (id === 'short' || id === 'long') {
          const plan = planGreeting({
            species: breedById(current.breedId)?.species === 'cat' ? 'cat' : 'dog',
            elapsedH: id === 'long' ? 13 : 4 / 60,
            energy: current.needs.energy,
            affection: current.attributes.current.affection,
            boldness: current.attributes.current.boldness,
            affectionPotential: current.attributes.potential.affection,
            boldnessPotential: current.attributes.potential.boldness,
            ageDays: current.ageDays,
            vitality: current.vitality,
            asleep: false,
            reduced: false,
            lastId: null,
            rng: worldRef.current.rng,
          });
          if (plan) {
            beginGreeting(worldRef.current, actor, plan);
          }
          return;
        }
        debugGreeting(worldRef.current, actor, id, current.ageDays, current.vitality, current.needs.energy);
      },
      greetingIds: () => greetingIds(breedById(petRef.current.breedId)?.species === 'cat' ? 'cat' : 'dog'),
      label: () => worldRef.current.greetLabel ?? '',
      furnitureAt: (x, y) => (travelRef.current ? null : furnitureAt(worldRef.current.scene, x, y)),
      moveFurniture: (pieceId, x, y) => (travelRef.current ? null : movePiece(worldRef.current.scene, pieceId, x, y)),
    }),
    [],
  );

  const cuddleLive = useRef(false);
  useEffect(() => {
    petRef.current = pet;
  }, [pet]);
  useEffect(() => {
    elapsedRef.current = elapsedH;
  }, [elapsedH]);
  useEffect(() => {
    onGreetingRef.current = onGreeting;
  }, [onGreeting]);
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
  const pendingHydration = useRef(0);
  const onWeightRef = useRef(onWeightDelta);
  const onEnergyRef = useRef(onEnergyDelta);
  const onHungerRef = useRef(onHungerDelta);
  const onHydrationRef = useRef(onHydrationDelta);
  useEffect(() => {
    onWeightRef.current = onWeightDelta;
    onEnergyRef.current = onEnergyDelta;
    onHungerRef.current = onHungerDelta;
    onHydrationRef.current = onHydrationDelta;
  }, [onEnergyDelta, onHungerDelta, onHydrationDelta, onWeightDelta]);
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
  const flushHydration = useCallback((force: boolean) => {
    const delta = pendingHydration.current;
    if (Math.abs(delta) <= 0.00001) {
      pendingHydration.current = 0;
      return;
    }
    if (!force && Math.abs(delta) < 0.4) {
      return;
    }
    pendingHydration.current = 0;
    onHydrationRef.current(delta);
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
  const onPointAddsRef = useRef(onPointAdds);
  useEffect(() => {
    onPointAddsRef.current = onPointAdds;
  }, [onPointAdds]);
  const hungerRef = useRef(pet.needs.hunger);
  hungerRef.current = pet.needs.hunger;
  const energyRef = useRef(pet.needs.energy);
  energyRef.current = pet.needs.energy;
  const statusRef = useRef('');

  const step = useCallback(
    (elapsedMs: number) => {
      const world = worldRef.current;
      const dt = frameDt(elapsedMs, activeRef.current);
      update(world, dt);
      const greeted = world.actors[0] ? takePendingGreeting(world.actors[0]) : null;
      if (greeted) {
        onGreetingRef.current?.(greeted);
      }
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
            if (queued.elapsedH != null) {
              elapsedRef.current = queued.elapsedH;
            }
            applyCue(queued.kind, queued.drop, queued.flick);
          }
        }
      }
      for (const sound of takeSounds(world)) {
        playVoice(sound);
      }
      const pointAdds: PointAdd[] = [];
      const meals = takeMeals(world);
      for (let i = 0; i < meals; i += 1) {
        if (actor) {
          const sc = actor.anchors.scale || 1;
          const x = actor.x + actor.face * sc * actor.anchors.head.x;
          const y = actor.y - actor.z + sc * (actor.anchors.head.y - actor.anchors.head.radius) - 18;
          const tummy = Math.min(feedHungerDrop, Math.max(0, hungerRef.current));
          if (tummy > 0) {
            pointAdds.push({ kind: 'tummy', x, y, amount: tummy });
            hungerRef.current = Math.max(0, hungerRef.current - tummy);
          }
          const energy = Math.min(feedEnergyGain, Math.max(0, 100 - energyRef.current));
          if (energy > 0) {
            pointAdds.push({ kind: 'energy', x, y, amount: energy });
            energyRef.current = Math.min(100, energyRef.current + energy);
          }
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
        pendingHydration.current += takeHydrationDelta(actor);
        flushHydration(false);
        const pops = takeEnergyPops(actor);
        const moodPops = takeMoodPops(actor);
        if (pops.length > 0 || moodPops.length > 0) {
          const sc = actor.anchors.scale || 1;
          const x = actor.x + actor.face * sc * actor.anchors.head.x;
          const y = actor.y - actor.z + sc * (actor.anchors.head.y - actor.anchors.head.radius) - 18;
          for (const amount of pops) {
            pointAdds.push({ kind: 'energy', x, y, amount });
            energyRef.current = Math.min(100, energyRef.current + amount);
          }
          for (const amount of moodPops) {
            pointAdds.push({ kind: 'mood', x, y, amount });
          }
        }
        if (pointAdds.length > 0) {
          onPointAddsRef.current?.(pointAdds);
        }
        const status = statusOf(actor);
        if (status !== statusRef.current) {
          statusRef.current = status;
          onStatusRef.current?.(status);
        }
      }
      redraw();
    },
    [applyCue, flushEnergy, flushHunger, flushHydration, flushWeight, redraw],
  );

  const kick = useRef<() => void>(() => undefined);

  useEffect(() => {
    return () => {
      flushWeight(true);
      flushEnergy(true);
      flushHunger(true);
      flushHydration(true);
    };
  }, [flushEnergy, flushHunger, flushHydration, flushWeight, pet.id]);

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
