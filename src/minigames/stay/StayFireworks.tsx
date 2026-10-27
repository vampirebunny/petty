import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { Canvas, PaintStyle, Picture, Skia, StrokeCap } from '@shopify/react-native-skia';
import type { SkCanvas, SkPaint, SkPicture } from '@shopify/react-native-skia';
import { useSharedValue } from 'react-native-reanimated';

import { createShow, fireworkColors, stepShow } from './fireworks';
import type { FireworkShow } from './fireworks';

type Props = {
  width: number;
  height: number;
  reducedMotion: boolean;
};

function rgba(paint: SkPaint, color: readonly [number, number, number], alpha: number): void {
  const red = Math.round(color[0] * 255);
  const green = Math.round(color[1] * 255);
  const blue = Math.round(color[2] * 255);
  paint.setColor(Skia.Color(`rgba(${red},${green},${blue},${alpha})`));
}

function drawShow(canvas: SkCanvas, show: FireworkShow): void {
  const fill = Skia.Paint();
  fill.setAntiAlias(true);
  const stroke = Skia.Paint();
  stroke.setAntiAlias(true);
  stroke.setStyle(PaintStyle.Stroke);
  stroke.setStrokeWidth(2);
  stroke.setStrokeCap(StrokeCap.Round);
  for (const rocket of show.rockets) {
    if (!rocket.gone) {
      const color = fireworkColors[rocket.color] ?? fireworkColors[0];
      rgba(fill, color, 0.95);
      canvas.drawCircle(rocket.x, rocket.y, 3.2, fill);
      rgba(stroke, color, 0.55);
      canvas.drawLine(rocket.x, rocket.y, rocket.x - rocket.vx * 0.05, rocket.y - rocket.vy * 0.05, stroke);
    }
    for (const spark of rocket.sparks) {
      if (!spark.on || spark.age >= spark.life) {
        continue;
      }
      const fade = 1 - spark.age / spark.life;
      const color = fireworkColors[spark.color] ?? fireworkColors[0];
      rgba(fill, color, 0.22 * fade);
      canvas.drawCircle(spark.x, spark.y, spark.size * 2.4, fill);
      rgba(fill, color, 0.95 * fade);
      canvas.drawCircle(spark.x, spark.y, spark.size * fade, fill);
      rgba(stroke, color, 0.7 * fade);
      canvas.drawLine(spark.x, spark.y, spark.x - spark.vx * 0.045, spark.y - spark.vy * 0.045, stroke);
    }
  }
}

function blankPicture(width: number, height: number): SkPicture {
  const recorder = Skia.PictureRecorder();
  recorder.beginRecording(Skia.XYWHRect(0, 0, Math.max(width, 1), Math.max(height, 1)));
  return recorder.finishRecordingAsPicture();
}

export function StayFireworks({ width, height, reducedMotion }: Props) {
  const picture = useSharedValue<SkPicture>(blankPicture(width, height));

  useEffect(() => {
    const show = createShow(width, height, Math.floor(Math.random() * 1_000_000_000) + 1);
    const paintFrame = () => {
      const recorder = Skia.PictureRecorder();
      const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, width, height));
      drawShow(canvas, show);
      picture.value = recorder.finishRecordingAsPicture();
    };
    if (reducedMotion) {
      stepShow(show, 0.95);
      paintFrame();
      return;
    }
    let raf = 0;
    let last = Date.now();
    const loop = () => {
      const now = Date.now();
      stepShow(show, Math.min(0.05, (now - last) / 1000));
      last = now;
      paintFrame();
      if (!show.done) {
        raf = requestAnimationFrame(loop);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [height, picture, reducedMotion, width]);

  return (
    <Canvas pointerEvents="none" style={[styles.fill, { width, height }]}>
      <Picture picture={picture} />
    </Canvas>
  );
}

const styles = StyleSheet.create({
  fill: StyleSheet.absoluteFill,
});
