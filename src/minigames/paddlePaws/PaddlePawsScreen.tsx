import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { GestureResponderEvent } from 'react-native';
import { Canvas, Picture, Skia, useFont, type SkPicture } from '@shopify/react-native-skia';
import { useSharedValue } from 'react-native-reanimated';

import { breedById, spawnActor, voiceRate } from '../../actor';
import type { Actor, Breed } from '../../actor/types';
import { growthFor } from '../../actor/growth';
import { playBadgeChime, playPointPop } from '../../audio/badge';
import { playBloop, preloadBloops } from '../../audio/bloop';
import { playVoice, setSoundEnabled, soundEnabled } from '../../audio/voice';
import { createUuid } from '../../compliance/identity';
import { readAccountLinked } from '../../db/accountMeta';
import type { PetState } from '../../sim/types';
import { AccountSheet } from '../../ui/AccountSheet';
import { fontFamily } from '../../ui/font';
import { loadSoundEnabled, saveSoundEnabled } from '../../storage/session';
import { CAUSE, HOW_TO, POINTS, WORLD_W } from './content';
import {
  beginRun,
  createRun,
  endRun,
  hudSignature,
  metersOf,
  pauseRun,
  pointerDown,
  pointerMove,
  pointerUp,
  resumeRun,
  step,
  takeSounds,
} from './engine';
import { drawPaddlePaws } from './render';
import { flushPaddleScores, loadBoard, rankThisRun, readBest, recordRun } from './scores';
import type { Board, LocalBest } from './scores';
import type { PaddleSound, Run } from './types';

type Overlay = 'menu' | 'play' | 'paused' | 'over';

type Summary = {
  cause: string;
  score: number;
  meters: number;
  rank: number;
  isBest: boolean;
  guest: boolean;
  waiting: boolean;
};

type Hud = {
  score: number;
  meters: number;
  shield: boolean;
  bump: number;
};

type Props = {
  pet: PetState;
  reducedMotion: boolean;
  onBack: () => void;
  onMenu: () => void;
};

function blankPicture(width: number, height: number): SkPicture {
  const recorder = Skia.PictureRecorder();
  recorder.beginRecording(Skia.XYWHRect(0, 0, Math.max(width, 1), Math.max(height, 1)));
  return recorder.finishRecordingAsPicture();
}

function playSounds(run: Run, pet: PetState, breed: Breed): void {
  const rate = voiceRate(breed, growthFor(pet.ageDays).scale);
  const vocal = breed.species === 'cat' ? 'meow' : 'bark';
  const play = (sound: PaddleSound) => {
    if (sound === 'start') {
      playVoice({ actorId: pet.id, sound: vocal, rate });
    } else if (sound === 'up') {
      playBloop(0);
    } else if (sound === 'shell' || sound === 'pearl') {
      playPointPop();
    } else if (sound === 'gem' || sound === 'chest' || sound === 'power' || sound === 'record') {
      playBadgeChime();
    } else if (sound === 'pop') {
      playVoice({ actorId: pet.id, sound: 'squeak', rate: 1 });
    } else if (sound === 'bonk') {
      playVoice({ actorId: pet.id, sound: 'growl', rate: 1 });
    } else if (sound === 'zap') {
      playVoice({ actorId: pet.id, sound: 'bell', rate: 1 });
    }
  };
  for (const sound of takeSounds(run)) {
    play(sound);
  }
}

