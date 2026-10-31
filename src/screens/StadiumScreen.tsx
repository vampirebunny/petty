import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { ChevronLeft, Flag, Users, WifiOff } from 'lucide-react-native';

import { readAccountLinked, serverNow } from '../db/accountMeta';
import { track, trackScreen } from '../analytics/analytics';
import { pushPetBeforeRead } from '../sync/queue';
import { askRaceReminderPermission, cancelRaceCall } from '../reminders/notifications';
import { fetchBoard, signUpFor, withdrawEntry, type RaceView, type StadiumBoard, type StadiumCard, type StadiumSlot } from '../stadium/api';
import {
  conflictCopy,
  createFriendGame,
  friendGameErrorCopy,
  leaveFriendGame,
  type FriendGameConflict,
  type FriendGameEvent,
  type FriendGameState,
} from '../stadium/friendGames';
import { gameplayConfig } from '../sim/gameplayConfig';
import { applyFriendRaceResult, applyRaceRewards, noteFriendGameStarted } from '../sim/raceRewards';
import { classForEvent, classForLevel, dropEndedSignup, eventLabel, isPlayableEvent, racesOf, skillBlock, withSignup, type RaceSignup, type SkillBlock } from '../sim/stadium';
import type { PetState } from '../sim/types';
import { fontFamily } from '../ui/font';
import { FitScale } from '../ui/FitScale';
import { STADIUM_STAGE } from '../ui/skia/stadium';
import { isLandscapeSplit, phoneColumnWidth } from '../ui/wideLayout';
import { FunModal } from '../ui/FunModal';
import { CandyButton } from '../ui/stadium/CandyButton';
import { Lobby } from '../ui/stadium/Lobby';
import { PetChip, ReadyBars, Toast, ink, pageFill, shared, softInk } from '../ui/stadium/parts';
import { DockDiveScreen } from '../ui/stadium/DockDiveScreen';
import { FunRunScreen } from '../ui/stadium/FunRunScreen';
import { HurdlesScreen } from '../ui/stadium/HurdlesScreen';
import { ObstacleScreen } from '../ui/stadium/ObstacleScreen';
import { RacePlaceholder } from '../ui/stadium/RacePlaceholder';
import { SignUpSheet } from '../ui/stadium/SignUpSheet';
import { StadiumHeader } from '../ui/stadium/StadiumHeader';
import { StartingGate, type GateExit } from '../ui/stadium/StartingGate';
import { Ticket } from '../ui/stadium/Ticket';
import { FriendGameSetup } from '../ui/stadium/FriendGameSetup';
import { NpcCalibrationStadium } from '../ui/stadium/NpcCalibrationDebug';
import { FriendRoom, type FriendRoomExit } from '../ui/stadium/FriendRoom';
import { AccountSheet } from '../ui/AccountSheet';
import { iconStroke } from '../ui/theme';

type Props = {
  pet: PetState;
  reducedMotion: boolean;
  /** Open straight onto the starting gate (race call or notification). */
  openGate: boolean;
  /** Open straight into this friend game's waiting room (an accepted invite). */
  openFriendGame?: string | null;
  moodTreats: number;
  onClose: () => void;
  onCommit: (pet: PetState) => void;
  onTrain: () => void;
  onPlay: () => void;
  onMoodTreat: () => void;
  onShop: () => void;
  onAtGate: (atGate: boolean) => void;
};

type Screen = 'loading' | 'lobby' | 'ticket' | 'gate' | 'race' | 'friendSetup' | 'friendRoom';

type FriendAsk = { event: FriendGameEvent; delayMin: number; invitees: string[]; conflict: FriendGameConflict };

function friendExitCopy(exit: FriendRoomExit): string {
  if (exit.why === 'cancelled') {
    return exit.byHost && exit.hostHandle
      ? `@${exit.hostHandle} cancelled the game.`
      : 'Not enough friends joined in time, so the game was cancelled.';
  }
  if (exit.why === 'lockedOut') return 'The friend game started without you.';
  if (exit.why === 'ended') return 'That friend game already finished.';
  return 'This friend game is no longer open.';
}
type Status = 'ok' | 'offline' | 'error';

const statusTop = 48;

function stadiumArtWidth(paneW: number, paneH: number, top: number): number {
  const ratio = STADIUM_STAGE.h / STADIUM_STAGE.w;
  const byHeight = Math.max(1, (paneH - top) / ratio);
  return Math.max(1, Math.min(paneW, byHeight));
}

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

