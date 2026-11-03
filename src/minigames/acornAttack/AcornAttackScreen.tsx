import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Canvas, Picture, Skia, useFont } from '@shopify/react-native-skia';
import { LinearGradient } from 'expo-linear-gradient';
import { useSharedValue } from 'react-native-reanimated';
import Svg, { Path, Rect } from 'react-native-svg';

import { breedById, spawnActor, type Breed } from '../../actor';
import type { Actor } from '../../actor/types';
import { playAcornSfx, preloadAcornSfx, releaseAcornSfx } from '../../audio/acornSfx';
import { pauseArcadeRound, resumeArcadeRound, startArcadeRound, stopArcadeRound } from '../../audio/arcadeMusic';
import { playBadgeChime } from '../../audio/badge';
import { playBloop } from '../../audio/bloop';
import { playVoice, setSoundEnabled, soundEnabled } from '../../audio/voice';
import { track } from '../../analytics/analytics';
import { onAccountFlags, readAccountLinked, readHandleSaved } from '../../db/accountMeta';
import { appVersion } from '../../economy/remoteDefs';
import type { PetState } from '../../sim/types';
import { AccountSheet } from '../../ui/AccountSheet';
import { fontFamily } from '../../ui/font';
import { loadSoundEnabled, saveSoundEnabled } from '../../storage/session';
import { columnWidth, HOW_TO, SQUIRREL_CARD, STORY, WORLD_W } from './content';
import {
  beginRun,
  clampPet,
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
import { drivePet, newPetDrive } from './petDrive';
import { drawAcornAttack, drawSquirrelArt } from './render';
import { flushAcornAttackScore, loadBoard, recordRun } from './scores';
import type { Board } from './scores';
import type { Run, Squirrel } from './types';

const C = {
  ink: '#3d2a4f',
  inkSoft: '#6f5a80',
  card: '#fffaf4',
  line: '#efe1d2',
  chip: '#f6eefb',
  pink: '#ff6fae',
  pinkDeep: '#e94b93',
};

type Overlay = 'menu' | 'play' | 'paused' | 'over';

type Summary = {
  title: string;
  score: number;
  best: number;
  level: number;
  squirrels: number;
  treats: number;
  meters: number;
  guest: boolean;
  waiting: boolean;
};

type Hud = {
  score: number;
  meters: number;
  hearts: number;
  laser: number;
  level: number;
  shield: boolean;
  magnet: number;
  scoreHot: boolean;
  levelHot: boolean;
};

type Props = {
  pet: PetState;
  reducedMotion: boolean;
  onBack: () => void;
  onMenu: () => void;
};

function blankPicture(): ReturnType<typeof Skia.PictureRecorder.prototype.finishRecordingAsPicture> {
  const recorder = Skia.PictureRecorder();
  recorder.beginRecording(Skia.XYWHRect(0, 0, 1, 1));
  return recorder.finishRecordingAsPicture();
}

function resultTitle(score: number, level: number, isBest: boolean): string {
  if (isBest && score > 0) {
    return 'New best!';
  }
  if (level >= 6) {
    return 'Great run!';
  }
  return 'Good run!';
}

export function AcornAttackScreen({ pet, reducedMotion, onMenu }: Props) {
  const font = useFont(require('@expo-google-fonts/fredoka/700Bold/Fredoka_700Bold.ttf'), 16);
  const picture = useSharedValue(blankPicture());
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [overlay, setOverlay] = useState<Overlay>('menu');
  const [hud, setHud] = useState<Hud>({
    score: 0,
    meters: 0,
    hearts: 3,
    laser: 1,
    level: 1,
    shield: false,
    magnet: 0,
    scoreHot: false,
    levelHot: false,
  });
  const [summary, setSummary] = useState<Summary | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const runRef = useRef<Run | null>(null);
  if (runRef.current == null) {
    runRef.current = createRun({ logicalH: 800, species: 'dog' });
  }
  const driveRef = useRef(newPetDrive());
  const actorRef = useRef<Actor | null>(null);
  const breedRef = useRef<Breed | null>(null);
  const petRef = useRef(pet);
  const reducedRef = useRef(reducedMotion);
  const boxRef = useRef(box);
  const frameRef = useRef(picture);
  const sigRef = useRef('');
  const settledRef = useRef(false);
  const seenLayout = useRef(false);
  const colRef = useRef(0);
  const activeRef = useRef(true);
  const finishRef = useRef<(run: Run) => void>(() => {});

  const column = box.width > 0 ? columnWidth(box.width, box.height) : 0;
  const columnLeft = box.width > 0 ? (box.width - column) / 2 : 0;
  const sideHud = columnLeft >= 160;

  useEffect(() => {
    petRef.current = pet;
  }, [pet]);

  useEffect(() => {
    reducedRef.current = reducedMotion;
  }, [reducedMotion]);

  useEffect(() => {
    preloadAcornSfx();
    return () => releaseAcornSfx();
  }, []);

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
        equipped: {},
        look: pet.look,
        seed: pet.attributes.seed,
        asleep: false,
        energy: 1,
        mood: 1,
        hydration: 1,
      },
      { x: 0, y: 0 },
    );
    driveRef.current = newPetDrive();
  }, [pet]);

  useEffect(() => {
    const run = runRef.current;
    if (!run || box.width < 2 || box.height < 2) {
      return;
    }
    const nextColumn = columnWidth(box.width, box.height);
    const nextH = box.height / (nextColumn / WORLD_W);
    const prevH = run.H;
    const prevColumn = colRef.current;
    run.H = nextH;
    clampPet(run);
    if (seenLayout.current && run.phase === 'play' && (Math.abs(prevH - nextH) > 2 || Math.abs(prevColumn - nextColumn) > 2)) {
      pauseRun(run);
      pauseArcadeRound();
      setOverlay('paused');
    }
    seenLayout.current = true;
    colRef.current = nextColumn;
  }, [box]);

  useEffect(() => {
    void loadSoundEnabled().then((on) => {
      setSoundEnabled(on);
      setSoundOn(on);
    });
    void loadBoard().then((next) => {
      if (next) {
        setBoard(next);
      }
    });
  }, []);

  useEffect(() => {
    return onAccountFlags(() => {
      if (!readAccountLinked() || !readHandleSaved()) {
        return;
      }
      void (async () => {
        const flushed = await flushAcornAttackScore();
        const live = await loadBoard();
        if (live) {
          setBoard(live);
        }
        setSummary((current) => (current ? { ...current, guest: false, waiting: flushed === 'kept' } : current));
      })();
    });
  }, []);

  const redraw = useCallback(() => {
    const run = runRef.current;
    const { width, height } = boxRef.current;
    if (!run || width < 2 || height < 2) {
      return;
    }
    const recorder = Skia.PictureRecorder();
    const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, width, height));
    drawAcornAttack(canvas, run, actorRef.current, breedRef.current, driveRef.current, font, width, height, reducedRef.current);
    frameRef.current.value = recorder.finishRecordingAsPicture();
  }, [font]);

  useEffect(() => {
    finishRef.current = (run: Run) => {
      if (settledRef.current) {
        return;
      }
      settledRef.current = true;
      if (run.phase !== 'over') {
        endRun(run);
      }
      stopArcadeRound();
      setOverlay('over');
      void settle(run);
    };

    async function settle(run: Run): Promise<void> {
      const score = Math.round(run.score);
      const meters = metersOf(run);
      const guest = !readAccountLinked();
      const saved = await recordRun({
        runId: run.runId,
        score,
        level: run.level,
        distanceM: meters,
        squirrels: run.booped,
        treats: run.treats,
        durationMs: Math.round(run.time * 1000),
        clientVersion: appVersion(),
      });
      let waiting = false;
      if (!guest && readHandleSaved()) {
        const flushed = await flushAcornAttackScore();
        if (flushed === 'sent') {
          track('post_score', { game_id: 'acornAttack', score });
        }
        waiting = flushed === 'kept';
        const live = await loadBoard();
        if (live) {
          setBoard(live);
        }
      }
      track('minigame_end', { game_id: 'acornAttack', score, duration_s: Math.round(run.time) });
      setSummary({
        title: resultTitle(score, run.level, saved.isBest),
        score,
        best: saved.best,
        level: run.level,
        squirrels: run.booped,
        treats: run.treats,
        meters,
        guest,
        waiting,
      });
    }
  }, []);

  const playSounds = useCallback((run: Run) => {
    const current = petRef.current;
    const breed = breedRef.current;
    for (const name of takeSounds(run)) {
      if (!soundEnabled()) {
        continue;
      }
      if (name === 'laser' || name === 'impact' || name === 'explode' || name === 'powerUp') {
        playAcornSfx(name);
      } else if (name === 'hurt') {
        playVoice({ actorId: current.id, sound: breed?.species === 'cat' ? 'meow' : 'growl', rate: 0.9 });
      } else if (name === 'badge') {
        playBadgeChime();
      } else {
        playBloop(0);
      }
    }
  }, []);

  useEffect(() => {
    let raf = 0;
    let last = Date.now();
    let running = true;
    const loop = () => {
      if (!running) {
        return;
      }
      const now = Date.now();
      const dt = (now - last) / 1000;
      last = now;
      const run = runRef.current;
      if (run && activeRef.current && run.phase !== 'over') {
        const phase = step(run, dt, reducedRef.current);
        playSounds(run);
        const sig = hudSignature(run);
        if (sig !== sigRef.current) {
          sigRef.current = sig;
          setHud({
            score: Math.round(run.score),
            meters: metersOf(run),
            hearts: run.hearts,
            laser: run.laserLevel,
            level: run.level,
            shield: run.shield,
            magnet: run.magnet,
            scoreHot: run.scorePop > 0,
            levelHot: run.levelPop > 0,
          });
        }
        if (phase === 'over') {
          finishRef.current(run);
        }
      }
      const actor = actorRef.current;
      const breed = breedRef.current;
      if (run && actor && breed) {
        const moving = run.phase === 'menu' || run.phase === 'play' || run.phase === 'dying';
        drivePet(driveRef.current, actor, breed, run, moving && activeRef.current ? Math.min(dt, 0.05) : 0);
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
      const run = runRef.current;
      if (!active && run && (run.phase === 'play' || run.phase === 'dying')) {
        pauseRun(run);
        pauseArcadeRound();
        setOverlay('paused');
      }
      if (returned) {
        last = Date.now();
        raf = requestAnimationFrame(loop);
        void flushAcornAttackScore();
      }
    });
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      sub.remove();
    };
  }, [playSounds, redraw]);

  useEffect(() => {
    return () => stopArcadeRound();
  }, []);

  const start = () => {
    const current = runRef.current;
    const run = createRun({
      logicalH: current?.H || 800,
      species: breedRef.current?.species === 'cat' ? 'cat' : 'dog',
    });
    beginRun(run);
    runRef.current = run;
    settledRef.current = false;
    sigRef.current = '';
    track('minigame_start', { game_id: 'acornAttack' });
    startArcadeRound();
    setSummary(null);
    setOverlay('play');
    setHud({
      score: 0,
      meters: 0,
      hearts: 3,
      laser: 1,
      level: 1,
      shield: false,
      magnet: 0,
      scoreHot: false,
      levelHot: false,
    });
  };

  const pause = () => {
    if (runRef.current) {
      pauseRun(runRef.current);
    }
    pauseArcadeRound();
    setOverlay('paused');
  };

  const toLogical = (x: number, y: number) => {
    const width = boxRef.current.width;
    const height = boxRef.current.height;
    const nextColumn = width > 0 ? columnWidth(width, height) : WORLD_W;
    const nextScale = nextColumn / WORLD_W;
    const left = width > 0 ? (width - nextColumn) / 2 : 0;
    return { x: (x - left) / nextScale, y: y / nextScale };
  };

  const playing = overlay === 'play';
  const rows = board?.rows.slice(0, 4) ?? [];

  return (
    <View
      style={styles.root}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        const next = { width, height };
        boxRef.current = next;
        setBox(next);
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
            if (!run) {
              return;
            }
            const point = toLogical(event.nativeEvent.locationX, event.nativeEvent.locationY);
            pointerDown(run, point.x, point.y);
          }}
          onResponderMove={(event) => {
            const run = runRef.current;
            if (!run) {
              return;
            }
            const point = toLogical(event.nativeEvent.locationX, event.nativeEvent.locationY);
            pointerMove(run, point.x, point.y);
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
        sideHud ? (
          <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
            <View pointerEvents="box-none" style={[styles.side, styles.sideLeft, { width: columnLeft - 24 }]}>
              <PauseButton onPress={pause} />
              <Hearts n={hud.hearts} />
              <View style={styles.subRow}>
                <LevelPill level={hud.level} hot={hud.levelHot} />
                <DistancePill meters={hud.meters} />
              </View>
            </View>
            <View pointerEvents="box-none" style={[styles.side, styles.sideRight, { width: columnLeft - 24 }]}>
              <ScorePill score={hud.score} hot={hud.scoreHot} />
              <LaserPill level={hud.laser} />
              <Chips hud={hud} />
            </View>
          </View>
        ) : (
          <View pointerEvents="box-none" style={[styles.hud, { left: columnLeft + 12, width: Math.max(0, column - 24) }]}>
            <View pointerEvents="box-none" style={styles.hudRow}>
              <PauseButton onPress={pause} />
              <Hearts n={hud.hearts} />
              <View style={styles.spacer} />
              <LaserPill level={hud.laser} />
              <ScorePill score={hud.score} hot={hud.scoreHot} />
            </View>
            <View pointerEvents="none" style={styles.hudRow}>
              <View style={styles.subRow}>
                <LevelPill level={hud.level} hot={hud.levelHot} />
                <DistancePill meters={hud.meters} />
              </View>
              <View style={styles.spacer} />
              <Chips hud={hud} />
            </View>
          </View>
        )
      ) : null}

      {overlay === 'menu' ? (
        <Veil>
          <Text style={styles.h1}>Acorn Attack</Text>
          <Text style={styles.p}>{STORY}</Text>
          <View style={styles.gang}>
            {SQUIRREL_CARD.map((item) => (
              <View key={item.kind} style={styles.gangItem}>
                <GangPortrait kind={item.kind} />
                <Text style={styles.gangName}>{item.name}</Text>
                <Text style={styles.gangRole}>
                  {item.role} · Lv {item.level}
                </Text>
              </View>
            ))}
          </View>
          <View style={styles.how}>
            {HOW_TO.map((line, index) => (
              <View key={line} style={styles.howRow}>
                <Text style={styles.howNum}>{index + 1}</Text>
                <Text style={styles.howText}>{line}</Text>
              </View>
            ))}
          </View>
          <CandyButton label="Play" onPress={start} />
          <BoardList rows={rows} />
          <GhostButton label="Menu" onPress={onMenu} />
        </Veil>
      ) : null}

      {overlay === 'paused' ? (
        <Veil>
          <Text style={styles.h2}>Paused</Text>
          <View style={styles.seg}>
            {[true, false].map((on) => (
              <Pressable
                key={on ? 'on' : 'off'}
                accessibilityRole="button"
                accessibilityState={{ selected: soundOn === on }}
                onPress={() => {
                  setSoundEnabled(on);
                  void saveSoundEnabled(on);
                  setSoundOn(on);
                }}
                style={[styles.segButton, soundOn === on && styles.segOn]}
              >
                <Text style={[styles.segText, soundOn === on && styles.segTextOn]}>{on ? 'Sound on' : 'Sound off'}</Text>
              </Pressable>
            ))}
          </View>
          <CandyButton
            label="Resume"
            onPress={() => {
              if (runRef.current) {
                resumeRun(runRef.current);
              }
              resumeArcadeRound();
              setOverlay('play');
            }}
          />
          <GhostButton
            label="End run"
            onPress={() => {
              const run = runRef.current;
              if (run) {
                finishRef.current(run);
              }
            }}
          />
        </Veil>
      ) : null}

      {overlay === 'over' && summary ? (
        <Veil>
          <Text style={styles.h2}>{summary.title}</Text>
          <Text style={styles.big}>{summary.score.toLocaleString()}</Text>
          <Text style={styles.p}>Your best: {summary.best.toLocaleString()}</Text>
          <View style={styles.stats}>
            <Stat label="Level reached" value={String(summary.level)} />
            <Stat label="Squirrels booped" value={String(summary.squirrels)} />
            <Stat label="Treats" value={String(summary.treats)} />
            <Stat label="Distance" value={`${summary.meters.toLocaleString()} m`} />
          </View>
          {summary.waiting ? <Text style={styles.note}>We will add your score when you are back online.</Text> : null}
          {summary.guest ? <CandyButton label="Log in to save your score" small onPress={() => setSheetOpen(true)} /> : null}
          {summary.guest ? <GhostButton label="Play again" onPress={start} /> : <CandyButton label="Play again" onPress={start} />}
          <GhostButton label="Menu" onPress={onMenu} />
          <View style={styles.promoGap} />
        </Veil>
      ) : null}
      {sheetOpen ? <AccountSheet reason="score" petName={pet.name} onClose={() => setSheetOpen(false)} /> : null}
    </View>
  );
}

