import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Canvas, Picture, Skia } from '@shopify/react-native-skia';
import type { SkPicture } from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import { useSharedValue } from 'react-native-reanimated';

import { todAt } from '../../actor';
import type { Actor } from '../../actor';
import { racePoses } from '../../actor/data/locomotion';
import { puffDust } from '../../actor/jump';
import { applyRaceLeap, applyStumble, clearPose, raceAirPx, raceHurdleSize, stepRaceRun } from '../../actor/raceDrive';
import { skyAt, solarHour } from '../../actor/sky';
import { playClearChime, playClipThud, preloadRaceSfx, releaseRaceSfx } from '../../audio/raceSfx';
import { serverNow } from '../../db/accountMeta';
import { classLabel, eventLabel, formatCountdown } from '../../sim/stadium';
import type { PetState } from '../../sim/types';
import { fetchRace, submitRaceReport, type RaceView } from '../../stadium/api';
import { hurdlesLog } from '../../stadium/raceReport';
import {
  coastRunner,
  createHurdleRunner,
  hurdleCourse,
  hurdleStat,
  hurdlesConfigFor,
  npcJumpPlan,
  runHurdles,
  stepHurdleRunner,
  type HurdleOutcome,
  type HurdleRunner,
  type Modifiers,
} from '../../../supabase/functions/_shared/race-sim/index.ts';
import type { Env } from '../skia/env';
import { drawRaceTrack } from '../skia/raceTrack';
import { fontFamily } from '../font';
import { CandyButton } from './CandyButton';
import { RaceAction } from './RaceAction';
import { raceInputOpen } from './raceCountdown';
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

type Standing = { key: string; name: string; finishMs: number | null; place: number | null; mine: boolean };
type Popup = { text: string; tone: HurdleOutcome; until: number };

const popupMs = 900;
const legsPerMeter = racePoses.hurdlesLegsPerMeter;
const popupText: Record<HurdleOutcome, string> = { perfect: 'Perfect!', good: 'Nice!', clip: 'Oops!' };