export function StadiumScreen({
  pet,
  reducedMotion,
  openGate,
  openFriendGame = null,
  moodTreats,
  onClose,
  onCommit,
  onTrain,
  onPlay,
  onMoodTreat,
  onShop,
  onAtGate,
}: Props) {
  const [now, setNow] = useState(() => serverNow());
  const [board, setBoard] = useState<StadiumBoard | null>(null);
  const [status, setStatus] = useState<Status>('ok');
  const [screen, setScreen] = useState<Screen>(() =>
    openFriendGame ? 'friendRoom' : openGate && racesOf(pet).signup ? 'gate' : 'loading',
  );
  const [friendRaceId, setFriendRaceId] = useState<string | null>(openFriendGame);
  const [friendAsk, setFriendAsk] = useState<FriendAsk | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [gateSignup, setGateSignup] = useState<RaceSignup | null>(() => (openGate ? racesOf(pet).signup : null));
  const [slotId, setSlotId] = useState<number | null>(null);
  const [sheet, setSheet] = useState<{ card: StadiumCard; slot: StadiumSlot } | null>(null);
  const [block, setBlock] = useState<SkillBlock | null>(null);
  const [race, setRace] = useState<RaceView | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [boardReason, setBoardReason] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [width, setWidth] = useState(0);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const split = isLandscapeSplit(windowWidth, windowHeight);
  const [pane, setPane] = useState<{ width: number; height: number } | null>(null);
  const petRef = useRef(pet);
  const loadGen = useRef(0);
  const commitRef = useRef(onCommit);
  const boardRef = useRef(board);
  const screenRef = useRef(screen);
  const atGateRef = useRef(onAtGate);

  useEffect(() => {
    if (screen === 'gate' || screen === 'race') {
      trackScreen('race');
      return;
    }
    if (screen !== 'loading') {
      trackScreen('stadium');
    }
  }, [screen]);
  useEffect(() => {
    petRef.current = pet;
    commitRef.current = onCommit;
    boardRef.current = board;
    screenRef.current = screen;
    atGateRef.current = onAtGate;
  }, [board, onAtGate, onCommit, pet, screen]);

  const signup = racesOf(pet).signup;

  const load = useCallback(async () => {
    const gen = ++loadGen.current;
    let result = await fetchBoard(petRef.current.id);
    if (gen !== loadGen.current) return;
    if (!result.ok && result.reason.includes('pet not synced')) {
      const pushed = await pushPetBeforeRead(petRef.current);
      if (gen !== loadGen.current) return;
      if (pushed.pet !== petRef.current) {
        petRef.current = pushed.pet;
        commitRef.current(pushed.pet);
      }
      result = pushed.reason
        ? { ok: false, offline: false, reason: pushed.reason }
        : await fetchBoard(pushed.pet.id);
      if (gen !== loadGen.current) return;
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
    atGateRef.current(screen === 'gate' || screen === 'race' || screen === 'friendRoom');
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
      const blocked = skillBlock(pet, card.event);
      setBlock(blocked);
      if (blocked) {
        track('competition_blocked', { type: card.event, missing_trick: blocked.trickId });
      }
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
    track('competition_enter', {
      type: view.event,
      class: view.classId,
      cup: view.cup,
      live_players: view.players.length,
    });
    clearSignup();
    setRace(view);
    setScreen('race');
  };

  const openFriends = () => {
    if (!readAccountLinked()) {
      setAccountOpen(true);
      return;
    }
    if (board?.friendGameRaceId) {
      setFriendRaceId(board.friendGameRaceId);
      setScreen('friendRoom');
      return;
    }
    setScreen('friendSetup');
  };

  const sendInvites = async (event: FriendGameEvent, delayMin: number, invitees: string[], replace: boolean) => {
    if (busy) {
      return;
    }
    setBusy(true);
    let result = await createFriendGame(petRef.current.id, event, delayMin, invitees, replace);
    if (!result.ok && /pet not synced/i.test(result.error)) {
      const pushed = await pushPetBeforeRead(petRef.current);
      if (pushed.pet !== petRef.current) {
        petRef.current = pushed.pet;
        commitRef.current(pushed.pet);
      }
      if (!pushed.reason) {
        result = await createFriendGame(pushed.pet.id, event, delayMin, invitees, replace);
      }
    }
    setBusy(false);
    if (!result.ok) {
      if ('conflict' in result) {
        setFriendAsk({ event, delayMin, invitees, conflict: result.conflict });
        return;
      }
      setFriendAsk(null);
      setToast(friendGameErrorCopy(result.error));
      return;
    }
    if (replace && friendAsk && friendAsk.conflict.cup !== 'friends') {
      void cancelRaceCall();
      clearSignup();
    }
    setFriendAsk(null);
    commitRef.current(noteFriendGameStarted(petRef.current, Date.now()));
    setFriendRaceId(result.data.raceId);
    setScreen('friendRoom');
    void load();
  };

  const leaveFriend = async (game: FriendGameState | null, confirmed: boolean) => {
    if (!friendRaceId || busy) {
      return;
    }
    if (game?.mineHost && !confirmed) {
      setConfirmCancel(true);
      return;
    }
    setConfirmCancel(false);
    setBusy(true);
    const result = await leaveFriendGame(friendRaceId);
    setBusy(false);
    if (!result.ok) {
      setToast(friendGameErrorCopy(result.error));
      return;
    }
    setFriendRaceId(null);
    setToast(result.data.cancelled ? 'You cancelled the friend game.' : 'You left the friend game.');
    setScreen('lobby');
    void load();
  };

  const leaveFriendRoom = (exit: FriendRoomExit) => {
    setFriendRaceId(null);
    setToast(friendExitCopy(exit));
    setScreen('lobby');
    void load();
  };

  const othersInSlot = (entry: RaceSignup): StadiumCard[] => {
    const slot = slots.find((item) => item.startsAt === entry.startsAt);
    return slot ? slot.events.filter((card) => card.id !== entry.eventId) : [];
  };

  const offline = status === 'offline' && screen !== 'gate' && screen !== 'race';
  const activeGate = screen === 'gate' ? (gateSignup ?? signup) : null;

  if (screen === 'race' && race && isPlayableEvent(race.event)) {
    const RaceScreen =
      race.event === 'hurdles'
        ? HurdlesScreen
        : race.event === 'dockDive'
          ? DockDiveScreen
          : race.event === 'obstacle'
            ? ObstacleScreen
            : FunRunScreen;
    return (
      <RaceScreen
        key={race.raceId}
        race={race}
        pet={pet}
        reducedMotion={reducedMotion}
        onFinish={(place) => {
          if (race.cup === 'friends') {
            commitRef.current(applyFriendRaceResult(petRef.current, race.raceId));
            return;
          }
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

  const artWidth = split && pane ? stadiumArtWidth(pane.width, pane.height, statusTop) : width;
  const art =
    artWidth > 0 ? (
      <StadiumHeader width={artWidth} top={statusTop} nextStart={slots[0]?.startsAt ?? null} reducedMotion={reducedMotion} />
    ) : null;
  const headerBar = (
          <View style={styles.headerBar} pointerEvents="box-none">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={screen === 'friendSetup' || screen === 'friendRoom' ? 'Back to the Stadium' : 'Back to the map'}
              onPress={() => {
                if (screen === 'friendSetup') {
                  setScreen('lobby');
                } else if (screen === 'friendRoom') {
                  setScreen('lobby');
                  void load();
                } else {
                  onClose();
                }
              }}
              style={styles.back}
            >
              <ChevronLeft size={22} strokeWidth={iconStroke + 1} color={ink} />
            </Pressable>
            <PetChip name={pet.name} level={pet.level} classId={classId} />
          </View>
  );
  const controls = (
        <View style={styles.body}>
          {offline ? (
            <View style={[shared.card, styles.offline]}>
              <WifiOff size={28} color={softInk} strokeWidth={iconStroke + 0.5} />
              <Text style={styles.offlineTitle}>The Stadium needs internet to race</Text>
              <Text style={[shared.copy, styles.center]}>Everything else keeps working. Come back when you&apos;re online.</Text>
              <CandyButton role="go" label="Try again" onPress={() => void load()} />
              <CandyButton role="secondary" label="Back to the map" onPress={onClose} />
            </View>
          ) : screen === 'friendRoom' && friendRaceId ? (
            <FriendRoom
              raceId={friendRaceId}
              petName={pet.name}
              now={now}
              leaving={busy}
              onLeave={(game) => void leaveFriend(game, false)}
              onRace={(view) => {
                setFriendRaceId(null);
                setRace(view);
                setScreen('race');
              }}
              onExit={leaveFriendRoom}
            />
          ) : screen === 'friendSetup' ? (
            <FriendGameSetup
              pet={pet}
              busy={busy}
              onSend={(event, delayMin, invitees) => void sendInvites(event, delayMin, invitees, false)}
              onBack={() => setScreen('lobby')}
            />
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
                onFriends={openFriends}
              />
              {board.friendGameRaceId ? (
                <CandyButton
                  role="friends"
                  label="Back to your friend game"
                  onPress={() => {
                    setFriendRaceId(board.friendGameRaceId);
                    setScreen('friendRoom');
                  }}
                />
              ) : null}
              {signup ? <CandyButton role="go" label="See your ticket" onPress={() => setScreen('ticket')} /> : null}
              <NpcCalibrationStadium />
            </>
          ) : (
            <View style={[shared.card, styles.offline]}>
              <Text style={[shared.copy, styles.center]}>{failureCopy(boardReason ?? 'pet not synced', pet.name)}</Text>
              <CandyButton role="go" label="Try again" onPress={() => void load()} />
            </View>
          )}
        </View>
  );
  const signupSheet =
    sheet && board ? (
      <SignUpSheet
        panel={split}
        card={sheet.card}
        slot={sheet.slot}
        classId={classForEvent(sheet.card.event, sheet.card.cup, classId)}
        capacity={board.capacity}
        petName={pet.name}
        energy={pet.needs.energy}
        mood={pet.needs.happiness}
        now={now}
        busy={busy}
        onSignUp={() => void signUp()}
        onClose={() => setSheet(null)}
      />
    ) : null;
  const notices = (
    <>
      {block ? (
        <FunModal
          title={block.trickName}
          body={`${pet.name} needs to learn ${block.trickName} for this race.`}
          icon={Flag}
          tint="lilac"
          reducedMotion={reducedMotion}
          primary={{ label: 'Training School', onPress: onTrain, closeFirst: true }}
          secondary={{ label: 'Not now', onPress: () => setBlock(null) }}
        />
      ) : null}

      {friendAsk ? (
        <FunModal
          title="Already in a race"
          body={conflictCopy(friendAsk.conflict, pet.name, 'start')}
          icon={Users}
          tint="lilac"
          reducedMotion={reducedMotion}
          primary={{
            label: busy ? 'Starting…' : 'Start this game',
            onPress: () => void sendInvites(friendAsk.event, friendAsk.delayMin, friendAsk.invitees, true),
          }}
          secondary={{ label: 'Not now', onPress: () => setFriendAsk(null) }}
        />
      ) : null}

      {confirmCancel ? (
        <FunModal
          title="Cancel this game?"
          body="Leaving cancels the friend game for everyone."
          icon={Users}
          tint="lilac"
          reducedMotion={reducedMotion}
          primary={{ label: 'Cancel game', onPress: () => void leaveFriend(null, true) }}
          secondary={{ label: 'Stay', onPress: () => setConfirmCancel(false) }}
        />
      ) : null}

      {accountOpen ? <AccountSheet reason="friends" petName={pet.name} onClose={() => setAccountOpen(false)} /> : null}

      {toast ? <Toast message={toast} reducedMotion={reducedMotion} onDone={hideToast} /> : null}
    </>
  );

  if (split) {
    return (
      <View style={styles.root}>
        <View style={styles.splitBody}>
          <View
            style={styles.stagePane}
            onLayout={(event) => {
              const nextW = Math.round(event.nativeEvent.layout.width);
              const nextH = Math.round(event.nativeEvent.layout.height);
              setPane((prev) => (prev && prev.width === nextW && prev.height === nextH ? prev : { width: nextW, height: nextH }));
            }}
          >
            {art}
          </View>
          <FitScale designWidth={phoneColumnWidth} style={styles.controlColumn}>
            {signupSheet ?? (
              <ScrollView style={styles.columnScroll} contentContainerStyle={[styles.scroll, styles.columnScrollContent]} bounces={false}>
                {controls}
              </ScrollView>
            )}
          </FitScale>
        </View>
        {headerBar}
        {notices}
      </View>
    );
  }

  return (
    <View style={styles.root} onLayout={(event) => setWidth(Math.round(event.nativeEvent.layout.width))}>
      <ScrollView contentContainerStyle={styles.scroll} bounces={false}>
        <View>
          {art}
          {headerBar}
        </View>
        {controls}
      </ScrollView>
      {signupSheet}
      {notices}
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
  splitBody: {
    flex: 1,
    flexDirection: 'row',
  },
  stagePane: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    width: 0,
    minWidth: 0,
    overflow: 'hidden',
    alignItems: 'center',
    backgroundColor: pageFill,
  },
  controlColumn: {
    flexGrow: 0,
    flexShrink: 1,
    flexBasis: phoneColumnWidth,
    maxWidth: phoneColumnWidth,
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
    backgroundColor: pageFill,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: '#E4D7F2',
  },
  columnScroll: {
    flex: 1,
  },
  columnScrollContent: {
    paddingTop: 96,
  },
  headerBar: {
    position: 'absolute',
    top: statusTop + 4,
    left: 12,
    right: 12,
    zIndex: 5,
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
