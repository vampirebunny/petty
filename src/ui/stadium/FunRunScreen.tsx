import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Canvas, Picture, Skia, useFont } from '@shopify/react-native-skia';
import type { SkPicture } from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import { useSharedValue } from 'react-native-reanimated';

import { todAt } from '../../actor';
import type { Actor } from '../../actor';
import { racePoses } from '../../actor/data/locomotion';
import { stepRaceMotion } from '../../actor/raceDrive';
import { skyAt, solarHour } from '../../actor/sky';
import { serverNow } from '../../db/accountMeta';
import { useCompetitionResult } from '../../analytics/race';
import { eventLabel, formatCountdown, raceTagLabel } from '../../sim/stadium';
import type { PetState } from '../../sim/types';
import { fetchRace, submitRaceReport, type RaceView } from '../../stadium/api';
import { liveFinish, liveStateOf, raceSyncConfig, sampleLive } from '../../stadium/liveTrack';
import { deliverRaceReport, funRunLog } from '../../stadium/raceReport';
import { useRaceSync } from '../../stadium/raceSync';
import {
  coastRunner,
  configFor,
  createRunner,
  runFunRun,
  stepRunner,
  type Modifiers,
  type RunnerState,
} from '../../../supabase/functions/_shared/race-sim/index.ts';
import type { Env } from '../skia/env';
import { drawRaceTrack } from '../skia/raceTrack';
import { fontFamily } from '../font';
import { CandyButton } from './CandyButton';
import { RaceAction } from './RaceAction';
import { raceInputOpen } from './raceCountdown';
import { actorOf, breedOf, classOf, modsOf, placeSuffix, raceLabelFont, raceLabelSize } from './raceField';
import { useRaceCountdown } from './useRaceCountdown';
import { useRaceLoop } from './useRaceLoop';
import { ReadyBars, ink, shared } from './parts';

const legsPerMeter = racePoses.legsPerMeter * racePoses.funRunScroll;

type Props = {
  race: RaceView;
  pet: PetState;
  reducedMotion: boolean;
  onFinish: (place: number) => void;
  onSpend: () => void;
  onExit: () => void;
};

type Standing = { key: string; name: string; finishMs: number | null; place: number | null; mine: boolean };

const bars = 8;

