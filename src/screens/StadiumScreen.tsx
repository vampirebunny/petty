import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { ChevronLeft, Flag, Users, WifiOff } from 'lucide-react-native';

import { readAccountLinked, serverNow } from '../db/accountMeta';
import { track, trackScreen } from '../analytics/analytics';
import { pushPetBeforeRead } from '../sync/queue';
import { askRaceReminderPermission, cancelRaceCall, scheduleRaceCall } from '../reminders/notifications';
import { fetchBoard, signUpFor, withdrawEntry, type RaceView, type StadiumBoard, type StadiumCard, type StadiumSlot } from '../stadium/api';
import {
  conflictCopy,
  createFriendGame,
  fetchFriendGame,
  friendGameErrorCopy,
  leaveFriendGame,
  type FriendGameConflict,
  type FriendGameEvent,
  type FriendGameState,
} from '../stadium/friendGames';
import { gameplayConfig } from '../sim/gameplayConfig';
import { applyFriendRaceResult, applyRaceRewards, noteFriendGameStarted } from '../sim/raceRewards';
import { recordFormatEntered } from '../invites/store';
import { classForEvent, classForLevel, dropEndedSignup, eventLabel, isPlayableEvent, racesOf, signedUpRaces, skillBlock, withFriendGame, withSignup, type FriendGameCall, type RaceEvent, type RaceSignup, type SignedUpRace, type SkillBlock } from '../sim/stadium';
import type { PetState } from '../sim/types';
import { fontFamily } from '../ui/font';
import { FitScale } from '../ui/FitScale';
import { lobbyHeroFill, lobbyPhoneAspect } from '../ui/lobby/heroes';
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
import { raceStillValid, retargetRace } from '../invites/pick';
import type { RaceOption } from '../invites/types';
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
  /** Open the sign-up sheet for this invitation, skipping the lobby. */
  openRace?: { eventId: string; event: RaceEvent; startsAt: number } | null;
  onInviteUnavailable?: () => void;
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
  openRace = null,
  onInviteUnavailable,
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
  const sending = useRef(false);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const split = isLandscapeSplit(windowWidth, windowHeight);
  const petRef = useRef(pet);
  const loadGen = useRef(0);
  const commitRef = useRef(onCommit);
  const boardRef = useRef(board);
  const screenRef = useRef(screen);
  const atGateRef = useRef(onAtGate);
  const openRaceRef = useRef(openRace);
  const missRef = useRef(onInviteUnavailable);
  const [hiddenInvite, setHiddenInvite] = useState<string | null>(null);

  useEffect(() => {
    openRaceRef.current = openRace;
    missRef.current = onInviteUnavailable;
  }, [openRace, onInviteUnavailable]);

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
      if (openRaceRef.current && screenRef.current === 'loading') {
        missRef.current?.();
      }
      return;
    }
    setBoardReason(null);
    const next = result.data;
    setStatus('ok');
    setBoard(next);
    const current = petRef.current;
    const local = racesOf(current).signup;
    let nextPet = local?.entryId !== next.activeEntry?.entryId ? withSignup(current, next.activeEntry, serverNow()) : current;
    if (screenRef.current === 'loading') {
      setScreen('lobby');
    }
    if (next.friendGameRaceId) {
      const game = await fetchFriendGame(next.friendGameRaceId);
      if (gen !== loadGen.current || (petRef.current !== current && petRef.current !== nextPet)) return;
      if (game.ok) {
        const call: FriendGameCall | null =
          game.data.event && (game.data.status === 'open' || game.data.status === 'locked' || game.data.status === 'countdown')
            ? { raceId: game.data.raceId, event: game.data.event, startsAt: game.data.startsAt }
            : null;
        nextPet = withFriendGame(nextPet, call, serverNow());
      }
    } else {
      nextPet = withFriendGame(nextPet, null, serverNow());
    }
    if (nextPet !== petRef.current) {
      petRef.current = nextPet;
      commitRef.current(nextPet);
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

  const inviteKey = openRace ? `${openRace.eventId}:${openRace.startsAt}` : null;
  const inviteSheet = useMemo(() => {
    if (!openRace || !board || hiddenInvite === inviteKey) {
      return null;
    }
    const options: RaceOption[] = board.slots.flatMap((slot) =>
      slot.events.map((card) => ({
        eventId: card.id,
        event: card.event,
        cup: card.cup,
        classId: classForEvent(card.event, card.cup, board.classId),
        state: card.state,
        startsAt: slot.startsAt,
      })),
    );
    const stored = options.find((row) => row.eventId === openRace.eventId);
    const chosen = stored && raceStillValid(stored, serverNow()) ? stored : retargetRace(options, openRace.event, serverNow());
    const slot = chosen ? board.slots.find((row) => row.events.some((card) => card.id === chosen.eventId)) : undefined;
    const card = slot?.events.find((row) => row.id === chosen?.eventId);
    return slot && card ? { card, slot } : null;
  }, [board, hiddenInvite, inviteKey, openRace]);

  useEffect(() => {
    if (!openRace || !board || hiddenInvite === inviteKey || inviteSheet) {
      return;
    }
    onInviteUnavailable?.();
  }, [board, hiddenInvite, inviteKey, inviteSheet, onInviteUnavailable, openRace]);

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
    const current = sheet ?? inviteSheet;
    if (!current || busy) {
      return;
    }
    setBusy(true);
    if (!racesOf(petRef.current).entered) {
      await askRaceReminderPermission();
    }
    const result = await signUpFor(petRef.current.id, current.card.id);
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
    if (petRef.current.ownerId) {
      void recordFormatEntered(petRef.current.ownerId, 'race', petRef.current.openedDays);
    }
    setSheet(null);
    if (inviteKey) {
      setHiddenInvite(inviteKey);
    }
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

  const openSignedUpRace = (race: SignedUpRace) => {
    if (race.kind === 'friend') {
      setFriendRaceId(race.id);
      setScreen('friendRoom');
      return;
    }
    const entry = racesOf(petRef.current).signup ?? board?.activeEntry ?? null;
    if (entry && !racesOf(petRef.current).signup) {
      const next = withSignup(petRef.current, entry, serverNow());
      petRef.current = next;
      commitRef.current(next);
    }
    setScreen('ticket');
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
    if (busy || sending.current) {
      return;
    }
    sending.current = true;
    setBusy(true);
    const permission = askRaceReminderPermission();
    let result: Awaited<ReturnType<typeof createFriendGame>>;
    try {
      result = await createFriendGame(petRef.current.id, event, delayMin, invitees, replace);
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
    } finally {
      sending.current = false;
      setBusy(false);
    }
    if (!result.ok) {
      if ('conflict' in result) {
        setFriendAsk({ event, delayMin, invitees, conflict: result.conflict });
        return;
      }
      setFriendAsk(null);
      setToast(friendGameErrorCopy(result.error));
      return;
    }
    let next = noteFriendGameStarted(petRef.current, Date.now());
    if (replace && friendAsk && friendAsk.conflict.cup !== 'friends') {
      void cancelRaceCall();
      next = withSignup(next, null, serverNow());
    }
    next = withFriendGame(next, { raceId: result.data.raceId, event, startsAt: result.data.startsAt }, serverNow());
    petRef.current = next;
    commitRef.current(next);
    void permission.then(() => scheduleRaceCall(petRef.current));
    setFriendAsk(null);
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
    const cleared = withFriendGame(petRef.current, null, serverNow());
    petRef.current = cleared;
    commitRef.current(cleared);
    void cancelRaceCall();
    setFriendRaceId(null);
    setToast(result.data.cancelled ? 'You cancelled the friend game.' : 'You left the friend game.');
    setScreen('lobby');
    void load();
  };

  const leaveFriendRoom = (exit: FriendRoomExit) => {
    const cleared = withFriendGame(petRef.current, null, serverNow());
    petRef.current = cleared;
    commitRef.current(cleared);
    void cancelRaceCall();
    setFriendRaceId(null);
    setToast(friendExitCopy(exit));
    setScreen('lobby');
    void load();
  };

  const rememberFriendGame = (game: FriendGameState) => {
    const event = game.event;
    const live = event != null && (game.status === 'open' || game.status === 'locked' || game.status === 'countdown');
    const next = withFriendGame(
      petRef.current,
      live ? { raceId: game.raceId, event, startsAt: game.startsAt } : game.status === 'cancelled' ? null : (racesOf(petRef.current).friendGame ?? null),
      serverNow(),
    );
    if (next === petRef.current) return;
    petRef.current = next;
    commitRef.current(next);
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

  const art = <StadiumHeader nextStart={slots[0]?.startsAt ?? null} reducedMotion={reducedMotion} />;
  const headerBar = (
          <View style={styles.headerBar} pointerEvents="box-none">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                screen === 'friendSetup' || screen === 'friendRoom' || screen === 'ticket' ? 'Back to the Stadium' : 'Back to the map'
              }
              onPress={() => {
                if (screen === 'friendSetup' || screen === 'ticket') {
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
              onUpdate={rememberFriendGame}
              onRest={() => void scheduleRaceCall(petRef.current)}
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
                races={signedUpRaces(signup, racesOf(pet).friendGame ?? null, board.friendGameRaceId)}
                selected={selected}
                onSelect={(slot) => setSlotId(slot.id)}
                onCard={onCard}
                onRace={openSignedUpRace}
                onFriends={openFriends}
              />
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
  const visibleSheet = sheet ?? inviteSheet;
  const signupSheet =
    visibleSheet && board ? (
      <SignUpSheet
        panel={split}
        card={visibleSheet.card}
        slot={visibleSheet.slot}
        classId={classForEvent(visibleSheet.card.event, visibleSheet.card.cup, classId)}
        capacity={board.capacity}
        petName={pet.name}
        energy={pet.needs.energy}
        mood={pet.needs.happiness}
        now={now}
        busy={busy}
        onSignUp={() => void signUp()}
        onClose={() => {
          setSheet(null);
          if (inviteKey) {
            setHiddenInvite(inviteKey);
          }
        }}
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
          <View style={styles.stagePane}>{art}</View>
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
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} bounces={false}>
        <View style={styles.phoneHero}>
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
  phoneHero: {
    width: '100%',
    aspectRatio: lobbyPhoneAspect,
    backgroundColor: lobbyHeroFill.stadium,
  },
  stagePane: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    width: 0,
    minWidth: 0,
    overflow: 'hidden',
    backgroundColor: lobbyHeroFill.stadium,
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
