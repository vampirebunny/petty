import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Canvas, Picture, Skia, useFont } from '@shopify/react-native-skia';
import type { SkPicture } from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import { PawPrint } from 'lucide-react-native';
import { useSharedValue } from 'react-native-reanimated';

import { todAt } from '../../actor';
import type { Actor, Breed } from '../../actor';
import { applyRaceLeap, clearPose, stepRaceRun } from '../../actor/raceDrive';
import { skyAt, solarHour } from '../../actor/sky';
import { playClearChime, playClipThud, playJumpBoing, preloadRaceSfx, releaseRaceSfx } from '../../audio/raceSfx';
import { serverNow } from '../../db/accountMeta';
import { classLabel, eventLabel } from '../../sim/stadium';
import type { PetState } from '../../sim/types';
import { fetchRace, submitRaceReport, type DistanceScore, type RaceView } from '../../stadium/api';
import { useDiveFlags } from '../../stadium/diveSync';
import {
  advanceDive,
  airSeconds,
  attemptGoMs,
  compareDives,
  createDive,
  diveClass,
  diveScore,
  diveTotalMs,
  dockDiveConfigFor,
  meterAt,
  npcDives,
  runUp,
  type DiveInput,
  type DiveResult,
  type DiveScore,
  type DiveState,
  type Modifiers,
} from '../../../supabase/functions/_shared/race-sim/index.ts';
import type { Env } from '../skia/env';
import { diveFit, drawDockDive, type DiveFlag, type DiveLabel, type DiveSplash } from '../skia/dockDive';
import { fontFamily } from '../font';
import { CandyButton } from './CandyButton';
import { countBeat, countLabels } from './raceCountdown';
import { actorOf, breedOf, classOf, modsOf, placeSuffix } from './raceField';
import { useRaceCountdown } from './useRaceCountdown';
import { ink, shared } from './parts';

type Props = {
  race: RaceView;
  pet: PetState;
  reducedMotion: boolean;
  onFinish: (place: number) => void;
  onExit: () => void;
};

type Standing = { key: string; name: string; mine: boolean; npc: boolean; place: number | null; bestM: number | null; bestAttempt: number | null };

type Mode = 'idle' | 'run' | 'air' | 'bob' | 'swim' | 'hop' | 'shake' | 'back';
type Motion = { mode: Mode; x: number; level: number; v: number; u: number; splash: DiveSplash | null };

const fredoka = require('@expo-google-fonts/fredoka/700Bold/Fredoka_700Bold.ttf');
// Other racers' flags show once a jump from this attempt has had time to land.
const revealMs = 4200;
const popupS = 1.4;
const motionTimes = { bobS: 0.35, swimMps: 3, swimMinS: 0.6, swimMaxS: 2.2, hopS: 0.4, shakeS: 0.9, backMinMps: 7 };
const apexBodies = { leap: 1.2, flop: 0.35, hop: 0.5 };

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// Where the player's pet is, `localS` seconds from an attempt's GO.
function motionAt(localS: number, result: DiveResult | null, dockM: number, gapS: number, version: string): Motion {
  const still = (x: number): Motion => ({ mode: 'idle', x, level: 0, v: 0, u: 0, splash: null });
  if (localS < 0) return still(0);
  const takeoffS = result ? result.takeoffMs / 1000 : Infinity;
  if (localS < takeoffS) {
    const run = runUp(localS * 1000, version);
    return { mode: 'run', x: Math.min(run.x, dockM), level: 0, v: run.v, u: 0, splash: null };
  }
  const dive = result!;
  const fromX = Math.min(runUp(dive.takeoffMs, version).x, dockM);
  const landX = dockM + dive.distanceM;
  const air = airSeconds(dive, version);
  const landS = takeoffS + air;
  const splash = (at: number): DiveSplash => ({
    m: dive.distanceM,
    ageS: at - landS,
    size: clamp((dive.distanceM - 1) / 7, 0, 1),
    flop: dive.flop,
  });
  if (localS < landS) {
    const u = (localS - takeoffS) / air;
    return { mode: 'air', x: lerp(fromX, landX, u), level: Math.pow(u, 1.6), v: 7, u, splash: null };
  }
  const swimFrom = landS + motionTimes.bobS;
  if (localS < swimFrom) return { mode: 'bob', x: landX, level: 1, v: 0, u: 0, splash: splash(localS) };
  const swimS = clamp(dive.distanceM / motionTimes.swimMps, motionTimes.swimMinS, motionTimes.swimMaxS);
  const outX = dockM + 0.4;
  if (localS < swimFrom + swimS) {
    const u = (localS - swimFrom) / swimS;
    return { mode: 'swim', x: lerp(landX, outX, u), level: 1, v: (landX - outX) / swimS, u, splash: splash(localS) };
  }
  const hopFrom = swimFrom + swimS;
  const deckX = dockM - 0.8;
  if (localS < hopFrom + motionTimes.hopS) {
    const u = (localS - hopFrom) / motionTimes.hopS;
    return { mode: 'hop', x: lerp(outX, deckX, u), level: 1 - u, v: 0, u, splash: splash(localS) };
  }
  const shakeFrom = hopFrom + motionTimes.hopS;
  if (localS < shakeFrom + motionTimes.shakeS) {
    return { mode: 'shake', x: deckX, level: 0, v: 0, u: (localS - shakeFrom) / motionTimes.shakeS, splash: splash(localS) };
  }
  const backFrom = shakeFrom + motionTimes.shakeS;
  const speed = Math.max(motionTimes.backMinMps, deckX / Math.max(0.5, gapS - 0.25 - backFrom));
  const backX = deckX - (localS - backFrom) * speed;
  if (backX > 0) return { mode: 'back', x: backX, level: 0, v: speed, u: 0, splash: null };
  return still(0);
}

