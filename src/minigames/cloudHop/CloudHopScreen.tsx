import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Canvas, Picture, Skia, useFont } from '@shopify/react-native-skia';
import type { SkPicture } from '@shopify/react-native-skia';
import { useSharedValue } from 'react-native-reanimated';

import { breedById, spawnActor, voiceRate } from '../../actor';
import type { Actor, Breed } from '../../actor/types';
import { growthFor } from '../../actor/growth';
import { playVoice, setSoundEnabled, soundEnabled } from '../../audio/voice';
import { onAccountFlags, readAccountLinked, readHandleSaved } from '../../db/accountMeta';
import type { PetState } from '../../sim/types';
import { AccountSheet } from '../../ui/AccountSheet';
import { fontFamily } from '../../ui/font';
import { loadSoundEnabled, saveSoundEnabled } from '../../storage/session';
import { HOW_TO, PTS_PER_M, WORLD_W } from './content';
import {
  beginRun,
  createRun,
  driftClouds,
  endRun,
  hudSignature,
  metersOf,
  pauseRun,
  pointerDown,
  pointerMove,
  pointerUp,
  resumeRun,
  scoreOf,
  step,
  takeSounds,
} from './engine';
import { drawCloudHop } from './render';
import { flushCloudHopScore, loadBoard, readSeen, recordRun, rememberSeen } from './scores';
import type { Board } from './scores';
import type { Run as HopRun } from './types';

type Overlay = 'menu' | 'play' | 'paused' | 'over' | 'board';

type Summary = {
  cause: string;
  score: number;
  meters: number;
  best: number;
  isBest: boolean;
  heightPts: number;
  collected: number;
  combo: number;
  perfect: number;
  near: number;
  rank: number | null;
  guest: boolean;
  waiting: boolean;
};

