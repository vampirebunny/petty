import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Canvas, Picture, Skia, useFont } from '@shopify/react-native-skia';
import type { SkPicture } from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import { useSharedValue } from 'react-native-reanimated';
import { Fence } from 'lucide-react-native';

import { todAt } from '../../actor';
import type { Actor } from '../../actor';
import { racePoses } from '../../actor/data/locomotion';
import { puffDust } from '../../actor/jump';
import { applyRaceDuck, applyRaceLeap, applyStumble, clearPose, raceAirPx, raceHurdleSize, stepRaceRun } from '../../actor/raceDrive';
import { skyAt, solarHour } from '../../actor/sky';
import { playClearChime, playClipThud, preloadRaceSfx, releaseRaceSfx } from '../../audio/raceSfx';
import { serverNow } from '../../db/accountMeta';
import { useCompetitionResult } from '../../analytics/race';
import { eventLabel, formatCountdown, raceTagLabel } from '../../sim/stadium';
import type { PetState } from '../../sim/types';
import { fetchRace, submitRaceReport, type RaceView } from '../../stadium/api';
import { liveFinish, liveStateOf, raceSyncConfig, sampleLive } from '../../stadium/liveTrack';
import { deliverRaceReport, obstacleLog } from '../../stadium/raceReport';
import { useRaceSync } from '../../stadium/raceSync';
import {
  coastRunner,
  createObstacleRunner,
  isDucking,
  npcObstaclePlan,
  obstacleConfigFor,
  obstacleCourse,
  obstacleStat,
  runObstacle,
  sectionAt,
  stepObstacleRunner,
  type Modifiers,
  type ObstacleButton,
  type ObstacleInput,
  type ObstacleOutcome,
  type ObstacleRunner,
} from '../../../supabase/functions/_shared/race-sim/index.ts';
import type { Env } from '../skia/env';
import { drawRaceTrack } from '../skia/raceTrack';
import { fontFamily } from '../font';
import { CandyButton } from './CandyButton';
import { ObstacleControls } from './ObstacleControls';
import { raceInputOpen } from './raceCountdown';
import { actorOf, breedOf, classOf, modsOf, placeSuffix, raceLabelFont, raceLabelSize } from './raceField';
import { useRaceCountdown } from './useRaceCountdown';
import { useRaceLoop } from './useRaceLoop';
import { ink, shared } from './parts';

type Props = {
  race: RaceView;
  pet: PetState;
  reducedMotion: boolean;
  onFinish: (place: number) => void;
  onExit: () => void;
};

type Standing = { key: string; name: string; finishMs: number | null; place: number | null; mine: boolean };
type Popup = { text: string; tone: ObstacleOutcome; until: number };

const popupMs = 900;
const legsPerMeter = racePoses.hurdlesLegsPerMeter;
const popupText: Record<ObstacleOutcome, string> = { perfect: 'Perfect!', good: 'Nice!', miss: 'Oops!' };
const duckInS = 0.1;
const duckOutS = 0.15;
// The hop in front of a tunnel peaks at this share of the hurdle leap's height.
const hopApexShare = 0.4;
// Past this many obstacles the markers shrink and wrap so the row fits a phone.
const roomyMarkers = 12;

