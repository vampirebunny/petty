import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef } from 'react';
import type { Ref } from 'react';
import { AppState, StyleSheet } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { Canvas, Picture, Rect, Skia } from '@shopify/react-native-skia';
import type { SkPicture } from '@shopify/react-native-skia';

import {
  createWorld,
  equipToy,
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
  startTreat,
  clearPlayToy,
  startHeld,
  steerHeld,
  setPlayTouch,
  releaseHeldFinger,
  stopHeld,
  startUserTask,
  startTrick,
  startSpook,
  startSpookReturn,
  takeSpookSettle,
  takeSpookReturn,
  trickPropAt,
  placeTrickProp,
  moveTrickProp,
  releaseStoredPiece,
  stowTrickProp,
  takeTrickFinish,
  inviteCare,
  takePendingRest,
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
  takePlayFinds,
  takeTreatMoods,
  takeTreatFinishes,
  takePondDrinks,
  takeCuddleOut,
  takeSounds,
  takeBirdChirps,
  stageBleed,
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
import type { StageFrame } from './wideLayout';
import type { CuddleOut, CuddleTouch, CuddleZone, Scene, TimeOfDay, World } from '../actor';
import type { ParkOffer } from '../actor/types';
import { syncParkVisitors } from '../actor/parkVisitors';
import { birdVisitSeed } from '../actor/birds';
import { playChirp, playVoice } from '../audio/voice';
import { attributeScore, drinkHydrationGain, feedEnergyGain, feedHungerDrop } from '../sim';
import type { PointAdd } from './cuddle/pointAdds';
import type { Cue, PetState } from '../sim/types';
import type { FurniturePiece, FurniturePlacement } from '../actor/furniture';
import { applyFurniture, furnitureAt, movePiece, showPiece, syncFurniture } from '../actor/furniture';
import { askHouseLeave, houseInside } from '../actor/conservatory';
import { askFurnitureOff, furnitureClaims } from '../actor/furnitureUse';
import { skyAt, solarHour } from '../actor/sky';
import { holdMotionRecords } from './skia/env';
import { drawWorld, roomPlateKey } from './skia/world';
import { propsForTrick, type TrickPropType } from '../sim/trickProps';
import type { TrickOutcome } from '../actor/data/trickScripts';
import {
  acceptParkFindPrompt,
  createParkFindVisit,
  dismissParkFindPrompt,
  forceParkFindNoticeNow,
  noteParkFindInput,
} from '../parkFinds/visit';
import type { FindVariant } from '../parkFinds/types';

// What the home screen can ask of the pet while Cuddle is on. Points are stage coordinates.
export type StageHandle = {
  pat: () => 'bonus' | 'repeat' | 'interrupt' | 'none';
  flipFace: () => void;
  setTimeScale: (scale: number) => void;
  playGreeting: (id: string) => void;
  greetingIds: () => string[];
  label: () => string;
  furnitureAt: (x: number, y: number) => string | null;
  trickPropAt: (x: number, y: number) => string | null;
  moveTrickProp: (instanceId: string, x: number, y: number) => void;
  liftTrickProp: (owned: { instanceId: string; type: TrickPropType; sourceTrickId: string }) => void;
  trickPropIds: (type: TrickPropType | null, mastered: boolean) => string[];
  startTrick: (trickId: string, outcome: TrickOutcome, propIds: string[]) => boolean;
  // Stores the callback for a miss cue that is about to start the bolt.
  armSpook: (onSettled: () => void) => void;
  // Runs a short on-stage bolt, then calls back. Immediate when the pet cannot move.
  spook: (onSettled: () => void) => void;
  // Walks back to where the bolt started. Immediate when the pet never left.
  walkBack: (onArrived: () => void) => void;
  moveFurniture: (pieceId: string, x: number, y: number) => { sceneId: string; x: number; y: number } | null;
  showStoredFurniture: (piece: FurniturePiece) => { sceneId: string; x: number; y: number } | null;
  stowFurniture: (pieceId: string) => boolean | 'wait';
  stowTrickProp: (instanceId: string) => void;
  placedTrickIds: () => string[];
  liftedProp: () => string | null;
  setLiftedProp: (instanceId: string | null) => void;
  invite: (kind: 'food' | 'water' | 'bed') => 'went' | 'queued' | 'already';
  setLifted: (pieceId: string | null) => void;
  squish: (pieceId: string) => void;
  // Changes the toy in play. True when a toy was already out and only its kind changed.
  swapToy: (kind: string) => boolean;
  // The toy in the scene, or the wand or laser being held.
  playKind: () => string | null;
  // Removes the toy and stops play.
  clearPlay: () => void;
  startHeld: (kind: 'wand' | 'laser') => void;
  steerHeld: (x: number, y: number, down: boolean) => void;
  setPlayTouch: (on: boolean) => void;
  releaseHeldFinger: () => void;
  stopHeld: () => void;
  heldOn: () => boolean;
  propPoint: (pieceId: string) => { x: number; y: number } | null;
  // Walks off the right and fades the room, then calls back instead of entering a scene.
  depart: (onLeft: () => void) => void;
  parkFindPrompting: () => boolean;
  parkFindAccept: (species: 'dog' | 'cat') => { itemId: string; rarity: string } | null;
  parkFindDismiss: () => void;
  parkFindTakeModal: () => { itemId: string } | null;
  parkFindNoteInput: () => void;
  parkFindForceNotice: (species: 'dog' | 'cat', variant: 'dig' | 'grass' | 'bush') => void;
  parkFindBootVisit: (species: 'dog' | 'cat', firstVisit: boolean) => void;
  parkFindClearVisit: () => void;
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
  treatId?: string;
  moodGain?: number;
  drop?: { x: number; y: number };
  flick?: { vx: number; vy: number; vz: number };
  elapsedH?: number;
  snapSceneToken?: number;
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
  onPlayFind?: (kind: 'fetch_round' | 'toy_round', at: { x: number; y: number }) => void;
  onTreatMood?: (amount: number) => void;
  onTreatEaten?: () => void;
  onTreatSkipped?: () => void;
  onTraveling?: (active: boolean) => void;
  // The drawn room just changed. Fires on the cut (fade complete), or immediately when there is no fade.
  onSceneCut?: (sceneId: string) => void;
  // Fresh mount from the road. The pet walks in from off the left. Reduce Motion stays put.
  enterFromLeft?: boolean;
  onWalkIn?: () => void;
  onPointAdds?: (adds: PointAdd[]) => void;
  onGreeting?: (id: string) => void;
  onFellAsleep?: () => void;
  onHouseStowed?: (pieceId: string) => void;
  onHouseMoved?: (pieceId: string, sceneId: string, x: number, y: number) => void;
  onTrickEnd?: () => void;
  furniture?: FurniturePiece[];
  placements?: FurniturePlacement[];
  toys?: string[];
  playToy?: string | null;
  onHeld?: (on: boolean) => void;
  // Measured scene pane. Omitted on a stacked layout, which sizes from the window.
  frame?: StageFrame;
  // Stacked layouts only. A wide pane keeps its own height.
  heightShare?: number;
  // Home park only. Other screens leave this off.
  parkVisitors?: boolean;
  parkOffers?: ParkOffer[];
  parkStranger?: (nonce: number) => ParkOffer;
  /** Park finds UI: prompt visibility, modal due after drop, reveal for persisting. */
  onParkFindUi?: (signal: {
    prompting: boolean;
    modalItemId: string | null;
    revealed: { itemId: string; rarity: string } | null;
  }) => void;
};

function actorsRushing(world: World): boolean {
  return world.actors.some((actor) => {
    const gait = actor.gait.current;
    return (
      actor.speed > 12 ||
      actor.pose.walk > 0.35 ||
      actor.task.type === 'travel' ||
      actor.task.type === 'fetch' ||
      gait === 'trot' ||
      gait === 'canter' ||
      gait === 'gallop'
    );
  });
}

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
  treatId,
  moodGain,
  drop,
  flick,
  elapsedH,
  snapSceneToken = 0,
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
  onPlayFind,
  onTreatMood,
  onTreatEaten,
  onTreatSkipped,
  onTraveling,
  onSceneCut,
  enterFromLeft = false,
  onWalkIn,
  onPointAdds,
  onGreeting,
  onFellAsleep,
  onHouseStowed,
  onHouseMoved,
  onTrickEnd,
  stageRef,
  furniture = [],
  placements = [],
  toys = [],
  playToy = null,
  onHeld,
  frame,
  heightShare,
  parkVisitors = false,
  parkOffers = [],
  parkStranger,
  onParkFindUi,
}: Props) {
  const { viewWidth, viewHeight } = useStageSize(frame, undefined, heightShare);
  const widthRef = useRef(viewWidth);
  const heightRef = useRef(viewHeight);
  const species = breedById(pet.breedId)?.species === 'cat' ? 'cat' : 'dog';
  const baseScene = sceneForSpecies(sceneOverride ?? sceneById(pet.sceneId), species);
  const scene = useMemo(
    () => applyFurniture(baseScene, furniture, placements),
    [baseScene, furniture, placements],
  );
  const worldRef = useRef<World>(createWorld([spawnActor(sourceOf(pet))], 1, scene));
  const parkOffersRef = useRef(parkOffers);
  const parkStrangerRef = useRef(parkStranger);
  const parkOnRef = useRef(parkVisitors);
  const onParkFindUiRef = useRef(onParkFindUi);
  const parkFindUiSent = useRef({ prompting: false, modalItemId: null as string | null, revealedId: null as string | null });
  const activeRef = useRef(AppState.currentState === 'active');
  const hourRef = useRef(hour);
  const reducedRef = useRef(reducedMotion);
  const toysRef = useRef(toys);
  const playToyRef = useRef(playToy);
  const todRef = useRef<TimeOfDay>(todAt(12));
  const todAtMs = useRef(0);
  useLayoutEffect(() => {
    widthRef.current = viewWidth;
    heightRef.current = viewHeight;
  }, [viewHeight, viewWidth]);
  useLayoutEffect(() => {
    parkOffersRef.current = parkOffers;
    parkStrangerRef.current = parkStranger;
    parkOnRef.current = parkVisitors;
  }, [parkOffers, parkStranger, parkVisitors]);
  useLayoutEffect(() => {
    onParkFindUiRef.current = onParkFindUi;
  }, [onParkFindUi]);
  useLayoutEffect(() => {
    toysRef.current = toys;
    playToyRef.current = playToy;
  }, [playToy, toys]);
  useLayoutEffect(() => {
    if (hourRef.current !== hour) {
      todAtMs.current = 0;
    }
    hourRef.current = hour;
    reducedRef.current = reducedMotion;
  }, [hour, reducedMotion]);
  const blank = useMemo(() => {
    const recorder = Skia.PictureRecorder();
    recorder.beginRecording(Skia.XYWHRect(0, 0, viewWidth, viewHeight));
    return recorder.finishRecordingAsPicture();
  }, [viewHeight, viewWidth]);
  // Furniture behind the pet, the pet and the ball, furniture in front. The room pictures
  // stay put until the pet or the ball crosses a piece. Scenery refreshes on its slow step
  // only while the pet is still, so a run does not rebuild the room.
  const backPicture = useSharedValue<SkPicture>(blank);
  const livePicture = useSharedValue<SkPicture>(blank);
  const frontPicture = useSharedValue<SkPicture>(blank);
  const fadeOpacity = useSharedValue(0);
  const fadeSink = useRef(fadeOpacity);
  const plates = useRef({ back: backPicture, live: livePicture, front: frontPicture, key: '', step: 0 });
  useLayoutEffect(() => {
    plates.current.back = backPicture;
    plates.current.live = livePicture;
    plates.current.front = frontPicture;
    fadeSink.current = fadeOpacity;
  }, [backPicture, fadeOpacity, frontPicture, livePicture]);
  const travelRef = useRef<{
    dest: Scene | null;
    phase: 'exit' | 'fade' | 'enter';
    fade: number;
    onLeft?: () => void;
  } | null>(null);
  const onTravelingRef = useRef(onTraveling);
  const onSceneCutRef = useRef(onSceneCut);
  const onWalkInRef = useRef(onWalkIn);
  useLayoutEffect(() => {
    onTravelingRef.current = onTraveling;
    onSceneCutRef.current = onSceneCut;
    onWalkInRef.current = onWalkIn;
  }, [onSceneCut, onTraveling, onWalkIn]);

  const redraw = useCallback(() => {
    const width = widthRef.current;
    const height = heightRef.current;
    const bounds = Skia.XYWHRect(0, 0, width, height);
    const now = Date.now();
    if (now - todAtMs.current > 1000) {
      // Sunrise maps to 06:00 and sunset to 18:00, so the sky gradient follows the real day.
      // A debug hour is already on that scale, so it goes straight to todAt.
      const live = solarHour(new Date(now));
      todRef.current = todAt(hourRef.current == null ? live : hourRef.current);
      todAtMs.current = now;
    }
    const world = worldRef.current;
    world.reducedMotion = reducedRef.current;
    const travel = travelRef.current;
    const fade = travel?.fade ?? 0;
    fadeSink.current.value = fade;
    const stepNow = world.reducedMotion ? 0 : Math.round(world.t * 10);
    // Moving the pet already spends the frame. Rebuilding the lawn and the trees then, or on
    // each step of the fade, is what makes a run and the fade stutter.
    const rushing = fade > 0.001 || travel?.phase === 'fade' || actorsRushing(world);
    const step = rushing ? plates.current.step : stepNow;
    const key = roomPlateKey(world, width, height, todRef.current, step);
    const record = (layer: 'back' | 'live' | 'front') => {
      const recorder = Skia.PictureRecorder();
      const canvas = recorder.beginRecording(bounds);
      drawWorld(canvas, world, width, height, todRef.current, reducedRef.current, undefined, undefined, undefined, undefined, layer);
      return recorder.finishRecordingAsPicture();
    };
    // Leave the previous picture for GC. dispose() marks the host object dead while Fabric
    // and the Skia recorder can still read it, which throws and wedges the React scheduler.
    if (rushing) {
      holdMotionRecords(true);
    }
    try {
      if (key !== plates.current.key) {
        plates.current.back.value = record('back');
        plates.current.front.value = record('front');
        plates.current.key = key;
        plates.current.step = step;
      }
      plates.current.live.value = record('live');
    } finally {
      holdMotionRecords(false);
    }
  }, []);
  const redrawRef = useRef(redraw);
  useEffect(() => {
    redrawRef.current = redraw;
  }, [redraw]);

  const walkedIn = useRef(false);
  useLayoutEffect(() => {
    if (!enterFromLeft || walkedIn.current) {
      return;
    }
    walkedIn.current = true;
    onWalkInRef.current?.();
    const world = worldRef.current;
    const actor = world.actors[0];
    onSceneCutRef.current?.(world.scene.id);
    if (reducedRef.current || !actor) {
      return;
    }
    startSceneEnter(world, actor, world.scene);
    travelRef.current = { dest: world.scene, phase: 'enter', fade: 0 };
    onTravelingRef.current?.(true);
    redrawRef.current();
  }, [enterFromLeft]);

  const actorSource = useMemo(() => sourceOf(pet), [pet]);

  useEffect(() => {
    const world = worldRef.current;
    const actor = world.actors.find((item) => item.id === actorSource.id && !item.guest);
    const guests = world.actors.filter((item) => item.guest);
    if (!actor) {
      world.actors = [spawnActor(actorSource), ...guests];
      world.items = [];
    } else {
      syncActor(actor, actorSource);
      world.actors = [actor, ...guests];
    }
    syncWorldWater(world, pet.waterLevel);
    syncWorldFood(world, pet.foodInBowl, pet.bowlItemId != null);
    redraw();
  }, [actorSource, pet.bowlItemId, pet.foodInBowl, pet.waterLevel, redraw]);

  const pendingCue = useRef<{
    kind: typeof cueKind;
    token: number;
    drop?: typeof drop;
    flick?: typeof flick;
    elapsedH?: number;
    treatId?: string;
    moodGain?: number;
  } | null>(null);
  const spookSettledRef = useRef<(() => void) | null>(null);
  const spookReturnRef = useRef<(() => void) | null>(null);
  const onTreatMoodRef = useRef(onTreatMood);
  const onTreatEatenRef = useRef(onTreatEaten);
  const onTreatSkippedRef = useRef(onTreatSkipped);
  useEffect(() => {
    onTreatMoodRef.current = onTreatMood;
    onTreatEatenRef.current = onTreatEaten;
    onTreatSkippedRef.current = onTreatSkipped;
  }, [onTreatEaten, onTreatMood, onTreatSkipped]);
  const petRef = useRef(pet);
  const elapsedRef = useRef(elapsedH);
  const onGreetingRef = useRef(onGreeting);

  const applyCue = useCallback(
    (
      kind: typeof cueKind,
      nextDrop?: typeof drop,
      nextFlick?: typeof flick,
      nextTreatId?: string,
      nextMood?: number,
    ) => {
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
      } else if (kind === 'praise') {
        actor.bark = { active: true, t: 0, fired: [false, false], open: 0, sound: true };
      } else if (kind === 'confused') {
        if (reducedRef.current || !startSpook(world, actor)) {
          const settled = spookSettledRef.current;
          spookSettledRef.current = null;
          settled?.();
        }
      } else if (kind === 'eat') {
        inviteCare(world, actor, 'food');
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
          world.toyPool = toysRef.current;
          beginGreeting(world, actor, plan);
        }
      } else if (kind === 'fetch') {
        world.toyKind = playToyRef.current || 'ball';
        startUserTask(world, actor, 'fetch', 1, nextDrop, nextFlick);
      } else if (kind === 'treat') {
        const mood = nextMood ?? 0;
        const started = startTreat(world, actor, nextTreatId || 'biscuit', mood);
        if (!started) {
          onTreatSkippedRef.current?.();
          if (mood > 0) {
            onTreatMoodRef.current?.(mood);
          }
        }
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
      if (!travelRef.current || travelRef.current.phase === 'enter') {
        startSceneExit(world, actor);
        travelRef.current = { dest, phase: 'exit', fade: 0 };
        onTravelingRef.current?.(true);
      } else {
        travelRef.current.dest = dest;
        travelRef.current.onLeft = undefined;
      }
      redraw();
    },
    [redraw],
  );

  const seenSnap = useRef(snapSceneToken);
  useEffect(() => {
    const world = worldRef.current;
    let snapped = false;
    if (snapSceneToken !== seenSnap.current) {
      seenSnap.current = snapSceneToken;
      if (world.scene.id !== scene.id) {
        travelRef.current = null;
        setWorldScene(world, scene);
        onTravelingRef.current?.(false);
        redraw();
        snapped = true;
      }
    }
    if (!snapped) {
      if (world.scene.id !== scene.id) {
        beginTravel(scene);
      } else {
        const removed = syncFurniture(world.scene, scene);
        for (const id of removed) {
          releaseStoredPiece(world, id);
        }
        redraw();
      }
    }
    // Already showing this room (open, snap, or reduced motion). A walk-off waits for the cut.
    if (travelRef.current == null) {
      onSceneCutRef.current?.(world.scene.id);
    }
  }, [beginTravel, redraw, scene, snapSceneToken]);

  useEffect(() => {
    petRef.current = pet;
  }, [pet]);

  useEffect(() => {
    elapsedRef.current = elapsedH;
    if (travelRef.current) {
      pendingCue.current = { kind: cueKind, token: cueToken, drop, flick, elapsedH, treatId, moodGain };
      return;
    }
    applyCue(cueKind, drop, flick, treatId, moodGain);
  }, [applyCue, cueKind, cueToken, drop, elapsedH, flick, moodGain, treatId]);

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

  const onHeldRef = useRef(onHeld);
  useLayoutEffect(() => {
    onHeldRef.current = onHeld;
  }, [onHeld]);

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
      trickPropAt: (x, y) => (travelRef.current ? null : trickPropAt(worldRef.current, x, y)),
      moveTrickProp: (instanceId, x, y) => {
        moveTrickProp(worldRef.current, instanceId, x, y);
      },
      liftTrickProp: (owned) => {
        const actor = worldRef.current.actors[0];
        if (!actor) {
          return;
        }
        placeTrickProp(worldRef.current, owned, actor.x + (actor.face >= 0 ? 70 : -70), actor.y);
      },
      trickPropIds: (type, mastered) => {
        const actor = worldRef.current.actors[0];
        if (!actor || !type) {
          return [];
        }
        return propsForTrick(worldRef.current.trickProps ?? [], type, actor.x, actor.y, mastered).map((prop) => prop.instanceId);
      },
      startTrick: (trickId, outcome, propIds) => {
        const actor = worldRef.current.actors[0];
        if (!actor) {
          return false;
        }
        return startTrick(worldRef.current, actor, trickId, outcome, propIds);
      },
      armSpook: (onSettled) => {
        spookSettledRef.current = onSettled;
      },
      spook: (onSettled) => {
        spookSettledRef.current = onSettled;
        const actor = worldRef.current.actors[0];
        if (reducedRef.current || !actor || !startSpook(worldRef.current, actor)) {
          spookSettledRef.current = null;
          onSettled();
        }
      },
      walkBack: (onArrived) => {
        spookReturnRef.current = onArrived;
        const actor = worldRef.current.actors[0];
        if (reducedRef.current || !actor || !startSpookReturn(worldRef.current, actor)) {
          spookReturnRef.current = null;
          onArrived();
        }
      },
      moveFurniture: (pieceId, x, y) => {
        if (travelRef.current) {
          return null;
        }
        const world = worldRef.current;
        const using = world.actors.find((actor) => furnitureClaims(actor, pieceId));
        if (using?.furniture) {
          askFurnitureOff(using);
          return null;
        }
        const housed = world.actors.find((actor) => actor.house?.propId === pieceId && houseInside(actor.house));
        if (housed?.house) {
          housed.house.moveAfter = { x, y };
          askHouseLeave(housed.house);
          return null;
        }
        return movePiece(world.scene, pieceId, x, y);
      },
      showStoredFurniture: (piece) => {
        const world = worldRef.current;
        const actor = world.actors[0];
        if (!actor) {
          return null;
        }
        const point = showPiece(world.scene, piece, actor.x + (actor.face >= 0 ? 70 : -70), actor.y);
        if (!point) {
          return null;
        }
        world.liftedId = piece.id;
        world.liftedPropId = null;
        redrawRef.current();
        return { sceneId: world.scene.id, x: point.x, y: point.y };
      },
      stowFurniture: (pieceId) => {
        const world = worldRef.current;
        const housed = world.actors.find((actor) => actor.house?.propId === pieceId && houseInside(actor.house));
        if (housed?.house) {
          housed.house.stowAfter = true;
          housed.house.moveAfter = null;
          askHouseLeave(housed.house);
          return 'wait';
        }
        const woke = releaseStoredPiece(world, pieceId);
        world.scene.props = world.scene.props.filter((prop) => prop.id !== pieceId);
        world.scene.pois = world.scene.pois.filter((poi) => poi.propId !== pieceId);
        if (world.liftedId === pieceId) {
          world.liftedId = null;
        }
        redrawRef.current();
        return woke;
      },
      stowTrickProp: (instanceId) => {
        stowTrickProp(worldRef.current, instanceId);
        redrawRef.current();
      },
      placedTrickIds: () => worldRef.current.trickProps.map((prop) => prop.instanceId),
      liftedProp: () => worldRef.current.liftedPropId,
      setLiftedProp: (instanceId) => {
        worldRef.current.liftedPropId = instanceId;
        if (instanceId) {
          worldRef.current.liftedId = null;
        }
      },
      invite: (kind) => {
        const actor = worldRef.current.actors[0];
        if (!actor) {
          return 'queued';
        }
        return inviteCare(worldRef.current, actor, kind);
      },
      setLifted: (pieceId) => {
        worldRef.current.liftedId = pieceId;
      },
      squish: (pieceId) => {
        const world = worldRef.current;
        world.squishId = pieceId;
        world.squishAt = world.t;
      },
      swapToy: (kind) => {
        const swapped = equipToy(worldRef.current, kind);
        if (swapped) {
          redrawRef.current();
        }
        return swapped;
      },
      playKind: () => {
        const world = worldRef.current;
        if (world.held) {
          return world.held.kind;
        }
        return world.items.find((item) => !item.kind.startsWith('treat:'))?.kind ?? null;
      },
      clearPlay: () => {
        const held = worldRef.current.held != null;
        clearPlayToy(worldRef.current);
        if (held) {
          onHeldRef.current?.(false);
        }
        redrawRef.current();
      },
      startHeld: (kind) => {
        startHeld(worldRef.current, kind);
        onHeldRef.current?.(true);
      },
      steerHeld: (x, y, down) => {
        steerHeld(worldRef.current, x, y, down);
      },
      setPlayTouch: (on) => {
        setPlayTouch(worldRef.current, on);
      },
      releaseHeldFinger: () => {
        releaseHeldFinger(worldRef.current);
      },
      stopHeld: () => {
        stopHeld(worldRef.current);
        onHeldRef.current?.(false);
      },
      heldOn: () => worldRef.current.held != null,
      propPoint: (pieceId) => {
        const prop = worldRef.current.scene.props.find((item) => item.id === pieceId);
        return prop ? { x: prop.x, y: prop.y } : null;
      },
      depart: (onLeft) => {
        const world = worldRef.current;
        const actor = world.actors[0];
        if (reducedRef.current || !actor) {
          travelRef.current = null;
          onTravelingRef.current?.(false);
          onLeft();
          return;
        }
        if (!travelRef.current || travelRef.current.phase === 'enter') {
          startSceneExit(world, actor);
          travelRef.current = { dest: null, phase: 'exit', fade: 0, onLeft };
          onTravelingRef.current?.(true);
        } else {
          travelRef.current.dest = null;
          travelRef.current.onLeft = onLeft;
        }
        redrawRef.current();
      },
      parkFindPrompting: () => worldRef.current.parkFindVisit?.prompting === true,
      parkFindAccept: (species) => {
        const world = worldRef.current;
        const actor = world.actors[0];
        if (!actor) return null;
        const item = acceptParkFindPrompt(world, actor, species);
        redrawRef.current();
        return item ? { itemId: item.id, rarity: item.rarity } : null;
      },
      parkFindDismiss: () => {
        dismissParkFindPrompt(worldRef.current);
        redrawRef.current();
      },
      parkFindTakeModal: () => {
        const visit = worldRef.current.parkFindVisit;
        if (!visit?.modalDueAt || worldRef.current.t < visit.modalDueAt || !visit.item) {
          return null;
        }
        const itemId = visit.item.id;
        visit.modalDueAt = null;
        return { itemId };
      },
      parkFindNoteInput: () => {
        noteParkFindInput(worldRef.current);
        if (worldRef.current.parkFindVisit?.prompting) {
          dismissParkFindPrompt(worldRef.current);
          redrawRef.current();
        }
      },
      parkFindForceNotice: (species, variant) => {
        const world = worldRef.current;
        const actor = world.actors[0];
        if (!actor) return;
        forceParkFindNoticeNow(world, actor, species, variant as FindVariant);
        redrawRef.current();
      },
      parkFindBootVisit: (species, firstVisit) => {
        const world = worldRef.current;
        const actor = world.actors[0];
        if (!actor || world.scene.id !== 'park') {
          world.parkFindVisit = null;
          return;
        }
        world.parkFindVisit = createParkFindVisit(world, actor, species, firstVisit);
        parkFindUiSent.current = { prompting: false, modalItemId: null, revealedId: null };
        redrawRef.current();
      },
      parkFindClearVisit: () => {
        worldRef.current.parkFindVisit = null;
        parkFindUiSent.current = { prompting: false, modalItemId: null, revealedId: null };
      },
    }),
    [],
  );

  const cuddleLive = useRef(false);
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

  const heldWas = useRef(false);
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
  const onPlayFindRef = useRef(onPlayFind);
  useEffect(() => {
    onPlayFindRef.current = onPlayFind;
  }, [onPlayFind]);
  const onPointAddsRef = useRef(onPointAdds);
  useEffect(() => {
    onPointAddsRef.current = onPointAdds;
  }, [onPointAdds]);
  const onFellAsleepRef = useRef(onFellAsleep);
  const onTrickEndRef = useRef(onTrickEnd);
  const onHouseStowedRef = useRef(onHouseStowed);
  const onHouseMovedRef = useRef(onHouseMoved);
  useEffect(() => {
    onFellAsleepRef.current = onFellAsleep;
    onTrickEndRef.current = onTrickEnd;
    onHouseStowedRef.current = onHouseStowed;
    onHouseMovedRef.current = onHouseMoved;
  }, [onFellAsleep, onTrickEnd, onHouseStowed, onHouseMoved]);
  const hungerRef = useRef(pet.needs.hunger);
  const energyRef = useRef(pet.needs.energy);
  const hydrationRef = useRef(pet.hydration);
  useLayoutEffect(() => {
    hungerRef.current = pet.needs.hunger;
    energyRef.current = pet.needs.energy;
    hydrationRef.current = pet.hydration;
  }, [pet.hydration, pet.needs.energy, pet.needs.hunger]);
  const statusRef = useRef('');

  const step = useCallback(
    (elapsedMs: number) => {
      const world = worldRef.current;
      const player = world.actors.find((item) => !item.guest);
      const current = petRef.current;
      if (player && player.id === current.id) {
        player.mood = Math.min(1, Math.max(0, current.needs.happiness / 100));
        player.energy = Math.min(1, Math.max(0, current.needs.energy / 100));
        player.cuddleAffinity = Math.min(1, Math.max(0, attributeScore(current, 'affection') / 100));
        player.stats = {
          ...player.stats,
          stamina: Math.min(1, Math.max(0, attributeScore(current, 'stamina') / 100)),
          agility: Math.min(1, Math.max(0, attributeScore(current, 'agility') / 100)),
          boldness: Math.min(1, Math.max(0, attributeScore(current, 'boldness') / 100)),
          obedience: Math.min(1, Math.max(0, attributeScore(current, 'obedience') / 100)),
        };
      }
      syncParkVisitors(world, {
        enabled: parkOnRef.current && world.scene.id === 'park' && travelRef.current == null,
        offers: parkOffersRef.current,
        stranger: parkStrangerRef.current ?? null,
      });
      const now = new Date();
      const sky = skyAt(now);
      world.stageBleed = stageBleed(widthRef.current, heightRef.current);
      world.birdClimate = {
        dark: todRef.current.dark,
        precip: sky.weather.precip,
        month: now.getMonth(),
      };
      world.birdSeed = birdVisitSeed(world.scene.id, now.getTime());
      const dt = frameDt(elapsedMs, activeRef.current);
      update(world, dt);
      if (takePendingRest(world)) {
        onFellAsleepRef.current?.();
      }
      if (takeTrickFinish(world)) {
        onTrickEndRef.current?.();
      }
      if (takeSpookSettle(world)) {
        const settled = spookSettledRef.current;
        spookSettledRef.current = null;
        settled?.();
      }
      if (takeSpookReturn(world)) {
        const arrived = spookReturnRef.current;
        spookReturnRef.current = null;
        arrived?.();
      }
      const greeted = world.actors[0] ? takePendingGreeting(world.actors[0]) : null;
      if (greeted) {
        onGreetingRef.current?.(greeted);
      }
      const travel = travelRef.current;
      const actor = world.actors[0];
      let leftForShop: (() => void) | undefined;
      if (travel && actor) {
        if (travel.phase === 'exit') {
          if (actor.task.type !== 'travel') {
            startSceneExit(world, actor);
          }
          const gate = actor.task.type === 'travel' ? (actor.task.poi?.x ?? 0) : Number.POSITIVE_INFINITY;
          if (actor.x >= gate - 8) {
            travel.phase = 'fade';
          }
        }
        if (travel.phase === 'fade') {
          travel.fade = Math.min(1, travel.fade + dt / 0.85);
          if (travel.fade >= 1) {
            const dest = travel.dest;
            if (!dest) {
              const onLeft = travel.onLeft;
              travel.fade = 1;
              if (onLeft) {
                travel.onLeft = undefined;
                onTravelingRef.current?.(false);
                leftForShop = onLeft;
              }
            } else {
              startSceneEnter(world, actor, dest);
              travel.phase = 'enter';
              travel.fade = 0;
              onSceneCutRef.current?.(world.scene.id);
            }
          }
        }
        if (travel.phase === 'enter' && !isSceneTravel(actor)) {
          travelRef.current = null;
          onTravelingRef.current?.(false);
          const queued = pendingCue.current;
          pendingCue.current = null;
          if (queued) {
            if (queued.elapsedH != null) {
              elapsedRef.current = queued.elapsedH;
            }
            applyCue(queued.kind, queued.drop, queued.flick, queued.treatId, queued.moodGain);
          }
        }
      }
      for (const sound of takeSounds(world)) {
        playVoice(sound);
      }
      const stowed = world.pendingHouseStow;
      if (stowed) {
        world.pendingHouseStow = null;
        releaseStoredPiece(world, stowed);
        world.scene.props = world.scene.props.filter((prop) => prop.id !== stowed);
        world.scene.pois = world.scene.pois.filter((poi) => poi.propId !== stowed);
        if (world.liftedId === stowed) {
          world.liftedId = null;
        }
        onHouseStowedRef.current?.(stowed);
      }
      const moved = world.pendingHouseMove;
      if (moved) {
        world.pendingHouseMove = null;
        onHouseMovedRef.current?.(moved.pieceId, moved.sceneId, moved.x, moved.y);
      }
      if (takeBirdChirps(world) > 0) {
        playChirp();
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
      const visit = world.parkFindVisit;
      if (visit) {
        const prompting = visit.prompting;
        const modalItemId =
          visit.modalDueAt != null && world.t >= visit.modalDueAt && visit.item ? visit.item.id : null;
        const revealed =
          visit.revealed && visit.item && parkFindUiSent.current.revealedId !== visit.item.id
            ? { itemId: visit.item.id, rarity: visit.item.rarity }
            : null;
        if (
          prompting !== parkFindUiSent.current.prompting ||
          modalItemId !== parkFindUiSent.current.modalItemId ||
          revealed
        ) {
          if (revealed) {
            parkFindUiSent.current.revealedId = revealed.itemId;
          }
          parkFindUiSent.current.prompting = prompting;
          parkFindUiSent.current.modalItemId = modalItemId;
          onParkFindUiRef.current?.({ prompting, modalItemId, revealed });
        }
      }
      for (const kind of takePlayFinds(world)) {
        const at = actor ? { x: actor.x, y: actor.y } : { x: 0, y: 0 };
        onPlayFindRef.current?.(kind, at);
      }
      const finishes = takeTreatFinishes(world);
      for (let i = 0; i < finishes; i += 1) {
        onTreatEatenRef.current?.();
      }
      for (const amount of takeTreatMoods(world)) {
        onTreatMoodRef.current?.(amount);
      }
      const bowlDrinks = takeBowlDrinks(world);
      const pondDrinks = takePondDrinks(world);
      const drinkCount = bowlDrinks + pondDrinks;
      if (actor && drinkCount > 0) {
        const sc = actor.anchors.scale || 1;
        const x = actor.x + actor.face * sc * actor.anchors.head.x;
        const y = actor.y - actor.z + sc * (actor.anchors.head.y - actor.anchors.head.radius) - 18;
        for (let i = 0; i < drinkCount; i += 1) {
          const hydration = Math.min(drinkHydrationGain, Math.max(0, 100 - hydrationRef.current));
          if (hydration > 0) {
            pointAdds.push({ kind: 'hydration', x, y, amount: hydration });
            hydrationRef.current = Math.min(100, hydrationRef.current + hydration);
          }
        }
      }
      for (let i = 0; i < bowlDrinks; i += 1) {
        onDrankRef.current?.(true);
      }
      for (let i = 0; i < pondDrinks; i += 1) {
        onDrankRef.current?.(false);
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
        const holding = world.held != null;
        if (holding !== heldWas.current) {
          heldWas.current = holding;
          onHeldRef.current?.(holding);
        }
        const status = statusOf(actor);
        if (status !== statusRef.current) {
          statusRef.current = status;
          onStatusRef.current?.(status);
        }
      }
      redraw();
      leftForShop?.();
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
    // The frame's own timestamp, not the moment JS got to it, so a late callback does not
    // shorten one step and lengthen the next.
    let last: number | null = null;
    let running = true;
    const loop = (stamp?: number) => {
      if (!running) {
        return;
      }
      const now = typeof stamp === 'number' ? stamp : performance.now();
      step(last == null ? 0 : now - last);
      last = now;
      if (activeRef.current) {
        raf = requestAnimationFrame(loop);
      }
    };
    kick.current = () => {
      cancelAnimationFrame(raf);
      last = null;
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
      <Picture picture={backPicture} />
      <Picture picture={livePicture} />
      <Picture picture={frontPicture} />
      <Rect x={0} y={0} width={viewWidth} height={viewHeight} color="rgb(8, 10, 16)" opacity={fadeOpacity} />
    </Canvas>
  );
}

const styles = StyleSheet.create({
  canvas: {
    width: '100%',
  },
});
