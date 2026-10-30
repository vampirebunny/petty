import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChevronLeft, Flag, WifiOff } from 'lucide-react-native';

import { serverNow } from '../db/accountMeta';
import { pushPetBeforeRead } from '../sync/queue';
import { askRaceReminderPermission, cancelRaceCall } from '../reminders/notifications';
import { fetchBoard, signUpFor, withdrawEntry, type RaceView, type StadiumBoard, type StadiumCard, type StadiumSlot } from '../stadium/api';
import { gameplayConfig } from '../sim/gameplayConfig';
import { applyRaceRewards } from '../sim/raceRewards';
import { classForLevel, dropEndedSignup, eventLabel, isPlayableEvent, racesOf, skillBlock, withSignup, type RaceSignup, type SkillBlock } from '../sim/stadium';
import type { PetState } from '../sim/types';
import { fontFamily } from '../ui/font';
import { FunModal } from '../ui/FunModal';
import { CandyButton } from '../ui/stadium/CandyButton';
import { Lobby } from '../ui/stadium/Lobby';
import { PetChip, ReadyBars, Toast, ink, pageFill, shared, softInk } from '../ui/stadium/parts';
import { FunRunScreen } from '../ui/stadium/FunRunScreen';
import { HurdlesScreen } from '../ui/stadium/HurdlesScreen';
import { RacePlaceholder } from '../ui/stadium/RacePlaceholder';
import { SignUpSheet } from '../ui/stadium/SignUpSheet';
import { StadiumHeader } from '../ui/stadium/StadiumHeader';
import { StartingGate, type GateExit } from '../ui/stadium/StartingGate';
import { Ticket } from '../ui/stadium/Ticket';
import { iconStroke } from '../ui/theme';

type Props = {
  pet: PetState;
  reducedMotion: boolean;
  /** Open straight onto the starting gate (race call or notification). */
  openGate: boolean;
  moodTreats: number;
  onClose: () => void;
  onCommit: (pet: PetState) => void;
  onTrain: () => void;
  onPlay: () => void;
  onMoodTreat: () => void;
  onShop: () => void;
  onAtGate: (atGate: boolean) => void;
};

type Screen = 'loading' | 'lobby' | 'ticket' | 'gate' | 'race';
type Status = 'ok' | 'offline' | 'error';

const statusTop = 48;

function failureCopy(reason: string, name: string): string {
  if (reason.includes('busy')) return `${name} is already in a race.`;
  if (reason.includes('resting')) return `${name} needs a short rest before this race.`;
  if (reason.includes('closed')) return 'That race just closed. Try the next one.';
  if (reason.includes('missing_trick')) return `${name} needs a new trick for this race.`;
  if (reason.includes('locked')) return 'The line-up is locked now.';
  if (reason.includes('pet not synced')) return `${name} hasn't reached the Stadium yet. Try again in a moment.`;
  if (reason.includes('not authenticated')) return 'Sign in to race at the Stadium.';
  if (reason.includes('not_active')) return `${name} is active on another device.`;
  if (reason === 'name') return "The Stadium can't use that name.";
  if (reason.includes('owner mismatch')) return `${name} hasn't reached the Stadium yet. Try again in a moment.`;
  if (reason.includes('retired')) return `${name} has already been retired.`;
  const short = reason.replace(/\s+/g, ' ').trim();
  if (short.length > 0 && short.length <= 160) return short;
  return 'Something went wrong. Try again in a moment.';
}