function Veil({ children }: { children: ReactNode }) {
  return (
    <View style={styles.veil}>
      <View style={styles.card}>
        <ScrollView style={styles.cardScroll} contentContainerStyle={styles.cardContent} showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      </View>
    </View>
  );
}

function CandyButton({ label, onPress, small = false }: { label: string; onPress: () => void; small?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.btnWrap, pressed && styles.btnPressed]}>
      <LinearGradient colors={['#ff9cc8', C.pink, C.pinkDeep]} locations={[0, 0.55, 1]} style={styles.btn}>
        <View pointerEvents="none" style={styles.btnShine} />
        <Text style={[styles.btnText, small && styles.btnTextSmall]}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

function GhostButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.ghost, pressed && styles.btnPressed]}>
      <Text style={styles.ghostText}>{label}</Text>
    </Pressable>
  );
}

const portraitSize = 58;

function GangPortrait({ kind }: { kind: Squirrel['kind'] }) {
  const art = useMemo(() => {
    const recorder = Skia.PictureRecorder();
    const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, portraitSize, portraitSize));
    const paint = Skia.Paint();
    paint.setAntiAlias(true);
    paint.setColor(Skia.Color('#e3f4dc'));
    canvas.drawCircle(29, 29, 28, paint);
    drawSquirrelArt(canvas, kind, 29, 34, kind === 'hoarder' ? 16.5 : 16, 0, 0, 0);
    return recorder.finishRecordingAsPicture();
  }, [kind]);
  return (
    <Canvas style={styles.portrait}>
      <Picture picture={art} />
    </Canvas>
  );
}

function PauseButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Pause" onPress={onPress} style={styles.round}>
      <Svg width={14} height={16} viewBox="0 0 14 16">
        <Rect x={1} y={1} width={4} height={14} rx={2} fill={C.ink} />
        <Rect x={9} y={1} width={4} height={14} rx={2} fill={C.ink} />
      </Svg>
    </Pressable>
  );
}

const heartPath =
  'M12 20.5C4 14.6 1.5 10.9 1.5 7.2 1.5 4 4 1.5 7 1.5c2 0 3.8 1.1 5 2.9 1.2-1.8 3-2.9 5-2.9 3 0 5.5 2.5 5.5 5.7 0 3.7-2.5 7.4-10.5 13.3z';

function Hearts({ n }: { n: number }) {
  return (
    <View style={styles.hearts} accessibilityLabel={`${n} hearts left`}>
      {[0, 1, 2].map((index) => {
        const on = index < n;
        return (
          <Svg key={index} width={24} height={22} viewBox="0 0 24 22">
            <Path d={heartPath} translateY={1.5} fill="#3d2a4f" fillOpacity={0.18} />
            <Path
              d={heartPath}
              fill={on ? '#ff4f8f' : '#ffffff'}
              fillOpacity={on ? 1 : 0.55}
              stroke={on ? '#d23c82' : '#c9b7d1'}
              strokeWidth={1.6}
            />
          </Svg>
        );
      })}
    </View>
  );
}

