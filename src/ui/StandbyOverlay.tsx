import { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { Canvas, Picture, Skia } from '@shopify/react-native-skia';
import type { SkPicture } from '@shopify/react-native-skia';

import { createWorld, frameDt, spawnActor, todAt, update } from '../actor';
import type { World } from '../actor';
import { stageWidth } from '../actor/geometry';
import { previewStageHeight } from '../actor/scenes';
import { previewBackdrop, previewHome, previewScene } from '../actor/previewScene';
import { onStandbyChange, readOtherDeviceLabel, readStandby } from '../db/accountMeta';
import type { Equipped, Look, PetState } from '../sim/types';
import { devicePhrase } from '../sync/deviceLabel';
import { requestPlayHere } from '../state/sessionGate';
import { CandyShell, candyInk, tints } from './candy';
import { fontFamily } from './font';
import { drawWorld } from './skia/world';

type Props = {
  pet: PetState | null;
};

const noon = todAt(12);
const frameMs = 1000 / 30;
const pink = tints.pink;

function AsleepPet({
  breedId,
  look,
  ageDays,
  equipped,
}: {
  breedId: string;
  look: Look;
  ageDays: number;
  equipped: Equipped;
}) {
  const ratio = previewStageHeight / stageWidth;
  const viewWidth = 280;
  const viewHeight = viewWidth * ratio;
  const [picture, setPicture] = useState<SkPicture | null>(null);
  const worldRef = useRef<World | null>(null);

  useEffect(() => {
    const actor = spawnActor(
      {
        id: 'standby',
        breedId,
        ageDays,
        weight: 0,
        vitality: 0.75,
        equipped,
        look,
        asleep: true,
      },
      previewHome,
    );
    const world = createWorld([actor], 1, previewScene);
    world.reducedMotion = true;
    world.noNap = true;
    worldRef.current = world;

    let raf = 0;
    let last = Date.now();
    let lastDraw = 0;
    let running = true;
    let active = AppState.currentState === 'active';

    const draw = () => {
      const current = worldRef.current;
      if (!current) {
        return;
      }
      const recorder = Skia.PictureRecorder();
      const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, viewWidth, viewHeight));
      drawWorld(canvas, current, viewWidth, viewHeight, noon, true, previewStageHeight, undefined, undefined, { sky: null });
      setPicture(recorder.finishRecordingAsPicture());
    };

    const loop = () => {
      if (!running) {
        return;
      }
      const now = Date.now();
      const current = worldRef.current;
      if (current) {
        update(current, frameDt(now - last, active));
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
  }, [ageDays, breedId, equipped, look, viewHeight, viewWidth]);

  return (
    <View style={[styles.stage, { width: viewWidth, height: viewHeight, backgroundColor: previewBackdrop }]}>
      <Canvas pointerEvents="none" style={{ width: viewWidth, height: viewHeight }}>
        {picture ? <Picture picture={picture} /> : null}
      </Canvas>
    </View>
  );
}

export function StandbyOverlay({ pet }: Props) {
  const [standby, setStandbyOn] = useState(readStandby());
  const [label, setLabel] = useState(readOtherDeviceLabel());

  useEffect(
    () =>
      onStandbyChange(() => {
        setStandbyOn(readStandby());
        setLabel(readOtherDeviceLabel());
      }),
    [],
  );

  if (!standby) {
    return null;
  }

  const phrase = devicePhrase(label);

  return (
    <View style={styles.scrim}>
      {pet ? (
        <AsleepPet breedId={pet.breedId} look={pet.look} ageDays={pet.ageDays} equipped={pet.equipped} />
      ) : null}
      <Text style={styles.title}>{`You're playing on ${phrase}.`}</Text>
      <Pressable accessibilityRole="button" onPress={() => requestPlayHere()} style={styles.hit}>
        {({ pressed }) => (
          <CandyShell tint={pink} radius={24} uid="play-here" pressed={pressed} style={styles.button}>
            <Text style={[styles.buttonLabel, { color: candyInk(pink) }]}>Play here</Text>
          </CandyShell>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(42, 20, 66, 0.72)',
    padding: 28,
    gap: 20,
  },
  stage: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  title: {
    color: '#fff',
    fontFamily: fontFamily.extraBold,
    fontSize: 28,
    textAlign: 'center',
  },
  hit: {
    alignSelf: 'stretch',
    maxWidth: 280,
  },
  button: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 18,
  },
});
