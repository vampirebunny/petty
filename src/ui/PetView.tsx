import { useCallback, useEffect, useMemo, useRef } from 'react';
import { AppState, StyleSheet, useWindowDimensions } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { Canvas, Picture, Skia } from '@shopify/react-native-skia';
import type { SkPicture } from '@shopify/react-native-skia';

import {
  createWorld,
  frameDt,
  sceneById,
  setWorldScene,
  settleOnResume,
  spawnActor,
  startUserTask,
  statusOf,
  syncActor,
  takeSounds,
  takeWeightDelta,
  todAt,
  update,
} from '../actor';
import { stageHeight, stageWidth } from '../actor/geometry';
import type { Scene, TimeOfDay, World } from '../actor';
import { playVoice } from '../audio/voice';
import type { Cue, PetState } from '../sim/types';
import { drawWorld } from './skia/world';

type Props = {
  pet: PetState;
  cueKind: Cue['kind'];
  cueToken: number;
  drop?: { x: number; y: number };
  hour: number | null;
  reducedMotion: boolean;
  sceneOverride?: Scene | null;
  onStatus?: (status: string) => void;
  onWeightDelta: (delta: number) => void;
};

function sourceOf(pet: PetState) {
  return {
    id: pet.id,
    breedId: pet.breedId,
    ageDays: pet.ageDays,
    weight: pet.weight,
    vitality: pet.vitality,
    equipped: pet.equipped,
    asleep: pet.asleep,
  };
}

export function PetView({ pet, cueKind, cueToken, drop, hour, reducedMotion, sceneOverride, onStatus, onWeightDelta }: Props) {
  const { width } = useWindowDimensions();
  const viewWidth = Math.max(280, width - 40);
  const viewHeight = viewWidth * (stageHeight / stageWidth);
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
      world.ball.state = 'none';
    } else {
      syncActor(actor, sourceOf(pet));
    }
    redraw();
  }, [pet.ageDays, pet.asleep, pet.breedId, pet.equipped, pet.id, pet.vitality, pet.weight, redraw]);

  useEffect(() => {
    const world = worldRef.current;
    if (world.scene !== scene) {
      setWorldScene(world, scene);
      redraw();
    }
  }, [scene, redraw]);

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
    } else if (cueKind === 'eat') {
      startUserTask(world, actor, 'eat');
    } else if (cueKind === 'drink') {
      startUserTask(world, actor, 'drink');
    } else if (cueKind === 'yawn') {
      startUserTask(world, actor, 'sleep');
    } else if (cueKind === 'purr') {
      startUserTask(world, actor, 'react', 0.8);
    } else if (cueKind === 'wiggle') {
      startUserTask(world, actor, 'react', 0.2);
    } else if (cueKind === 'fetch') {
      startUserTask(world, actor, 'fetch', 1, drop);
    }
    redraw();
  }, [cueKind, cueToken, drop, redraw]);

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
  const statusRef = useRef('');

  const step = useCallback(
    (elapsedMs: number) => {
      const world = worldRef.current;
      update(world, frameDt(elapsedMs, activeRef.current));
      for (const sound of takeSounds(world)) {
        playVoice(sound);
      }
      const actor = world.actors[0];
      if (actor) {
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
