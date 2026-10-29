import { useEffect, useMemo } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { Canvas, Picture, Skia } from '@shopify/react-native-skia';
import type { SkPicture } from '@shopify/react-native-skia';
import { useSharedValue } from 'react-native-reanimated';

import { todAt } from '../../actor';
import { skyAt, solarHour } from '../../actor/sky';
import { formatSlot } from '../../sim/stadium';
import type { Env } from '../skia/env';
import { STADIUM_STAGE, drawStadiumHeader, stadiumLabels } from '../skia/stadium';
import { fontFamily } from '../font';

type Props = {
  width: number;
  /** Extra sky above the art, for the status bar. */
  top: number;
  nextStart: number | null;
  reducedMotion: boolean;
};

// About ten pictures a second, the same pace as ambient sway in the other scenes.
const frameMs = 100;
// With reduce motion on, the header stays still and only follows the sky and weather.
const stillMs = 30_000;

export function StadiumHeader({ width, top, nextStart, reducedMotion }: Props) {
  const height = Math.round((width * STADIUM_STAGE.h) / STADIUM_STAGE.w) + top;
  const blank = useMemo(() => {
    const recorder = Skia.PictureRecorder();
    recorder.beginRecording(Skia.XYWHRect(0, 0, Math.max(1, width), Math.max(1, height)));
    return recorder.finishRecordingAsPicture();
  }, [height, width]);
  const picture = useSharedValue<SkPicture>(blank);

  useEffect(() => {
    if (width <= 0) {
      return;
    }
    const started = Date.now();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let active = AppState.currentState === 'active';
    const draw = () => {
      const now = new Date();
      const sky = skyAt(now);
      const env: Env = {
        tod: todAt(solarHour(now)),
        t: (now.getTime() - started) / 1000,
        reduced: reducedMotion,
        bowlFill: 0,
        waterLevel: 0,
        glows: [],
        feeding: [],
        sky,
        wind: sky.weather.wind,
      };
      const recorder = Skia.PictureRecorder();
      const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, width, height));
      drawStadiumHeader(canvas, width, top, env);
      picture.value = recorder.finishRecordingAsPicture();
    };
    const loop = () => {
      if (!active) {
        return;
      }
      draw();
      timer = setTimeout(loop, reducedMotion ? stillMs : frameMs);
    };
    loop();
    const subscription = AppState.addEventListener('change', (status) => {
      const next = status === 'active';
      if (next === active) {
        return;
      }
      active = next;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (active) {
        loop();
      }
    });
    return () => {
      subscription.remove();
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [height, picture, reducedMotion, top, width]);

  const k = width / STADIUM_STAGE.w;
  const board = stadiumLabels.scoreboard;
  const title = stadiumLabels.title;
  return (
    <View style={{ width, height }}>
      <Canvas pointerEvents="none" style={{ width, height }}>
        <Picture picture={picture} />
      </Canvas>
      <View
        pointerEvents="none"
        style={[styles.board, { left: board.x * k, top: top + board.y * k, width: board.w * k, height: board.h * k }]}
        accessibilityLabel={nextStart ? `Next race at ${formatSlot(nextStart)}` : undefined}
      >
        <Text style={[styles.boardKicker, { fontSize: Math.max(8, 9 * k) }]}>NEXT RACE</Text>
        <Text style={[styles.boardTime, { fontSize: Math.max(12, 16 * k) }]}>{nextStart ? formatSlot(nextStart) : '--:--'}</Text>
      </View>
      <View pointerEvents="none" style={[styles.title, { left: title.x * k, top: top + title.y * k, width: title.w * k, height: title.h * k }]}>
        <Text accessibilityRole="header" style={[styles.titleText, { fontSize: Math.max(14, 18 * k) }]}>
          Stadium
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boardKicker: {
    fontFamily: fontFamily.fredokaSemibold,
    color: '#FFB0CA',
    letterSpacing: 1,
  },
  boardTime: {
    fontFamily: fontFamily.fredokaBold,
    color: '#FFE08A',
  },
  title: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleText: {
    fontFamily: fontFamily.fredokaBold,
    color: '#FFFFFF',
    textShadowColor: '#7853E6',
    textShadowRadius: 3,
    textShadowOffset: { width: 0, height: 1 },
  },
});