export function ObstacleScreen({ race, pet, reducedMotion, onFinish, onExit }: Props) {
  const [width, setWidth] = useState(0);
  const [finalRace, setFinalRace] = useState<RaceView | null>(null);
  const [provisional, setProvisional] = useState<Standing[] | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [frame, setFrame] = useState({
    at: 0,
    tMs: 0,
    cue: null as ObstacleButton | null,
    xs: {} as Record<string, number>,
    outcomes: [] as ObstacleOutcome[],
  });
  const [popup, setPopup] = useState<Popup | null>(null);
  const [quiet, setQuiet] = useState(0);
  const [armedQuiet, setArmedQuiet] = useState<number | null>(null);
  const inputs = useRef<ObstacleInput[]>([]);
  const runners = useRef(new Map<string, ObstacleRunner>());
  const plans = useRef(new Map<string, number[]>());
  const actors = useRef(new Map<string, Actor>());
  const sizes = useRef(new Map<string, { barZ: number; apex: number }>());
  const ducks = useRef(new Map<string, number>());
  const landed = useRef(new Set<string>());
  const seen = useRef({ jumps: 0, ducks: 0, outcomes: 0 });
  const uiAt = useRef({ at: 0, cue: null as ObstacleButton | null, outcomes: 0 });
  const petRef = useRef(pet);
  const playerMods = useRef<Modifiers | null>(null);
  const rewarded = useRef(false);
  const sent = useRef(false);
  const grantRef = useRef<(view: RaceView) => void>(() => undefined);
  const blank = useMemo(() => {
    const recorder = Skia.PictureRecorder();
    recorder.beginRecording(Skia.XYWHRect(0, 0, 1, 1));
    return recorder.finishRecordingAsPicture();
  }, []);
  const picture = useSharedValue<SkPicture>(blank);
  const [lineup, setLineup] = useState(race);
  const field = useMemo(() => [...lineup.players, ...lineup.npcs], [lineup.npcs, lineup.players]);
  const mine = field.find((row) => row.mine) ?? race.players[0];
  const live = lineup.players.length > 1;
  const { remotes, send } = useRaceSync(race.raceId, live);
  const stale = useRef(new Set<string>());
  const labelFont = useFont(raceLabelFont, raceLabelSize);
  const classId = classOf(race.classId);
  const version = race.configVersion;
  const config = obstacleConfigFor(version);
  const course = useMemo(() => obstacleCourse(classId, version, race.seed), [classId, race.seed, version]);
  const { distanceM, obstacles } = course;
  const stageHeight = Math.round(Math.min(300, Math.max(220, width * 0.66)));
  const finished = provisional != null || finalRace?.status === 'finished';
  const { untilStart, going, beat, countLabel } = useRaceCountdown(race.startsAt, finished);
  const resultsReady = finished && armedQuiet === quiet;

  useEffect(() => {
    petRef.current = pet;
  }, [pet]);

  useEffect(() => {
    preloadRaceSfx();
    return () => releaseRaceSfx();
  }, []);

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

  useRaceLoop((dt) => {
      const at = serverNow();
      const elapsed = Math.max(0, at - race.startsAt);
      const stepMs = 1000 / config.stepHz;
      let player: ObstacleRunner | null = null;
      if (going) {
        for (const row of field) {
          if (!row.mine && !row.npc) {
            const view = sampleLive(remotes.current.get(row.key), elapsed - raceSyncConfig.interpDelayMs, Date.now());
            if (view?.stale) stale.current.add(row.key);
            else stale.current.delete(row.key);
            const outcomes = (view?.outcomes ?? []) as ObstacleOutcome[];
            const remote = runners.current.get(row.key) ?? createObstacleRunner();
            remote.x = view?.x ?? 0;
            remote.v = view?.v ?? 0;
            remote.tMs = view?.t ?? 0;
            remote.finishMs = view?.finishMs ?? null;
            remote.jumpX = view?.jumpX ?? null;
            remote.jumpAirM = view?.airM ?? 0;
            remote.duckX = view?.duckX ?? null;
            remote.duckUntilX = view?.duckUntilX ?? 0;
            remote.clipAtMs = view?.clipAtMs ?? null;
            remote.bonkAtMs = view?.bonkAtMs ?? null;
            remote.outcomes = outcomes;
            remote.outcomeMs = view?.outcomeMs ?? [];
            remote.next = outcomes.length;
            runners.current.set(row.key, remote);
            continue;
          }
          const state = runners.current.get(row.key) ?? createObstacleRunner();
          runners.current.set(row.key, state);
          const npc = row.npc ? { classId, skill: row.skill ?? 0.5, seed: `${race.seed}:${row.key}` } : null;
          let plan = plans.current.get(row.key) ?? null;
          if (npc && !plan) {
            plan = npcObstaclePlan(npc, version, race.seed);
            plans.current.set(row.key, plan);
          }
          if (row.mine && !playerMods.current) {
            playerMods.current = modsOf(row, petRef.current);
          }
          while (state.tMs < Math.min(elapsed, config.maxMs + 20000)) {
            if (state.finishMs == null) {
              if (state.tMs >= config.maxMs) break;
              const next = state.tMs + stepMs;
              const due = row.mine ? inputs.current.filter((input) => input.tMs >= state.tMs && input.tMs < next) : [];
              stepObstacleRunner(state, due, row.mine ? playerMods.current : null, npc, classId, version, race.seed, plan);
            } else {
              const before = state.tMs;
              coastRunner(state, stepMs, distanceM);
              if (state.tMs === before) break;
            }
          }
        }
        player = mine ? runners.current.get(mine.key) ?? null : null;
        if (live && mine && player) send(liveStateOf(mine.key, player));
        if (player) {
          if (player.jumps.length > seen.current.jumps) {
            seen.current.jumps = player.jumps.length;
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          if (player.ducks.length > seen.current.ducks) {
            seen.current.ducks = player.ducks.length;
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          if (player.outcomes.length > seen.current.outcomes) {
            const outcome = player.outcomes[player.outcomes.length - 1];
            seen.current.outcomes = player.outcomes.length;
            setPopup({ text: popupText[outcome], tone: outcome, until: at + popupMs });
            if (outcome === 'miss') {
              playClipThud();
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            } else {
              playClearChime(outcome === 'perfect');
            }
          }
        }
        if (player && (player.finishMs != null || player.tMs >= config.maxMs) && !sent.current) {
          const standings = field
            .map((row) => {
              if (!row.mine && !row.npc) {
                return { key: row.key, name: row.petName, finishMs: liveFinish(remotes.current.get(row.key)), place: null, mine: false };
              }
              const npc = row.npc ? { classId, skill: row.skill ?? 0.5, seed: `${race.seed}:${row.key}` } : null;
              const result = runObstacle(row.mine ? inputs.current : [], row.mine ? playerMods.current : null, npc, classId, version, race.seed);
              return { key: row.key, name: row.petName, finishMs: result.finishMs, place: null, mine: row.mine };
            })
            .sort((a, b) => (a.finishMs ?? 1e9) - (b.finishMs ?? 1e9));
          sent.current = true;
          setWaiting(true);
          setProvisional(standings);
          const mineStanding = standings.find((row) => row.mine);
          const log = obstacleLog(inputs.current);
          void deliverRaceReport(
            () => submitRaceReport(race.raceId, mineStanding?.finishMs ?? null, log),
            (view) => grantRef.current(view),
          );
        }
      }

      const livePet = petRef.current;
      for (const row of field) {
        const breed = breedOf(row, livePet);
        const actor = actors.current.get(row.key) ?? actorOf(row, livePet, breed);
        actors.current.set(row.key, actor);
        if (row.mine) {
          actor.equipped = { ...livePet.equipped };
          actor.displayAgeDays = livePet.ageDays;
        }
        let size = sizes.current.get(row.key);
        if (!size) {
          size = raceHurdleSize(actor, raceAirPx(actor, breed, config.airM, legsPerMeter));
          sizes.current.set(row.key, size);
        }
        const runner = runners.current.get(row.key);
        stepRaceRun(actor, breed, runner?.v ?? 0, dt, legsPerMeter);
        if (!runner) {
          clearPose(actor);
          applyRaceDuck(actor, 0);
          continue;
        }
        // Low while a duck lasts and anywhere inside a tube, eased like the trick's crawl.
        const inTube = sectionAt(course, runner.x)?.kind === 'tunnel';
        const wantLow = isDucking(runner) || inTube;
        const before = ducks.current.get(row.key) ?? 0;
        const low = wantLow ? Math.min(1, before + dt / duckInS) : Math.max(0, before - dt / duckOutS);
        ducks.current.set(row.key, low);
        const hitAt = Math.max(runner.clipAtMs ?? -1e9, runner.bonkAtMs ?? -1e9);
        const stumbleT = (runner.tMs - hitAt) / (racePoses.stumbleSeconds * 1000);
        if (stumbleT >= 0 && stumbleT < 1) {
          applyStumble(actor, breed, stumbleT, reducedMotion);
          applyRaceDuck(actor, 0);
          continue;
        }
        applyRaceDuck(actor, low);
        if (runner.jumpX == null || runner.jumpAirM <= 0) {
          clearPose(actor);
          continue;
        }
        const apex = runner.jumpAirM < config.airM ? Math.max(racePoses.leapApexPx, size.apex * hopApexShare) : size.apex;
        const airU = (runner.x - runner.jumpX) / runner.jumpAirM;
        if (airU < 1) {
          landed.current.delete(row.key);
          applyRaceLeap(actor, airU, 0, apex);
          continue;
        }
        const after = (runner.x - (runner.jumpX + runner.jumpAirM)) / Math.max(runner.v, 1);
        const playing = applyRaceLeap(actor, 1, Math.max(0.001, after), apex);
        if (!playing) {
          clearPose(actor);
        } else if (!landed.current.has(row.key)) {
          landed.current.add(row.key);
          if (!reducedMotion && actor.jump) puffDust(actor, actor.jump.dust);
        }
      }

      if (width > 0) {
        const trackH = stageHeight;
        const follow = mine ? (runners.current.get(mine.key)?.x ?? 0) : 0;
        const sky = skyAt(new Date(at));
        const env: Env = {
          tod: todAt(solarHour(new Date(at))),
          t: at / 1000,
          reduced: reducedMotion,
          bowlFill: 0,
          waterLevel: 0,
          glows: [],
          feeding: [],
          sky,
          wind: sky.weather.wind,
        };
        const recorder = Skia.PictureRecorder();
        const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, width, trackH));
        const racers = field.map((row) => {
          const runner = runners.current.get(row.key);
          const sinceMiss = (index: number) =>
            runner?.outcomes[index] === 'miss' ? Math.max(0, (runner.tMs - runner.outcomeMs[index]) / 1000) : null;
          const hurdleIdx: number[] = [];
          const tunnelIdx: number[] = [];
          obstacles.forEach((o, i) => (o.kind === 'hurdle' ? hurdleIdx : tunnelIdx).push(i));
          return {
            x: runner?.x ?? 0,
            name: row.petName,
            mine: row.mine,
            stale: stale.current.has(row.key),
            actor: actors.current.get(row.key) ?? actorOf(row, livePet, breedOf(row, livePet)),
            breed: breedOf(row, livePet),
            course: {
              hurdles: hurdleIdx.map((i) => obstacles[i].at),
              fallenS: hurdleIdx.map(sinceMiss),
              tunnels: tunnelIdx.map((i) => ({ at: obstacles[i].at, end: obstacles[i].end, bonkS: sinceMiss(i) })),
              barZ: sizes.current.get(row.key)?.barZ ?? 30,
              species: row.mine ? (breedOf(row, livePet).species === 'cat' ? 'cat' : 'dog') : row.species,
              // Zones stay hidden; players judge from the hurdle and the tunnel mouth.
              zones: null,
            },
          };
        });
        drawRaceTrack(canvas, width, trackH, env, follow, racers, distanceM, legsPerMeter, labelFont);
        picture.value = recorder.finishRecordingAsPicture();
      }

      const upcoming = player ? (obstacles[player.next] ?? null) : null;
      const cue: ObstacleButton | null = going && upcoming ? (upcoming.kind === 'hurdle' ? 'jump' : 'duck') : null;
      const outcomes = player ? player.outcomes : [];
      const now = Date.now();
      if (
        now - uiAt.current.at >= 1000 / raceSyncConfig.uiHz ||
        cue !== uiAt.current.cue ||
        outcomes.length !== uiAt.current.outcomes
      ) {
        uiAt.current = { at: now, cue, outcomes: outcomes.length };
        const xs: Record<string, number> = {};
        for (const row of field) xs[row.key] = runners.current.get(row.key)?.x ?? 0;
        setFrame({
          at,
          tMs: player?.tMs ?? 0,
          cue,
          xs,
          outcomes: [...outcomes],
        });
      }
  });

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

  const standings = finalRace
    ? [...finalRace.players, ...finalRace.npcs]
        .map((row) => ({ key: row.key, name: row.petName, finishMs: row.finishMs, place: row.place, mine: row.mine }))
        .sort((a, b) => (a.place ?? 99) - (b.place ?? 99))
    : provisional;
  const minePlace = standings?.find((row) => row.mine)?.place;
  useCompetitionResult(race, resultsReady, minePlace ?? undefined);
  const stat = obstacleStat(frame.outcomes, obstacles.length, 0);
  const showPopup = popup != null && frame.at < popup.until;
  const compact = obstacles.length > roomyMarkers;

  const press = (button: ObstacleButton) => {
    // Re-check the clock: `going` can lag the 50 ms render tick right at Go!.
    const at = serverNow();
    if (!raceInputOpen(at, race.startsAt, finished)) return;
    // The live sim can run up to one step past `at`. Stamp the press no earlier than the
    // step it lands in, or the scene skips it while the replay and the results count it.
    const simMs = mine ? (runners.current.get(mine.key)?.tMs ?? 0) : 0;
    inputs.current.push({ tMs: Math.max(at - race.startsAt, simMs), button });
  };

  return (
    <View style={styles.root} onLayout={(event) => setWidth(Math.round(event.nativeEvent.layout.width))}>
      <View style={styles.bar}>
        <Text style={styles.title}>{eventLabel(race.event)}</Text>
        <View style={styles.barEnd}>
          <View style={styles.pill} accessibilityLabel={`${stat.clean} of ${stat.total} obstacles cleared`}>
            <Text style={styles.pillText}>
              {stat.clean}/{stat.total}
            </Text>
          </View>
          <Text style={styles.timer}>{going ? formatCountdown(Math.max(0, frame.tMs)) : formatCountdown(Math.max(0, untilStart))}</Text>
        </View>
      </View>
      <View style={styles.mini}>
        {field.map((row) => (
          <View
            key={row.key}
            style={[styles.dot, row.mine && styles.dotMine, { left: `${Math.min(100, ((frame.xs[row.key] ?? 0) / distanceM) * 100)}%` }]}
          />
        ))}
      </View>
      <View style={[styles.stage, { height: stageHeight }]}>
        {width > 0 ? (
          <Canvas style={styles.canvas}>
            <Picture picture={picture} />
          </Canvas>
        ) : null}
        {showPopup && popup ? (
          <Text
            accessibilityLiveRegion="polite"
            style={[styles.popup, { left: width * 0.33 - 30, top: stageHeight * 0.38 }, popup.tone === 'miss' ? styles.popupOops : styles.popupNice]}
          >
            {popup.text}
          </Text>
        ) : null}
      </View>
      <View style={[styles.markers, compact && styles.markersCompact]} accessibilityLabel={`Obstacles cleared ${stat.clean} of ${stat.total}`}>
        {obstacles.map((obstacle, index) => {
          const outcome = frame.outcomes[index];
          const cleared = outcome != null && outcome !== 'miss';
          const color = outcome === 'miss' ? '#EE5A8E' : cleared ? '#2DAA6C' : '#B7ADC1';
          return (
            <View
              key={index}
              style={[styles.marker, compact && styles.markerCompact, cleared && styles.markerClear, outcome === 'miss' && styles.markerMiss]}
            >
              {outcome === 'miss' ? (
                <Text style={[styles.cross, compact && styles.crossCompact]}>✕</Text>
              ) : obstacle.kind === 'hurdle' ? (
                <Fence size={compact ? 9 : 13} color={cleared ? '#fff' : color} strokeWidth={2.4} />
              ) : (
                <View style={[styles.arch, compact && styles.archCompact, { borderColor: cleared ? '#fff' : color }]} />
              )}
            </View>
          );
        })}
      </View>
      {finished && standings ? (
        <View style={styles.results}>
          <ScrollView style={styles.resultsScroll} contentContainerStyle={styles.standings} showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>
              {minePlace === 1 ? `${pet.name} won!` : minePlace ? `${pet.name} placed ${minePlace}${placeSuffix(minePlace)}!` : 'Finish!'}
            </Text>
            {finalRace?.status === 'finished' ? null : <Text style={shared.copy}>Provisional</Text>}
            <Text style={shared.strong}>
              Obstacles {stat.clean}/{stat.total} · Perfect {stat.perfect}
            </Text>
            {standings.map((row, index) => (
              <Text key={row.key} style={styles.standing}>
                {row.place ?? index + 1}. {row.name}
                {row.mine ? ' · you' : ' · NPC'} {row.finishMs == null ? 'DNF' : `${(row.finishMs / 1000).toFixed(2)}s`}
              </Text>
            ))}
            <Text style={shared.copy}>{raceTagLabel(race)}.</Text>
          </ScrollView>
          {resultsReady ? <CandyButton role="go" label="Back to the Stadium" onPress={onExit} /> : null}
          {resultsReady ? null : <View style={styles.hold} onTouchStart={() => setQuiet((value) => value + 1)} />}
        </View>
      ) : (
        <ObstacleControls
          going={going}
          beat={beat}
          countLabel={countLabel}
          hint={going ? 'Keep tapping RUN · jump and duck in time' : 'Buttons wake up at Go!'}
          cue={frame.cue}
          onPress={press}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFF4FA' },
  bar: { paddingTop: 54, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  barEnd: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontFamily: fontFamily.fredokaBold, fontSize: 26, color: ink },
  timer: { fontFamily: fontFamily.fredokaBold, fontSize: 22, color: ink },
  pill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, borderWidth: 2, borderColor: ink, backgroundColor: '#C3F0D7' },
  pillText: { fontFamily: fontFamily.fredokaBold, fontSize: 15, color: ink },
  mini: { height: 28, marginHorizontal: 16, marginTop: 8, borderRadius: 8, backgroundColor: '#fff', borderWidth: 2, borderColor: ink },
  dot: { position: 'absolute', top: 6, width: 14, height: 14, borderRadius: 7, backgroundColor: '#CDB4F0', borderWidth: 2, borderColor: ink },
  dotMine: { backgroundColor: '#FF8FC0', width: 18, height: 18, borderRadius: 9, top: 4 },
  stage: { marginTop: 8 },
  canvas: { flex: 1 },
  popup: { position: 'absolute', fontFamily: fontFamily.fredokaBold, fontSize: 26 },
  popupNice: { color: '#2DAA6C' },
  popupOops: { color: '#EE5A8E' },
  markers: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 10, marginHorizontal: 12 },
  markersCompact: { gap: 4 },
  marker: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#B7ADC1', alignItems: 'center', justifyContent: 'center' },
  markerCompact: { width: 15, height: 15, borderRadius: 8, borderWidth: 1.5 },
  markerClear: { backgroundColor: '#79C8A0', borderColor: '#2DAA6C' },
  markerMiss: { borderColor: '#EE5A8E' },
  arch: { width: 12, height: 7, borderTopLeftRadius: 6, borderTopRightRadius: 6, borderWidth: 2, borderBottomWidth: 0, marginTop: 3 },
  archCompact: { width: 8, height: 5, borderTopLeftRadius: 4, borderTopRightRadius: 4, borderWidth: 1.5, marginTop: 2 },
  cross: { fontFamily: fontFamily.fredokaBold, fontSize: 12, color: '#EE5A8E', lineHeight: 14 },
  crossCompact: { fontSize: 8, lineHeight: 10 },
  results: { flex: 1, minHeight: 0, padding: 16, paddingBottom: 28, gap: 12 },
  resultsScroll: { flex: 1 },
  standings: { gap: 8 },
  hold: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  standing: { fontFamily: fontFamily.bold, fontSize: 16, color: ink },
});
