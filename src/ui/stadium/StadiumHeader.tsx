import { useEffect, useMemo, useState } from 'react';
import { AppState, Image, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import { Canvas, Picture, Skia } from '@shopify/react-native-skia';
import type { SkCanvas, SkImage, SkPicture } from '@shopify/react-native-skia';
import { useSharedValue } from 'react-native-reanimated';

import { todAt } from '../../actor';
import { skyAt, solarHour } from '../../actor/sky';
import { formatSlot } from '../../sim/stadium';
import { fontFamily } from '../font';
import type { Env } from '../skia/env';
import { clamp01, hash, noise, rect } from '../skia/ink';
import { drawSkyPane } from '../skia/sky';
import { drawPrecip } from '../skia/weatherFx';
import { isLandscapeSplit } from '../wideLayout';
import { stadiumPlates, type StadiumCut } from './stadiumPlate';

type Props = {
  nextStart: number | null;
  reducedMotion: boolean;
  /** False once this lobby is no longer the screen being shown. */
  active?: boolean;
};

const frameMs = 100;
const stillMs = 30_000;
const confetti = ['#FFE08A', '#FF8FC1', '#5FD6A8', '#7EC8FF', '#FFB07A'];

type PlateArt = { art: SkImage; lights: SkImage | null };

const plates = new Map<StadiumCut, PlateArt>();
const loading = new Map<StadiumCut, Promise<PlateArt | null>>();

async function decode(source: ImageSourcePropType): Promise<SkImage | null> {
  const resolved = Image.resolveAssetSource(source);
  if (!resolved?.uri) {
    return null;
  }
  const response = await fetch(resolved.uri);
  const data = Skia.Data.fromBytes(new Uint8Array(await response.arrayBuffer()));
  return Skia.Image.MakeImageFromEncoded(data);
}

function loadPlate(cut: StadiumCut): Promise<PlateArt | null> {
  const cached = plates.get(cut);
  if (cached) {
    return Promise.resolve(cached);
  }
  const pending = loading.get(cut);
  if (pending) {
    return pending;
  }
  const spec = stadiumPlates[cut];
  const work = (async () => {
    try {
      const art = await decode(spec.art);
      if (!art) {
        return null;
      }
      const next = { art, lights: await decode(spec.lights) };
      plates.set(cut, next);
      return next;
    } catch {
      return null;
    } finally {
      loading.delete(cut);
    }
  })();
  loading.set(cut, work);
  return work;
}

function drawConfetti(c: SkCanvas, width: number, height: number, env: Env): void {
  const t = env.reduced ? 0 : env.t;
  const wind = env.wind ?? 0;
  const count = 26;
  for (let i = 0; i < count; i += 1) {
    const span = height + 24;
    const speed = 16 + hash(i, 2) * 26;
    const fy = (((hash(i, 3) * span + t * speed) % span) + span) % span;
    const fx = (((hash(i, 4) * width + wind * 36 * t) % width) + width) % width;
    const s = 3 + hash(i, 5) * 3.5;
    c.save();
    c.translate(fx, fy - 12);
    c.rotate((t * (40 + hash(i, 6) * 80) + hash(i, 7) * 360) % 360, 0, 0);
    rect(c, -s / 2, -s * 0.28, s, s * 0.56, confetti[i % confetti.length], 0.9);
    c.restore();
  }
}

export function StadiumHeader({ nextStart, reducedMotion, active = true }: Props) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const cut: StadiumCut = isLandscapeSplit(windowWidth, windowHeight) ? 'tall' : 'phone';
  const plate = stadiumPlates[cut];
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [loaded, setLoaded] = useState<{ cut: StadiumCut; art: PlateArt } | null>(null);
  const image = loaded?.cut === cut ? loaded.art : plates.get(cut) ?? null;
  const blank = useMemo(() => {
    const recorder = Skia.PictureRecorder();
    recorder.beginRecording(Skia.XYWHRect(0, 0, 1, 1));
    return recorder.finishRecordingAsPicture();
  }, []);
  const picture = useSharedValue<SkPicture>(blank);

  useEffect(() => {
    let alive = true;
    void loadPlate(cut).then((next) => {
      if (alive && next) {
        setLoaded({ cut, art: next });
      }
    });
    return () => {
      alive = false;
    };
  }, [cut]);

  useEffect(() => {
    const width = box.width;
    const height = box.height;
    if (width <= 0 || height <= 0) {
      return;
    }
    const started = Date.now();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let showing = active && AppState.currentState === 'active';
    const draw = () => {
      const now = new Date();
      const sky = skyAt(now);
      const baseWind = sky.weather.wind;
      const gust = Math.max(0, noise((Date.now() - started) / 1000 * 0.25, 5)) ** 2 * 0.6;
      const env: Env = {
        tod: todAt(solarHour(now)),
        t: (now.getTime() - started) / 1000,
        reduced: reducedMotion,
        bowlFill: 0,
        waterLevel: 0,
        glows: [],
        feeding: [],
        sky,
        wind: reducedMotion
          ? baseWind
          : baseWind * (0.75 + 0.25 * noise((Date.now() - started) / 1000 * 0.1, 3)) + Math.sign(baseWind || 1) * gust,
      };
      const recorder = Skia.PictureRecorder();
      const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, width, height));
      const art = image?.art ?? null;
      const imgW = art?.width() ?? plate.width;
      const imgH = art?.height() ?? plate.height;
      const scale = Math.max(width / imgW, height / imgH);
      const dw = imgW * scale;
      const dh = imgH * scale;
      const dx = (width - dw) / 2;
      const dy = (height - dh) / 2;
      const skyH = Math.min(height, Math.max(1, dy + plate.skyBottom * scale));
      drawSkyPane(canvas, 0, 0, width, skyH, env);
      const paint = Skia.Paint();
      paint.setAntiAlias(true);
      const dest = Skia.XYWHRect(dx, dy, dw, dh);
      if (art) {
        canvas.drawImageRect(art, Skia.XYWHRect(0, 0, imgW, imgH), dest, paint);
      }
      const lamps = clamp01((env.tod.dark - 0.18) / 0.4);
      if (image?.lights && lamps > 0.02) {
        const glow = Skia.Paint();
        glow.setAntiAlias(true);
        glow.setAlphaf(lamps);
        canvas.drawImageRect(image.lights, Skia.XYWHRect(0, 0, image.lights.width(), image.lights.height()), dest, glow);
      }
      drawConfetti(canvas, width, height, env);
      drawPrecip(canvas, 0, 0, width, height, env, { scale: Math.min(1.35, Math.max(0.65, height / 280)) });
      picture.value = recorder.finishRecordingAsPicture();
    };
    const loop = () => {
      if (!showing) {
        return;
      }
      draw();
      timer = setTimeout(loop, reducedMotion ? stillMs : frameMs);
    };
    loop();
    const subscription = AppState.addEventListener('change', (status) => {
      const next = active && status === 'active';
      if (next === showing) {
        return;
      }
      showing = next;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (showing) {
        loop();
      }
    });
    return () => {
      subscription.remove();
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [active, box.height, box.width, cut, image, picture, plate.height, plate.skyBottom, plate.width, reducedMotion]);

  const when = nextStart ? formatSlot(nextStart) : '--:--';
  const tall = cut === 'tall';
  return (
    <View
      style={styles.fill}
      accessibilityLabel="Stadium"
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setBox((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
      }}
    >
      <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Picture picture={picture} />
      </Canvas>
      <View pointerEvents="none" style={[styles.copy, tall ? styles.copyTall : styles.copyPhone]}>
        <Text accessibilityRole="header" style={styles.title}>
          Stadium
        </Text>
        <Text style={styles.next}>Next race {when}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, width: '100%', height: '100%', overflow: 'hidden' },
  copy: {
    position: 'absolute',
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  copyPhone: { top: 108 },
  copyTall: { top: 120 },
  title: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 28,
    color: '#FFFFFF',
    textShadowColor: '#3A2A78',
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 1 },
  },
  next: {
    marginTop: 2,
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 14,
    color: '#FFE08A',
    textShadowColor: '#3A2A78',
    textShadowRadius: 3,
    textShadowOffset: { width: 0, height: 1 },
  },
});
