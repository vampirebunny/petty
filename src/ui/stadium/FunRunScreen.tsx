import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Canvas, Picture, Skia } from '@shopify/react-native-skia';
import type { SkPicture } from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import { useSharedValue } from 'react-native-reanimated';

import { breedById, defaultLook, resolveBreed, spawnActor, todAt } from '../../actor';
import type { Actor, Breed } from '../../actor';
import { racePoses, setGallopStyle } from '../../actor/data/locomotion';
import type { GallopStyle } from '../../actor/data/locomotion';
import { freshPreview, stepPosePreview, stepRaceMotion } from '../../actor/raceDrive';
import type { PoseMode, PosePreview } from '../../actor/raceDrive';
import { skyAt, solarHour } from '../../actor/sky';
import { serverNow } from '../../db/accountMeta';
import { classLabel, eventLabel, formatCountdown } from '../../sim/stadium';
import type { PetState } from '../../sim/types';
import { fetchRace, submitRaceReport, type RaceView } from '../../stadium/api';
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
import { actorOf, breedOf, classOf, modsOf, placeSuffix } from './raceField';
import { useRaceCountdown } from './useRaceCountdown';
import { ink, shared } from './parts';

const legsPerMeter = racePoses.legsPerMeter * racePoses.funRunScroll;

type Props = {
  race: RaceView;
  pet: PetState;
  reducedMotion: boolean;
  onFinish: (place: number) => void;
  onExit: () => void;
};

type Standing = { key: string; name: string; finishMs: number | null; place: number | null; mine: boolean };

const bars = 8;
const previewBreeds = ['retriever', 'corgi', 'pug', 'dachshund', 'husky', 'domesticShorthair', 'siamese'] as const;
const previewAges = { puppy: 1, adult: 16, senior: 22 } as const;