export function StadiumScreen({ pet, reducedMotion, openGate, moodTreats, onClose, onCommit, onTrain, onPlay, onMoodTreat, onShop, onAtGate }: Props) {
  const [now, setNow] = useState(() => serverNow());
  const [board, setBoard] = useState<StadiumBoard | null>(null);
  const [status, setStatus] = useState<Status>('ok');
  const [screen, setScreen] = useState<Screen>(() => (openGate && racesOf(pet).signup ? 'gate' : 'loading'));
  const [gateSignup, setGateSignup] = useState<RaceSignup | null>(() => (openGate ? racesOf(pet).signup : null));
  const [slotId, setSlotId] = useState<number | null>(null);
  const [sheet, setSheet] = useState<{ card: StadiumCard; slot: StadiumSlot } | null>(null);
  const [block, setBlock] = useState<SkillBlock | null>(null);
  const [race, setRace] = useState<RaceView | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [boardReason, setBoardReason] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [width, setWidth] = useState(0);
  const petRef = useRef(pet);
  const commitRef = useRef(onCommit);
  const boardRef = useRef(board);
  const screenRef = useRef(screen);
  const atGateRef = useRef(onAtGate);

  useEffect(() => {
    petRef.current = pet;
    commitRef.current = onCommit;
    boardRef.current = board;
    screenRef.current = screen;
    atGateRef.current = onAtGate;
  }, [board, onAtGate, onCommit, pet, screen]);

  const signup = racesOf(pet).signup;

  const load = useCallback(async () => {
    let result = await fetchBoard(petRef.current.id);
    if (!result.ok && result.reason.includes('pet not synced')) {
      const pushed = await pushPetBeforeRead(petRef.current);
      if (pushed.pet !== petRef.current) {
        petRef.current = pushed.pet;
        commitRef.current(pushed.pet);
      }
      result = pushed.reason
        ? { ok: false, offline: false, reason: pushed.reason }
        : await fetchBoard(pushed.pet.id);
    }
    if (!result.ok) {
      setBoardReason(result.reason);
      setStatus(result.offline ? 'offline' : 'error');
      if (screenRef.current === 'loading') {
        setScreen('lobby');
      }
      return;
    }
    setBoardReason(null);
    const next = result.data;
    setStatus('ok');
    setBoard(next);
    const current = petRef.current;
    const local = racesOf(current).signup;
    if (local?.entryId !== next.activeEntry?.entryId) {
      commitRef.current(withSignup(current, next.activeEntry, serverNow()));
    }
    if (screenRef.current === 'loading') {
      setScreen(next.activeEntry ? 'ticket' : 'lobby');
    }
  }, []);

  useEffect(() => {
    let tick = 0;
    void load();
    const timer = setInterval(() => {
      const at = serverNow();
      setNow(at);
      tick += 1;
      const first = boardRef.current?.slots[0];
      const rolled = first != null && at >= first.startsAt;
      if (rolled || tick % Math.round(gameplayConfig.races.boardRefreshMs / 1000) === 0) {
        void load();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    atGateRef.current(screen === 'gate');
  }, [screen]);

  useEffect(() => {
    const ref = atGateRef;
    return () => ref.current(false);
  }, []);

  const hideToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    const dropped = dropEndedSignup(pet, serverNow());
    if (dropped !== pet) {
      commitRef.current(dropped);
    }
  }, [pet]);

  const slots = board?.slots ?? [];
  const selected = slots.find((slot) => slot.id === slotId) ?? slots[0] ?? null;
  const classId = board?.classId ?? classForLevel(pet.level);

  const clearSignup = () => {
    const current = petRef.current;
    if (racesOf(current).signup) {
      commitRef.current(withSignup(current, null, serverNow()));
    }
  };

  const onCard = (card: StadiumCard, slot: StadiumSlot) => {
    if (card.state === 'open') {
      setSheet({ card, slot });
      return;
    }
    if (card.state === 'entered') {
      setScreen('ticket');
      return;
    }
    if (card.state === 'missing_trick') {
      setBlock(skillBlock(pet, card.event));
      return;
    }
    if (card.state === 'busy') {
      setToast('One race at a time.');
    }
  };

  const signUp = async () => {
    if (!sheet || busy) {
      return;
    }
    setBusy(true);
    if (!racesOf(petRef.current).entered) {
      await askRaceReminderPermission();
    }
    const result = await signUpFor(petRef.current.id, sheet.card.id);
    setBusy(false);
    if (!result.ok) {
      if (result.offline) {
        setStatus('offline');
      } else {
        setToast(failureCopy(result.reason, pet.name));
      }
      setSheet(null);
      void load();
      return;
    }
    commitRef.current(withSignup(petRef.current, result.data, serverNow()));
    setSheet(null);
    setScreen('ticket');
    void load();
  };

  const withdraw = async (entry: RaceSignup | null) => {
    if (!entry || busy) {
      return;
    }
    setBusy(true);
    const result = await withdrawEntry(entry.entryId);
    setBusy(false);
    if (!result.ok) {
      setToast(result.offline ? 'The Stadium needs internet to race.' : failureCopy(result.reason, pet.name));
      return;
    }
    void cancelRaceCall();
    clearSignup();
    setGateSignup(null);
    setToast(`You've withdrawn from ${eventLabel(entry.event)}`);
    setScreen('lobby');
    void load();
  };

  const goGate = () => {
    setGateSignup(signup);
    setScreen('gate');
  };

  const leaveGate = (why: GateExit) => {
    clearSignup();
    setGateSignup(null);
    if (why === 'noShow') {
      setToast('The race started without you. Catch the next one!');
    }
    setScreen('lobby');
    void load();
  };

  const startRace = (view: RaceView) => {
    clearSignup();
    setRace(view);
    setScreen('race');
  };

  const othersInSlot = (entry: RaceSignup): StadiumCard[] => {
    const slot = slots.find((item) => item.startsAt === entry.startsAt);
    return slot ? slot.events.filter((card) => card.id !== entry.eventId) : [];
  };

  const offline = status === 'offline' && screen !== 'gate' && screen !== 'race';
  const activeGate = screen === 'gate' ? (gateSignup ?? signup) : null;

  if (screen === 'race' && race && isPlayableEvent(race.event)) {
    const RaceScreen = race.event === 'hurdles' ? HurdlesScreen : FunRunScreen;
    return (
      <RaceScreen
        key={race.raceId}
        race={race}
        pet={pet}
        reducedMotion={reducedMotion}
        onFinish={(place) => {
          commitRef.current(
            applyRaceRewards(
              petRef.current,
              { raceId: race.raceId, event: race.event, classId: race.classId, place, at: serverNow() },
              serverNow(),
            ),
          );
        }}
        onExit={() => {
          setRace(null);
          setScreen('lobby');
          void load();
        }}
      />
    );
  }

  return (
    <View style={styles.root} onLayout={(event) => setWidth(Math.round(event.nativeEvent.layout.width))}>
      <ScrollView contentContainerStyle={styles.scroll} bounces={false}>
        <View>
          {width > 0 ? <StadiumHeader width={width} top={statusTop} nextStart={slots[0]?.startsAt ?? null} reducedMotion={reducedMotion} /> : null}
          <View style={styles.headerBar}>
            <Pressable accessibilityRole="button" accessibilityLabel="Back to the map" onPress={onClose} style={styles.back}>
              <ChevronLeft size={22} strokeWidth={iconStroke + 1} color={ink} />
            </Pressable>
            <PetChip name={pet.name} level={pet.level} classId={classId} />
          </View>
        </View>

        <View style={styles.body}>
          {offline ? (
            <View style={[shared.card, styles.offline]}>
              <WifiOff size={28} color={softInk} strokeWidth={iconStroke + 0.5} />
              <Text style={styles.offlineTitle}>The Stadium needs internet to race</Text>
              <Text style={[shared.copy, styles.center]}>Everything else keeps working. Come back when you&apos;re online.</Text>
              <CandyButton role="go" label="Try again" onPress={() => void load()} />
              <CandyButton role="secondary" label="Back to the map" onPress={onClose} />
            </View>
          ) : screen === 'loading' ? (
            <Text style={[shared.copy, styles.center]}>Checking the race board…</Text>
          ) : screen === 'gate' && activeGate ? (
            <StartingGate
              signup={activeGate}
              petName={pet.name}
              now={now}
              withdrawing={busy}
              onWithdraw={() => void withdraw(activeGate)}
              onRace={startRace}
              onExit={leaveGate}
            />
          ) : screen === 'race' && race ? (
            <RacePlaceholder
              race={race}
              onBack={() => {
                setRace(null);
                setScreen('lobby');
                void load();
              }}
            />
          ) : screen === 'ticket' && signup ? (
            <Ticket
              signup={signup}
              petName={pet.name}
              energy={pet.needs.energy}
              mood={pet.needs.happiness}
              moodTreats={moodTreats}
              now={now}
              others={othersInSlot(signup)}
              withdrawing={busy}
              onGate={goGate}
              onPlay={onPlay}
              onWaitElsewhere={onClose}
              onMoodTreat={onMoodTreat}
              onShop={onShop}
              onWithdraw={() => void withdraw(signup)}
            />
          ) : board ? (
            <>
              {status === 'error' ? <Text style={[shared.copy, styles.center]}>The race board is catching up. Try again in a moment.</Text> : null}
              <View style={shared.card}>
                <ReadyBars energy={pet.needs.energy} mood={pet.needs.happiness} />
              </View>
              <Lobby
                board={board}
                now={now}
                selected={selected}
                onSelect={(slot) => setSlotId(slot.id)}
                onCard={onCard}
                onFriends={() => setToast('Racing with friends is coming soon.')}
              />
              {signup ? <CandyButton role="go" label="See your ticket" onPress={() => setScreen('ticket')} /> : null}
            </>
          ) : (
            <View style={[shared.card, styles.offline]}>
              <Text style={[shared.copy, styles.center]}>{failureCopy(boardReason ?? 'pet not synced', pet.name)}</Text>
              <CandyButton role="go" label="Try again" onPress={() => void load()} />
            </View>
          )}
        </View>
      </ScrollView>

      {sheet && board ? (
        <SignUpSheet
          card={sheet.card}
          slot={sheet.slot}
          classId={classId}
          capacity={board.capacity}
          petName={pet.name}
          energy={pet.needs.energy}
          mood={pet.needs.happiness}
          now={now}
          busy={busy}
          onSignUp={() => void signUp()}
          onClose={() => setSheet(null)}
        />
      ) : null}

      {block ? (
        <FunModal
          title={block.trickName}
          body={
            block.reason === 'age'
              ? `${block.trickName} unlocks when ${pet.name} is older, at the ${block.stageLabel} stage. The Fun Run and Fetch & Swat are open now.`
              : `${pet.name} needs to learn ${block.trickName} for this race.`
          }
          icon={Flag}
          tint="lilac"
          reducedMotion={reducedMotion}
          primary={block.reason === 'now' ? { label: 'Training School', onPress: onTrain, closeFirst: true } : { label: 'OK', onPress: () => setBlock(null) }}
          secondary={block.reason === 'now' ? { label: 'Not now', onPress: () => setBlock(null) } : undefined}
        />
      ) : null}

      {toast ? <Toast message={toast} reducedMotion={reducedMotion} onDone={hideToast} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: pageFill,
  },
  scroll: {
    paddingBottom: 48,
  },
  headerBar: {
    position: 'absolute',
    top: statusTop + 4,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    padding: 16,
    gap: 14,
  },
  offline: {
    alignItems: 'center',
    gap: 10,
  },
  offlineTitle: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 18,
    color: ink,
    textAlign: 'center',
  },
  center: {
    textAlign: 'center',
  },
});