export function PaddlePawsScreen({ pet, reducedMotion, onBack, onMenu }: Props) {
  const font = useFont(require('@expo-google-fonts/fredoka/700Bold/Fredoka_700Bold.ttf'), 20);
  const fontSm = useFont(require('@expo-google-fonts/fredoka/700Bold/Fredoka_700Bold.ttf'), 12);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [overlay, setOverlay] = useState<Overlay>('menu');
  const [hud, setHud] = useState<Hud>({ score: 0, meters: 0, shield: false, bump: 0 });
  const [summary, setSummary] = useState<Summary | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [guest, setGuest] = useState(() => !readAccountLinked());
  const picture = useSharedValue<SkPicture>(blankPicture(1, 1));
  const pictureRef = useRef(picture);
  const runRef = useRef<Run | null>(null);
  const actorRef = useRef<Actor | null>(null);
  const breedRef = useRef<Breed | null>(null);
  const sigRef = useRef('');
  const overRef = useRef(0);
  const boxRef = useRef(box);
  const petRef = useRef(pet);
  const reducedRef = useRef(reducedMotion);
  const activeRef = useRef(true);
  const bestRef = useRef<LocalBest>({ score: 0, meters: 0, farthest: 0 });

  const logicalH = box.width > 0 ? (box.height * WORLD_W) / box.width : 700;

  useEffect(() => {
    boxRef.current = box;
    petRef.current = pet;
    reducedRef.current = reducedMotion;
    pictureRef.current = picture;
  }, [box, pet, picture, reducedMotion]);

  useEffect(() => {
    const breed = breedById(pet.breedId);
    breedRef.current = breed;
    if (!breed) {
      actorRef.current = null;
      return;
    }
    actorRef.current = spawnActor(
      {
        id: pet.id,
        breedId: pet.breedId,
        ageDays: pet.ageDays,
        weight: pet.weight,
        vitality: pet.vitality,
        equipped: pet.equipped,
        look: pet.look,
        seed: pet.attributes.seed,
        asleep: false,
        energy: Math.min(1, Math.max(0, pet.needs.energy / 100)),
        mood: Math.min(1, Math.max(0, pet.needs.happiness / 100)),
        hydration: Math.min(1, Math.max(0, pet.hydration / 100)),
      },
      { x: 0, y: 0 },
    );
  }, [pet]);

  useEffect(() => {
    preloadBloops();
    let cancelled = false;
    void readBest().then((best) => {
      if (cancelled) {
        return;
      }
      bestRef.current = best;
      if (!runRef.current) {
        runRef.current = createRun({
          seed: 1,
          logicalH,
          bestMeters: best.farthest,
          bestScore: best.score,
        });
      }
    });
    void loadSoundEnabled().then((on) => {
      setSoundEnabled(on);
      if (!cancelled) {
        setSoundOn(on);
      }
    });
    void loadBoard().then((next) => {
      if (!cancelled && next) {
        setBoard(next);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [logicalH]);

  const redraw = useCallback(() => {
    const run = runRef.current;
    const { width, height } = boxRef.current;
    if (!run || width < 2 || height < 2) {
      return;
    }
    run.H = (height * WORLD_W) / width;
    const recorder = Skia.PictureRecorder();
    const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, width, height));
    drawPaddlePaws(canvas, run, actorRef.current, breedRef.current, font, fontSm, width, height);
    pictureRef.current.value = recorder.finishRecordingAsPicture();
  }, [font, fontSm]);

  const settle = useCallback(async (run: Run) => {
    const score = run.score;
    const meters = metersOf(run);
    const saved = await recordRun({
      clientRunId: createUuid(),
      score,
      meters,
      petId: petRef.current.id,
    });
    bestRef.current = saved.best;
    const isGuest = !readAccountLinked();
    setGuest(isGuest);
    const flushed = await flushPaddleScores();
    const live = await loadBoard();
    if (live) {
      setBoard(live);
    }
    const rows = live?.rows ?? [];
    if (saved.isBest && run.cause !== 'quit') {
      playBadgeChime();
    }
    setSummary({
      cause: run.cause,
      score,
      meters,
      rank: rankThisRun(rows, score),
      isBest: saved.isBest,
      guest: isGuest,
      waiting: flushed === 'kept',
    });
  }, []);

  const openResults = useCallback(
    (run: Run) => {
      if (run.overId === overRef.current) {
        return;
      }
      overRef.current = run.overId;
      setOverlay('over');
      void settle(run);
    },
    [settle],
  );

  useEffect(() => {
    let raf = 0;
    let last = Date.now();
    let running = true;
    const loop = () => {
      if (!running) {
        return;
      }
      const now = Date.now();
      const dt = Math.min(1 / 30, (now - last) / 1000);
      last = now;
      const run = runRef.current;
      const breed = breedRef.current;
      if (run && activeRef.current) {
        run.reduced = reducedRef.current;
        run.H = boxRef.current.width > 0 ? (boxRef.current.height * WORLD_W) / boxRef.current.width : run.H;
        step(run, dt);
        if (breed && (run.phase === 'play' || run.phase === 'dying')) {
          playSounds(run, petRef.current, breed);
        }
        if (run.phase === 'play' || run.phase === 'dying') {
          const sig = hudSignature(run);
          if (sig !== sigRef.current) {
            sigRef.current = sig;
            setHud({
              score: run.score,
              meters: metersOf(run),
              shield: run.pet.shield,
              bump: run.bump,
            });
          }
        }
        if (run.phase === 'over') {
          openResults(run);
        }
      }
      redraw();
      if (activeRef.current) {
        raf = requestAnimationFrame(loop);
      }
    };
    raf = requestAnimationFrame(loop);
    const sub = AppState.addEventListener('change', (status) => {
      const active = status === 'active';
      const returned = active && !activeRef.current;
      activeRef.current = active;
      if (!active && runRef.current?.phase === 'play') {
        pauseRun(runRef.current);
        setOverlay('paused');
      }
      if (returned) {
        last = Date.now();
        raf = requestAnimationFrame(loop);
        void flushPaddleScores().then(() => loadBoard().then((next) => next && setBoard(next)));
      }
    });
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      sub.remove();
    };
  }, [openResults, redraw]);

  const start = () => {
    const best = bestRef.current;
    const run = createRun({
      seed: Math.floor(Math.random() * 4294967296),
      logicalH,
      bestMeters: best.farthest,
      bestScore: best.score,
    });
    beginRun(run);
    runRef.current = run;
    overRef.current = 0;
    sigRef.current = '';
    setSummary(null);
    setOverlay('play');
    setHud({ score: 0, meters: 0, shield: false, bump: 0 });
  };

  const scale = box.width > 0 ? box.width / WORLD_W : 1;
  const playing = overlay === 'play' || overlay === 'paused';
  const showHud = overlay === 'play' || overlay === 'paused';

  const clearTouches = () => {
    const run = runRef.current;
    if (!run) {
      return;
    }
    for (const id of [...run.touches.keys()]) {
      pointerUp(run, id);
    }
  };

  const syncTouches = (event: GestureResponderEvent) => {
    const run = runRef.current;
    if (!run) {
      return;
    }
    const native = event.nativeEvent;
    const list = native.touches.length > 0 ? native.touches : [{ identifier: 1, locationY: native.locationY }];
    const live = new Set<string>();
    for (const touch of list) {
      const id = String(touch.identifier);
      live.add(id);
      const y = touch.locationY / scale;
      if (run.touches.has(id)) {
        pointerMove(run, id, y);
      } else {
        pointerDown(run, id, y);
      }
    }
    for (const id of [...run.touches.keys()]) {
      if (!live.has(id)) {
        pointerUp(run, id);
      }
    }
  };

  const reason =
    summary == null
      ? ''
      : summary.cause === 'quit'
        ? 'You ended the run'
        : summary.isBest
          ? 'New high score!'
          : (CAUSE[summary.cause] ?? 'Your run ended');

  return (
    <View
      style={styles.root}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setBox({ width, height });
      }}
    >
      <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Picture picture={picture} />
      </Canvas>
      {playing ? (
        <View
          style={StyleSheet.absoluteFill}
          onStartShouldSetResponder={() => overlay === 'play'}
          onMoveShouldSetResponder={() => overlay === 'play'}
          onResponderGrant={syncTouches}
          onResponderMove={syncTouches}
          onResponderRelease={clearTouches}
          onResponderTerminate={clearTouches}
        />
      ) : null}
      {showHud ? (
        <View pointerEvents="box-none" style={styles.hud}>
          <View pointerEvents="box-none" style={styles.row}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Pause"
              onPress={() => {
                const run = runRef.current;
                if (!run) {
                  return;
                }
                pauseRun(run);
                setOverlay('paused');
              }}
              style={styles.pause}
            >
              <Text style={styles.pauseText}>II</Text>
            </Pressable>
            <View pointerEvents="none" style={styles.pill}>
              <Text style={styles.pillLabel}>Swam</Text>
              <Text style={styles.pillValue}>{hud.meters} m</Text>
            </View>
            <View style={styles.spacer} />
            <View pointerEvents="none" style={[styles.pill, { transform: [{ scale: 1 + hud.bump * 0.6 }] }]}>
              <Text style={styles.pillLabel}>Points</Text>
              <Text style={styles.pillValue}>{hud.score}</Text>
            </View>
          </View>
          {hud.shield ? (
            <View pointerEvents="none" style={styles.row}>
              <View style={styles.spacer} />
              <View style={styles.shieldPill}>
                <View style={styles.bub} />
                <Text style={styles.shieldText}>Shield on</Text>
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      {overlay === 'menu' ? (
        <View style={styles.overlay}>
          <View style={styles.card}>
            <ScrollView style={styles.cardScroll} contentContainerStyle={styles.cardContent} showsVerticalScrollIndicator>
              <Text style={styles.title}>Paddle Paws</Text>
              <Text style={styles.body}>{HOW_TO}</Text>
              <View style={styles.legend}>
                <Legend label="Shell" points={POINTS.shell} />
                <Legend label="Pearl" points={POINTS.pearl} />
                <Legend label="Sea gem" points={POINTS.gem} />
                <Legend label="Treasure" points={POINTS.chest} />
              </View>
              <View style={styles.split}>
                <View style={styles.tile}>
                  <Text style={styles.tileTitle}>Above your pet</Text>
                  <Text style={styles.tileBody}>Hold to swim up</Text>
                </View>
                <View style={styles.tile}>
                  <Text style={styles.tileTitle}>Below your pet</Text>
                  <Text style={styles.tileBody}>Hold to swim down</Text>
                </View>
              </View>
              <TopScores board={board} />
              {guest ? (
                <Pressable accessibilityRole="button" onPress={() => setSheetOpen(true)} style={styles.ghost}>
                  <Text style={styles.ghostText}>Create an account to compete with friends</Text>
                </Pressable>
              ) : null}
              <Pressable accessibilityRole="button" onPress={start} style={styles.btn}>
                <Text style={styles.btnText}>Swim</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={onBack} style={styles.ghost}>
                <Text style={styles.ghostText}>Back</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      ) : null}

      {overlay === 'paused' ? (
        <View style={styles.overlay}>
          <View style={styles.card}>
            <ScrollView style={styles.cardScroll} contentContainerStyle={styles.cardContent} showsVerticalScrollIndicator>
            <Text style={styles.heading}>Paused</Text>
            <Pressable accessibilityRole="button" onPress={() => {
              const run = runRef.current;
              if (run) {
                resumeRun(run);
              }
              setOverlay('play');
            }} style={styles.btn}>
              <Text style={styles.btnText}>Resume</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                const next = !soundEnabled();
                setSoundEnabled(next);
                void saveSoundEnabled(next);
                setSoundOn(next);
              }}
              style={styles.chip}
            >
              <Text style={styles.chipText}>{soundOn ? 'Sound on' : 'Sound off'}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                const run = runRef.current;
                if (!run) {
                  return;
                }
                endRun(run);
                openResults(run);
              }}
              style={styles.ghost}
            >
              <Text style={styles.ghostText}>End run</Text>
            </Pressable>
            </ScrollView>
          </View>
        </View>
      ) : null}

      {overlay === 'over' && summary ? (
        <View style={styles.overlay}>
          <View style={styles.card}>
            <ScrollView style={styles.cardScroll} contentContainerStyle={styles.cardContent} showsVerticalScrollIndicator>
              <Text style={styles.heading}>Game over</Text>
              <Text style={styles.reason}>{reason}</Text>
              <View style={styles.stats}>
                <Stat value={summary.score.toLocaleString()} label="Points" gold />
                <Stat value={String(summary.meters)} label="Meters" />
                <Stat value={`#${summary.rank}`} label="Rank" />
              </View>
              {summary.waiting ? <Text style={styles.note}>We will add your score when you are back online.</Text> : null}
              <TopScores board={board} />
              {guest ? (
                <Pressable accessibilityRole="button" onPress={() => setSheetOpen(true)} style={styles.ghost}>
                  <Text style={styles.ghostText}>Create an account to compete with friends</Text>
                </Pressable>
              ) : null}
              <Pressable accessibilityRole="button" onPress={start} style={styles.btn}>
                <Text style={styles.btnText}>Swim again</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={onMenu} style={styles.ghost}>
                <Text style={styles.ghostText}>Menu</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      ) : null}
      {sheetOpen ? (
        <AccountSheet
          reason="score"
          petName={pet.name}
          onClose={() => {
            setSheetOpen(false);
            setGuest(!readAccountLinked());
          }}
        />
      ) : null}
    </View>
  );
}

