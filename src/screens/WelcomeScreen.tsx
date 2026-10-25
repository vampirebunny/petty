import { useEffect, useRef, useState } from 'react';
import { AppState, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Canvas, Picture, Skia } from '@shopify/react-native-skia';
import type { SkPicture } from '@shopify/react-native-skia';

import { createWorld, frameDt, spawnActor, todAt, update } from '../actor';
import type { World } from '../actor';
import { stageWidth } from '../actor/geometry';
import { previewStageHeight } from '../actor/scenes';
import { previewBackdrop, previewHome, previewScene } from '../actor/previewScene';
import { CandyShell, candyInk, tints } from '../ui/candy';
import { fontFamily } from '../ui/font';
import { useContentWidth } from '../ui/PhoneColumn';
import { drawWorld } from '../ui/skia/world';

type Props = {
  onGetStarted: () => void;
};

const noon = todAt(12);
const frameMs = 1000 / 30;
const pink = tints.pink;
const pinkInk = candyInk(pink);

function welcomeWorld(): World {
  const source = {
    ageDays: 0,
    weight: 0,
    vitality: 0.75,
    equipped: {},
    asleep: false,
  };
  const dog = spawnActor(
    { ...source, id: 'welcome-dog', breedId: 'retriever' },
    { x: previewHome.x - 110, y: previewHome.y },
  );
  const cat = spawnActor(
    { ...source, id: 'welcome-cat', breedId: 'domesticShorthair' },
    { x: previewHome.x + 110, y: previewHome.y },
  );
  const world = createWorld([dog, cat], 1, previewScene);
  world.reducedMotion = false;
  world.noNap = true;
  return world;
}

function WelcomePets() {
  const width = useContentWidth();
  const ratio = previewStageHeight / stageWidth;
  const viewWidth = Math.min(560, Math.max(240, width - 40));
  const viewHeight = viewWidth * ratio;
  const [picture, setPicture] = useState<SkPicture | null>(null);
  const worldRef = useRef<World | null>(null);

  useEffect(() => {
    if (!worldRef.current) {
      worldRef.current = welcomeWorld();
    }
    let raf = 0;
    let last = Date.now();
    let lastDraw = 0;
    let running = true;
    let active = AppState.currentState === 'active';

    const draw = () => {
      const world = worldRef.current;
      if (!world) {
        return;
      }
      const recorder = Skia.PictureRecorder();
      const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, viewWidth, viewHeight));
      drawWorld(canvas, world, viewWidth, viewHeight, noon, true, previewStageHeight, undefined, undefined, { sky: null });
      setPicture(recorder.finishRecordingAsPicture());
    };

    const loop = () => {
      if (!running) {
        return;
      }
      const now = Date.now();
      const world = worldRef.current;
      if (world) {
        update(world, frameDt(now - last, active));
      }
      last = now;
      if (now - lastDraw >= frameMs) {
        lastDraw = now;
        draw();
      }
      if (active) {
        raf = requestAnimationFrame(loop);
      }
    };
    raf = requestAnimationFrame(loop);

    const subscription = AppState.addEventListener('change', (status) => {
      const wasActive = active;
      active = status === 'active';
      if (active && !wasActive) {
        last = Date.now();
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(loop);
      }
    });
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      subscription.remove();
    };
  }, [viewHeight, viewWidth]);

  return (
    <View style={[styles.stage, { width: viewWidth, height: viewHeight, backgroundColor: previewBackdrop }]}>
      <Canvas pointerEvents="none" style={{ width: viewWidth, height: viewHeight }}>
        {picture ? <Picture picture={picture} /> : null}
      </Canvas>
    </View>
  );
}

export function WelcomeScreen({ onGetStarted }: Props) {
  return (
    <View style={styles.root}>
      <ScrollView bounces={false} contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <Image
        source={require('../../assets/icon.png')}
        style={styles.logo}
        accessibilityLabel="Boop Boop"
        accessibilityIgnoresInvertColors
      />
      <WelcomePets />
      <Text style={styles.headline}>{"Let's adopt your pet!"}</Text>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" onPress={onGetStarted} style={styles.hit}>
          {({ pressed }) => (
            <CandyShell tint={pink} radius={28} uid="welcome-start" pressed={pressed} style={styles.primary}>
              <Text style={[styles.primaryText, { color: pinkInk }]}>Get started</Text>
            </CandyShell>
          )}
        </Pressable>
      </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFF4F8',
  },
  screen: {
    flexGrow: 1,
    backgroundColor: '#FFF4F8',
    alignItems: 'center',
    paddingTop: 64,
    paddingBottom: 28,
    gap: 16,
  },
  logo: {
    width: 148,
    height: 148,
    borderRadius: 36,
  },
  stage: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  headline: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 32,
    color: pinkInk,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  actions: {
    alignSelf: 'stretch',
    marginTop: 'auto',
    paddingHorizontal: 24,
    gap: 12,
  },
  hit: {
    alignSelf: 'stretch',
  },
  primary: {
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 22,
  },
});