type Hud = {
  score: number;
  meters: number;
  combo: number;
  mult: number;
  bar: number;
  magnet: number;
  umbrella: boolean;
  bannerEye: string;
  bannerTitle: string;
  bannerSub: string;
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

function playSounds(run: HopRun, pet: PetState, breed: Breed): void {
  const rate = voiceRate(breed, growthFor(pet.ageDays).scale);
  const vocal = breed.species === 'cat' ? 'meow' : 'bark';
  for (const sound of takeSounds(run)) {
    if (sound === 'squeak') {
      playVoice({ actorId: pet.id, sound: 'squeak', rate: 1 });
    } else if (sound === 'big') {
      playVoice({ actorId: pet.id, sound: vocal, rate: rate * 0.82 });
    } else {
      playVoice({ actorId: pet.id, sound: vocal, rate });
    }
  }
}

export function CloudHopScreen({ pet, reducedMotion, onBack, onMenu }: Props) {
  const font = useFont(require('@expo-google-fonts/fredoka/700Bold/Fredoka_700Bold.ttf'), 18);
  const fontLg = useFont(require('@expo-google-fonts/fredoka/700Bold/Fredoka_700Bold.ttf'), 24);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [overlay, setOverlay] = useState<Overlay>('menu');
  const [hud, setHud] = useState<Hud>({
    score: 0,
    meters: 0,
    combo: 0,
    mult: 1,
    bar: 1,
    magnet: 0,
    umbrella: false,
    bannerEye: '',
    bannerTitle: '',
    bannerSub: '',
  });
  const [summary, setSummary] = useState<Summary | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [boardNote, setBoardNote] = useState('');
  const [soundOn, setSoundOn] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [devHeight, setDevHeight] = useState('0');
  const [devSeed, setDevSeed] = useState('');
  const [devUnlock, setDevUnlock] = useState(false);
  const [devHit, setDevHit] = useState(false);
  const [devGod, setDevGod] = useState(false);
  const picture = useSharedValue<SkPicture>(blankPicture(1, 1));
  const runRef = useRef<HopRun | null>(null);
  const actorRef = useRef<Actor | null>(null);
  const breedRef = useRef<Breed | null>(null);
  const sigRef = useRef('');
  const overRef = useRef(0);
  const boxRef = useRef(box);
  const overlayRef = useRef(overlay);
  const petRef = useRef(pet);
  const reducedRef = useRef(reducedMotion);
  const activeRef = useRef(true);
  const boardFrom = useRef<Overlay>('menu');
  boxRef.current = box;
  overlayRef.current = overlay;
  petRef.current = pet;
  reducedRef.current = reducedMotion;

  const logicalH = box.width > 0 ? (box.height * WORLD_W) / box.width : 700;

  const makeRun = useCallback(
    (height: number) => {
      const seed = devSeed.trim() === '' ? Math.floor(Math.random() * 4294967296) : Number(devSeed) >>> 0;
      const seen = runRef.current?.seen ?? new Set<string>();
      const run = createRun({
        seed,
        logicalH: height,
        seen,
        startMeters: Number(devHeight) || 0,
        unlockAll: devUnlock,
        invincible: devGod,
      });
      run.hitboxes = devHit;
      runRef.current = run;
      sigRef.current = '';
      return run;
    },
    [devGod, devHeight, devHit, devSeed, devUnlock],
  );

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
    return onAccountFlags(() => {
      if (!readAccountLinked() || !readHandleSaved()) {
        return;
      }
      void (async () => {
        const flushed = await flushCloudHopScore();
        const live = await loadBoard();
        if (live) {
          setBoard(live);
        }
        setSummary((current) =>
          current
            ? {
                ...current,
                guest: false,
                waiting: flushed === 'kept',
                rank: live?.me && live.me.rank <= 20 ? live.me.rank : current.rank,
              }
            : current,
        );
      })();
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void readSeen().then((ids) => {
      if (cancelled) {
        return;
      }
      const seen = new Set(ids);
      if (runRef.current) {
        runRef.current.seen = seen;
      } else {
        const run = createRun({ seed: 1, logicalH, seen });
        runRef.current = run;
      }
    });
    void loadSoundEnabled().then((on) => {
      setSoundEnabled(on);
      if (!cancelled) {
        setSoundOn(on);
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
    drawCloudHop(canvas, run, actorRef.current, breedRef.current, font, fontLg, width, height);
    picture.value = recorder.finishRecordingAsPicture();
  }, [font, fontLg, picture]);

  useEffect(() => {
    let raf = 0;
    let last = Date.now();
    let running = true;
    const loop = () => {
      if (!running) {
        return;
      }
      const now = Date.now();
      const rdt = Math.min(1 / 30, (now - last) / 1000);
      last = now;
      const run = runRef.current;
      const breed = breedRef.current;
      if (run && activeRef.current) {
        if (run.phase === 'menu') {
          if (!reducedRef.current) {
            driftClouds(run, rdt);
          }
        } else if (run.phase === 'play') {
          run.time += rdt;
          let dt = rdt;
          if (run.slowT > 0) {
            run.slowT -= rdt;
            dt *= 0.35;
          }
          step(run, dt);
          if (breed) {
            playSounds(run, petRef.current, breed);
          }
          if (run.freshSeen.length > 0) {
            const fresh = run.freshSeen.splice(0, run.freshSeen.length);
            void rememberSeen(fresh);
          }
          const sig = hudSignature(run);
          if (sig !== sigRef.current) {
            sigRef.current = sig;
            const mult = Math.min(5, 1 + Math.floor(run.combo / 5));
            setHud({
              score: scoreOf(run),
              meters: metersOf(run),
              combo: run.combo,
              mult,
              bar: run.pet.on ? Math.max(0, 1 - run.stand / 1.8) : 1,
              magnet: run.pet.magnet,
              umbrella: run.pet.umbrella,
              bannerEye: run.banner?.eye ?? '',
              bannerTitle: run.banner?.title ?? '',
              bannerSub: run.banner?.sub ?? '',
            });
          }
          if (run.overId !== overRef.current) {
            overRef.current = run.overId;
            setOverlay('over');
            void settle(run);
          }
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
        void flushCloudHopScore();
      }
    });
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      sub.remove();
    };
  }, [redraw]);

  async function settle(run: HopRun): Promise<void> {
    const score = scoreOf(run);
    const meters = metersOf(run);
    const guest = !readAccountLinked();
    const saved = await recordRun({
      score,
      meters,
      petName: petRef.current.name,
      durationS: run.time,
    });
    let rank: number | null = null;
    let waiting = false;
    if (!guest && readHandleSaved()) {
      const flushed = await flushCloudHopScore();
      waiting = flushed === 'kept';
      const live = await loadBoard();
      if (live?.me && live.me.rank <= 20) {
        rank = live.me.rank;
      }
      if (live) {
        setBoard(live);
      }
    }
    setSummary({
      cause: run.deathCause,
      score,
      meters,
      best: saved.best.score,
      isBest: saved.isBest,
      heightPts: meters * PTS_PER_M,
      collected: run.pts,
      combo: run.stats.maxCombo,
      perfect: run.stats.perfect,
      near: run.stats.near,
      rank,
      guest,
      waiting,
    });
  }

  const start = () => {
    const run = makeRun(logicalH);
    beginRun(run);
    overRef.current = 0;
    setSummary(null);
    setOverlay('play');
    setHud({
      score: 0,
      meters: metersOf(run),
      combo: 0,
      mult: 1,
      bar: 1,
      magnet: 0,
      umbrella: false,
      bannerEye: '',
      bannerTitle: '',
      bannerSub: '',
    });
  };

  const openBoard = (from: Overlay) => {
    boardFrom.current = from;
    setOverlay('board');
    void loadBoard().then((next) => {
      setBoard(next);
      setBoardNote(next ? '' : 'Scores will show when you are online.');
    });
  };

  const scale = box.width > 0 ? box.width / WORLD_W : 1;
  const playing = overlay === 'play';

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
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={(event) => {
            const run = runRef.current;
            const breed = breedRef.current;
            if (!run) {
              return;
            }
            pointerDown(run, event.nativeEvent.locationX / scale);
            if (breed) {
              playSounds(run, pet, breed);
            }
          }}
          onResponderMove={(event) => {
            const run = runRef.current;
            if (run) {
              pointerMove(run, event.nativeEvent.locationX / scale);
            }
          }}
          onResponderRelease={() => {
            if (runRef.current) {
              pointerUp(runRef.current);
            }
          }}
          onResponderTerminate={() => {
            if (runRef.current) {
              pointerUp(runRef.current);
            }
          }}
        />
      ) : null}
      {playing ? (
        <View style={styles.hud} pointerEvents="box-none">
          <View style={styles.row}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Pause"
              onPress={() => {
                if (runRef.current) {
                  pauseRun(runRef.current);
                }
                setOverlay('paused');
              }}
              style={styles.pause}
            >
              <Text style={styles.pauseText}>II</Text>
            </Pressable>
            <View style={styles.pill}>
              <Text style={styles.pillLabel}>Score</Text>
              <Text style={styles.score}>{hud.score.toLocaleString()}</Text>
            </View>
            <View style={styles.spacer} />
            <View style={styles.pill}>
              <Text style={styles.pillLabel}>Height</Text>
              <Text style={styles.pillValue}>{hud.meters} m</Text>
            </View>
          </View>
          <View style={styles.row}>
            {hud.combo >= 2 ? (
              <View style={styles.combo}>
                <Text style={styles.comboText}>
                  Combo {hud.combo}
                  {hud.mult > 1 ? ` · ×${hud.mult}` : ''}
                </Text>
                <View style={styles.bar}>
                  <View style={[styles.barFill, { width: `${Math.round(hud.bar * 100)}%` }]} />
                </View>
              </View>
            ) : null}
            <View style={styles.spacer} />
            {hud.magnet > 0 ? (
              <View style={styles.pillSm}>
                <Text style={styles.pillSmText}>Magnet {Math.ceil(hud.magnet)}s</Text>
              </View>
            ) : null}
            {hud.umbrella ? (
              <View style={styles.pillSm}>
                <Text style={styles.pillSmText}>Umbrella ready</Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}
      {playing && hud.bannerTitle ? (
        <View style={styles.banner} pointerEvents="none">
          {hud.bannerEye ? <Text style={styles.bannerEye}>{hud.bannerEye}</Text> : null}
          <Text style={styles.bannerTitle}>{hud.bannerTitle}</Text>
          {hud.bannerSub ? <Text style={styles.bannerSub}>{hud.bannerSub}</Text> : null}
        </View>
      ) : null}

      {overlay === 'menu' ? (
        <View style={styles.overlay}>
          <View style={styles.card}>
            <Text style={styles.title}>Cloud Hop</Text>
            <Text style={styles.body}>Ride the clouds up. Score points for height and everything you grab. Dodge the birds, outrun the fog. One fall and it is over.</Text>
            <Text style={styles.how}>{HOW_TO}</Text>
            <Pressable accessibilityRole="button" onPress={start} style={styles.btn}>
              <Text style={styles.btnText}>Play</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => openBoard('menu')} style={styles.ghost}>
              <Text style={styles.ghostText}>Leaderboard</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={onBack} style={styles.ghost}>
              <Text style={styles.ghostText}>Back</Text>
            </Pressable>
            {__DEV__ ? (
              <View style={styles.dev}>
                <Text style={styles.devLabel}>Start height</Text>
                <TextInput value={devHeight} onChangeText={setDevHeight} keyboardType="number-pad" style={styles.input} />
                <Text style={styles.devLabel}>Seed</Text>
                <TextInput value={devSeed} onChangeText={setDevSeed} keyboardType="number-pad" style={styles.input} />
                <DevToggle label="Unlock everything" on={devUnlock} onPress={() => setDevUnlock((value) => !value)} />
                <DevToggle label="Hitboxes" on={devHit} onPress={() => setDevHit((value) => !value)} />
                <DevToggle label="Invincible" on={devGod} onPress={() => setDevGod((value) => !value)} />
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      {overlay === 'paused' ? (
        <View style={styles.overlay}>
          <View style={styles.card}>
            <Text style={styles.heading}>Paused</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                if (runRef.current) {
                  resumeRun(runRef.current);
                }
                setOverlay('play');
              }}
              style={styles.btn}
            >
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
                setOverlay('over');
                void settle(run);
              }}
              style={styles.ghost}
            >
              <Text style={styles.ghostText}>End run</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {overlay === 'over' && summary ? (
        <View style={styles.overlay}>
          <View style={styles.card}>
            <Text style={styles.heading}>Game over</Text>
            <Text style={styles.reason}>{summary.cause}</Text>
            <View style={styles.stats}>
              <Stat value={summary.score.toLocaleString()} label="Score" />
              <Stat value={String(summary.meters)} label="Meters" />
              <Stat value={summary.best.toLocaleString()} label="High score" />
            </View>
            {summary.rank ? <Text style={styles.rank}>You are #{summary.rank}</Text> : null}
            {summary.waiting ? <Text style={styles.note}>We will add your score when you are back online.</Text> : null}
            <View style={styles.extras}>
              {summary.isBest ? <Text style={styles.extra}>New best score</Text> : null}
              <Text style={styles.extra}>
                Height {summary.meters} m · {summary.heightPts.toLocaleString()} pts
              </Text>
              <Text style={styles.extra}>Collected · {summary.collected.toLocaleString()} pts</Text>
              <Text style={styles.extra}>Best combo {summary.combo}</Text>
              <Text style={styles.extra}>Perfect landings {summary.perfect}</Text>
              {summary.near > 0 ? <Text style={styles.extra}>Close calls {summary.near}</Text> : null}
            </View>
            {summary.guest ? (
              <Pressable accessibilityRole="button" onPress={() => setSheetOpen(true)} style={styles.btn}>
                <Text style={styles.btnText}>Log in or create an account to save your score</Text>
              </Pressable>
            ) : null}
            <Pressable accessibilityRole="button" onPress={start} style={summary.guest ? styles.ghost : styles.btn}>
              <Text style={summary.guest ? styles.ghostText : styles.btnText}>Play again</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => openBoard('over')} style={styles.ghost}>
              <Text style={styles.ghostText}>Leaderboard</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={onMenu} style={styles.ghost}>
              <Text style={styles.ghostText}>Menu</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {overlay === 'board' ? (
        <View style={styles.overlay}>
          <View style={styles.card}>
            <Text style={styles.heading}>Top scores</Text>
            <View style={styles.list}>
              {board?.rows.map((row) => (
                <View key={`${row.rank}-${row.handle}`} style={[styles.lbRow, row.mine && styles.lbMe]}>
                  <Text style={styles.lbRank}>{row.rank}</Text>
                  <Text style={styles.lbName} numberOfLines={1}>
                    {row.handle}
                    {row.petName ? ` · ${row.petName}` : ''}
                  </Text>
                  <Text style={styles.lbScore}>{row.score.toLocaleString()}</Text>
                </View>
              ))}
              {board && board.rows.length === 0 ? <Text style={styles.note}>No scores yet.</Text> : null}
              {boardNote ? <Text style={styles.note}>{boardNote}</Text> : null}
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => setOverlay(boardFrom.current === 'over' ? 'over' : 'menu')}
              style={styles.ghost}
            >
              <Text style={styles.ghostText}>Back</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      {sheetOpen ? (
        <AccountSheet reason="score" petName={pet.name} onClose={() => setSheetOpen(false)} />
      ) : null}
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function DevToggle({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.chip}>
      <Text style={styles.chipText}>
        {label}: {on ? 'on' : 'off'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#2a2350' },
  hud: { position: 'absolute', top: 54, left: 12, right: 12, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  spacer: { flex: 1 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,250,253,0.88)',
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
    color: '#7a5f8f',
  },
  pillValue: { fontFamily: fontFamily.fredokaBold, fontSize: 18, color: '#4a2f5e' },
  score: { fontFamily: fontFamily.fredokaBold, fontSize: 20, color: '#4a2f5e', minWidth: 36 },
  pause: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,250,253,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseText: { fontFamily: fontFamily.extraBold, color: '#4a2f5e', letterSpacing: 1 },
  combo: {
    backgroundColor: 'rgba(255,250,253,0.88)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 4,
    minWidth: 120,
  },
  comboText: { fontFamily: fontFamily.fredokaBold, fontSize: 14, color: '#4a2f5e' },
  bar: { height: 4, borderRadius: 4, backgroundColor: '#f0dff5', marginTop: 2 },
  barFill: { height: 4, borderRadius: 4, backgroundColor: '#ff8fc4' },
  pillSm: {
    backgroundColor: 'rgba(255,250,253,0.88)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillSmText: { fontFamily: fontFamily.extraBold, fontSize: 13, color: '#4a2f5e' },
  banner: {
    position: 'absolute',
    top: '22%',
    alignSelf: 'center',
    backgroundColor: '#fffafd',
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: 'center',
    maxWidth: '82%',
  },
  bannerEye: {
    fontFamily: fontFamily.extraBold,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#e2569b',
  },
  bannerTitle: { fontFamily: fontFamily.fredokaBold, fontSize: 24, color: '#4a2f5e', textAlign: 'center' },
  bannerSub: { fontFamily: fontFamily.bold, fontSize: 13, color: '#7a5f8f', textAlign: 'center' },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(42,35,80,0.25)',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    backgroundColor: '#fffafd',
    borderRadius: 28,
    padding: 22,
    gap: 12,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 360,
  },
  title: { fontFamily: fontFamily.fredokaBold, fontSize: 44, color: '#e2569b', textAlign: 'center' },
  heading: { fontFamily: fontFamily.fredokaBold, fontSize: 32, color: '#4a2f5e', textAlign: 'center' },
  body: { fontFamily: fontFamily.semibold, fontSize: 15, lineHeight: 22, color: '#7a5f8f', textAlign: 'center' },
  how: { fontFamily: fontFamily.bold, fontSize: 13, lineHeight: 18, color: '#7a5f8f', backgroundColor: '#f6ecff', borderRadius: 16, padding: 10 },
  reason: { fontFamily: fontFamily.extraBold, color: '#e2569b', textAlign: 'center' },
  btn: { backgroundColor: '#ff7fbd', borderRadius: 999, paddingVertical: 12, paddingHorizontal: 16 },
  btnText: { fontFamily: fontFamily.fredokaBold, fontSize: 20, color: '#ffffff', textAlign: 'center' },
  ghost: { paddingVertical: 6 },
  ghostText: { fontFamily: fontFamily.fredokaBold, fontSize: 16, color: '#7a5f8f', textAlign: 'center' },
  chip: { backgroundColor: '#f3e6f7', borderRadius: 16, paddingVertical: 8 },
  chipText: { fontFamily: fontFamily.fredokaBold, fontSize: 16, color: '#4a2f5e', textAlign: 'center' },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, backgroundColor: '#f6ecff', borderRadius: 16, paddingVertical: 8, alignItems: 'center' },
  statValue: { fontFamily: fontFamily.fredokaBold, fontSize: 22, color: '#4a2f5e' },
  statLabel: { fontFamily: fontFamily.extraBold, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', color: '#7a5f8f' },
  rank: { fontFamily: fontFamily.extraBold, color: '#e2569b', textAlign: 'center' },
  note: { fontFamily: fontFamily.semibold, fontSize: 13, color: '#7a5f8f', textAlign: 'center' },
  extras: { backgroundColor: '#f6ecff', borderRadius: 16, padding: 10, gap: 4 },
  extra: { fontFamily: fontFamily.bold, fontSize: 13, color: '#4a2f5e' },
  list: { backgroundColor: '#f6ecff', borderRadius: 16, padding: 6, gap: 2 },
  lbRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 12 },
  lbMe: { backgroundColor: '#ffd6ea' },
  lbRank: { width: 28, fontFamily: fontFamily.extraBold, color: '#7a5f8f' },
  lbName: { flex: 1, fontFamily: fontFamily.extraBold, color: '#4a2f5e' },
  lbScore: { fontFamily: fontFamily.fredokaBold, fontSize: 17, color: '#4a2f5e' },
  dev: { gap: 6 },
  devLabel: { fontFamily: fontFamily.extraBold, fontSize: 11, color: '#7a5f8f' },
  input: {
    borderRadius: 12,
    backgroundColor: '#f6ecff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontFamily: fontFamily.bold,
    color: '#4a2f5e',
  },
});
