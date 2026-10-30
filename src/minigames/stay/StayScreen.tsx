import { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { startArcadeRound, stopArcadeRound } from '../../audio/arcadeMusic';
import { readAccountLinked, readHandleSaved } from '../../db/accountMeta';
import type { PetState } from '../../sim/types';
import { AccountSheet } from '../../ui/AccountSheet';
import { fontFamily } from '../../ui/font';
import { formatStayTime, heldCentiseconds, isExactStay, pickTargetSeconds } from './best';
import { StayFireworks } from './StayFireworks';
import { flushStayTime, loadBoard, recordRun } from './scores';
import { track } from '../../analytics/analytics';
import type { Board, BoardMe } from './scores';

type Phase = 'ready' | 'holding' | 'over';

type Summary = {
  targetCs: number;
  actualCs: number;
  guest: boolean;
  waiting: boolean;
  outside: BoardMe | null;
};

type Props = {
  pet: PetState;
  reducedMotion: boolean;
  onBack: () => void;
  onMenu: () => void;
};

export function StayScreen({ pet, reducedMotion, onMenu }: Props) {
  const [target, setTarget] = useState(() => pickTargetSeconds(Math.random()));
  const [elapsedCs, setElapsedCs] = useState(0);
  const [pressed, setPressed] = useState(false);
  const [phase, setPhase] = useState<Phase>('ready');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const holdingRef = useRef(false);
  const phaseRef = useRef<Phase>('ready');
  const targetRef = useRef(target);
  const startedAt = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    startArcadeRound();
    const sub = AppState.addEventListener('change', (status) => {
      if (status === 'active' || !holdingRef.current) {
        return;
      }
      holdingRef.current = false;
      cancelAnimationFrame(rafRef.current);
      const next = pickTargetSeconds(Math.random());
      targetRef.current = next;
      setTarget(next);
      setElapsedCs(0);
      setPressed(false);
      phaseRef.current = 'ready';
      setPhase('ready');
    });
    return () => {
      holdingRef.current = false;
      cancelAnimationFrame(rafRef.current);
      sub.remove();
      stopArcadeRound();
    };
  }, []);

  function setPhaseBoth(next: Phase) {
    phaseRef.current = next;
    setPhase(next);
  }

  function dealTarget() {
    const next = pickTargetSeconds(Math.random());
    targetRef.current = next;
    setTarget(next);
    setElapsedCs(0);
  }

  function loop() {
    if (!holdingRef.current) {
      return;
    }
    const elapsed = heldCentiseconds(startedAt.current);
    setElapsedCs(elapsed);
    rafRef.current = requestAnimationFrame(loop);
  }

  function beginHold() {
    if (phaseRef.current !== 'ready' || holdingRef.current) {
      return;
    }
    holdingRef.current = true;
    startedAt.current = Date.now();
    track('minigame_start', { game_id: 'stay' });
    setPressed(true);
    setElapsedCs(0);
    setPhaseBoth('holding');
    rafRef.current = requestAnimationFrame(loop);
  }

  function endHold() {
    if (!holdingRef.current) {
      return;
    }
    holdingRef.current = false;
    cancelAnimationFrame(rafRef.current);
    const actualCs = heldCentiseconds(startedAt.current);
    setPressed(false);
    setElapsedCs(actualCs);
    setPhaseBoth('over');
    const targetCs = targetRef.current * 100;
    setCelebrate(isExactStay(targetCs, actualCs));
    void settle(targetCs, actualCs);
  }

  async function settle(targetCs: number, actualCs: number) {
    const guest = !readAccountLinked();
    await recordRun({ targetCs, actualCs });
    let waiting = false;
    if (!guest && readHandleSaved()) {
      const flushed = await flushStayTime();
      if (flushed === 'sent') {
        track('post_score', { game_id: 'stay', score: actualCs });
      }
      waiting = flushed === 'kept';
    }
    const live = await loadBoard();
    if (live) {
      setBoard(live);
    }
    track('minigame_end', { game_id: 'stay', score: actualCs, duration_s: actualCs / 100 });
    const me = live?.me ?? null;
    setSummary({
      targetCs,
      actualCs,
      guest,
      waiting,
      outside: me && me.rank > 20 ? me : null,
    });
  }

  function playAgain() {
    setCelebrate(false);
    setSummary(null);
    setPhaseBoth('ready');
    dealTarget();
  }

  function leave() {
    holdingRef.current = false;
    cancelAnimationFrame(rafRef.current);
    stopArcadeRound();
    onMenu();
  }

  return (
    <View
      style={styles.root}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setBox({ width, height });
      }}
    >
      {box.width > 0 ? (
        <Svg width={box.width} height={box.height} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <LinearGradient id="staySky" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#bfe6ff" />
              <Stop offset="1" stopColor="#ffd3ea" />
            </LinearGradient>
          </Defs>
          <Rect width={box.width} height={box.height} fill="url(#staySky)" />
        </Svg>
      ) : null}
      <View style={styles.upper}>
        <Text style={styles.lead}>Hold for</Text>
        <Text style={styles.targetNum}>{target}</Text>
        <Text style={styles.lead}>seconds</Text>
        <Text style={styles.clock}>{formatStayTime(elapsedCs)}</Text>
        <Text style={styles.hint}>Let go at exactly {target}.00</Text>
      </View>
      <View style={styles.lower}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Hold the paw. Let go at exactly ${target}.00 seconds`}
          disabled={phase === 'over'}
          onPressIn={beginHold}
          onPressOut={endHold}
          style={styles.pawHit}
        >
          <View style={[styles.paw, pressed && !reducedMotion && styles.pawDown]}>
            <Paw />
          </View>
        </Pressable>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Menu" onPress={leave} style={styles.back}>
        <Text style={styles.backText}>Menu</Text>
      </Pressable>
      {phase === 'over' && summary ? (
        <View style={styles.overlay}>
          <View style={styles.card}>
            <ScrollView style={styles.cardScroll} contentContainerStyle={styles.cardContent} showsVerticalScrollIndicator>
              <Text style={styles.heading}>Stay</Text>
              <View style={styles.stats}>
                <Stat value={formatStayTime(summary.targetCs)} label="Target" />
                <Stat value={formatStayTime(summary.actualCs)} label="Actual" />
              </View>
              {summary.outside ? (
                <Text style={styles.rank}>
                  You are #{summary.outside.rank} · Target {formatStayTime(summary.outside.targetCs)} · Actual{' '}
                  {formatStayTime(summary.outside.actualCs)}
                </Text>
              ) : null}
              {summary.waiting ? <Text style={styles.note}>We will add your time when you are back online.</Text> : null}
              <TopScores board={board} />
              {summary.guest ? (
                <Pressable accessibilityRole="button" onPress={() => setSheetOpen(true)} style={styles.btn}>
                  <Text style={styles.btnText}>Log in or create an account to save your time</Text>
                </Pressable>
              ) : null}
              <Pressable accessibilityRole="button" onPress={playAgain} style={summary.guest ? styles.ghost : styles.btn}>
                <Text style={summary.guest ? styles.ghostText : styles.btnText}>Play again</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={onMenu} style={styles.ghost}>
                <Text style={styles.ghostText}>Menu</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      ) : null}
      {celebrate && box.width > 0 ? (
        <StayFireworks width={box.width} height={box.height} reducedMotion={reducedMotion} />
      ) : null}
      {sheetOpen ? (
        <AccountSheet
          reason="score"
          petName={pet.name}
          onClose={() => {
            setSheetOpen(false);
            if (!readAccountLinked() || !readHandleSaved()) {
              return;
            }
            void flushStayTime().then(async (flushed) => {
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
                      outside: live?.me && live.me.rank > 20 ? live.me : null,
                    }
                  : current,
              );
            });
          }}
        />
      ) : null}
    </View>
  );
}

function Paw() {
  return (
    <Svg width={148} height={148} viewBox="0 0 160 160">
      <Defs>
        <RadialGradient id="stayPaw" cx="0.38" cy="0.3" r="0.85">
          <Stop offset="0" stopColor="#ffc4de" />
          <Stop offset="0.55" stopColor="#ff79b4" />
          <Stop offset="1" stopColor="#ef5098" />
        </RadialGradient>
      </Defs>
      <G fill="url(#stayPaw)">
        <Path d="M80 70c22 0 46 22 46 46 0 18-14 26-26 26-8 0-13-4-20-4s-12 4-20 4c-12 0-26-8-26-26 0-24 24-46 46-46z" />
        <Ellipse cx={34} cy={66} rx={15} ry={19} transform="rotate(-22 34 66)" />
        <Ellipse cx={62} cy={38} rx={15} ry={20} transform="rotate(-8 62 38)" />
        <Ellipse cx={98} cy={38} rx={15} ry={20} transform="rotate(8 98 38)" />
        <Ellipse cx={126} cy={66} rx={15} ry={19} transform="rotate(22 126 66)" />
      </G>
    </Svg>
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

function TopScores({ board }: { board: Board | null }) {
  if (!board || board.rows.length === 0) {
    return null;
  }
  return (
    <View style={styles.list}>
      <Text style={styles.scoresTitle}>Top Scores</Text>
      <View style={styles.lbRow}>
        <Text style={styles.lbRank} />
        <Text style={styles.lbName} />
        <Text style={styles.lbHead}>Target</Text>
        <Text style={styles.lbHead}>Actual</Text>
      </View>
      {board.rows.map((row) => (
        <View key={`${row.rank}-${row.handle}`} style={[styles.lbRow, row.mine && styles.lbMe]}>
          <Text style={styles.lbRank}>{row.rank}</Text>
          <Text style={styles.lbName} numberOfLines={1}>
            {row.handle}
          </Text>
          <Text style={styles.lbTime}>{formatStayTime(row.targetCs)}</Text>
          <Text style={styles.lbTime}>{formatStayTime(row.actualCs)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#ffd3ea' },
  upper: { flex: 2, alignItems: 'center', justifyContent: 'center', paddingTop: 48 },
  lower: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', marginTop: -96 },
  lead: { fontFamily: fontFamily.extraBold, fontSize: 22, color: '#7a5f8c' },
  targetNum: { fontFamily: fontFamily.fredokaBold, fontSize: 88, lineHeight: 96, color: '#4a2a5e' },
  clock: {
    marginTop: 8,
    fontFamily: fontFamily.fredokaBold,
    fontSize: 56,
    lineHeight: 64,
    color: '#4a2a5e',
    fontVariant: ['tabular-nums'],
  },
  hint: { marginTop: 4, fontFamily: fontFamily.extraBold, fontSize: 16, color: '#7a5f8c' },
  pawHit: { width: 168, height: 168, alignItems: 'center', justifyContent: 'center' },
  paw: {},
  pawDown: { transform: [{ translateY: 7 }, { scale: 0.96 }] },
  back: {
    position: 'absolute',
    top: 64,
    left: 16,
    minWidth: 48,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(255,250,253,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: { fontFamily: fontFamily.fredokaBold, fontSize: 16, color: '#7a5f8c' },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(74,42,94,0.25)',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    backgroundColor: '#fffafd',
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
  heading: { fontFamily: fontFamily.fredokaBold, fontSize: 32, color: '#e94b93', textAlign: 'center' },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, backgroundColor: '#f8f1fb', borderRadius: 16, paddingVertical: 8, alignItems: 'center' },
  statValue: { fontFamily: fontFamily.fredokaBold, fontSize: 22, color: '#4a2a5e' },
  statLabel: {
    fontFamily: fontFamily.extraBold,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: '#7a5f8c',
  },
  rank: { fontFamily: fontFamily.extraBold, color: '#e94b93', textAlign: 'center' },
  note: { fontFamily: fontFamily.semibold, fontSize: 13, color: '#7a5f8c', textAlign: 'center' },
  btn: { backgroundColor: '#ff7fbd', borderRadius: 999, paddingVertical: 12, paddingHorizontal: 16 },
  btnText: { fontFamily: fontFamily.fredokaBold, fontSize: 20, color: '#ffffff', textAlign: 'center' },
  ghost: { paddingVertical: 6 },
  ghostText: { fontFamily: fontFamily.fredokaBold, fontSize: 16, color: '#7a5f8c', textAlign: 'center' },
  scoresTitle: { fontFamily: fontFamily.fredokaBold, fontSize: 18, color: '#4a2a5e', textAlign: 'center', paddingTop: 4 },
  list: { backgroundColor: '#f8f1fb', borderRadius: 16, padding: 6, gap: 2 },
  lbRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 12 },
  lbMe: { backgroundColor: '#ffd6ea' },
  lbRank: { width: 24, fontFamily: fontFamily.extraBold, color: '#7a5f8c' },
  lbName: { flex: 1, fontFamily: fontFamily.extraBold, color: '#4a2a5e' },
  lbHead: { width: 64, fontFamily: fontFamily.extraBold, fontSize: 11, letterSpacing: 0.4, textTransform: 'uppercase', color: '#7a5f8c', textAlign: 'right' },
  lbTime: { width: 64, fontFamily: fontFamily.fredokaBold, fontSize: 14, color: '#4a2a5e', textAlign: 'right' },
});