function Legend({ label, points }: { label: string; points: number }) {
  return (
    <View style={styles.legendItem}>
      <Text style={styles.legendPoints}>+{points}</Text>
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

function Stat({ value, label, gold }: { value: string; label: string; gold?: boolean }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, gold && styles.gold]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function TopScores({ board }: { board: Board | null }) {
  const rows = (board?.rows ?? []).filter((row) => row.score > 0);
  if (rows.length === 0) {
    return null;
  }
  return (
    <View style={styles.list}>
      <Text style={styles.scoresTitle}>Top Scores</Text>
      {rows.map((row) => (
        <View key={`${row.rank}-${row.handle}-${row.mine ? 'me' : 'f'}`} style={[styles.lbRow, row.mine && styles.lbMe]}>
          <Text style={styles.lbRank}>{row.rank}</Text>
          <Text style={styles.lbName} numberOfLines={1}>
            {row.mine ? row.handle || 'You' : row.handle || 'Friend'}
          </Text>
          <Text style={styles.lbScore}>{row.score.toLocaleString()}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#143a62' },
  hud: { position: 'absolute', top: 54, left: 12, right: 12, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  spacer: { flex: 1 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(251,253,255,0.88)',
    borderRadius: 999,
    paddingVertical: 4,
    paddingLeft: 8,
    paddingRight: 12,
  },
  pillLabel: {
    fontFamily: fontFamily.extraBold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#5f6f9a',
  },
  pillValue: { fontFamily: fontFamily.fredokaBold, fontSize: 18, color: '#2f3f6e' },
  pause: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(251,253,255,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseText: { fontFamily: fontFamily.extraBold, color: '#2f3f6e', letterSpacing: 1 },
  shieldPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(251,253,255,0.88)',
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  bub: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#7fdcf0' },
  shieldText: { fontFamily: fontFamily.extraBold, fontSize: 13, color: '#2f3f6e' },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(10,30,70,0.28)',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    backgroundColor: '#fbfdff',
    borderRadius: 28,
    padding: 22,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 360,
    maxHeight: '100%',
    overflow: 'hidden',
  },
  cardScroll: { flexGrow: 0, flexShrink: 1 },
  cardContent: { gap: 12 },
  title: { fontFamily: fontFamily.fredokaBold, fontSize: 40, color: '#e2569b', textAlign: 'center' },
  heading: { fontFamily: fontFamily.fredokaBold, fontSize: 32, color: '#2f3f6e', textAlign: 'center' },
  body: { fontFamily: fontFamily.semibold, fontSize: 15, lineHeight: 22, color: '#5f6f9a', textAlign: 'center' },
  legend: { flexDirection: 'row', gap: 6 },
  legendItem: { flex: 1, backgroundColor: '#e9f6ff', borderRadius: 14, paddingVertical: 6, alignItems: 'center' },
  legendPoints: { fontFamily: fontFamily.fredokaBold, fontSize: 16, color: '#e2569b' },
  legendLabel: { fontFamily: fontFamily.extraBold, fontSize: 10, color: '#5f6f9a', textAlign: 'center' },
  split: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, backgroundColor: '#e9f6ff', borderRadius: 14, padding: 8 },
  tileTitle: { fontFamily: fontFamily.fredokaBold, fontSize: 15, color: '#2f3f6e' },
  tileBody: { fontFamily: fontFamily.bold, fontSize: 12, color: '#5f6f9a' },
  btn: { backgroundColor: '#ff7fbd', borderRadius: 999, paddingVertical: 12, paddingHorizontal: 16 },
  btnText: { fontFamily: fontFamily.fredokaBold, fontSize: 22, color: '#ffffff', textAlign: 'center' },
  ghost: { paddingVertical: 6 },
  ghostText: { fontFamily: fontFamily.fredokaBold, fontSize: 16, color: '#5f6f9a', textAlign: 'center' },
  chip: { backgroundColor: '#e9f6ff', borderRadius: 16, paddingVertical: 8 },
  chipText: { fontFamily: fontFamily.fredokaBold, fontSize: 16, color: '#2f3f6e', textAlign: 'center' },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, backgroundColor: '#e9f6ff', borderRadius: 16, paddingVertical: 8, alignItems: 'center' },
  statValue: { fontFamily: fontFamily.fredokaBold, fontSize: 22, color: '#2f3f6e' },
  gold: { color: '#c98a12' },
  statLabel: {
    fontFamily: fontFamily.extraBold,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: '#5f6f9a',
  },
  reason: { fontFamily: fontFamily.extraBold, color: '#e2569b', textAlign: 'center' },
  note: { fontFamily: fontFamily.semibold, fontSize: 13, color: '#5f6f9a', textAlign: 'center' },
  list: { backgroundColor: '#e9f6ff', borderRadius: 16, padding: 8, gap: 2 },
  scoresTitle: { fontFamily: fontFamily.fredokaBold, fontSize: 18, color: '#2f3f6e', textAlign: 'center', paddingTop: 4 },
  lbRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 10 },
  lbMe: { backgroundColor: '#fbfdff', borderWidth: 2, borderColor: '#ff8fc4' },
  lbRank: { width: 24, fontFamily: fontFamily.extraBold, color: '#5f6f9a' },
  lbName: { flex: 1, fontFamily: fontFamily.extraBold, color: '#2f3f6e' },
  lbScore: { fontFamily: fontFamily.fredokaBold, fontSize: 15, color: '#2f3f6e' },
});
