import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Canvas, Picture, Skia } from '@shopify/react-native-skia';
import type { SkPicture } from '@shopify/react-native-skia';
import { useSharedValue } from 'react-native-reanimated';
import { Clapperboard } from 'lucide-react-native';

import { breedById, createWorld, sceneById, spawnActor, todAt } from '../../actor';
import type { Actor } from '../../actor/types';
import { strutStageSpeed } from '../../actor/data/strut';
import { stepStrutRun } from '../../actor/strutDrive';
import { playRunwayApplause, releaseRunwayApplause } from '../../audio/runwayApplause';
import { quietRunwayTrack, startRunwayTrack, stopRunwayTrack } from '../../audio/runwayMusic';
import { themeById, type RunwayThemeId } from '../../runway/catalog';
import { runwayConfig } from '../../runway/config';
import { equipFromFrozenLook } from '../../runway/lookEquip';
import { buildBeats, lookForRound, modelsForViewer, skipToNextModel, skipToNextRound, venueScrolls } from '../../runway/playback';
import type { LocalRunwayShow } from '../../runway/types';
import {
  layerOffset,
  themeSkyColor,
  venueFx,
  venueLayerLayout,
  venuePawY,
  venueScale,
  venueStackHeight,
  venueTileWidth,
  venueXml,
} from '../../runway/venue';
import { FunModal } from '../FunModal';
import { fontFamily } from '../font';
import { drawPetOnly } from '../skia/world';
import {
  advanceVenueFx,
  createVenueFxRuntime,
  drawPetShadow,
  drawVenueBeams,
  drawVenueExtras,
  drawVenueFlashes,
  drawVenueLedChase,
  drawVenueParticles,
  type VenueFxRuntime,
} from './venueFx';

type Props = {
  show: LocalRunwayShow;
  viewerSubmissionId?: string;
  reducedMotion: boolean;
  doneLabel?: string;
  onDone: () => void;
};

const petBox = 260;
const noon = todAt(14);

function petScreenX(stepId: string, progress: number, width: number): number {
  const center = width / 2 - petBox / 2;
  const offLeft = -petBox * 1.2;
  const p = Math.min(1, Math.max(0, progress));
  if (stepId === 'enter') {
    return offLeft + (center - offLeft) * p;
  }
  if (stepId === 'exit') {
    return center + (offLeft - center) * p;
  }
  return center;
}

