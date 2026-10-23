import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Canvas, Picture, Skia } from '@shopify/react-native-skia';
import type { SkPicture } from '@shopify/react-native-skia';

import { breedById, createWorld, frameDt, growthFor, sceneById, setDirection, spawnActor, startGesture, startUserTask, takeSounds, todAt, update, voiceRate } from '../actor';
import { playVoice } from '../audio/voice';
import { bodyOf, faceEachOther, separate, tugShift } from '../playdate/contact';
import { beatAt, directionFor, playdateEndMs, replayBeats } from '../playdate/direct';
import { burstFor, stepBursts } from '../playdate/overlay';
import type { OverlayBurst } from '../playdate/overlay';
import { butterflyAt, propAt } from '../playdate/props';
import type { PropView } from '../playdate/props';
import type { Item } from '../items/types';
import type { Actor, World } from '../actor';
import { actorSourceOf } from '../playdate/snapshot';
import type { Beat, PlaydateRecord } from '../playdate/types';
import { cameraAt, portraitFrame } from '../playdate/camera';
import type { FrozenCenter } from '../playdate/camera';
import { closeEnough, homeA, homeB, placeOpening, playSpeed, stepOpening } from '../playdate/opening';
import type { OpeningPhase, OpeningState } from '../playdate/opening';
import { ambientCues, crossBeats, sfxShots } from '../playdate/sfx';
import type { SfxShot } from '../playdate/sfx';
import { voiceCues } from '../playdate/voice';
import { drawWorld } from './skia/world';
import { useStageSize } from './useStageSize';

function applyProp(world: World, prop: PropView | null): void {
  if (!prop || prop.kind === 'rope' && prop.holder === 'both') {
    world.items = [];
    return;
  }
  const item = (extra: Partial<Item>): Item => ({
    id: 'playdate-prop',
    kind: prop.kind,
    x: prop.x,
    y: prop.y,
    z: prop.z,
    vx: 0,
    vy: 0,
    vz: 0,
    state: 'free',
    ...extra,
  });
  if (prop.holder === 'A' || prop.holder === 'B') {
    const actor = prop.holder === 'A' ? world.actors[0] : world.actors[1];
    world.items = [item({ state: 'carried', holderId: actor?.id, x: actor?.x ?? prop.x, y: actor?.y ?? prop.y, z: 0 })];
    return;
  }
  world.items = [item({})];
}

type Props = {
  record: PlaydateRecord;
  reducedMotion: boolean;
  onDone: () => void;
};

