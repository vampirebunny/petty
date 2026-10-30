import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Picture, Skia, TileMode } from '@shopify/react-native-skia';
import type { SkCanvas, SkPicture } from '@shopify/react-native-skia';

import { applyFurniture } from '../actor/furniture';
import { createWorld, defaultPose, sceneById, spawnActor, todAt } from '../actor';
import { stageHeight, stageWidth } from '../actor/scenes';
import { skyAt } from '../actor/sky';
import { drawWorld } from '../ui/skia/world';
import { gameplayConfig } from '../sim/gameplayConfig';

import { frameAt } from './clips';
import { clipGradeMatrix } from './filter';
import type { ClipRecord } from './types';

type Props = {
  record: ClipRecord;
  elapsed: number;
  reducedMotion: boolean;
  dimmed: boolean;
};

// drawWorld anchors the camera at 62% of the view height, so this centre frames the whole room.
const roomCamera = { x: stageWidth / 2, y: stageHeight * 0.62, zoom: 1 };

function drawFrame(record: ClipRecord, elapsed: number, reducedMotion: boolean, width: number, height: number): SkPicture {
  const frame = frameAt(record, elapsed);
  const scene = applyFurniture(sceneById(record.roomId), record.pieces, frame.placed);
  const actor = spawnActor(
    {
      id: 'petcam',
      breedId: record.pet.breedId,
      ageDays: record.pet.ageDays,
      weight: record.pet.weight,
      vitality: record.pet.vitality,
      equipped: record.sweaterItemId ? { ...record.pet.equipped, jacket: record.sweaterItemId } : record.pet.equipped,
      look: record.pet.look,
      asleep: frame.pose.lie === 1 && (frame.pose.eyes ?? 0) > 0.8,
      seed: record.seed,
    },
    { x: frame.x, y: frame.y },
  );
  actor.clipPlay = true;
  actor.clipStuck = frame.stuck;
  actor.clipEyeshine = record.isNight;
  actor.clipHind = frame.hind;
  actor.clipScale = frame.scale;
  actor.x = frame.x;
  actor.y = frame.y;
  actor.z = frame.z;
  actor.face = frame.face;
  actor.aimFace = frame.face;
  actor.yawFace = frame.face;
  actor.octantFrom = frame.octantFrom;
  actor.octant = frame.octant;
  actor.octantTarget = frame.octant;
  actor.octantBlend = frame.octantBlend;
  actor.phase = elapsed * 8;
  actor.pose = { ...defaultPose(), ...frame.pose };
  if (frame.gait) {
    actor.gait = { current: frame.gait, from: frame.gait, blend: 1 };
  }
  const world = createWorld([actor], record.seed, scene);
  world.reducedMotion = reducedMotion;
  world.noNap = true;
  const when = new Date(record.recordedAt + elapsed * 1000);
  const hour = when.getHours() + when.getMinutes() / 60;
  const shake = reducedMotion ? 0 : frame.shake;
  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, width, height));
  canvas.clear(Skia.Color('#000000'));
  const grade = Skia.Paint();
  grade.setColorFilter(Skia.ColorFilter.MakeMatrix(clipGradeMatrix(record.isNight)));
  canvas.saveLayer(grade);
  if (shake > 0) {
    canvas.save();
    canvas.translate(Math.sin(elapsed * 48) * shake, Math.cos(elapsed * 37) * shake * 0.6);
  }
  drawWorld(canvas, world, width, height, todAt(hour), reducedMotion, undefined, roomCamera, undefined, { sky: skyAt(when) });
  if (shake > 0) {
    canvas.restore();
  }
  canvas.restore();
  if (!reducedMotion && frame.flash > 0) {
    const paint = Skia.Paint();
    paint.setColor(Skia.Color('#ffffff'));
    paint.setAlphaf(frame.flash);
    canvas.drawRect(Skia.XYWHRect(0, 0, width, height), paint);
  }
  drawWebcamOverlay(canvas, record.isNight, elapsed, width, height, reducedMotion);
  return recorder.finishRecordingAsPicture();
}

function drawWebcamOverlay(
  canvas: SkCanvas,
  night: boolean,
  elapsed: number,
  width: number,
  height: number,
  reducedMotion: boolean,
): void {
  const filter = gameplayConfig.petCam.filter;
  const scan = night ? filter.nightScanline : filter.scanline;
  const line = Skia.Paint();
  line.setColor(Skia.Color('#000000'));
  line.setAlphaf(scan);
  for (let y = 1; y < height; y += 2) {
    canvas.drawRect(Skia.XYWHRect(0, y, width, 1), line);
  }
  const vignette = Skia.Paint();
  vignette.setShader(
    Skia.Shader.MakeRadialGradient(
      { x: width / 2, y: height / 2 },
      0.72 * Math.hypot(width, height),
      [Skia.Color('#00000000'), Skia.Color(`rgba(0,0,0,${filter.vignette})`)],
      [0, 1],
      TileMode.Clamp,
    ),
  );
  canvas.drawRect(Skia.XYWHRect(0, 0, width, height), vignette);
  if (reducedMotion) {
    return;
  }
  const grain = (night ? filter.nightGrain : filter.grain) / 255;
  const speck = Skia.Paint();
  speck.setColor(Skia.Color('#ffffff'));
  speck.setAlphaf(grain);
  let n = Math.floor(elapsed * 17) + (night ? 19 : 3);
  const count = Math.min(900, Math.floor((width * height) / 80));
  for (let i = 0; i < count; i += 1) {
    n = (n * 16807 + 1) % 2147483647;
    const x = n % width;
    n = (n * 16807 + 1) % 2147483647;
    const y = n % height;
    canvas.drawRect(Skia.XYWHRect(x, y, 1, 1), speck);
  }
}

export function ClipPlayer({ record, elapsed, reducedMotion, dimmed }: Props) {
  const [box, setBox] = useState({ width: 0, height: 0 });
  const picture = useMemo(() => {
    if (box.width < 2 || box.height < 2) {
      return null;
    }
    return drawFrame(record, elapsed, reducedMotion, Math.round(box.width), Math.round(box.height));
  }, [box.height, box.width, elapsed, record, reducedMotion]);

  return (
    <View
      style={styles.frame}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setBox((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
      }}
    >
      {picture && box.width > 2 ? (
        <Canvas style={styles.canvas}>
          <Picture picture={picture} />
        </Canvas>
      ) : null}
      {dimmed ? <View style={styles.dim} pointerEvents="none" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    aspectRatio: stageWidth / stageHeight,
    backgroundColor: '#000',
    borderRadius: 14,
    overflow: 'hidden',
  },
  canvas: {
    flex: 1,
  },
  dim: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
});