function setFace(actor: Actor, dir: 1 | -1): void {
  const side = dir === 1 ? 'E' : 'W';
  actor.face = dir;
  actor.aimFace = dir;
  actor.yawFace = dir;
  actor.octant = side;
  actor.octantFrom = side;
  actor.octantTarget = side;
}

function applyMotion(actor: Actor, breed: Breed, motion: Motion, dt: number, legsPerMeter: number, bodyPx: number): void {
  stepRaceRun(actor, breed, motion.mode === 'run' || motion.mode === 'back' ? motion.v : 0, dt, legsPerMeter);
  actor.pose.swim = 0;
  actor.pose.shake = 0;
  if (motion.mode === 'air') {
    const flop = motion.level >= 0 && motion.u >= 0 && motion.splash == null && motion.v === 7 && false;
    applyRaceLeap(actor, motion.u, 0, bodyPx * (flop ? apexBodies.flop : apexBodies.leap));
    return;
  }
  clearPose(actor);
  if (motion.mode === 'bob' || motion.mode === 'swim') {
    if (motion.mode === 'swim') setFace(actor, -1);
    actor.pose.swim = 1;
    actor.pose.walk = 0;
    actor.pose.stretch = 0;
    actor.pose.stream = 0;
    actor.phase += dt * 7;
  } else if (motion.mode === 'hop') {
    setFace(actor, -1);
    applyRaceLeap(actor, motion.u, 0, bodyPx * apexBodies.hop);
  } else if (motion.mode === 'shake') {
    actor.pose.walk = 0;
    actor.pose.shake = Math.sin(Math.PI * motion.u);
  } else if (motion.mode === 'back') {
    setFace(actor, -1);
  }
}

function toScore(results: readonly (DiveResult | null)[], score: DiveScore): DistanceScore {
  return {
    scoreDm: Math.round(score.bestM * 10),
    secondDm: Math.round(score.secondM * 10),
    bestAttempt: score.bestAttempt,
    attemptsM: results.map((result) => result?.distanceM ?? 0),
    flops: results.map((result) => result?.flop ?? false),
  };
}