export function HurdlesScreen({ race, pet, reducedMotion, onFinish, onExit }: Props) {
  const [width, setWidth] = useState(0);
  const [finalRace, setFinalRace] = useState<RaceView | null>(null);
  const [provisional, setProvisional] = useState<Standing[] | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [frame, setFrame] = useState({ at: 0, tMs: 0, xs: {} as Record<string, number>, outcomes: [] as HurdleOutcome[] });
  const [popup, setPopup] = useState<Popup | null>(null);
  const [quiet, setQuiet] = useState(0);
  const [armedQuiet, setArmedQuiet] = useState<number | null>(null);
  const jumps = useRef<number[]>([]);
  const runners = useRef(new Map<string, HurdleRunner>());
  const plans = useRef(new Map<string, number[]>());
  const actors = useRef(new Map<string, Actor>());
  const sizes = useRef(new Map<string, { barZ: number; apex: number }>());
  const landed = useRef(new Set<string>());
  const seen = useRef({ jumps: 0, outcomes: 0 });
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
  const classId = classOf(race.classId);
  const version = race.configVersion;
  const config = hurdlesConfigFor(version);
  const course = useMemo(() => hurdleCourse(classId, version, race.seed), [classId, race.seed, version]);
  const { hurdles, distanceM } = course;
  const stageHeight = Math.round(Math.min(320, Math.max(240, width * 0.72)));
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

  useEffect(() => {
    let alive = true;
    const tick = () => {
      if (!alive) return;
      const at = serverNow();
      const elapsed = Math.max(0, at - race.startsAt);
      const stepMs = 1000 / config.stepHz;
      let player: HurdleRunner | null = null;
      if (going) {
        for (const row of field) {
          const state = runners.current.get(row.key) ?? createHurdleRunner();
          runners.current.set(row.key, state);
          const npc = row.npc ? { classId, skill: row.skill ?? 0.5, seed: `${race.seed}:${row.key}` } : null;
          let plan = plans.current.get(row.key) ?? null;
          if (npc && !plan) {
            plan = npcJumpPlan(npc, version, race.seed);
            plans.current.set(row.key, plan);
          }
          if (row.mine && !playerMods.current) {
            playerMods.current = modsOf(row, petRef.current);
          }
          while (state.tMs < Math.min(elapsed, config.maxMs + 20000)) {
            if (state.finishMs == null) {
              if (state.tMs >= config.maxMs) break;
              const next = state.tMs + stepMs;
              const due = row.mine ? jumps.current.filter((tap) => tap >= state.tMs && tap < next) : [];
              stepHurdleRunner(state, due, row.mine ? playerMods.current : null, npc, classId, version, race.seed, plan);
            } else {
              const before = state.tMs;
              coastRunner(state, stepMs, distanceM);
              if (state.tMs === before) break;
            }
          }
        }
        player = mine ? runners.current.get(mine.key) ?? null : null;
        if (player) {
          if (player.jumps.length > seen.current.jumps) {
            seen.current.jumps = player.jumps.length;
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          if (player.outcomes.length > seen.current.outcomes) {
            const outcome = player.outcomes[player.outcomes.length - 1];
            seen.current.outcomes = player.outcomes.length;
            setPopup({ text: popupText[outcome], tone: outcome, until: at + popupMs });
            if (outcome === 'clip') {
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
              const npc = row.npc ? { classId, skill: row.skill ?? 0.5, seed: `${race.seed}:${row.key}` } : null;
              const result = runHurdles(row.mine ? jumps.current : [], row.mine ? playerMods.current : null, npc, classId, version, race.seed);
              return { key: row.key, name: row.petName, finishMs: result.finishMs, place: null, mine: row.mine };
            })
            .sort((a, b) => (a.finishMs ?? 1e9) - (b.finishMs ?? 1e9));
          sent.current = true;
          setWaiting(true);
          setProvisional(standings);
          const mineStanding = standings.find((row) => row.mine);
          void submitRaceReport(race.raceId, mineStanding?.finishMs ?? null, hurdlesLog(jumps.current)).then((result) => {
            if (result.ok) grantRef.current(result.data);
            else if (result.offline) sent.current = false;
          });
        }
      }

      const dt = 0.05;
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
          continue;
        }
        const stumbleT = runner.clipAtMs == null ? 1 : (runner.tMs - runner.clipAtMs) / (racePoses.stumbleSeconds * 1000);
        if (stumbleT < 1) {
          applyStumble(actor, breed, stumbleT, reducedMotion);
          continue;
        }
        if (runner.jumpX == null) {
          clearPose(actor);
          continue;
        }
        // The leap follows the sim: air progress is distance over the event's air length. It plays out past the line too.
        const airU = (runner.x - runner.jumpX) / config.airM;
        if (airU < 1) {
          landed.current.delete(row.key);
          applyRaceLeap(actor, airU, 0, size.apex);
          continue;
        }
        const after = (runner.x - (runner.jumpX + config.airM)) / Math.max(runner.v, 1);
        const playing = applyRaceLeap(actor, 1, Math.max(0.001, after), size.apex);
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
        const recorder = Skia.PictureRecorder();
        const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, width, trackH));
        const racers = field.map((row) => {
          const runner = runners.current.get(row.key);
          return {
            x: runner?.x ?? 0,
            name: row.petName,
            mine: row.mine,
            actor: actors.current.get(row.key) ?? actorOf(row, livePet, breedOf(row, livePet)),
            breed: breedOf(row, livePet),
            course: {
              hurdles,
              fallenS: hurdles.map((_, index) =>
                runner?.outcomes[index] === 'clip' ? Math.max(0, (runner.tMs - runner.outcomeMs[index]) / 1000) : null,
              ),
              barZ: sizes.current.get(row.key)?.barZ ?? 30,
              species: row.mine ? (breedOf(row, livePet).species === 'cat' ? 'cat' : 'dog') : row.species,
              // The jump zone stays hidden; players judge it from the hurdle.
              zones: null,
            },
          };
        });
        drawRaceTrack(canvas, width, trackH, env, follow, racers, distanceM, legsPerMeter);
        picture.value = recorder.finishRecordingAsPicture();
      }
      const xs: Record<string, number> = {};
      for (const row of field) xs[row.key] = runners.current.get(row.key)?.x ?? 0;
      setFrame({ at, tMs: player?.tMs ?? 0, xs, outcomes: player ? [...player.outcomes] : [] });
    };
    const timer = setInterval(tick, 50);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [classId, config, distanceM, field, going, hurdles, mine, picture, race.raceId, race.seed, race.startsAt, reducedMotion, stageHeight, version, width]);

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
  const stat = hurdleStat(frame.outcomes, hurdles.length);
  const showPopup = popup != null && frame.at < popup.until;

  const tap = () => {
    // Re-check the clock: `going` can lag the 50 ms render tick right at Go!.
    const at = serverNow();
    if (!raceInputOpen(at, race.startsAt, finished)) return;
    jumps.current.push(at - race.startsAt);
  };

  return (
    <View style={styles.root} onLayout={(event) => setWidth(Math.round(event.nativeEvent.layout.width))}>
      <View style={styles.bar}>
        <Text style={styles.title}>{eventLabel(race.event)}</Text>
        <View style={styles.barEnd}>
          <View style={styles.pill} accessibilityLabel={`${stat.clean} of ${stat.total} hurdles cleared`}>
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
            style={[styles.popup, { left: width * 0.33 - 30, top: stageHeight * 0.38 }, popup.tone === 'clip' ? styles.popupOops : styles.popupNice]}
          >
            {popup.text}
          </Text>
        ) : null}
      </View>
      <View style={styles.dots} accessibilityLabel={`Clean jumps ${stat.clean} of ${stat.total}`}>
        {hurdles.map((_, index) => {
          const outcome = frame.outcomes[index];
          return (
            <View key={index} style={[styles.hurdleDot, outcome && outcome !== 'clip' && styles.hurdleClear, outcome === 'clip' && styles.hurdleClip]}>
              {outcome === 'clip' ? <Text style={styles.cross}>✕</Text> : null}
            </View>
          );
        })}
      </View>
      {finished && standings ? (
        <View style={styles.results}>
          <View style={styles.standings}>
            <Text style={styles.title}>
              {minePlace === 1 ? `${pet.name} won!` : minePlace ? `${pet.name} placed ${minePlace}${placeSuffix(minePlace)}!` : 'Finish!'}
            </Text>
            {finalRace?.status === 'finished' ? null : <Text style={shared.copy}>Provisional</Text>}
            <Text style={shared.strong}>
              Clean jumps {stat.clean}/{stat.total} · Perfect {stat.perfect}
            </Text>
            {standings.map((row, index) => (
              <Text key={row.key} style={styles.standing}>
                {row.place ?? index + 1}. {row.name}
                {row.mine ? ' · you' : ' · NPC'} {row.finishMs == null ? 'DNF' : `${(row.finishMs / 1000).toFixed(2)}s`}
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
        <RaceAction
          going={going}
          beat={beat}
          countLabel={countLabel}
          activeLabel="JUMP!"
          tone="jump"
          hint={going ? `Jump just before ${pet.name} reaches each hurdle` : 'Jumping starts at Go!'}
          accessibilityLabel="Jump"
          onActivate={tap}
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
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 10 },
  hurdleDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#B7ADC1', alignItems: 'center', justifyContent: 'center' },
  hurdleClear: { backgroundColor: '#79C8A0', borderColor: '#2DAA6C' },
  hurdleClip: { borderColor: '#EE5A8E' },
  cross: { fontFamily: fontFamily.fredokaBold, fontSize: 11, color: '#EE5A8E', lineHeight: 13 },
  results: { flex: 1, padding: 16, paddingBottom: 28, justifyContent: 'space-between' },
  standings: { gap: 8 },
  hold: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  standing: { fontFamily: fontFamily.bold, fontSize: 16, color: ink },
});