export function PlaydateStage({ record, reducedMotion, onDone }: Props) {
  const { contentWidth: viewWidth, viewHeight } = useStageSize();
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
    let opening: OpeningState = { phase: 'portraitA', elapsed: 0 };
    let placed: OpeningPhase | null = null;
    let finished = false;
    let running = true;
    const tod = todAt(record.hour);
    const cues = ambientCues(record.version, voiceCues(record.seed, endMs), beats);
    let cueIndex = 0;
    const fired = new Set<number>();
    const frozen = new Map<number, FrozenCenter>();
    const jaws: { id: string; until: number }[] = [];
    let bursts: OverlayBurst[] = [];
    const speciesOf = (pet: Actor): 'dog' | 'cat' => breedById(pet.breedId)?.species ?? 'dog';
    const playShot = (pet: Actor, shot: SfxShot): void => {
      if (shot.speak || shot.skipIfBarking) {
        if (pet.bark.active) {
          return;
        }
      }
      if (shot.speak) {
        startUserTask(world, pet, 'speak');
        return;
      }
      const breed = breedById(pet.breedId);
      const rate = (breed ? voiceRate(breed, growthFor(pet.displayAgeDays).scale) : 1) * shot.rateScale;
      if (world.sounds.length < 8) {
        world.sounds.push({ actorId: pet.id, sound: shot.sound, rate });
      }
      if (shot.jaw) {
        jaws.push({ id: pet.id, until: elapsed + 200 });
      }
    };
    const arm = (pet: Actor, beat: Beat, side: 'A' | 'B'): void => {
      if (beat.gesture) {
        startGesture(pet, beat.gesture, reducedMotion);
      }
      if (beat.tag === 'golden' && beat.emote === 'heart' && side === 'B') {
        return;
      }
      const mark = pet.headMark;
      const burst = burstFor({
        version: record.version,
        emote: beat.emote,
        fx: beat.fx,
        seed: record.seed,
        actor: side,
        beatT: beat.t,
        x: mark?.x ?? pet.x,
        y: mark?.y ?? pet.y - 36,
        reduced: reducedMotion,
      });
      if (burst) {
        bursts.push(burst);
      }
    };
    const loop = () => {
      if (!running) {
        return;
      }
      const now = Date.now();
      const dt = frameDt(now - last, true);
      last = now;
      world.reducedMotion = reducedMotion;
      const left = world.actors[0];
      const right = world.actors[1];
      const floor = world.scene.floor;
      const y = (floor.yMin + floor.yMax) / 2;
      if (left && right && opening.phase !== 'play') {
        const arrived =
          opening.phase === 'enterA' ? closeEnough(left, homeA, y) : opening.phase === 'enterB' ? closeEnough(right, homeB, y) : false;
        opening = stepOpening(opening, dt * 1000, arrived);
      }
      if (left && right && opening.phase !== placed) {
        placeOpening(opening.phase, left, right, floor, y);
        placed = opening.phase;
      }
      const playing = opening.phase === 'play';
      const step = playing ? dt * playSpeed : dt;
      if (playing) {
        elapsed += step * 1000;
      }
      const beatA = playing ? beatAt(beats, elapsed, 'A') : null;
      const beatB = playing ? beatAt(beats, elapsed, 'B') : null;
      if (playing && left && right) {
        const reach = bodyOf(left, floor).radius + bodyOf(right, floor).radius;
        if (beatA) {
          setDirection(left, directionFor(beatA, 'A', { self: left, other: right, reach, floor }));
        }
        if (beatB) {
          setDirection(right, directionFor(beatB, 'B', { self: right, other: left, reach, floor }));
        }
        if (record.version >= 2) {
          for (const index of crossBeats(beats, elapsed, fired)) {
            const beat = beats[index];
            const sides = beat.actor === 'both' ? (['A', 'B'] as const) : ([beat.actor] as const);
            for (const side of sides) {
              arm(side === 'A' ? left : right, beat, side);
            }
            if (beat.camera === 'punch') {
              frozen.set(index, { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 });
            }
            for (const shot of sfxShots(beat, (actor) => speciesOf(actor === 'A' ? left : right))) {
              playShot(shot.actor === 'A' ? left : right, shot);
            }
          }
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
      world.items = [];
      update(world, step);
      if (playing && left && right) {
        if (beatA?.action === 'tug' || beatA?.action === 'tug_rope') {
          tugShift(left, elapsed / 1000, 'A', step);
        }
        if (beatB?.action === 'tug' || beatB?.action === 'tug_rope') {
          tugShift(right, elapsed / 1000, 'B', step);
        }
        separate(left, right, floor, step);
        faceEachOther(left, right);
      }
      for (const sound of takeSounds(world)) {
        playVoice(sound);
      }
      const prop = playing && record.version >= 2 ? propAt(beats, elapsed) : null;
      applyProp(world, prop);
      if (record.version >= 2 && prop && prop.holder != null) {
        const pulse = 0.35 + 0.15 * Math.sin(elapsed / 180);
        if (prop.holder !== 'B' && left) {
          left.pose.jawHold = pulse;
        }
        if (prop.holder !== 'A' && right) {
          right.pose.jawHold = pulse;
        }
      }
      if (record.version >= 2) {
        for (const jaw of jaws) {
          if (elapsed > jaw.until) {
            continue;
          }
          const pet = jaw.id === left?.id ? left : jaw.id === right?.id ? right : null;
          if (pet) {
            pet.pose.jawHold = 0.7;
          }
        }
      }
      bursts = stepBursts(bursts, step);
      const rope =
        prop?.kind === 'rope' && prop.holder === 'both' ? { sag: 36 * (1 - Math.abs(Math.cos((elapsed / 1000) * 3.2))) } : null;
      const butterfly = playing && record.version >= 2 ? butterflyAt(beats, elapsed) : null;
      const zzz =
        playing && record.version >= 2
          ? beats.flatMap((beat) => {
              if (beat.emote !== 'zzz' || beat.t > elapsed || elapsed > beat.t + 2000) {
                return [];
              }
              const pets = beat.actor === 'both' ? [left, right] : beat.actor === 'A' ? [left] : [right];
              return pets.flatMap((pet) => {
                if (!pet) {
                  return [];
                }
                const mark = pet.headMark;
                return [{ x: mark?.x ?? pet.x, y: (mark?.y ?? pet.y - 36) - 8, phase: (elapsed - beat.t) / 1000 }];
              });
            })
          : [];
      const recorder = Skia.PictureRecorder();
      const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, viewWidth, viewHeight));
      const camera =
        opening.phase === 'portraitA' && left
          ? portraitFrame(left.x, left.y)
          : opening.phase === 'portraitB' && right
            ? portraitFrame(right.x, right.y)
            : playing && record.version >= 2
              ? cameraAt(beats, elapsed, frozen, reducedMotion, record.seed)
              : undefined;
      drawWorld(canvas, world, viewWidth, viewHeight, tod, reducedMotion, undefined, camera, { bursts, rope, butterfly, zzz });
      const next = recorder.finishRecordingAsPicture();
      setPicture(next);
      if (!finished && playing && elapsed >= endMs) {
        finished = true;
        onDoneRef.current();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
    };
  }, [beats, endMs, record.hour, record.seed, record.version, reducedMotion, viewHeight, viewWidth, world]);

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
