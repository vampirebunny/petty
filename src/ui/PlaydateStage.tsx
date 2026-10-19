import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Canvas, Picture, Skia } from '@shopify/react-native-skia';
import type { SkPicture } from '@shopify/react-native-skia';

import { createWorld, frameDt, sceneById, setDirection, spawnActor, startUserTask, takeSounds, todAt, update } from '../actor';
import { playVoice } from '../audio/voice';
import { bodyOf, faceEachOther, separate, tugShift } from '../playdate/contact';
import { beatAt, directionFor, playdateEndMs, replayBeats } from '../playdate/direct';
import { actorSourceOf } from '../playdate/snapshot';
import type { PlaydateRecord } from '../playdate/types';
import { voiceCues } from '../playdate/voice';
import { drawWorld } from './skia/world';
import { useStageSize } from './useStageSize';

type Props = {
  record: PlaydateRecord;
  reducedMotion: boolean;
  onDone: () => void;
};

export function PlaydateStage({ record, reducedMotion, onDone }: Props) {
  const { viewWidth, viewHeight } = useStageSize();
  const beats = useMemo(() => replayBeats(record), [record]);
  const endMs = useMemo(() => playdateEndMs(beats), [beats]);
  const world = useMemo(() => {
    const scene = sceneById(record.sceneId);
    const y = (scene.floor.yMin + scene.floor.yMax) / 2;
    return createWorld(
      [spawnActor(actorSourceOf(record.petA), { x: 200, y }), spawnActor(actorSourceOf(record.petB), { x: 440, y })],
      record.seed || 1,
      scene,
    );
  }, [record]);
  const [picture, setPicture] = useState<SkPicture | null>(null);
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    let raf = 0;
    let last = Date.now();
    let elapsed = 0;
    let finished = false;
    let running = true;
    let live: SkPicture | null = null;
    const retired: { picture: SkPicture; at: number }[] = [];
    const tod = todAt(record.hour);
    const cues = voiceCues(record.seed, endMs);
    let cueIndex = 0;
    const loop = () => {
      if (!running) {
        return;
      }
      const now = Date.now();
      const dt = frameDt(now - last, true);
      last = now;
      elapsed += dt * 1000;
      world.reducedMotion = reducedMotion;
      const left = world.actors[0];
      const right = world.actors[1];
      const floor = world.scene.floor;
      const beatA = beatAt(beats, elapsed, 'A');
      const beatB = beatAt(beats, elapsed, 'B');
      if (left && right) {
        const reach = bodyOf(left, floor).radius + bodyOf(right, floor).radius;
        if (beatA) {
          setDirection(left, directionFor(beatA, 'A', { self: left, other: right, reach, floor }));
        }
        if (beatB) {
          setDirection(right, directionFor(beatB, 'B', { self: right, other: left, reach, floor }));
        }
        while (cueIndex < cues.length && elapsed >= cues[cueIndex].t) {
          const cue = cues[cueIndex];
          cueIndex += 1;
          const speaker = cue.actor === 'A' ? left : right;
          if (!speaker.bark.active) {
            startUserTask(world, speaker, 'speak');
          }
        }
      }
      update(world, dt);
      if (left && right) {
        if (beatA?.action === 'tug') {
          tugShift(left, elapsed / 1000, 'A', dt);
        }
        if (beatB?.action === 'tug') {
          tugShift(right, elapsed / 1000, 'B', dt);
        }
        separate(left, right, floor, dt);
        faceEachOther(left, right);
      }
      for (const sound of takeSounds(world)) {
        playVoice(sound);
      }
      const recorder = Skia.PictureRecorder();
      const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, viewWidth, viewHeight));
      drawWorld(canvas, world, viewWidth, viewHeight, tod, reducedMotion);
      const next = recorder.finishRecordingAsPicture();
      if (live) {
        retired.push({ picture: live, at: now });
      }
      live = next;
      const staleBefore = now - 1000;
      while (retired.length > 0 && retired[0].at < staleBefore) {
        retired.shift()?.picture.dispose();
      }
      setPicture(next);
      if (!finished && elapsed >= endMs) {
        finished = true;
        onDoneRef.current();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      const current = live;
      const pending = retired.splice(0);
      setTimeout(() => {
        current?.dispose();
        for (const stale of pending) {
          stale.picture.dispose();
        }
      }, 1000);
    };
  }, [beats, endMs, record.hour, record.seed, reducedMotion, viewHeight, viewWidth, world]);

  if (!picture) {
    return null;
  }
  return (
    <Canvas pointerEvents="none" style={[styles.canvas, { width: viewWidth, height: viewHeight }]}>
      <Picture picture={picture} />
    </Canvas>
  );
}

const styles = StyleSheet.create({
  canvas: {
    alignSelf: 'center',
  },
});
