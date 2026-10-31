import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { startRunwayTrack, stopRunwayTrack } from '../../audio/runwayMusic';
import { themeById, type RunwayThemeId } from '../../runway/catalog';
import { runwayConfig } from '../../runway/config';
import { buildBeats, modelsForViewer, skipToNextModel, skipToNextRound, venueScrolls } from '../../runway/playback';
import type { LocalRunwayShow } from '../../runway/types';
import { layerOffset, venueLayers, venuePawY, venueScale, venueStackHeight, venueTileWidth } from '../../runway/venue';
import { fontFamily } from '../font';

type Props = {
  show: LocalRunwayShow;
  viewerSubmissionId?: string;
  reducedMotion: boolean;
  onDone: () => void;
};

export function RunwayView({ show, viewerSubmissionId, reducedMotion, onDone }: Props) {
  const { width, height } = useWindowDimensions();
  const themeId = (themeById(show.themeId)?.id ?? 'space') as RunwayThemeId;
  const layers = venueLayers(themeId);
  const scale = venueScale(height);
  const beats = useMemo(() => buildBeats(show, viewerSubmissionId), [show, viewerSubmissionId]);
  const models = useMemo(() => modelsForViewer(show, viewerSubmissionId), [show, viewerSubmissionId]);
  const [beatIndex, setBeatIndex] = useState(0);
  const [scroll, setScroll] = useState(0);
  const scrollRef = useRef(0);
  const beatIndexRef = useRef(0);
  const started = useRef(false);

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
    const tick = () => {
      const elapsed = (Date.now() - start) / 1000;
      if (scrollMode === 'out') {
        scrollRef.current = startScroll + speed * elapsed;
        setScroll(scrollRef.current);
      } else if (scrollMode === 'back') {
        scrollRef.current = startScroll - speed * elapsed;
        setScroll(scrollRef.current);
      }
      if (elapsed >= seconds) {
        setBeatIndex((i) => i + 1);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [beatIndex, beats, onDone, reducedMotion]);

  const beat = beats[Math.min(beatIndex, beats.length - 1)];
  const model = models[beat?.modelIndex ?? 0];
  const lookNumber = (beat?.lookIndex ?? 0) + 1;
  const tile = venueTileWidth * scale;
  const stackH = venueStackHeight * scale;
  const pawY = venuePawY * scale;

  return (
    <View style={styles.root}>
      <View style={[styles.stage, { width, height: stackH }]}>
        {layers.map((src, index) => {
          const speed = [0.1, 0.3, 0.6, 0.75, 1.0, 1.25][index] ?? 1;
          const offset = layerOffset(scroll, speed, scale);
          const copies = Math.ceil(width / tile) + 2;
          return (
            <View key={index} style={StyleSheet.absoluteFill} pointerEvents="none">
              {Array.from({ length: copies }, (_, copy) => (
                <Image
                  key={copy}
                  source={src}
                  style={{
                    position: 'absolute',
                    left: offset + copy * tile,
                    top: 0,
                    width: tile,
                    height: stackH,
                  }}
                  resizeMode="stretch"
                />
              ))}
            </View>
          );
        })}
        <View style={[styles.petSpot, { top: pawY - 120, left: width / 2 - 60 }]}>
          <Text style={styles.petName}>{model?.submission.pet.name ?? 'Model'}</Text>
          <Text style={styles.petHint}>Look {lookNumber}</Text>
        </View>
      </View>
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
  root: { flex: 1, backgroundColor: '#1a1530' },
  stage: { overflow: 'hidden', alignSelf: 'stretch' },
  petSpot: {
    position: 'absolute',
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 24,
  },
  petName: { fontFamily: fontFamily.fredokaBold, color: '#fff', fontSize: 16 },
  petHint: { fontFamily: fontFamily.regular, color: '#f5e9ff', fontSize: 12, marginTop: 4 },
  chrome: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 28,
    gap: 10,
  },
  lookLabel: { fontFamily: fontFamily.fredokaBold, color: '#fff', fontSize: 22, textAlign: 'center' },
  modelLabel: { fontFamily: fontFamily.regular, color: '#f5e9ff', fontSize: 14, textAlign: 'center' },
  row: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  btn: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
  },
  btnText: { fontFamily: fontFamily.fredokaSemibold, color: '#4B3B7A', fontSize: 14 },
});
