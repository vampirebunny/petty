import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Canvas, Picture, Skia } from '@shopify/react-native-skia';
import type { SkPicture, SkSVG } from '@shopify/react-native-skia';

import { breedById, createWorld, sceneById, spawnActor, todAt } from '../../actor';
import type { Actor } from '../../actor/types';
import { stepStrutRun } from '../../actor/strutDrive';
import { startRunwayTrack, stopRunwayTrack } from '../../audio/runwayMusic';
import { themeById, type RunwayThemeId } from '../../runway/catalog';
import { runwayConfig } from '../../runway/config';
import { equipFromFrozenLook } from '../../runway/lookEquip';
import { buildBeats, modelsForViewer, skipToNextModel, skipToNextRound, venueScrolls } from '../../runway/playback';
import type { LocalRunwayShow } from '../../runway/types';
import {
  layerOffset,
  themeSkyColor,
  venueLayerLayout,
  venuePawY,
  venueScale,
  venueStackHeight,
  venueTileWidth,
  venueXml,
} from '../../runway/venue';
import { fontFamily } from '../font';
import { drawPetOnly } from '../skia/world';

type Props = {
  show: LocalRunwayShow;
  viewerSubmissionId?: string;
  reducedMotion: boolean;
  onDone: () => void;
};

const petBox = 220;
const noon = todAt(14);

export function RunwayView({ show, viewerSubmissionId, reducedMotion, onDone }: Props) {
  const { width, height } = useWindowDimensions();
  const themeId = (themeById(show.themeId)?.id ?? 'space') as RunwayThemeId;
  const scale = venueScale(height);
  const stackH = venueStackHeight * scale;
  const tile = venueTileWidth * scale;
  const stageTop = Math.max(0, height - stackH);
  const sky = themeSkyColor(themeId);

  const beats = useMemo(() => buildBeats(show, viewerSubmissionId), [show, viewerSubmissionId]);
  const models = useMemo(() => modelsForViewer(show, viewerSubmissionId), [show, viewerSubmissionId]);
  const [beatIndex, setBeatIndex] = useState(0);
  const [picture, setPicture] = useState<SkPicture | null>(null);
  const scrollRef = useRef(0);
  const beatIndexRef = useRef(0);
  const started = useRef(false);
  const actorRef = useRef<Actor | null>(null);
  const lookKeyRef = useRef('');
  const svgsRef = useRef<(SkSVG | null)[]>([]);

  useEffect(() => {
    svgsRef.current = venueXml(themeId).map((xml) => Skia.SVG.MakeFromString(xml));
  }, [themeId]);

  useEffect(() => {
    if (!started.current) {
      started.current = true;
      startRunwayTrack(show.trackId);
    }
    return () => {
      stopRunwayTrack();
    };
  }, [show.trackId]);

  useEffect(() => {
    beatIndexRef.current = beatIndex;
    if (beatIndex >= beats.length) {
      stopRunwayTrack();
      onDone();
      return;
    }
    const beat = beats[beatIndex];
    const seconds = reducedMotion ? Math.min(0.35, beat.seconds) : beat.seconds;
    const scrollMode = venueScrolls(beat.stepId);
    const start = Date.now();
    const startScroll = scrollRef.current;
    const speed = 72;
    let frame = 0;
    let lastDraw = 0;

    const draw = () => {
      if (width <= 0 || height <= 0) {
        return;
      }
      const recorder = Skia.PictureRecorder();
      const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, width, height));
      const skyPaint = Skia.Paint();
      skyPaint.setColor(Skia.Color(sky));
      canvas.drawRect(Skia.XYWHRect(0, 0, width, height), skyPaint);

      svgsRef.current.forEach((svg, index) => {
        if (!svg) {
          return;
        }
        const layout = venueLayerLayout[index];
        if (!layout) {
          return;
        }
        const offset = layerOffset(scrollRef.current, layout.speed, scale);
        const copies = Math.ceil(width / Math.max(tile, 1)) + 2;
        const layerTop = stageTop + layout.y * scale;
        const layerH = layout.height * scale;
        for (let copy = 0; copy < copies; copy += 1) {
          canvas.save();
          canvas.translate(offset + copy * tile, layerTop);
          canvas.drawSvg(svg, tile, layerH);
          canvas.restore();
        }
      });

      const model = models[beat.modelIndex];
      const look = model?.submission.looks[beat.lookIndex];
      const pet = model?.submission.pet;
      if (pet && look) {
        const lookKey = `${model.submission.submissionId}:${beat.lookIndex}`;
        const { equipped, wearDefs } = equipFromFrozenLook(look);
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
        const moving =
          beat.stepId === 'walkOut' || beat.stepId === 'walkBack' || beat.stepId === 'enter' || beat.stepId === 'exit';
        const face: 1 | -1 = beat.stepId === 'walkBack' ? -1 : 1;
        const breed = breedById(pet.breedId);
        if (breed) {
          stepStrutRun(actor, breed, reducedMotion ? 0 : 1 / 30, moving && !reducedMotion, face);
        }
        if (beat.stepId === 'pose') {
          actor.pose.walk = 0;
          actor.pose.faceCam = 1;
          actor.pose.headUp = 0.4;
          actor.pose.tailLift = 0.9;
          actor.pose.wagAmp = 0.45;
          actor.speed = 0;
        }
        const world = createWorld([actor], 1, sceneById('livingroom'));
        const pawScreenY = stageTop + venuePawY * scale;
        canvas.save();
        canvas.translate(width / 2 - petBox / 2, pawScreenY - petBox * 0.82);
        drawPetOnly(canvas, world, petBox, petBox, noon, { x: 320, y: 460, zoom: 2.6 });
        canvas.restore();
      }

      setPicture(recorder.finishRecordingAsPicture());
    };

    const tickFrame = (now: number) => {
      const elapsed = (now - start) / 1000;
      if (scrollMode === 'out') {
        scrollRef.current = startScroll + speed * elapsed;
      } else if (scrollMode === 'back') {
        scrollRef.current = startScroll - speed * elapsed;
      }
      if (now - lastDraw >= 1000 / 30) {
        lastDraw = now;
        draw();
      }
      if (elapsed >= seconds) {
        setBeatIndex((i) => i + 1);
        return;
      }
      frame = requestAnimationFrame(tickFrame);
    };
    frame = requestAnimationFrame(tickFrame);
    return () => cancelAnimationFrame(frame);
  }, [beatIndex, beats, height, models, onDone, reducedMotion, scale, sky, stageTop, tile, width]);

  const beat = beats[Math.min(beatIndex, beats.length - 1)];
  const model = models[beat?.modelIndex ?? 0];
  const lookNumber = (beat?.lookIndex ?? 0) + 1;

  return (
    <View style={[styles.root, { backgroundColor: sky }]}>
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        {picture ? <Picture picture={picture} /> : null}
      </Canvas>
      <View style={styles.chrome}>
        <Text style={styles.lookLabel}>
          Look {lookNumber} of {runwayConfig.looksPerModel}
        </Text>
        <Text style={styles.modelLabel}>{model?.submission.pet.name}</Text>
        <View style={styles.row}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Skip model"
            onPress={() => setBeatIndex(skipToNextModel(beats, beatIndexRef.current))}
            style={styles.btn}
          >
            <Text style={styles.btnText}>Skip model</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Skip to next round"
            onPress={() => setBeatIndex(skipToNextRound(beats, beatIndexRef.current))}
            style={styles.btn}
          >
            <Text style={styles.btnText}>Next round</Text>
          </Pressable>
        </View>
      </View>
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