export function FunRunScreen({ race, pet, reducedMotion, onFinish, onExit }: Props) {
  const [width, setWidth] = useState(0);
  const [finalRace, setFinalRace] = useState<RaceView | null>(null);
  const [provisional, setProvisional] = useState<Standing[] | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [frame, setFrame] = useState({ v: 0, tMs: 0, xs: {} as Record<string, number> });
  const taps = useRef<number[]>([]);
  const runners = useRef(new Map<string, RunnerState>());
  const actors = useRef(new Map<string, Actor>());
  const petRef = useRef(pet);
  const previewRef = useRef<PosePreview>(freshPreview());
  const previewModeRef = useRef<PoseMode>('off');
  const previewActor = useRef<Actor | null>(null);
  const previewBreed = useRef<Breed | null>(null);
  const [previewMode, setPreviewMode] = useState<PoseMode>('off');
  const [previewRate, setPreviewRate] = useState(1);
  const [previewBreedId, setPreviewBreedId] = useState<string>(pet.breedId);
  const [previewAge, setPreviewAge] = useState<keyof typeof previewAges>('adult');
  const [previewOutfit, setPreviewOutfit] = useState<'none' | 'boots' | 'hat'>('none');
  const [previewStyle, setPreviewStyle] = useState<GallopStyle>('flying');
  const [quiet, setQuiet] = useState(0);
  const [posesOpen, setPosesOpen] = useState(false);
  const stageHeight = Math.round(Math.min(320, Math.max(240, width * 0.72)));
  const [armedQuiet, setArmedQuiet] = useState<number | null>(null);
  const lastHaptic = useRef(0);
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
  const config = configFor(race.configVersion);
  const finished = provisional != null || finalRace?.status === 'finished';
  const { untilStart, going, beat, countLabel } = useRaceCountdown(race.startsAt, finished);
  const resultsReady = finished && armedQuiet === quiet;

  useEffect(() => {
    petRef.current = pet;
  }, [pet]);

  useEffect(() => {
    const found = breedById(previewBreedId) ?? breedById('retriever')!;
    const breed = resolveBreed(found, defaultLook(found));
    const equipped =
      previewOutfit === 'boots' ? { boots: 'rain', jacket: 'sweater' } : previewOutfit === 'hat' ? { hat: 'top', glasses: 'classic' } : {};
    previewBreed.current = breed;
    previewActor.current = spawnActor({
      id: 'preview',
      breedId: breed.id,
      ageDays: previewAges[previewAge],
      weight: 0,
      vitality: 1,
      equipped,
      look: defaultLook(found),
      asleep: false,
    });
    setGallopStyle(previewStyle);
  }, [previewAge, previewBreedId, previewOutfit, previewStyle]);

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
      let player: RunnerState | null = null;
      if (going) {
      const stepMs = 1000 / config.stepHz;
      for (const row of field) {
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
      if (player && (player.finishMs != null || player.tMs >= config.maxMs)) {
        const standings = field
          .map((row) => {
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
          void submitRaceReport(
            race.raceId,
            mineStanding?.finishMs ?? null,
            standings.filter((row) => !row.mine).map((row) => ({ entryId: row.key, finishMs: row.finishMs })),
          ).then((result) => {
            if (result.ok) grantRef.current(result.data);
          });
        }
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
        stepRaceMotion(actor, breed, runners.current.get(row.key)?.v ?? 0, dt, null, reducedMotion, legsPerMeter);
      }
      const preview = previewRef.current;
      if (preview.mode !== 'off' && previewActor.current && previewBreed.current) {
        stepPosePreview(previewActor.current, previewBreed.current, preview, dt, reducedMotion);
        if (preview.mode !== previewModeRef.current) {
          previewModeRef.current = preview.mode;
          setPreviewMode(preview.mode);
        }
      }
      const trackH = stageHeight;
      if (width > 0) {
        const showing = preview.mode !== 'off' && previewActor.current && previewBreed.current;
        const follow = mine ? (runners.current.get(mine.key)?.x ?? 0) : 0;
        const camera = showing ? preview.clock * 3 : follow;
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
        const racers = showing && previewActor.current && previewBreed.current
          ? [{ x: camera, name: 'Preview', mine: true, actor: previewActor.current, breed: previewBreed.current }]
          : field.map((row) => ({
              x: runners.current.get(row.key)?.x ?? 0,
              name: row.petName,
              mine: row.mine,
              actor: actors.current.get(row.key) ?? actorOf(row, livePet, breedOf(row, livePet)),
              breed: breedOf(row, livePet),
            }));
        drawRaceTrack(canvas, width, trackH, env, camera, racers, config.distanceM, legsPerMeter);
        picture.value = recorder.finishRecordingAsPicture();
      }
      const xs: Record<string, number> = {};
      for (const row of field) xs[row.key] = runners.current.get(row.key)?.x ?? 0;
      setFrame({ v: player?.v ?? 0, tMs: player?.tMs ?? 0, xs });
    };
    const timer = setInterval(tick, 50);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [config.distanceM, config.maxMs, config.stepHz, field, finished, going, mine, picture, race.classId, race.configVersion, race.raceId, race.seed, race.startsAt, reducedMotion, stageHeight, width]);

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

  const tap = () => {
    // Re-check the clock: `going` can lag the 50 ms render tick right at Go!.
    const at = serverNow();
    if (!raceInputOpen(at, race.startsAt, finished)) return;
    taps.current.push(at - race.startsAt);
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
        <View style={styles.barEnd}>
          {__DEV__ ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Pose preview" onPress={() => setPosesOpen((open) => !open)} style={styles.poses}>
              <Text style={styles.chipText}>Poses</Text>
            </Pressable>
          ) : null}
          <Text style={styles.timer}>{going ? formatCountdown(Math.max(0, frame.tMs)) : formatCountdown(Math.max(0, untilStart))}</Text>
        </View>
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
      {__DEV__ && posesOpen ? (
        <View style={styles.preview}>
          {(
            [
              ['gallop', 'Gallop'],
              ['leap', 'Leap'],
              ['stumble', 'Stumble'],
              ['loop', 'Loop'],
              ['off', 'Off'],
            ] as const
          ).map(([mode, label]) => (
            <Pressable
              key={mode}
              onPress={() => {
                previewRef.current = { mode, rate: previewRef.current.rate, clock: 0, landed: false };
                previewModeRef.current = mode;
                setPreviewMode(mode);
              }}
              style={[styles.chip, previewMode === mode && styles.chipOn]}
            >
              <Text style={styles.chipText}>{label}</Text>
            </Pressable>
          ))}
          {[1, 0.5, 0.25].map((rate) => (
            <Pressable
              key={rate}
              onPress={() => {
                previewRef.current.rate = rate;
                setPreviewRate(rate);
              }}
              style={[styles.chip, previewRate === rate && styles.chipOn]}
            >
              <Text style={styles.chipText}>{rate}×</Text>
            </Pressable>
          ))}
          <Pressable
            onPress={() => setPreviewBreedId(previewBreeds[(previewBreeds.indexOf(previewBreedId as (typeof previewBreeds)[number]) + 1) % previewBreeds.length] ?? 'retriever')}
            style={styles.chip}
          >
            <Text style={styles.chipText}>{previewBreedId}</Text>
          </Pressable>
          {(['puppy', 'adult', 'senior'] as const).map((age) => (
            <Pressable key={age} onPress={() => setPreviewAge(age)} style={[styles.chip, previewAge === age && styles.chipOn]}>
              <Text style={styles.chipText}>{age}</Text>
            </Pressable>
          ))}
          {(
            [
              ['none', 'Plain'],
              ['boots', 'Boots'],
              ['hat', 'Hat'],
            ] as const
          ).map(([outfit, label]) => (
            <Pressable key={outfit} onPress={() => setPreviewOutfit(outfit)} style={[styles.chip, previewOutfit === outfit && styles.chipOn]}>
              <Text style={styles.chipText}>{label}</Text>
            </Pressable>
          ))}
          <Pressable
            onPress={() => setPreviewStyle(previewStyle === 'flying' ? 'classic' : 'flying')}
            style={styles.chip}
          >
            <Text style={styles.chipText}>{previewStyle}</Text>
          </Pressable>
        </View>
      ) : null}
      <View style={[styles.stage, { height: stageHeight }]}>
        {width > 0 ? <Canvas style={styles.canvas}><Picture picture={picture} /></Canvas> : null}
      </View>
      {finished && standings ? (
        <View style={styles.results}>
          <View style={styles.standings}>
            <Text style={styles.title}>{minePlace === 1 ? `${pet.name} won!` : minePlace ? `${pet.name} placed ${minePlace}${placeSuffix(minePlace)}!` : 'Finish!'}</Text>
            {finalRace?.status === 'finished' ? null : <Text style={shared.copy}>Provisional</Text>}
            {standings.map((row, index) => (
              <Text key={row.key} style={styles.standing}>
                {row.place ?? index + 1}. {row.name}
                {row.mine ? ' · you' : ' · NPC'} {row.finishMs == null ? 'DNF' : `${(row.finishMs / 1000).toFixed(2)}s`}
              </Text>
            ))}
            <Text style={shared.copy}>Top tap speed shows on the next races. {classLabel(race.classId)}.</Text>
          </View>
          {resultsReady ? (
            <CandyButton role="go" label="Back to the Stadium" onPress={onExit} />
          ) : (
            <View style={styles.hold} onTouchStart={holdResults} />
          )}
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
  barEnd: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  poses: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 2, borderColor: ink, backgroundColor: '#fff' },
  title: { fontFamily: fontFamily.fredokaBold, fontSize: 26, color: ink },
  timer: { fontFamily: fontFamily.fredokaBold, fontSize: 22, color: ink },
  mini: { height: 28, marginHorizontal: 16, marginTop: 8, borderRadius: 8, backgroundColor: '#fff', borderWidth: 2, borderColor: ink },
  dot: { position: 'absolute', top: 6, width: 14, height: 14, borderRadius: 7, backgroundColor: '#CDB4F0', borderWidth: 2, borderColor: ink },
  dotMine: { backgroundColor: '#FF8FC0', width: 18, height: 18, borderRadius: 9, top: 4 },
  preview: { position: 'absolute', top: 96, left: 12, right: 12, zIndex: 2, flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 8, borderRadius: 12, backgroundColor: 'rgba(255,244,250,0.94)' },
  chip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 2, borderColor: ink, backgroundColor: '#fff' },
  chipOn: { backgroundColor: '#FFD0E6' },
  chipText: { fontFamily: fontFamily.bold, fontSize: 11, color: ink },
  stage: { marginTop: 8 },
  canvas: { flex: 1 },
  meter: { flexDirection: 'row', gap: 6 },
  barBit: { width: 18, height: 14, borderRadius: 4, backgroundColor: '#E7D7F2' },
  barOn: { backgroundColor: '#F0609F' },
  results: { flex: 1, padding: 16, paddingBottom: 28, justifyContent: 'space-between' },
  standings: { gap: 8 },
  hold: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  standing: { fontFamily: fontFamily.bold, fontSize: 16, color: ink },
});