export function RunwayView({ show, viewerSubmissionId, reducedMotion, doneLabel = 'Return to The Catwalk', onDone }: Props) {
  const { width, height } = useWindowDimensions();
  const themeId = (themeById(show.themeId)?.id ?? 'space') as RunwayThemeId;
  const scale = venueScale(height);
  const stackH = venueStackHeight * scale;
  const tile = venueTileWidth * scale;
  const stageTop = Math.max(0, height - stackH);
  const sky = themeSkyColor(themeId);
  const fx = useMemo(() => venueFx(themeId), [themeId]);

  const beats = useMemo(() => buildBeats(show, viewerSubmissionId), [show, viewerSubmissionId]);
  const models = useMemo(() => modelsForViewer(show, viewerSubmissionId), [show, viewerSubmissionId]);

  const blank = useMemo(() => {
    const recorder = Skia.PictureRecorder();
    recorder.beginRecording(Skia.XYWHRect(0, 0, 1, 1));
    return recorder.finishRecordingAsPicture();
  }, []);
  const picture = useSharedValue<SkPicture>(blank);
  const venueSvgs = useMemo(() => venueXml(themeId).map((xml) => Skia.SVG.MakeFromString(xml)), [themeId]);

  const [beatIndex, setBeatIndex] = useState(0);
  const [ended, setEnded] = useState(false);
  const [replayNonce, setReplayNonce] = useState(0);
  const beatIndexRef = useRef(0);
  const scrollRef = useRef(0);
  const actorRef = useRef<Actor | null>(null);
  const lookKeyRef = useRef('');
  const fxRuntimeRef = useRef<VenueFxRuntime>(createVenueFxRuntime(fx));
  const onDoneRef = useRef(onDone);
  const doneRef = useRef(false);
  const endedRef = useRef(false);

  // Beat bookkeeping for a continuous loop (not one effect-per-beat).
  const beatStartRef = useRef(0);
  const beatScrollStartRef = useRef(0);
  const lastTsRef = useRef(0);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    fxRuntimeRef.current = createVenueFxRuntime(fx);
  }, [fx]);

  useEffect(() => {
    startRunwayTrack(show.trackId);
  }, [show.trackId, replayNonce]);

  useEffect(
    () => () => {
      stopRunwayTrack();
      releaseRunwayApplause();
    },
    [],
  );

  const holdLastFrame = useCallback(() => {
    if (endedRef.current) {
      return;
    }
    endedRef.current = true;
    doneRef.current = true;
    quietRunwayTrack();
    playRunwayApplause();
    setEnded(true);
  }, []);

  const replayShow = useCallback(() => {
    endedRef.current = false;
    doneRef.current = false;
    setEnded(false);
    setBeatIndex(0);
    setReplayNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    if (width <= 0 || height <= 0 || beats.length === 0 || ended) {
      return;
    }
    doneRef.current = false;
    endedRef.current = false;
    beatIndexRef.current = 0;
    scrollRef.current = 0;
    beatStartRef.current = 0;
    beatScrollStartRef.current = 0;
    lastTsRef.current = 0;
    lookKeyRef.current = '';
    actorRef.current = null;
    let frame = 0;
    let lastUi = 0;

    const finish = () => {
      holdLastFrame();
    };

    const drawFrame = (elapsedInBeat: number, dt: number, beatIdx: number) => {
      const beat = beats[beatIdx];
      if (!beat) {
        return;
      }
      const seconds = reducedMotion ? Math.min(0.35, beat.seconds) : beat.seconds;
      const progress = seconds > 0 ? Math.min(1, elapsedInBeat / seconds) : 1;
      const scrollMode = venueScrolls(beat.stepId);
      const scrollDir: 1 | -1 = scrollMode === 'back' ? -1 : 1;
      const playing = scrollMode !== 'still';
      const petX = petScreenX(beat.stepId, progress, width);
      const petCenterX = petX + petBox / 2;
      const runtime = fxRuntimeRef.current ?? createVenueFxRuntime(fx);
      fxRuntimeRef.current = runtime;

      try {
        advanceVenueFx(runtime, fx, dt, {
          playing,
          scrollDir,
          reducedMotion,
          width,
          scale,
        });
      } catch {
        // FX must never block the pet or venue.
      }

      const recorder = Skia.PictureRecorder();
      const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, width, height));
      const skyPaint = Skia.Paint();
      skyPaint.setColor(Skia.Color(sky));
      canvas.drawRect(Skia.XYWHRect(0, 0, width, height), skyPaint);

      const fxOpts = {
        width,
        height,
        scale,
        stageTop,
        scroll: scrollRef.current,
        scrollDir,
        reducedMotion,
        fxEnabled: true,
        petCenterX,
        dt,
      };

      const drawLayer = (index: number) => {
        const svg = venueSvgs[index];
        const layout = venueLayerLayout[index];
        if (!svg || !layout) {
          return;
        }
        try {
          const offset = layerOffset(scrollRef.current, layout.speed, scale);
          const copies = Math.ceil(width / Math.max(tile, 1)) + 2;
          const layerTop = stageTop + layout.y * scale;
          const layerH = layout.height * scale;
          for (let copy = 0; copy < copies; copy += 1) {
            canvas.save();
            canvas.translate(offset + copy * tile, layerTop);
            canvas.drawSvg(svg, tile + 1, layerH);
            canvas.restore();
          }
        } catch {
          // Skip a bad layer rather than blanking the frame.
        }
      };

      drawLayer(0);
      try {
        drawVenueExtras(canvas, fx, runtime, fxOpts);
      } catch {
        /* ignore */
      }
      drawLayer(1);
      drawLayer(2);
      try {
        drawVenueParticles(canvas, fx, runtime, fxOpts);
        drawVenueBeams(canvas, fx, runtime, fxOpts);
      } catch {
        /* ignore */
      }
      drawLayer(3);
      drawLayer(4);
      drawLayer(5);
      try {
        drawVenueLedChase(canvas, fx, runtime, fxOpts);
      } catch {
        /* ignore */
      }

      const pawScreenY = stageTop + venuePawY * scale;
      drawPetShadow(canvas, petCenterX, pawScreenY, scale);

      const model = models[beat.modelIndex];
      const look = model ? lookForRound(model.submission.looks, beat.lookIndex) : undefined;
      const pet = model?.submission.pet;
      if (pet && look) {
        try {
          const lookKey = `${model.submission.submissionId}:${beat.lookIndex}`;
          const { equipped, wearDefs, backWear } = equipFromFrozenLook(look);
          if (!actorRef.current || lookKeyRef.current !== lookKey) {
            actorRef.current = spawnActor(
              {
                id: pet.snapshotId,
                breedId: pet.breedId,
                ageDays: pet.ageDays,
                weight: pet.weight,
                vitality: 0.85,
                equipped,
                wearDefs,
                backWear,
                look: { ...pet.look },
                asleep: false,
                seed: 7,
              },
              { x: 320, y: 460 },
            );
            lookKeyRef.current = lookKey;
          }
          const actor = actorRef.current;
          actor.equipped = equipped;
          actor.wearDefs = wearDefs;
          actor.backWear = backWear;
          const moving =
            beat.stepId === 'walkOut' ||
            beat.stepId === 'walkBack' ||
            beat.stepId === 'enter' ||
            beat.stepId === 'exit';
          const face: 1 | -1 = beat.stepId === 'walkBack' || beat.stepId === 'exit' ? -1 : 1;
          const breed = breedById(pet.breedId);
          if (breed) {
            stepStrutRun(actor, breed, reducedMotion ? 0 : dt, moving && !reducedMotion, face);
          }
          if (beat.stepId === 'pose') {
            actor.pose.walk = 0;
            actor.pose.faceCam = 1;
            actor.pose.headUp = 0.4;
            actor.pose.tailLift = 0.9;
            actor.pose.wagAmp = 0.45;
            actor.speed = 0;
          } else if (beat.stepId === 'stop' || beat.stepId === 'turn') {
            actor.pose.walk = Math.max(0, actor.pose.walk - dt * 2);
            actor.speed = 0;
          }
          const world = createWorld([actor], 1, sceneById('livingroom'));
          world.t += dt;
          canvas.save();
          canvas.translate(petX, pawScreenY - petBox * 0.78);
          drawPetOnly(canvas, world, petBox, petBox, noon, { x: 320, y: 460, zoom: 2.85 });
          canvas.restore();
        } catch {
          // Still show the venue if a costume/pet draw fails.
        }
      }

      drawLayer(6);
      try {
        drawVenueFlashes(canvas, fx, runtime, fxOpts);
      } catch {
        /* ignore */
      }

      picture.value = recorder.finishRecordingAsPicture();
    };

    const tick = (now: number) => {
      if (doneRef.current) {
        return;
      }
      if (!beatStartRef.current) {
        beatStartRef.current = now;
        beatScrollStartRef.current = scrollRef.current;
      }
      const dt = lastTsRef.current ? Math.min(0.05, (now - lastTsRef.current) / 1000) : 1 / 30;
      lastTsRef.current = now;

      let idx = beatIndexRef.current;
      if (idx >= beats.length) {
        finish();
        return;
      }
      const beat = beats[idx]!;
      const seconds = reducedMotion ? Math.min(0.35, beat.seconds) : beat.seconds;
      const elapsedInBeat = Math.max(0, (now - beatStartRef.current) / 1000);
      const scrollMode = venueScrolls(beat.stepId);

      // Scroll in stack units (venueLayerLayout).
      if (scrollMode === 'out') {
        scrollRef.current = beatScrollStartRef.current + strutStageSpeed * elapsedInBeat;
      } else if (scrollMode === 'back') {
        const ramp = 0.35;
        const dist =
          elapsedInBeat <= ramp
            ? strutStageSpeed * (0.2 * elapsedInBeat + 0.8 * ((elapsedInBeat * elapsedInBeat) / ramp) / 2)
            : strutStageSpeed * (0.2 * ramp + 0.8 * (ramp / 2)) + strutStageSpeed * (elapsedInBeat - ramp);
        scrollRef.current = beatScrollStartRef.current - dist;
      }

      drawFrame(elapsedInBeat, dt, idx);

      if (elapsedInBeat >= seconds) {
        idx += 1;
        beatIndexRef.current = idx;
        beatStartRef.current = now;
        beatScrollStartRef.current = scrollRef.current;
        lastUi = now;
        setBeatIndex(idx);
        if (idx >= beats.length) {
          finish();
          return;
        }
      } else if (now - lastUi >= 200) {
        lastUi = now;
        setBeatIndex(beatIndexRef.current);
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [beats, ended, fx, height, holdLastFrame, models, picture, reducedMotion, replayNonce, scale, sky, stageTop, tile, venueSvgs, width]);

  const beat = beats[Math.min(beatIndex, Math.max(beats.length - 1, 0))];
  const model = models[beat?.modelIndex ?? 0];
  const lookNumber = (beat?.lookIndex ?? 0) + 1;

  return (
    <View style={[styles.root, { backgroundColor: sky }]}>
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        {width > 0 ? <Picture picture={picture} /> : null}
      </Canvas>
      {!ended ? (
        <View style={styles.chrome}>
          <Text style={styles.lookLabel}>
            Look {lookNumber} of {runwayConfig.looksPerModel}
          </Text>
          <Text style={styles.modelLabel}>{model?.submission.pet.name ?? ''}</Text>
          <View style={styles.row}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Skip model"
              onPress={() => {
                const next = skipToNextModel(beats, beatIndexRef.current);
                beatIndexRef.current = next;
                beatStartRef.current = 0;
                beatScrollStartRef.current = scrollRef.current;
                setBeatIndex(next);
                if (next >= beats.length) {
                  holdLastFrame();
                }
              }}
              style={styles.btn}
            >
              <Text style={styles.btnText}>Skip model</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Skip to next round"
              onPress={() => {
                const next = skipToNextRound(beats, beatIndexRef.current);
                beatIndexRef.current = next;
                beatStartRef.current = 0;
                beatScrollStartRef.current = scrollRef.current;
                setBeatIndex(next);
                if (next >= beats.length) {
                  holdLastFrame();
                }
              }}
              style={styles.btn}
            >
              <Text style={styles.btnText}>Next round</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      {ended ? (
        <FunModal
          title="That's a wrap!"
          body={doneLabel === 'Continue' ? 'What a show. Continue when you are ready to vote.' : 'What a show. Want to watch it again?'}
          icon={Clapperboard}
          tint="lilac"
          sparkle
          reducedMotion={reducedMotion}
          primary={{ label: 'Replay', onPress: replayShow }}
          secondary={{
            label: doneLabel,
            onPress: () => onDoneRef.current(),
            closeFirst: true,
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  chrome: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 28,
    gap: 10,
  },
  lookLabel: {
    fontFamily: fontFamily.fredokaBold,
    color: '#fff',
    fontSize: 22,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowRadius: 6,
  },
  modelLabel: {
    fontFamily: fontFamily.regular,
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowRadius: 4,
  },
  row: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  btn: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
  },
  btnText: { fontFamily: fontFamily.fredokaSemibold, color: '#4B3B7A', fontSize: 14 },
});