function LaserPill({ level }: { level: number }) {
  return (
    <View style={styles.pill} accessibilityLabel={`Laser level ${level}`}>
      <Text style={styles.pillText}>Laser</Text>
      <View style={styles.pips}>
        {[1, 2, 3, 4].map((index) => (
          <View key={index} style={[styles.pip, index <= level && styles.pipOn]} />
        ))}
      </View>
    </View>
  );
}

function ScorePill({ score, hot }: { score: number; hot: boolean }) {
  return (
    <View style={[styles.pill, hot && styles.pop]}>
      <Text style={styles.pillText}>{score.toLocaleString()}</Text>
    </View>
  );
}

function LevelPill({ level, hot }: { level: number; hot: boolean }) {
  return (
    <View style={[styles.pill, styles.pillSm, hot && styles.pop]}>
      <Text style={styles.pillSmText}>
        Level <Text style={styles.pillSmBold}>{level}</Text>
      </Text>
    </View>
  );
}

function DistancePill({ meters }: { meters: number }) {
  return (
    <View style={[styles.pill, styles.pillSm]}>
      <Text style={styles.pillSmText}>{meters.toLocaleString()}m</Text>
    </View>
  );
}

function Chips({ hud }: { hud: Hud }) {
  return (
    <View style={styles.chips}>
      {hud.shield ? <Text style={styles.chip}>Shield on</Text> : null}
      {hud.magnet > 0 ? <Text style={styles.chip}>Magnet</Text> : null}
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function BoardList({ rows }: { rows: Board['rows'] }) {
  if (rows.length === 0) {
    return null;
  }
  return (
    <View style={styles.board}>
      <Text style={styles.boardTitle}>Friends</Text>
      {rows.map((row) => (
        <View key={`${row.rank}-${row.handle}`} style={styles.boardRow}>
          <Text style={[styles.boardRank, row.mine && styles.boardMe]}>{row.rank}</Text>
          <Text style={[styles.boardName, row.mine && styles.boardMe]} numberOfLines={1}>
            {row.handle || 'Friend'}
          </Text>
          <Text style={[styles.boardScore, row.mine && styles.boardMe]}>{row.score.toLocaleString()}</Text>
        </View>
      ))}
    </View>
  );
}

const lift = { shadowColor: C.ink, shadowOpacity: 0.18, shadowRadius: 0, shadowOffset: { width: 0, height: 3 }, elevation: 2 };

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#7cc96b' },
  hud: { position: 'absolute', top: 54, gap: 8 },
  hudRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subRow: { flexDirection: 'row', gap: 6 },
  spacer: { flex: 1 },
  side: { position: 'absolute', top: 54, gap: 10 },
  sideLeft: { left: 16, alignItems: 'flex-start' },
  sideRight: { right: 16, alignItems: 'flex-end' },
  round: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    ...lift,
  },
  hearts: { flexDirection: 'row', gap: 3 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 12,
    ...lift,
    shadowOpacity: 0.16,
  },
  pop: { transform: [{ scale: 1.18 }] },
  pillText: { fontFamily: fontFamily.fredokaBold, fontSize: 16, color: C.ink, fontVariant: ['tabular-nums'] },
  pillSm: { paddingVertical: 2, paddingHorizontal: 10, gap: 3 },
  pillSmText: { fontFamily: fontFamily.fredokaSemibold, fontSize: 13, color: C.ink, fontVariant: ['tabular-nums'] },
  pillSmBold: { fontFamily: fontFamily.fredokaBold },
  pips: { flexDirection: 'row', gap: 3 },
  pip: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#f1d6df' },
  pipOn: { backgroundColor: '#ff2d55', borderWidth: 2, borderColor: '#ffd3dd', width: 12, height: 12, borderRadius: 6, margin: -2 },
  chips: { gap: 4, alignItems: 'flex-end' },
  chip: {
    fontFamily: fontFamily.extraBold,
    fontSize: 12,
    color: C.ink,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 999,
    overflow: 'hidden',
    paddingVertical: 2,
    paddingHorizontal: 10,
  },
  veil: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(40,70,35,0.28)',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  card: {
    backgroundColor: C.card,
    borderRadius: 28,
    borderBottomWidth: 6,
    borderBottomColor: C.line,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 370,
    maxHeight: '100%',
    overflow: 'hidden',
    shadowColor: '#281e32',
    shadowOpacity: 0.22,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 18 },
    elevation: 8,
  },
  cardScroll: { flexGrow: 0, flexShrink: 1 },
  cardContent: { gap: 12, paddingVertical: 20, paddingHorizontal: 18 },
  h1: { fontFamily: fontFamily.fredokaBold, fontSize: 42, lineHeight: 46, color: C.pinkDeep, textAlign: 'center' },
  h2: { fontFamily: fontFamily.fredokaBold, fontSize: 30, lineHeight: 34, color: C.ink, textAlign: 'center' },
  p: { fontFamily: fontFamily.bold, fontSize: 14, lineHeight: 20, color: C.inkSoft, textAlign: 'center' },
  gang: { flexDirection: 'row', gap: 4 },
  gangItem: { flex: 1, alignItems: 'center', gap: 2 },
  portrait: { width: portraitSize, height: portraitSize },
  gangName: { fontFamily: fontFamily.extraBold, fontSize: 11, lineHeight: 13, color: C.ink, textAlign: 'center' },
  gangRole: { fontFamily: fontFamily.bold, fontSize: 11, lineHeight: 13, color: C.inkSoft, textAlign: 'center' },
  how: { backgroundColor: C.chip, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12, gap: 5 },
  howRow: { flexDirection: 'row', gap: 6 },
  howNum: { width: 18, fontFamily: fontFamily.fredokaBold, fontSize: 15, lineHeight: 18, color: C.pinkDeep },
  howText: { flex: 1, fontFamily: fontFamily.bold, fontSize: 13.5, lineHeight: 18, color: C.ink },
  btnWrap: {
    borderRadius: 999,
    backgroundColor: '#c73a7c',
    paddingBottom: 5,
    shadowColor: C.pinkDeep,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  btnPressed: { transform: [{ translateY: 3 }] },
  btn: { borderRadius: 999, paddingVertical: 11, paddingHorizontal: 20, overflow: 'hidden', borderTopWidth: 3, borderTopColor: 'rgba(255,255,255,0.55)' },
  btnShine: { position: 'absolute', left: '12%', right: '12%', top: 2, height: '38%', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.35)' },
  btnText: { fontFamily: fontFamily.fredokaBold, fontSize: 22, color: '#ffffff', textAlign: 'center' },
  btnTextSmall: { fontSize: 18 },
  ghost: {
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderBottomWidth: 4,
    borderBottomColor: C.line,
    paddingVertical: 11,
    paddingHorizontal: 20,
  },
  ghostText: { fontFamily: fontFamily.fredokaBold, fontSize: 22, color: C.ink, textAlign: 'center' },
  seg: { flexDirection: 'row', backgroundColor: C.chip, borderRadius: 999, padding: 3, gap: 3 },
  segButton: { flex: 1, borderRadius: 999, paddingVertical: 6 },
  segOn: { backgroundColor: '#ffffff', borderBottomWidth: 2, borderBottomColor: C.line },
  segText: { fontFamily: fontFamily.extraBold, fontSize: 13, color: C.inkSoft, textAlign: 'center' },
  segTextOn: { color: C.ink },
  big: { fontFamily: fontFamily.fredokaBold, fontSize: 58, lineHeight: 62, color: C.pinkDeep, textAlign: 'center', fontVariant: ['tabular-nums'] },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: { flexBasis: '47%', flexGrow: 1, backgroundColor: C.chip, borderRadius: 14, paddingVertical: 7, paddingHorizontal: 10, alignItems: 'center' },
  statLabel: { fontFamily: fontFamily.extraBold, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', color: C.inkSoft, textAlign: 'center' },
  statValue: { fontFamily: fontFamily.extraBold, fontSize: 18, color: C.ink, fontVariant: ['tabular-nums'] },
  note: { fontFamily: fontFamily.semibold, fontSize: 13, color: C.inkSoft, textAlign: 'center' },
  board: { borderTopWidth: 2, borderTopColor: C.line, paddingTop: 10 },
  boardTitle: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 15,
    letterSpacing: 0.75,
    textTransform: 'uppercase',
    color: C.inkSoft,
    marginBottom: 4,
  },
  boardRow: { flexDirection: 'row', gap: 8, paddingVertical: 3 },
  boardRank: { width: 22, fontFamily: fontFamily.extraBold, color: C.inkSoft },
  boardName: { flex: 1, fontFamily: fontFamily.extraBold, color: C.ink },
  boardScore: { fontFamily: fontFamily.extraBold, color: C.ink, fontVariant: ['tabular-nums'] },
  boardMe: { color: C.pinkDeep },
  promoGap: { height: 44 },
});