export function DockDiveScreen({ race, pet, reducedMotion, onFinish, onExit }: Props) {
  const [width, setWidth] = useState(0);
  const [finalRace, setFinalRace] = useState<RaceView | null>(null);
  const [provisional, setProvisional] = useState<Standing[] | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [mineResults, setMineResults] = useState<(DiveResult | null)[]>([null, null, null]);
  const [frame, setFrame] = useState({ at: serverNow(), meter: 0, holding: false });
  const [quiet, setQuiet] = useState(0);
  const [armedQuiet, setArmedQuiet] = useState<number | null>(null);
  const inputs = useRef<DiveInput[][]>([[], [], []]);
  const dives = useRef<DiveState[]>([createDive(), createDive(), createDive()]);
  const holdAttempt = useRef<number | null>(null);
  const touches = useRef(new Set<string>());
  const actorRef = useRef<Actor | null>(null);
  const landed = useRef(new Set<number>());
  const bests = useRef<{ best: number; popups: { attempt: number; text: string; big: boolean }[] }>({ best: 0, popups: [] });
  const petRef = useRef(pet);
  const playerMods = useRef<Modifiers | null>(null);
  const rewarded = useRef(false);
  const sent = useRef(false);
  const grantRef = useRef<(view: RaceView) => void>(() => undefined);
  const lastBeat = useRef<string | null>(null);
  const rulerFont = useFont(fredoka, 11);
  const popFont = useFont(fredoka, 24);
  const bigFont = useFont(fredoka, 34);
  const blank = useMemo(() => {
    const recorder = Skia.PictureRecorder();
    recorder.beginRecording(Skia.XYWHRect(0, 0, 1, 1));
    return recorder.finishRecordingAsPicture();
  }, []);
  const picture = useSharedValue<SkPicture>(blank);
  const [lineup, setLineup] = useState(race);
  const field = useMemo(() => [...lineup.players, ...lineup.npcs], [lineup.npcs, lineup.players]);
  const mine = field.find((row) => row.mine) ?? race.players[0];
  const classId = classOf(race.classId);
  const version = race.configVersion;
  const config = dockDiveConfigFor(version);
  const cls = diveClass(classId, version);
  const gapMs = config.windowMs + config.countdownMs;
  const totalMs = diveTotalMs(version);
  const live = lineup.players.length > 1;
  const { others, send } = useDiveFlags(race.raceId, live);
  const npcResults = useMemo(() => {
    const out: Record<string, DiveResult[]> = {};
    for (const row of field) {
      if (row.npc) out[row.key] = npcDives({ classId, skill: row.skill ?? 0.5, seed: `${race.seed}:${row.key}` }, version);
    }
    return out;
  }, [classId, field, race.seed, version]);
  const stageHeight = Math.round(Math.min(320, Math.max(240, width * 0.72)));
  const elapsed = frame.at - race.startsAt;
  const done = elapsed >= totalMs && mineResults.every((result) => result != null);
  const finished = provisional != null || finalRace?.status === 'finished';
  const countdown = useRaceCountdown(race.startsAt, finished);
  const resultsReady = finished && armedQuiet === quiet;

  const attempt = elapsed < 0 ? 0 : Math.min(config.attempts - 1, Math.floor(elapsed / gapMs));
  const local = elapsed - attemptGoMs(attempt, version);
  const between = elapsed >= 0 && local >= config.windowMs && attempt < config.attempts - 1;
  const shownAttempt = between ? attempt + 1 : attempt;
  const inputOpen = !finished && elapsed >= 0 && local < config.windowMs && mineResults[attempt] == null;
  // Attempt 1 uses the shared race countdown. Attempts 2 and 3 get a 3-2-1 of their own.
  const untilNext = attemptGoMs(shownAttempt, version) - elapsed;
  const ownBeat = shownAttempt > 0 ? countBeat(untilNext) : null;
  const beat = shownAttempt === 0 ? countdown.beat : ownBeat === 4 ? null : ownBeat;
  const countLabel = shownAttempt === 0 ? countdown.countLabel : beat == null ? null : countLabels[beat];
  const bestSoFar = Math.max(0, ...mineResults.map((result) => result?.distanceM ?? 0));

  useEffect(() => {
    petRef.current = pet;
  }, [pet]);

  useEffect(() => {
    preloadRaceSfx();
    return () => releaseRaceSfx();
  }, []);

  useEffect(() => {
    if (shownAttempt === 0 || finished || beat == null) return;
    const key = `${shownAttempt}:${beat}`;
    if (lastBeat.current === key) return;
    lastBeat.current = key;
    if (beat === 0) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [beat, finished, shownAttempt]);

  useEffect(() => {
    grantRef.current = (view) => {
      setFinalRace(view);
      if (rewarded.current) return;
      const placed = [...view.players, ...view.npcs].find((entry) => entry.mine && entry.place && entry.finishMs != null);
      if (!placed?.place) return;
      rewarded.current = true;
      onFinish(placed.place);
    };
  });

  // Results for every racer, as far as this phone knows them.
  const resultsOf = (key: string, isMine: boolean, isNpc: boolean, latest: (DiveResult | null)[]): (DiveResult | null)[] => {
    if (isMine) return latest;
    if (isNpc) return npcResults[key] ?? [null, null, null];
    return [0, 1, 2].map((index) => {
      const flag = others[`${key}:${index}`];
      return flag ? { distanceM: flag.m, flop: flag.flop, takeoffMs: config.windowMs, power: 0, spot: 0 } : null;
    });
  };

  useEffect(() => {
    let alive = true;
    const tick = () => {
      if (!alive) return;
      const at = serverNow();
      const since = at - race.startsAt;
      const now = since < 0 ? 0 : Math.min(config.attempts - 1, Math.floor(since / gapMs));
      const nowLocal = since - attemptGoMs(now, version);
      if (since >= 0 && !playerMods.current) playerMods.current = modsOf(mine, petRef.current);
      let changed = false;
      if (since >= 0) {
        for (let k = 0; k <= now; k += 1) {
          const state = dives.current[k];
          if (state.result) continue;
          advanceDive(state, inputs.current[k], k < now ? config.windowMs : Math.min(nowLocal, config.windowMs), playerMods.current, classId, version);
          if (!state.result) continue;
          changed = true;
          const result = state.result;
          if (!result.flop) {
            playJumpBoing();
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          if (live && mine) send({ entryId: mine.key, attempt: k, m: result.distanceM, flop: result.flop });
        }
      }
      const latest = dives.current.map((state) => state.result);
      if (changed) setMineResults(latest);

      // Landing: the distance pops up over the splash, bigger on a new personal best.
      const current = latest[now];
      if (since >= 0 && current && !landed.current.has(now) && nowLocal / 1000 >= current.takeoffMs / 1000 + airSeconds(current, version)) {
        landed.current.add(now);
        const best = current.distanceM > bests.current.best && !current.flop;
        if (best) bests.current.best = current.distanceM;
        bests.current.popups.push({ attempt: now, text: `${current.distanceM.toFixed(1)} m!`, big: best && now > 0 });
        if (current.flop) {
          playClipThud();
        } else {
          playClearChime(best);
        }
        void Haptics.impactAsync(current.flop ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Medium);
      }

      if (since >= totalMs && latest.every((result) => result != null) && !sent.current) {
        sent.current = true;
        const scored = field.map((row) => {
          const results = resultsOf(row.key, row.mine, row.npc, latest);
          return { row, results, score: diveScore(results, version) };
        });
        scored.sort((a, b) => compareDives(a.score, b.score));
        setProvisional(
          scored.map(({ row, score }) => ({
            key: row.key,
            name: row.petName,
            mine: row.mine,
            npc: row.npc,
            place: null,
            bestM: score.bestM,
            bestAttempt: score.bestAttempt,
          })),
        );
        setWaiting(true);
        const mineScored = scored.find((item) => item.row.mine);
        void submitRaceReport(
          race.raceId,
          mineScored?.score.bestAtMs ?? null,
          scored
            .filter((item) => item.row.npc)
            .map((item) => ({ entryId: item.row.key, finishMs: item.score.bestAtMs, score: toScore(item.results, item.score) })),
          mineScored ? toScore(mineScored.results, mineScored.score) : undefined,
        ).then((result) => {
          if (result.ok) grantRef.current(result.data);
        });
      }

      // Draw the player's pet from the attempt it is in, or the one it is coming back from.
      const motionAttempt = since < 0 ? 0 : now;
      const motionLocal = since < 0 ? since : nowLocal;
      const motion = motionAt(motionLocal / 1000, latest[motionAttempt], cls.dockM, gapMs / 1000, version);
      const livePet = petRef.current;
      const breed = mine ? breedOf(mine, livePet) : null;
      if (mine && breed && width > 0) {
        const actor = actorRef.current ?? actorOf(mine, livePet, breed);
        actorRef.current = actor;
        actor.equipped = { ...livePet.equipped };
        actor.displayAgeDays = livePet.ageDays;
        const fit = diveFit(actor, breed, width, stageHeight);
        const bodyUnits = fit.bodyPx / Math.max(fit.fit, 0.001);
        if (motion.mode === 'air') {
          stepRaceRun(actor, breed, 7, 0.05, fit.legsPerMeter);
          actor.pose.swim = 0;
          actor.pose.shake = 0;
          const flop = latest[motionAttempt]?.flop ?? false;
          applyRaceLeap(actor, motion.u, 0, bodyUnits * (flop ? apexBodies.flop : apexBodies.leap));
        } else {
          applyMotion(actor, breed, motion, 0.05, fit.legsPerMeter, bodyUnits);
        }
        const env: Env = {
          tod: todAt(solarHour(new Date(at))),
          t: at / 1000,
          reduced: reducedMotion,
          bowlFill: 0,
          waterLevel: 0,
          glows: [],
          feeding: [],
          sky: skyAt(new Date(at)),
          wind: skyAt(new Date(at)).weather.wind,
        };
        const flags: DiveFlag[] = [];
        for (const row of field) {
          const results = resultsOf(row.key, row.mine, row.npc, latest);
          let freshest = -1;
          const shown: number[] = [];
          results.forEach((result, index) => {
            if (!result || since < 0) return;
            const visible = row.mine
              ? landed.current.has(index)
              : index < now || (index === now && nowLocal >= revealMs) || since >= totalMs;
            if (!visible) return;
            shown.push(index);
            freshest = Math.max(freshest, index);
          });
          for (const index of shown) flags.push({ m: results[index]!.distanceM, mine: row.mine, fresh: index === freshest });
        }
        const labels: DiveLabel[] = [];
        const popup = bests.current.popups.find((item) => item.attempt === motionAttempt);
        if (popup && motion.splash && motion.splash.ageS < popupS) {
          labels.push({ m: motion.splash.m, text: popup.text, big: popup.big, alpha: 1 - Math.max(0, motion.splash.ageS - popupS * 0.7) / (popupS * 0.3) });
        }
        const recorder = Skia.PictureRecorder();
        const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, width, stageHeight));
        drawDockDive(
          canvas,
          width,
          stageHeight,
          env,
          motion.x,
          fit,
          { dockM: cls.dockM, zoneM: cls.zoneM },
          {
            x: motion.x,
            level: motion.level,
            liftPx: 0,
            wet: motion.mode === 'bob' || motion.mode === 'swim' || (motion.mode === 'hop' && motion.u < 0.3),
            actor,
            breed,
          },
          flags,
          motion.splash ? [motion.splash] : [],
          labels,
          { ruler: rulerFont, label: popFont, big: bigFont },
        );
        picture.value = recorder.finishRecordingAsPicture();
      }

      const state = dives.current[now];
      const holding = since >= 0 && !state.result && state.holdFromMs != null;
      const meter = holding ? meterAt(Math.min(nowLocal, config.windowMs) - state.holdFromMs!, classId, version) : (state.result?.power ?? 0);
      setFrame({ at, meter, holding });
    };
    const timer = setInterval(tick, 50);
    return () => {
      alive = false;
      clearInterval(timer);
    };
    // resultsOf reads `others` and `npcResults`, both listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bigFont, classId, cls, config, field, gapMs, live, mine, npcResults, others, picture, popFont, race.raceId, race.startsAt, reducedMotion, rulerFont, send, stageHeight, totalMs, version, width]);

  // The screen opens before the start, while the server may still be adding NPCs.
  const settled = lineup.status === 'running' || lineup.status === 'finished' || lineup.status === 'cancelled';
  useEffect(() => {
    if (settled || sent.current) return;
    let alive = true;
    const timer = setInterval(() => {
      void fetchRace(race.raceId).then((result) => {
        if (alive && result.ok) setLineup(result.data);
      });
    }, 500);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [race.raceId, settled]);

  useEffect(() => {
    if (!finished) return;
    const timer = setTimeout(() => setArmedQuiet(quiet), 600);
    return () => clearTimeout(timer);
  }, [finished, quiet]);

  useEffect(() => {
    if (!waiting || finalRace?.status === 'finished') return;
    const timer = setInterval(() => {
      void fetchRace(race.raceId).then((result) => {
        if (result.ok && result.data.status === 'finished') grantRef.current(result.data);
      });
    }, 2000);
    return () => clearInterval(timer);
  }, [finalRace?.status, race.raceId, waiting]);

  const standings: Standing[] | null = finalRace
    ? [...finalRace.players, ...finalRace.npcs]
        .map((row) => ({
          key: row.key,
          name: row.petName,
          mine: row.mine,
          npc: row.npc,
          place: row.place,
          bestM: row.scoreDm == null ? null : row.scoreDm / 10,
          bestAttempt: row.bestAttempt,
        }))
        .sort((a, b) => (a.place ?? 99) - (b.place ?? 99))
    : provisional;
  const mineStanding = standings?.find((row) => row.mine);
  const minePlace = mineStanding?.place;
  const mineScore = diveScore(mineResults, version);

  const press = () => {
    const at = serverNow();
    const since = at - race.startsAt;
    if (since < 0 || finished) return;
    const index = Math.min(config.attempts - 1, Math.floor(since / gapMs));
    const at0 = since - attemptGoMs(index, version);
    if (at0 >= config.windowMs || dives.current[index].result) return;
    holdAttempt.current = index;
    inputs.current[index].push({ at: at0, down: true });
  };

  const lift = () => {
    const index = holdAttempt.current;
    holdAttempt.current = null;
    if (index == null) return;
    const at0 = serverNow() - race.startsAt - attemptGoMs(index, version);
    if (dives.current[index].result) return;
    inputs.current[index].push({ at: at0, down: false });
    void Haptics.selectionAsync();
  };

  const hint = !inputOpen
    ? between || elapsed < 0
      ? 'Holding starts at Go!'
      : 'Nice splash!'
    : frame.holding
      ? 'Let go as the meter tops out at the edge'
      : `Hold, then let go as ${pet.name} reaches the mint band`;

  return (
    <View style={styles.root} onLayout={(event) => setWidth(Math.round(event.nativeEvent.layout.width))}>
      <View style={styles.bar}>
        <Text style={styles.title}>{eventLabel(race.event)}</Text>
        <View style={styles.barEnd}>
          <View style={styles.pill}>
            <Text style={styles.pillText}>
              Attempt {shownAttempt + 1} of {config.attempts}
            </Text>
          </View>
          <Text style={styles.best} accessibilityLabel={`Best so far ${bestSoFar.toFixed(1)} meters`}>
            {bestSoFar > 0 ? `${bestSoFar.toFixed(1)} m` : '–'}
          </Text>
        </View>
      </View>
      <View style={[styles.stage, { height: stageHeight }]}>
        {width > 0 ? (
          <Canvas style={styles.canvas}>
            <Picture picture={picture} />
          </Canvas>
        ) : null}
      </View>
      {finished && standings ? (
        <View style={styles.results}>
          <View style={styles.standings}>
            <Text style={styles.title}>
              {minePlace === 1 ? `${pet.name} won!` : minePlace ? `${pet.name} placed ${minePlace}${placeSuffix(minePlace)}!` : 'Splash!'}
            </Text>
            {finalRace?.status === 'finished' ? null : <Text style={shared.copy}>Provisional</Text>}
            <Text style={shared.strong}>
              Best {mineScore.bestM.toFixed(1)} m (attempt {mineScore.bestAttempt + 1})
            </Text>
            {standings.map((row, index) => (
              <Text key={row.key} style={styles.standing}>
                {row.place ?? index + 1}. {row.name}
                {row.mine ? ' · you' : row.npc ? ' · NPC' : ''}{' '}
                {row.bestM == null ? 'DNF' : `${row.bestM.toFixed(1)} m${row.bestAttempt != null ? ` (attempt ${row.bestAttempt + 1})` : ''}`}
              </Text>
            ))}
            <Text style={shared.copy}>{classLabel(race.classId)}.</Text>
          </View>
          {resultsReady ? (
            <CandyButton role="go" label="Back to the Stadium" onPress={onExit} />
          ) : (
            <View style={styles.hold} onTouchStart={() => setQuiet((value) => value + 1)} />
          )}
        </View>
      ) : (
        <HoldArea
          open={inputOpen}
          holding={frame.holding}
          countLabel={countLabel}
          beat={beat}
          hint={done ? 'Waiting for results…' : hint}
          onPress={press}
          onRelease={lift}
          touches={touches.current}
        >
          <Meter value={frame.meter} />
        </HoldArea>
      )}
    </View>
  );
}

// The whole action area is the hold target. The first finger down starts the hold; the last one up ends it.
function HoldArea({
  open,
  holding,
  countLabel,
  beat,
  hint,
  onPress,
  onRelease,
  touches,
  children,
}: {
  open: boolean;
  holding: boolean;
  countLabel: string | null;
  beat: number | null;
  hint: string;
  onPress: () => void;
  onRelease: () => void;
  touches: Set<string>;
  children: ReactNode;
}) {
  const settle = (still: readonly { identifier: string | number }[]) => {
    const ids = new Set(still.map((touch) => String(touch.identifier)));
    for (const id of touches) if (!ids.has(id)) touches.delete(id);
    if (touches.size === 0) onRelease();
  };
  return (
    <View
      style={styles.action}
      onTouchStart={(event) => {
        const wasEmpty = touches.size === 0;
        for (const touch of event.nativeEvent.touches) touches.add(String(touch.identifier));
        if (wasEmpty && touches.size > 0) onPress();
      }}
      onTouchEnd={(event) => settle(event.nativeEvent.touches)}
      onTouchCancel={() => {
        touches.clear();
        onRelease();
      }}
    >
      {countLabel ? (
        <Text accessibilityLiveRegion="assertive" style={[styles.count, beat === 4 && styles.ready, beat === 0 && styles.go]}>
          {countLabel}
        </Text>
      ) : null}
      <View style={styles.controlRow}>
        <View
          style={[styles.control, holding && styles.controlDown, !open && styles.wait]}
          accessibilityRole="button"
          accessibilityLabel={open ? 'Hold to charge the jump, let go to jump' : 'Wait for Go'}
          accessibilityState={{ disabled: !open }}
        >
          {open ? <PawPrint size={30} color="#fff" strokeWidth={2.5} /> : null}
          <Text style={[styles.label, holding && styles.labelDown, !open && styles.waitLabel]}>{open ? (holding ? 'Let go!' : 'HOLD') : 'Wait'}</Text>
        </View>
        {children}
      </View>
      <Text style={shared.copy}>{hint}</Text>
    </View>
  );
}

function Meter({ value }: { value: number }) {
  const fill = clamp(value, 0, 1);
  return (
    <View style={styles.meter} accessibilityLabel={`Power ${Math.round(fill * 100)} percent`}>
      <View style={styles.sweet} />
      <View style={[styles.meterFill, { height: `${fill * 100}%` }, fill > 0.85 && styles.meterTop]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFF4FA' },
  bar: { paddingTop: 54, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  barEnd: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontFamily: fontFamily.fredokaBold, fontSize: 26, color: ink },
  best: { fontFamily: fontFamily.fredokaBold, fontSize: 22, color: ink, minWidth: 56, textAlign: 'right' },
  pill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, borderWidth: 2, borderColor: ink, backgroundColor: '#CDEBFA' },
  pillText: { fontFamily: fontFamily.fredokaBold, fontSize: 14, color: ink },
  stage: { marginTop: 8 },
  canvas: { flex: 1 },
  action: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 16 },
  count: { fontFamily: fontFamily.fredokaBold, fontSize: 72, color: ink },
  ready: { fontSize: 44 },
  go: { color: '#2DAA6C' },
  controlRow: { flexDirection: 'row', alignItems: 'center', gap: 22 },
  control: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 3,
    borderColor: ink,
    backgroundColor: '#3A8DDE',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  controlDown: { backgroundColor: '#2C73BA', transform: [{ scale: 0.95 }] },
  wait: { backgroundColor: '#E4DEE9', borderColor: '#B7ADC1', borderStyle: 'dashed', opacity: 0.6, transform: [{ scale: 0.92 }] },
  label: { fontFamily: fontFamily.fredokaBold, fontSize: 32, color: '#fff' },
  labelDown: { fontSize: 26 },
  waitLabel: { color: '#9A8FA6' },
  meter: {
    width: 30,
    height: 150,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: ink,
    backgroundColor: '#fff',
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  sweet: { position: 'absolute', top: 0, left: 0, right: 0, height: '15%', backgroundColor: '#FFE38A' },
  meterFill: { width: '100%', backgroundColor: '#FF8FC0', opacity: 0.9 },
  meterTop: { backgroundColor: '#F0609F' },
  results: { flex: 1, padding: 16, paddingBottom: 28, justifyContent: 'space-between' },
  standings: { gap: 8 },
  hold: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  standing: { fontFamily: fontFamily.bold, fontSize: 16, color: ink },
});