export function FunRunScreen({ race, pet, reducedMotion, onFinish, onSpend, onExit }: Props) {
  const [width, setWidth] = useState(0);
  const [finalRace, setFinalRace] = useState<RaceView | null>(null);
  const [provisional, setProvisional] = useState<Standing[] | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [frame, setFrame] = useState({ v: 0, tMs: 0, xs: {} as Record<string, number> });
  const taps = useRef<number[]>([]);
  const runners = useRef(new Map<string, RunnerState>());
  const actors = useRef(new Map<string, Actor>());
  const petRef = useRef(pet);
  const [quiet, setQuiet] = useState(0);
  const stageHeight = Math.round(Math.min(320, Math.max(240, width * 0.72)));
  const [armedQuiet, setArmedQuiet] = useState<number | null>(null);
  const lastHaptic = useRef(0);
  const uiAt = useRef(0);
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
  if (!playerMods.current) playerMods.current = modsOf(mine, pet);
  const live = lineup.players.length > 1;
  const { remotes, send } = useRaceSync(race.raceId, live);
  const stale = useRef(new Set<string>());
  const labelFont = useFont(raceLabelFont, raceLabelSize);
  const config = configFor(race.configVersion);
  const finished = provisional != null || finalRace?.status === 'finished';
  const { untilStart, going, beat, countLabel } = useRaceCountdown(race.startsAt, finished);
  const resultsReady = finished && armedQuiet === quiet;

  useEffect(() => {
    petRef.current = pet;
  }, [pet]);

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
      let player: RunnerState | null = null;
      if (going) {
      const stepMs = 1000 / config.stepHz;
      for (const row of field) {
        if (!row.mine && !row.npc) {
          const view = sampleLive(remotes.current.get(row.key), elapsed - raceSyncConfig.interpDelayMs, Date.now());
          if (view?.stale) stale.current.add(row.key);
          else stale.current.delete(row.key);
          const remote = runners.current.get(row.key) ?? createRunner();
          remote.x = view?.x ?? 0;
          remote.v = view?.v ?? 0;
          remote.tMs = view?.t ?? 0;
          remote.finishMs = view?.finishMs ?? null;
          runners.current.set(row.key, remote);
          continue;
        }
        const state = runners.current.get(row.key) ?? createRunner();
        runners.current.set(row.key, state);
        const npc = row.npc
          ? { classId: classOf(race.classId), skill: row.skill ?? 0.5, seed: `${race.seed}:${row.key}` }
          : null;
        while (state.tMs < Math.min(elapsed, config.maxMs + 20000)) {
          if (state.finishMs == null) {
            if (state.tMs >= config.maxMs) break;
            const next = state.tMs + stepMs;
            const due = row.mine ? taps.current.filter((tap) => tap >= state.tMs && tap < next) : [];
            if (row.mine && !playerMods.current) {
              playerMods.current = modsOf(row, petRef.current);
            }
            stepRunner(state, due, row.mine && playerMods.current ? playerMods.current : modsOf(row, null), npc, race.configVersion);
          } else {
            const before = state.tMs;
            coastRunner(state, stepMs, config.distanceM);
            if (state.tMs === before) break;
          }
        }
      }
      player = mine ? runners.current.get(mine.key) ?? null : null;
      if (live && mine && player) send(liveStateOf(mine.key, player));
      if (player && (player.finishMs != null || player.tMs >= config.maxMs)) {
        const standings = field
          .map((row) => {
            if (!row.mine && !row.npc) {
              return { key: row.key, name: row.petName, finishMs: liveFinish(remotes.current.get(row.key)), place: null, mine: false };
            }
            const spec = row.npc
              ? { classId: classOf(race.classId), skill: row.skill ?? 0.5, seed: `${race.seed}:${row.key}` }
              : null;
            const result = runFunRun(row.mine ? taps.current : [], row.mine && playerMods.current ? playerMods.current : modsOf(row, null), spec, race.configVersion);
            return { key: row.key, name: row.petName, finishMs: result.finishMs, place: null, mine: row.mine };
          })
          .sort((a, b) => (a.finishMs ?? 1e9) - (b.finishMs ?? 1e9));
        if (!sent.current) {
          sent.current = true;
          setWaiting(true);
          setProvisional(standings);
          const mineStanding = standings.find((row) => row.mine);
          const log = funRunLog(taps.current);
          void deliverRaceReport(
            race.raceId,
            () => submitRaceReport(race.raceId, mineStanding?.finishMs ?? null, log),
            (view) => grantRef.current(view),
          );
        }
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
        stepRaceMotion(actor, breed, runners.current.get(row.key)?.v ?? 0, dt, null, reducedMotion, legsPerMeter);
      }
      const trackH = stageHeight;
      if (width > 0) {
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
        const racers = field.map((row) => ({
          x: runners.current.get(row.key)?.x ?? 0,
          name: row.petName,
          mine: row.mine,
          stale: stale.current.has(row.key),
          actor: actors.current.get(row.key) ?? actorOf(row, livePet, breedOf(row, livePet)),
          breed: breedOf(row, livePet),
        }));
        drawRaceTrack(canvas, width, trackH, env, follow, racers, config.distanceM, legsPerMeter, labelFont);
        picture.value = recorder.finishRecordingAsPicture();
      }
      const now = Date.now();
      if (now - uiAt.current >= 1000 / raceSyncConfig.uiHz) {
        uiAt.current = now;
        const xs: Record<string, number> = {};
        for (const row of field) xs[row.key] = runners.current.get(row.key)?.x ?? 0;
        setFrame({ v: player?.v ?? 0, tMs: player?.tMs ?? 0, xs });
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

  const filled = Math.round((frame.v / config.topSpeed) * bars);
  const standings = finalRace
    ? [...finalRace.players, ...finalRace.npcs]
        .map((row) => ({ key: row.key, name: row.petName, finishMs: row.finishMs, place: row.place, mine: row.mine }))
        .sort((a, b) => (a.place ?? 99) - (b.place ?? 99))
    : provisional;
  const minePlace = standings?.find((row) => row.mine)?.place;
  useCompetitionResult(race, resultsReady, minePlace ?? undefined);

  const tap = () => {
    // Re-check the clock: `going` can lag the 50 ms render tick right at Go!.
    const at = serverNow();
    if (!raceInputOpen(at, race.startsAt, finished)) return;
    // The live sim can run up to one step past `at`. Stamp the tap no earlier than the
    // step it lands in, or the scene skips it while the replay and the results count it.
    const simMs = mine ? (runners.current.get(mine.key)?.tMs ?? 0) : 0;
    taps.current.push(Math.max(at - race.startsAt, simMs));
    onSpend();
    const local = Date.now();
    if (local - lastHaptic.current < 50) return;
    lastHaptic.current = local;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const holdResults = () => {
    setQuiet((value) => value + 1);
  };

  return (
    <View style={styles.root} onLayout={(event) => setWidth(Math.round(event.nativeEvent.layout.width))}>
      <View style={styles.bar}>
        <Text style={styles.title}>{eventLabel(race.event)}</Text>
        <Text style={styles.timer}>{going ? formatCountdown(Math.max(0, frame.tMs)) : formatCountdown(Math.max(0, untilStart))}</Text>
      </View>
      <View style={styles.mini}>
        {field.map((row) => (
          <View
            key={row.key}
            style={[
              styles.dot,
              row.mine && styles.dotMine,
              { left: `${Math.min(100, ((frame.xs[row.key] ?? 0) / config.distanceM) * 100)}%` },
            ]}
          />
        ))}
      </View>
      <View style={styles.readiness}>
        <ReadyBars
          stacked
          energy={pet.needs.energy}
          mood={pet.needs.happiness}
          hydration={pet.hydration}
          energyLabel={`${pet.name}'s energy`}
          moodLabel={`${pet.name}'s mood`}
          hydrationLabel={`${pet.name}'s hydration`}
        />
      </View>
      <View style={[styles.stage, { height: stageHeight }]}>
        {width > 0 ? <Canvas style={styles.canvas}><Picture picture={picture} /></Canvas> : null}
      </View>
      {finished && standings ? (
        <View style={styles.results}>
          <ScrollView style={styles.resultsScroll} contentContainerStyle={styles.standings} showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>{minePlace === 1 ? `${pet.name} won!` : minePlace ? `${pet.name} placed ${minePlace}${placeSuffix(minePlace)}!` : 'Finish!'}</Text>
            {finalRace?.status === 'finished' ? null : <Text style={shared.copy}>Provisional</Text>}
            {standings.map((row, index) => (
              <Text key={row.key} style={styles.standing}>
                {row.place ?? index + 1}. {row.name}
                {row.mine ? ' · you' : ' · NPC'} {row.finishMs == null ? 'DNF' : `${(row.finishMs / 1000).toFixed(2)}s`}
              </Text>
            ))}
            <Text style={shared.copy}>Top tap speed shows on the next races. {raceTagLabel(race)}.</Text>
          </ScrollView>
          {resultsReady ? <CandyButton role="go" label="Back to the Stadium" onPress={onExit} /> : null}
          {resultsReady ? null : <View style={styles.hold} onTouchStart={holdResults} />}
        </View>
      ) : (
        <RaceAction
          going={going}
          beat={beat}
          countLabel={countLabel}
          activeLabel="TAP!"
          tone="tap"
          hint={going ? 'Tap as fast as you can' : 'Tapping starts at Go!'}
          accessibilityLabel="Tap to run"
          onActivate={tap}
        >
          <View style={styles.meter}>
            {Array.from({ length: bars }, (_, index) => (
              <View key={index} style={[styles.barBit, index < filled && styles.barOn]} />
            ))}
          </View>
        </RaceAction>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFF4FA' },
  bar: { paddingTop: 54, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontFamily: fontFamily.fredokaBold, fontSize: 26, color: ink },
  timer: { fontFamily: fontFamily.fredokaBold, fontSize: 22, color: ink },
  mini: { height: 28, marginHorizontal: 16, marginTop: 8, borderRadius: 8, backgroundColor: '#fff', borderWidth: 2, borderColor: ink },
  readiness: { marginHorizontal: 16, marginTop: 10 },
  dot: { position: 'absolute', top: 6, width: 14, height: 14, borderRadius: 7, backgroundColor: '#CDB4F0', borderWidth: 2, borderColor: ink },
  dotMine: { backgroundColor: '#FF8FC0', width: 18, height: 18, borderRadius: 9, top: 4 },
  stage: { marginTop: 8 },
  canvas: { flex: 1 },
  meter: { flexDirection: 'row', gap: 6 },
  barBit: { width: 18, height: 14, borderRadius: 4, backgroundColor: '#E7D7F2' },
  barOn: { backgroundColor: '#F0609F' },
  results: { flex: 1, minHeight: 0, padding: 16, paddingBottom: 28, gap: 12 },
  resultsScroll: { flex: 1 },
  standings: { gap: 8 },
  hold: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  standing: { fontFamily: fontFamily.bold, fontSize: 16, color: ink },
});
