import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AccessibilityInfo, AppState, Image, Linking, Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, Pressable, ScrollView } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import {
  actionReason,
  breedById,
  sceneById,
  stagePoint,
} from '../actor';
import { preloadBloops, releaseBloops, silenceBloops, unmuteBloops } from '../audio/bloop';
import { releaseMusic, setMusicEnabled, suspendMusic, switchMusic } from '../audio/music';
import { setSoundEnabled } from '../audio/voice';
import type { CuddleOut } from '../actor';
import { stageHeight, stageWidth } from '../actor/geometry';
import { bowlAlreadyInRoom, bowlRoomMessage, otherBedInRoom, pieceLabel, roomRestBadge, shopSku, stowWarning } from '../actor/furniture';
import type { FurniturePiece } from '../actor/furniture';
import { flickSpeedThreshold } from '../input/flick';
import { CuddleGesture } from '../input/cuddleGesture';
import type { GestureEvent } from '../input/cuddleGesture';
import { archetypeNames, archetypeStyleNames, attributeScore, currentStyle, petStrokeIntervalMs, shownAttributeSteps, styleBasis, traits } from '../sim';
import type { Trait } from '../sim';
import {
  loadHasSeenSilentModeHint,
  loadMusicEnabled,
  loadSoundEnabled,
  saveHasSeenSilentModeHint,
  saveMusicEnabled,
  saveSoundEnabled,
} from '../storage/session';
import { PlacesScreen } from './PlacesScreen';
import { PantryScreen } from './PantryScreen';
import { PetShopScreen } from './PetShopScreen';
import { placeFlavors, placeIcons, speciesLabel } from '../ui/actionIcons';
import { CandyShell, candyInk, tints } from '../ui/candy';
import { BoopsPayout } from '../components/currency/BoopsPayout';
import { acceptStageOrigin } from '../components/currency/windowSample';
import { BoopCounter } from '../ui/BoopCounter';
import type { BoopCounterHandle } from '../ui/BoopCounter';
import { fontFamily } from '../ui/font';
import { iconStroke } from '../ui/theme';
import { useAccountHandle } from '../state/useAccountHandle';
import { usePet } from '../state/usePet';
import { grantDevItem } from '../dev/grant';
import { usePlayerHome } from '../state/usePlayerHome';
import { useEconomy } from '../economy/useEconomy';
import { basicTreatId } from '../economy/state';
import { KIBBLE_ID, catalogItem, foodsInInventory } from '../economy/catalog';
import { newRequestId, outfitsOwned } from '../economy/service';
import { refreshShopCatalog } from '../economy/shopSync';
import { playRuleFor } from '../items/playRules';
import { canGiveTreat, treatsInInventory } from '../treats';
import { trackName } from '../sim/tracks';
import { failBand, trickListing } from '../sim/tricks';
import type { TrickPropType } from '../sim/trickProps';
import { currentOwner } from '../db/currentOwner';
import { consumeBedStorageTip, trickPropsOf } from '../db/playerHome';
import { ghostDelayMs, ghostEligible, startCuddleSession } from '../cuddle/guidance';
import { HomeActionPanel } from '../ui/HomeActionPanel';
import { ToyCard } from '../ui/ToyCard';
import { PropCard } from '../ui/PropCard';
import { HoldPieceSheet } from '../ui/HoldPieceSheet';
import { NoticeSheet } from '../ui/NoticeSheet';
import { StorageCard } from '../ui/StorageCard';
import type { StorageChoice } from '../ui/StorageCard';
import { needThreshold } from '../ui/candyTokens';
import { CandyTooltip } from '../ui/tips/CandyTooltip';
import { useCandyTips } from '../ui/tips/useCandyTips';
import { PlaydateScreen } from './PlaydateScreen';
import { ClothingLab } from './ClothingLab';
import { SettingsScreen } from './SettingsScreen';
import { AccountSheet } from '../ui/AccountSheet';
import { FindFriendsHost } from '../ui/FindFriendsHost';
import { FriendRequestModal } from '../ui/FriendRequestModal';
import { BlockConfirm, ReportSheet, ReportThanks } from '../ui/FriendDialogs';
import { FriendNotifyPrompt } from '../ui/FriendNotifyPrompt';
import { loadFriends, blockPlayer, reportPlayer } from '../friends/api';
import { parseFriendLink } from '../friends/friendLink';
import { closeFindFriends, openFindFriends } from '../friends/findOpen';
import { onFriendModalRequest } from '../friends/open';
import { clearPendingAdd, readPendingAdd, savePendingAdd } from '../friends/pendingAdd';
import { friendPromptShouldShow, newestRequestAt, readFriendSeenAt, writeFriendSeenAt } from '../friends/prompt';
import { listenForFriendPushes, registerFriendPushToken } from '../friends/push';
import type { FriendRow } from '../friends/types';
import { handlePromptIsStrict, onHandlePrompt } from '../compliance/handlePrompt';
import { openPathSuppressed } from '../state/sessionGate';
import { FacingLab } from './FacingLab';
import { WardrobeScreen } from './WardrobeScreen';
import { parkOfferFromSnapshot, parkStrangerOffer } from '../playdate/npcs';
import { usePlaydates } from '../state/usePlaydates';
import { formatCooldown } from '../playdate/cooldown';
import { DebugPanel } from '../ui/DebugPanel';
import { NeedRings } from '../ui/NeedRings';
import { needHold, presentNeeds, sumHolds } from '../ui/needHold';
import type { NeedHold } from '../ui/needHold';
import { TrainingRings } from '../ui/TrainingRings';
import { SchoolControls } from '../ui/school/SchoolControls';
import type { SchoolControlsHandle } from '../ui/school/SchoolControls';
import { onAccountFlags, readAccountLinked, readSchoolTrickTip, setSchoolTrickTip } from '../db/accountMeta';
import { FunModal } from '../ui/FunModal';
import { HandlePrompt } from '../ui/HandleScreen';
import { Day3Prompt } from '../ui/Day3Prompt';
import { ReauthPrompt } from '../ui/ReauthPrompt';
import { TreatPicker } from '../ui/TreatPicker';
import { AttributePops, trainingPopColor, traitPopColor } from '../ui/AttributePops';
import type { PointPop } from '../ui/AttributePops';
import { formatRest, isResting, restRemainingMs } from '../sim/training';
import { BadgeCelebration } from '../ui/BadgeCelebration';
import { Bone, ChevronRight, CircleHelp, Cookie, Droplet, HandHeart, Moon, Settings, Soup, Sparkles } from 'lucide-react-native';
import { playBadgeChime } from '../audio/badge';
import { GREET } from '../actor/greetings';
import { PetView } from '../ui/PetView';
import { PhoneColumn } from '../ui/PhoneColumn';
import { useStageSize } from '../ui/useStageSize';
import { useOpenedDuoBoopEdge, useOpenedDuoTopInset } from '../ui/useDeviceOrientation';
import { FitScale } from '../ui/FitScale';
import { isLandscapeSplit, phoneColumnWidth, schoolStackedHeightShare } from '../ui/wideLayout';
import type { CuddleHandle, StageHandle } from '../ui/PetView';
import { CuddleFeedback } from '../ui/cuddle/CuddleFeedback';
import type { FeedbackHandle } from '../ui/cuddle/CuddleFeedback';
import type { PointAdd } from '../ui/cuddle/pointAdds';
import { CuddleHelpSheet, GhostFinger } from '../ui/cuddle/CuddleGuidance';
import { SilentModeHint } from '../ui/SilentModeHint';

const badgeLabels: Record<string, string> = {
  sit: 'Sit',
  speak: 'Speak',
  paw: 'Paw',
};

type TipKind = 'food' | 'water' | 'bed';

function isTipPiece(piece: { kind: string; contents?: string }, kind: TipKind) {
  return kind === 'bed'
    ? piece.kind === 'bed'
    : piece.kind === 'bowl' && (kind === 'water' ? piece.contents === 'water' : piece.contents !== 'water');
}

// A home owns a bed in more than one room. The hint has to use the one standing in the room on screen.
function placedInScene(
  pieces: { id: string; kind: string; contents?: string }[],
  placements: { pieceId: string; sceneId: string; x: number; y: number }[],
  sceneId: string,
  kind: TipKind,
) {
  return (
    placements.find((spot) => {
      if (spot.sceneId !== sceneId) {
        return false;
      }
      const piece = pieces.find((item) => item.id === spot.pieceId);
      return piece != null && isTipPiece(piece, kind);
    }) ?? null
  );
}

// Pieces are anchored where they meet the floor. The drawing sits above that point.
function markerPoint(pieceKind: string | undefined, spot: { x: number; y: number }) {
  const lift = pieceKind === 'bed' ? 18 : pieceKind === 'bowl' ? 12 : 0;
  return { x: spot.x, y: spot.y - lift };
}

type Props = {
  petApi: ReturnType<typeof usePet>;
};

const traitLabel: Record<Trait, string> = {
  stamina: 'Stamina',
  agility: 'Agility',
  intelligence: 'Intelligence',
  boldness: 'Boldness',
  affection: 'Affection',
  obedience: 'Obedience',
};

function formatScore(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export default function HomeScreen({ petApi }: Props) {
  const {
    state,
    mood,
    cue,
    feed,
    refillWater,
    reportDrank,
    reportAte,
    sit,
    givePaw,
    speak,
    rest,
    beginRest,
    pet,
    rememberGreeting,
    startCuddle,
    finishCuddle,
    chooseToy,
    throwAt,
    flickAt,
    setScene,
    equip,
    applyActorWeight,
    applyActorEnergy,
    applyActorHunger,
    applyActorHydration,
    applyActorHappiness,
    advanceBy,
    setAge,
    setVitalityValue,
    setWeightValue,
    reset,
    retire,
    finishPlaydate,
    remindersOn,
    setRemindersOn,
    attemptTrick,
    resolveTraining,
    moveFurniture,
    stowFurniture,
    offerTreat,
    welcomeBack,
    dismissWelcome,
    homeSnapToken,
    setCareTreatCount,
    commitPet,
    noteFind,
    burst,
    pendingBoops,
    dismissBurst,
    cancelBursts,
  } = petApi;
  const homeSpecies = state ? (breedById(state.breedId)?.species === 'cat' ? 'cat' : 'dog') : 'dog';
  const home = usePlayerHome(state?.ownerId, homeSpecies);
  const economyApi = useEconomy(state != null);
  const [clock, setClock] = useState(() => Date.now());
  const [pantryOpen, setPantryOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [bedTip, setBedTip] = useState(false);
  const [bedSwap, setBedSwap] = useState<{ piece: FurniturePiece; occupantId: string; name: string; x: number; y: number } | null>(null);
  useEffect(() => {
    if (!shopOpen && consumeBedStorageTip()) {
      setBedTip(true);
    }
  }, [shopOpen]);
  const [, setShopStamp] = useState(0);
  const counterRef = useRef<BoopCounterHandle>(null);
  const stageViewRef = useRef<View>(null);
  const [stageWindow, setStageWindow] = useState({ x: 0, y: 0 });
  const [stageReady, setStageReady] = useState(false);
  const skippedStageZero = useRef(false);
  const paidBurst = useRef<number | null>(null);
  const cancelBurstsRef = useRef(cancelBursts);
  useEffect(() => {
    cancelBurstsRef.current = cancelBursts;
  }, [cancelBursts]);
  const [pops, setPops] = useState<PointPop[] | null>(null);
  const [treatHolds, setTreatHolds] = useState<NeedHold[]>([]);
  const treatHoldsRef = useRef<NeedHold[]>([]);
  const clearPops = useCallback(() => setPops(null), []);
  const [dialog, setDialog] = useState<
    | { kind: 'good' | 'miss' | 'out' | 'break'; trackId: string }
    | null
  >(null);
  const [previewBottom, setPreviewBottom] = useState(0);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const duoTop = useOpenedDuoTopInset();
  const boopEdge = useOpenedDuoBoopEdge();
  const split = isLandscapeSplit(windowWidth, windowHeight);
  const [stagePane, setStagePane] = useState<{ width: number; height: number } | null>(null);
  const stageFrame = split
    ? {
        width: stagePane?.width ?? Math.max(280, windowWidth - phoneColumnWidth),
        height: stagePane?.height ?? windowHeight,
        maxHeightShare: 1,
      }
    : undefined;
  const atSchool = state?.sceneId === 'school';
  const logicalH = stageHeight;
  const { viewWidth, viewHeight, contentWidth } = useStageSize(
    stageFrame,
    undefined,
    !split && atSchool ? schoolStackedHeightShare : undefined,
  );
  const [trickTip, setTrickTip] = useState<{ id: string; name: string; first: boolean } | null>(null);
  const schoolRef = useRef<SchoolControlsHandle>(null);
  const ownedPropTypes = useMemo(() => {
    void home;
    if (!state?.ownerId) {
      return [] as string[];
    }
    return trickPropsOf(state.ownerId).map((prop) => prop.type);
  }, [home, state?.ownerId]);
  const lastStrokeAt = useRef(0);
  const [playdateOpen, setPlaydateOpen] = useState(false);
  const playdates = usePlaydates(state?.ownerId);
  const parkOffers = useMemo(
    () => playdates.save.cast.map(parkOfferFromSnapshot),
    [playdates.save.cast],
  );
  const parkStranger = useCallback(
    (nonce: number) => parkStrangerOffer(state?.ownerId || 'guest', nonce),
    [state?.ownerId],
  );
  const owned = outfitsOwned();
  const [hour, setHour] = useState<number | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [wardrobeOpen, setWardrobeOpen] = useState(false);
  const [placesOpen, setPlacesOpen] = useState(false);
  useEffect(() => {
    if (homeSnapToken === 0) {
      return;
    }
    setPlacesOpen(false);
    setShopOpen(false);
  }, [homeSnapToken]);
  const whereUid = useId().replace(/:/g, '');
  const [facingOpen, setFacingOpen] = useState(false);
  const [clothingOpen, setClothingOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [incomingFriends, setIncomingFriends] = useState<FriendRow[]>([]);
  const [friendTick, setFriendTick] = useState(0);
  const [requestsOpen, setRequestsOpen] = useState(false);
  const [forceRequests, setForceRequests] = useState(false);
  const [friendPrompt, setFriendPrompt] = useState(false);
  const [friendReport, setFriendReport] = useState<{ userId: string; handle: string } | null>(null);
  const [friendThanks, setFriendThanks] = useState<{ userId: string; handle: string } | null>(null);
  const [friendBlock, setFriendBlock] = useState<{ userId: string; handle: string } | null>(null);
  const [addGate, setAddGate] = useState(false);
  const accountHandle = useAccountHandle();
  const [personalityOpen, setPersonalityOpen] = useState(false);
  const [playOpen, setPlayOpen] = useState(false);
  const [propOpen, setPropOpen] = useState(false);
  const [storageOpen, setStorageOpen] = useState(false);
  const [storageItems, setStorageItems] = useState<StorageChoice[]>([]);
  const [storageEmpty, setStorageEmpty] = useState('Nothing in storage.');
  const [bowlNotice, setBowlNotice] = useState<string | null>(null);
  const [holdTarget, setHoldTarget] = useState<{ id: string; prop: boolean; warning: string | null } | null>(null);
  const [holdConfirm, setHoldConfirm] = useState(false);
  const [propChoices, setPropChoices] = useState<{ id: string; label: string; type: string; sourceTrickId: string }[]>([]);
  const [heldPlay, setHeldPlay] = useState(false);
  const [treatOpen, setTreatOpen] = useState(false);
  const [treatNote, setTreatNote] = useState<string | null>(null);
  const [feedOpen, setFeedOpen] = useState(false);
  const [feedNote, setFeedNote] = useState<string | null>(null);
  const [cuddleOn, setCuddleOn] = useState(false);
  const tips = useCandyTips();
  const [helpOpen, setHelpOpen] = useState(false);
  const [sessionNumber, setSessionNumber] = useState(0);
  const [ghost, setGhost] = useState<{ from: { x: number; y: number }; to: { x: number; y: number }; key: number } | null>(
    null,
  );
  const [coachTarget, setCoachTarget] = useState<{ x: number; y: number } | null>(null);
  const cuddleHandle = useRef<CuddleHandle>(null);
  const stageHandle = useRef<StageHandle>(null);
  const feedback = useRef<FeedbackHandle>(null);
  const tracker = useRef(new CuddleGesture());
  const touchedRef = useRef(false);
  const touchActive = useRef(false);
  const lastTrailAt = useRef(0);
  const cuddleOnRef = useRef(false);
  const [note, setNote] = useState('');
  const [soundOn, setSoundOn] = useState(true);
  const [musicOn, setMusicOn] = useState(true);
  const [silentHintOpen, setSilentHintOpen] = useState(false);
  const askFeedRef = useRef<() => void>(() => {});
  const askWaterRef = useRef<() => void>(() => {});
  const askSleepRef = useRef<() => void>(() => {});
  const tipsRef = useRef(tips);
  useEffect(() => {
    tipsRef.current = tips;
  }, [tips]);
  const [popped, setPopped] = useState<string[] | null>(null);
  const [movePieceId, setMovePieceId] = useState<string | null>(null);
  const [knownPieceIds, setKnownPieceIds] = useState<string | null>(null);
  const prevNeeds = useRef<{ h: number; t: number; e: number } | null>(null);
  // null until storage answers. true once shown or already dismissed this install.
  const [silentHintSeen, setSilentHintSeen] = useState<boolean | null>(null);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let mounted = true;
    void loadSoundEnabled().then((enabled) => {
      if (mounted) {
        setSoundOn(enabled);
        setSoundEnabled(enabled);
      }
    });
    void loadMusicEnabled().then((enabled) => {
      if (mounted) {
        setMusicOn(enabled);
        setMusicEnabled(enabled);
      }
    });
    preloadBloops();
    const pullShop = () => {
      void refreshShopCatalog().then((ok) => {
        if (ok) {
          setShopStamp((value) => value + 1);
        }
      });
    };
    pullShop();
    listenForFriendPushes();
    const appState = AppState.addEventListener('change', (next) => {
      const background = next !== 'active';
      suspendMusic(background);
      if (background) {
        silenceBloops();
        counterRef.current?.snap();
        cancelBurstsRef.current();
      } else {
        unmuteBloops();
        pullShop();
        if (!openPathSuppressed()) {
          setFriendTick((value) => value + 1);
        }
      }
    });
    return () => {
      mounted = false;
      appState.remove();
      releaseMusic();
      releaseBloops();
      if (noteTimer.current) {
        clearTimeout(noteTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    const unsubModal = onFriendModalRequest(() => {
      closeFindFriends();
      setForceRequests(true);
      setSettingsOpen(false);
      setPlaydateOpen(false);
    });
    const unsubHandle = onHandlePrompt(() => setFriendTick((value) => value + 1));
    const unsubAccount = onAccountFlags(() => setFriendTick((value) => value + 1));
    return () => {
      unsubModal();
      unsubHandle();
      unsubAccount();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!readAccountLinked()) {
        if (!cancelled) {
          setIncomingFriends([]);
          setRequestsOpen(false);
        }
        return;
      }
      await registerFriendPushToken();
      const bundle = await loadFriends();
      if (cancelled) {
        return;
      }
      setIncomingFriends(bundle.incoming);
      if (handlePromptIsStrict()) {
        return;
      }
      const newest = newestRequestAt(bundle.incoming.map((row) => row.createdAt));
      const seen = await readFriendSeenAt();
      if (cancelled) {
        return;
      }
      if (forceRequests || (newest != null && (seen == null || newest > seen))) {
        setRequestsOpen(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [friendTick, forceRequests]);

  useEffect(() => {
    const take = (url: string | null) => {
      if (!url) {
        return;
      }
      const handle = parseFriendLink(url);
      if (!handle) {
        return;
      }
      void savePendingAdd(handle).then(() => setFriendTick((value) => value + 1));
    };
    void Linking.getInitialURL().then(take);
    const sub = Linking.addEventListener('url', (event) => take(event.url));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!state || handlePromptIsStrict()) {
      return;
    }
    let cancelled = false;
    void readPendingAdd().then((handle) => {
      if (cancelled || !handle) {
        return;
      }
      if (readAccountLinked()) {
        setAddGate(false);
        void clearPendingAdd();
        openFindFriends(handle);
        return;
      }
      setAddGate(true);
    });
    return () => {
      cancelled = true;
    };
  }, [friendTick, state]);

  useEffect(() => {
    let mounted = true;
    void loadHasSeenSilentModeHint().then((seen) => {
      if (mounted) {
        setSilentHintSeen((current) => current ?? seen);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  // iOS cannot read the silent switch. Offer the hint once, and let the tap's sound start immediately.
  const offerSilentHint = useCallback(() => {
    if (Platform.OS !== 'ios' || silentHintSeen === true) {
      return;
    }
    setSilentHintSeen(true);
    if (silentHintSeen === false) {
      setSilentHintOpen(true);
      return;
    }
    void loadHasSeenSilentModeHint().then((seen) => {
      if (!seen) {
        setSilentHintOpen(true);
      }
    });
  }, [silentHintSeen]);

  const dismissSilentHint = useCallback(() => {
    setSilentHintOpen(false);
    setSilentHintSeen(true);
    void saveHasSeenSilentModeHint();
  }, []);

  const toggleSound = useCallback(() => {
    offerSilentHint();
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
    void saveSoundEnabled(next);
  }, [offerSilentHint, soundOn]);

  const toggleMusic = useCallback(() => {
    const next = !musicOn;
    setMusicOn(next);
    setMusicEnabled(next);
    void saveMusicEnabled(next);
  }, [musicOn]);

  const flash = useCallback((text: string) => {
    setNote(text);
    if (noteTimer.current) {
      clearTimeout(noteTimer.current);
    }
    noteTimer.current = setTimeout(() => setNote(''), 2600);
  }, []);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) {
        setReducedMotion(enabled);
      }
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (cue.kind === 'wiggle' || cue.kind === 'purr') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [cue.kind, cue.token]);

  const stroke = useCallback(() => {
    const now = Date.now();
    if (now - lastStrokeAt.current < petStrokeIntervalMs) {
      return;
    }
    lastStrokeAt.current = now;
    pet();
  }, [pet]);

  const softDropHere = useCallback(
    (x: number, y: number) => {
      const point = stagePoint(x, y, viewWidth, viewHeight, contentWidth, stageWidth, logicalH);
      if (point.x < 0 || point.x > stageWidth) {
        return;
      }
      throwAt(point.x, point.y);
    },
    [contentWidth, throwAt, logicalH, viewHeight, viewWidth],
  );
  const flickHere = useCallback(
    (x: number, y: number, vx: number, vy: number) => {
      const point = stagePoint(x, y, viewWidth, viewHeight, contentWidth, stageWidth, logicalH);
      if (point.x < 0 || point.x > stageWidth) {
        return;
      }
      const scaleX = stageWidth / Math.max(contentWidth, 1);
      const scaleY = logicalH / Math.max(viewHeight, 1);
      flickAt(point.x, point.y, vx * scaleX, vy * scaleY);
    },
    [contentWidth, flickAt, logicalH, viewHeight, viewWidth],
  );
  const stageToView = useCallback(
    (point: { x: number; y: number }) => {
      const pad = (viewWidth - contentWidth) / 2;
      return {
        x: pad + (point.x / stageWidth) * contentWidth,
        y: (point.y / logicalH) * viewHeight,
      };
    },
    [contentWidth, logicalH, viewHeight, viewWidth],
  );

  const acceptingTouch = useCallback(() => {
    const phase = cuddleHandle.current?.phase();
    return phase === 'waiting' || phase === 'rollDown' || phase === 'rollOver' || phase === 'belly';
  }, []);

  const sendCuddleEvents = useCallback(
    (events: GestureEvent[]) => {
      const handle = cuddleHandle.current;
      if (!handle || !acceptingTouch()) {
        return;
      }
      for (const event of events) {
        const stage = stagePoint(event.x, event.y, viewWidth, viewHeight, contentWidth, stageWidth, logicalH);
        if (event.type === 'move') {
          touchedRef.current = true;
          handle.touch({ kind: 'move', zone: event.zone, x: stage.x });
          const now = Date.now();
          if (now - lastTrailAt.current > 35) {
            lastTrailAt.current = now;
            feedback.current?.trail(event.x, event.y);
          }
        } else if (event.type === 'stroke') {
          touchedRef.current = true;
          tipsRef.current.performed('tip.cuddle');
          handle.touch({ kind: 'stroke', zone: event.zone, x: stage.x });
        } else if (event.type === 'heart') {
          feedback.current?.heart(event.x, event.y);
        } else if (event.type === 'tooFast') {
          touchedRef.current = true;
          handle.touch({ kind: 'flinch', zone: 'back', x: stage.x });
        } else {
          touchedRef.current = true;
          tipsRef.current.performed('tip.cuddle');
          handle.touch({ kind: 'scratch', zone: event.zone, x: stage.x });
        }
      }
    },
    [acceptingTouch, contentWidth, logicalH, viewHeight, viewWidth],
  );

  const cuddleMove = useCallback(
    (x: number, y: number) => {
      const handle = cuddleHandle.current;
      if (!handle) {
        return;
      }
      if (!touchActive.current) {
        touchActive.current = true;
        tracker.current.begin();
        handle.setGesturing(true);
      }
      const stage = stagePoint(x, y, viewWidth, viewHeight, contentWidth, stageWidth, logicalH);
      sendCuddleEvents(tracker.current.move(x, y, Date.now(), handle.zoneAt(stage.x, stage.y)));
    },
    [contentWidth, sendCuddleEvents, logicalH, viewHeight, viewWidth],
  );
  const cuddleTap = useCallback(
    (x: number, y: number) => {
      const handle = cuddleHandle.current;
      if (!handle || !acceptingTouch()) {
        return;
      }
      const stage = stagePoint(x, y, viewWidth, viewHeight, contentWidth, stageWidth, logicalH);
      if (handle.zoneAt(stage.x, stage.y) === 'nose') {
        touchedRef.current = true;
        tipsRef.current.performed('tip.cuddle');
        handle.touch({ kind: 'boop', zone: 'nose', x: stage.x });
      }
    },
    [acceptingTouch, contentWidth, logicalH, viewHeight, viewWidth],
  );
  const cuddleEnd = useCallback(() => {
    touchActive.current = false;
    cuddleHandle.current?.setGesturing(false);
  }, []);
  const cuddleMoveRef = useRef(cuddleMove);
  const cuddleTapRef = useRef(cuddleTap);
  const cuddleEndRef = useRef(cuddleEnd);
  useEffect(() => {
    cuddleMoveRef.current = cuddleMove;
    cuddleTapRef.current = cuddleTap;
    cuddleEndRef.current = cuddleEnd;
  }, [cuddleEnd, cuddleMove, cuddleTap]);
  const onCuddleMoveStage = useCallback((x: number, y: number) => cuddleMoveRef.current(x, y), []);
  const onCuddleTapStage = useCallback((x: number, y: number) => cuddleTapRef.current(x, y), []);
  const onCuddleEndStage = useCallback(() => cuddleEndRef.current(), []);

  const dropRef = useRef(softDropHere);
  const flickRef = useRef(flickHere);
  const strokeRef = useRef(stroke);
  useEffect(() => {
    dropRef.current = softDropHere;
    flickRef.current = flickHere;
    strokeRef.current = stroke;
  }, [flickHere, softDropHere, stroke]);
  const moveFurnitureRef = useRef(moveFurniture);
  useEffect(() => {
    moveFurnitureRef.current = moveFurniture;
  }, [moveFurniture]);
  const holdPiece = useRef<string | null>(null);
  const holdProp = useRef(false);
  const armedMove = useRef<{ id: string; prop: boolean } | null>(null);
  const draggingArmed = useRef(false);
  const holdTargetRef = useRef<{ id: string; prop: boolean; warning: string | null } | null>(null);
  const homePiecesRef = useRef<FurniturePiece[]>(home.pieces);
  const petNameRef = useRef(state?.name ?? 'Your pet');
  useEffect(() => {
    homePiecesRef.current = home.pieces;
    petNameRef.current = state?.name ?? 'Your pet';
  }, [home.pieces, state?.name]);
  const trickDialog = useRef<'good' | 'miss' | null>(null);
  const trickTrack = useRef<string | null>(null);
  const placeIntent = useRef<{ trackId: string; learned: boolean } | null>(null);
  const queuedPlay = useRef<{
    trackId: string;
    outcome: 'success' | 'early' | 'mid' | 'almost';
    dialog: 'good' | 'miss' | null;
    propIds: string[];
  } | null>(null);
  const playCatalogRef = useRef<(trackId: string, learned: boolean, rolled?: boolean) => void>(() => {});
  useEffect(() => {
    if (dialog != null || !queuedPlay.current) {
      return;
    }
    const next = queuedPlay.current;
    queuedPlay.current = null;
    if (stageHandle.current?.startTrick(next.trackId, next.outcome, next.propIds)) {
      trickDialog.current = next.dialog;
      trickTrack.current = next.trackId;
    }
  }, [dialog]);
  const flickPiece = useRef<string | null>(null);
  const pieceAt = useCallback(
    (x: number, y: number) => {
      const point = stagePoint(x, y, viewWidth, viewHeight, contentWidth, stageWidth, logicalH);
      return stageHandle.current?.furnitureAt(point.x, point.y) ?? null;
    },
    [contentWidth, logicalH, viewHeight, viewWidth],
  );
  const closeHold = useCallback(() => {
    holdTargetRef.current = null;
    setHoldConfirm(false);
    setHoldTarget(null);
  }, []);
  const dropMoved = useCallback(
    (id: string, prop: boolean, x: number, y: number) => {
      const point = stagePoint(x, y, viewWidth, viewHeight, contentWidth, stageWidth, logicalH);
      stageHandle.current?.setLifted(null);
      stageHandle.current?.setLiftedProp(null);
      armedMove.current = null;
      draggingArmed.current = false;
      holdPiece.current = null;
      holdProp.current = false;
      if (prop) {
        stageHandle.current?.moveTrickProp(id, point.x, point.y);
        const intent = placeIntent.current;
        placeIntent.current = null;
        if (intent) {
          playCatalogRef.current(intent.trackId, intent.learned);
        }
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        return;
      }
      const placed = stageHandle.current?.moveFurniture(id, point.x, point.y);
      if (placed) {
        moveFurnitureRef.current(id, placed.sceneId, placed.x, placed.y);
      }
      tipsRef.current.performed('tip.move');
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [contentWidth, logicalH, viewHeight, viewWidth],
  );
  const onStageTap = useCallback(
    (x: number, y: number) => {
      tipsRef.current.dismiss();
      if (holdTargetRef.current) {
        closeHold();
        return;
      }
      if (armedMove.current) {
        const armed = armedMove.current;
        armedMove.current = null;
        if (armed.prop) {
          stageHandle.current?.setLiftedProp(null);
        } else {
          stageHandle.current?.setLifted(null);
        }
        return;
      }
      if (stageHandle.current?.heldOn()) {
        const point = stagePoint(x, y, viewWidth, viewHeight, contentWidth, stageWidth, logicalH);
        if (point.x < 96 && point.y > logicalH - 76) {
          stageHandle.current.stopHeld();
          return;
        }
        stageHandle.current.steerHeld(point.x, point.y, false);
        return;
      }
      if (!pieceAt(x, y)) {
        dropRef.current(x, y);
      }
    },
    [closeHold, contentWidth, pieceAt, logicalH, viewHeight, viewWidth],
  );
  const onHoldStart = useCallback(
    (x: number, y: number) => {
      const point = stagePoint(x, y, viewWidth, viewHeight, contentWidth, stageWidth, logicalH);
      const propId = stageHandle.current?.trickPropAt(point.x, point.y) ?? null;
      const armed = armedMove.current;
      const practiceDrag = propId != null && placeIntent.current != null && stageHandle.current?.liftedProp() === propId;
      if (propId && ((armed?.prop && armed.id === propId) || practiceDrag)) {
        holdPiece.current = propId;
        holdProp.current = true;
        stageHandle.current?.moveTrickProp(propId, point.x, point.y);
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        return;
      }
      const pieceId = propId ? null : pieceAt(x, y);
      if (pieceId && armed && !armed.prop && armed.id === pieceId) {
        holdPiece.current = pieceId;
        holdProp.current = false;
        stageHandle.current?.moveFurniture(pieceId, point.x, point.y);
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        return;
      }
      holdPiece.current = null;
      holdProp.current = false;
      const id = propId ?? pieceId;
      if (!id) {
        return;
      }
      const piece = propId ? null : homePiecesRef.current.find((item) => item.id === id);
      const next = {
        id,
        prop: propId != null,
        warning: piece ? stowWarning(piece, petNameRef.current) : null,
      };
      holdTargetRef.current = next;
      setHoldConfirm(false);
      setHoldTarget(next);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [contentWidth, logicalH, pieceAt, viewHeight, viewWidth],
  );
  const onHoldMove = useCallback(
    (x: number, y: number) => {
      const pieceId = holdPiece.current;
      if (!pieceId) {
        return;
      }
      const point = stagePoint(x, y, viewWidth, viewHeight, contentWidth, stageWidth, logicalH);
      if (holdProp.current) {
        stageHandle.current?.moveTrickProp(pieceId, point.x, point.y);
        return;
      }
      stageHandle.current?.moveFurniture(pieceId, point.x, point.y);
    },
    [contentWidth, logicalH, viewHeight, viewWidth],
  );
  const onHoldEnd = useCallback(
    (x: number, y: number) => {
      const pieceId = holdPiece.current;
      const prop = holdProp.current;
      if (!pieceId) {
        return;
      }
      dropMoved(pieceId, prop, x, y);
    },
    [dropMoved],
  );
  const onFlickStart = useCallback(
    (x: number, y: number) => {
      if (stageHandle.current?.heldOn()) {
        const point = stagePoint(x, y, viewWidth, viewHeight, contentWidth, stageWidth, logicalH);
        stageHandle.current.steerHeld(point.x, point.y, true);
        return;
      }
      const armed = armedMove.current;
      if (armed) {
        draggingArmed.current = true;
        const point = stagePoint(x, y, viewWidth, viewHeight, contentWidth, stageWidth, logicalH);
        if (armed.prop) {
          stageHandle.current?.moveTrickProp(armed.id, point.x, point.y);
        } else {
          stageHandle.current?.moveFurniture(armed.id, point.x, point.y);
        }
        return;
      }
      flickPiece.current = pieceAt(x, y);
    },
    [contentWidth, pieceAt, logicalH, viewHeight, viewWidth],
  );
  const onFlickMove = useCallback(
    (x: number, y: number, vx: number, vy: number) => {
      if (stageHandle.current?.heldOn()) {
        const point = stagePoint(x, y, viewWidth, viewHeight, contentWidth, stageWidth, logicalH);
        stageHandle.current.steerHeld(point.x, point.y, true);
        return;
      }
      if (draggingArmed.current && armedMove.current) {
        const point = stagePoint(x, y, viewWidth, viewHeight, contentWidth, stageWidth, logicalH);
        const armed = armedMove.current;
        if (armed.prop) {
          stageHandle.current?.moveTrickProp(armed.id, point.x, point.y);
        } else {
          stageHandle.current?.moveFurniture(armed.id, point.x, point.y);
        }
        return;
      }
      if (flickPiece.current) {
        return;
      }
      stageHandle.current?.setPlayTouch(Math.hypot(vx, vy) >= flickSpeedThreshold);
      void x;
      void y;
      strokeRef.current();
    },
    [contentWidth, logicalH, viewHeight, viewWidth],
  );
  const onFlickFinish = useCallback(
    (x: number, y: number) => {
      stageHandle.current?.setPlayTouch(false);
      if (stageHandle.current?.heldOn()) {
        stageHandle.current.releaseHeldFinger();
      }
      if (draggingArmed.current && armedMove.current) {
        const armed = armedMove.current;
        dropMoved(armed.id, armed.prop, x, y);
      }
    },
    [dropMoved],
  );
  const onFlickEnd = useCallback(
    (x: number, y: number, vx: number, vy: number) => {
      if (stageHandle.current?.heldOn()) {
        const point = stagePoint(x, y, viewWidth, viewHeight, contentWidth, stageWidth, logicalH);
        if (point.x < 96 && point.y > logicalH - 76) {
          stageHandle.current.stopHeld();
          return;
        }
        stageHandle.current.steerHeld(point.x, point.y, false);
        return;
      }
      stageHandle.current?.setPlayTouch(false);
      if (draggingArmed.current && armedMove.current) {
        const armed = armedMove.current;
        dropMoved(armed.id, armed.prop, x, y);
        return;
      }
      const pieceId = flickPiece.current;
      flickPiece.current = null;
      if (pieceId) {
        return;
      }
      if (Math.hypot(vx, vy) >= flickSpeedThreshold) {
        flickRef.current(x, y, vx, vy);
      }
    },
    [contentWidth, dropMoved, logicalH, viewHeight, viewWidth],
  );
  const gesture = useMemo(() => {
    if (cuddleOn) {
      // Cuddle replaces the ball gestures: a drag is a stroke or a scratch, a tap on the nose is a boop.
      const boop = Gesture.Tap()
        .maxDistance(12)
        .onEnd((event, success) => {
          if (success) {
            runOnJS(onCuddleTapStage)(event.x, event.y);
          }
        });
      const drag = Gesture.Pan()
        .minDistance(4)
        .onUpdate((event) => {
          runOnJS(onCuddleMoveStage)(event.x, event.y);
        })
        .onFinalize(() => {
          runOnJS(onCuddleEndStage)();
        });
      return Gesture.Exclusive(boop, drag);
    }
    const tap = Gesture.Tap()
      .maxDuration(250)
      .maxDistance(10)
      .onEnd((event, success) => {
        if (success) {
          runOnJS(onStageTap)(event.x, event.y);
        }
      });
    const hold = Gesture.Pan()
      .activateAfterLongPress(400)
      .onStart((event) => {
        runOnJS(onHoldStart)(event.x, event.y);
      })
      .onUpdate((event) => {
        runOnJS(onHoldMove)(event.x, event.y);
      })
      .onFinalize((event) => {
        runOnJS(onHoldEnd)(event.x, event.y);
      });
    const flick = Gesture.Pan()
      .minDistance(10)
      .onStart((event) => {
        runOnJS(onFlickStart)(event.x, event.y);
      })
      .onUpdate((event) => {
        runOnJS(onFlickMove)(event.x, event.y, event.velocityX, event.velocityY);
      })
      .onEnd((event) => {
        runOnJS(onFlickEnd)(event.x, event.y, event.velocityX, event.velocityY);
      })
      .onFinalize((event) => {
        runOnJS(onFlickFinish)(event.x, event.y);
      });
    return Gesture.Exclusive(tap, hold, flick);
  }, [
    cuddleOn,
    onCuddleEndStage,
    onCuddleMoveStage,
    onCuddleTapStage,
    onFlickEnd,
    onFlickFinish,
    onFlickMove,
    onFlickStart,
    onHoldEnd,
    onHoldMove,
    onHoldStart,
    onStageTap,
  ]);
  const petName = state?.name ?? 'Your pet';

  const toggleCuddle = useCallback(() => {
    if (cuddleOnRef.current) {
      cuddleOnRef.current = false;
      touchActive.current = false;
      cuddleHandle.current?.setGesturing(false);
      setCuddleOn(false);
      setGhost(null);
      tipsRef.current.dismiss();
      return;
    }
    cuddleOnRef.current = true;
    startCuddle();
    setCuddleOn(true);
    setGhost(null);
    setSessionNumber(0);
    tracker.current.reset();
    touchedRef.current = false;
    touchActive.current = false;
    tipsRef.current.offer('tip.cuddle');
    void startCuddleSession().then((session) => {
      if (cuddleOnRef.current) {
        setSessionNumber(session);
      }
    });
  }, [startCuddle]);

  const onCuddleEvent = useCallback(
    (event: CuddleOut | { type: 'interrupted' }) => {
      if (event.type === 'exit') {
        cuddleOnRef.current = false;
        touchActive.current = false;
        setCuddleOn(false);
        setGhost(null);
        flash(
          event.reason === 'tolerance'
            ? `${petName} has had enough cuddles for now.`
            : `${petName} is done cuddling.`,
        );
      } else if (event.type === 'interrupted') {
        cuddleOnRef.current = false;
        touchActive.current = false;
        setCuddleOn(false);
        setGhost(null);
      } else if (event.petted >= 1) {
        tipsRef.current.performed('tip.cuddle');
      }
      if (event.type === 'done' && event.petted >= 2) {
        finishCuddle(event.petted);
      }
    },
    [finishCuddle, flash, petName],
  );

  // The ghost finger strokes the back once if a settled pet goes untouched, for the first few sessions.
  useEffect(() => {
    if (!cuddleOn || tips.current != null || !ghostEligible(sessionNumber)) {
      return undefined;
    }
    let settledAt: number | null = null;
    let shown = false;
    const timer = setInterval(() => {
      if (shown || touchedRef.current) {
        return;
      }
      if (cuddleHandle.current?.phase() !== 'waiting') {
        return;
      }
      settledAt ??= Date.now();
      if (Date.now() - settledAt >= ghostDelayMs) {
        const path = cuddleHandle.current?.backPath();
        if (path) {
          shown = true;
          setGhost({ from: stageToView(path.from), to: stageToView(path.to), key: Date.now() });
        }
      }
    }, 200);
    return () => clearInterval(timer);
  }, [cuddleOn, sessionNumber, stageToView, tips.current]);

  // Keeps the cuddle tip on the pet while the pet settles.
  useEffect(() => {
    if (tips.current !== 'tip.cuddle') {
      return undefined;
    }
    const update = () => {
      const path = cuddleHandle.current?.backPath();
      if (path) {
        setCoachTarget(stageToView({ x: (path.from.x + path.to.x) / 2, y: (path.from.y + path.to.y) / 2 }));
      }
    };
    update();
    const timer = setInterval(update, 300);
    return () => clearInterval(timer);
  }, [stageToView, tips.current]);

  const inventory = economyApi.inventory;

  useEffect(() => {
    const id = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const count = inventory.find((row) => row.itemId === basicTreatId)?.qty ?? 0;
    setCareTreatCount(count);
  }, [inventory, setCareTreatCount]);

  const rememberStage = useCallback(() => {
    let attempt = 0;
    const read = () => {
      const node = stageViewRef.current;
      if (!node) {
        return;
      }
      node.measureInWindow((x, y, width, height) => {
        const decision = acceptStageOrigin({ x, y, width, height }, skippedStageZero.current);
        skippedStageZero.current = decision.skippedZero;
        if (!decision.ok) {
          attempt += 1;
          if (attempt < 8) {
            requestAnimationFrame(read);
          } else {
            setStageReady(true);
          }
          return;
        }
        setStageWindow((prev) => (prev.x === x && prev.y === y ? prev : { x, y }));
        setStageReady(true);
      });
    };
    read();
  }, []);

  const milestones = state?.milestones;
  const [knownMilestones, setKnownMilestones] = useState<string[] | null>(null);
  const [celebrating, setCelebrating] = useState<string | null>(null);
  const [knownUnlockKey, setKnownUnlockKey] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState<string | null>(null);
  const [unlockQueue, setUnlockQueue] = useState<string[]>([]);
  const openTrickKey = state
    ? Object.values(state.training)
        .filter((track) => track.unlocked)
        .map((track) => track.id)
        .sort()
        .join(',')
    : '';
  if (milestones && (knownMilestones == null || milestones.length !== knownMilestones.length)) {
    setKnownMilestones(milestones);
    if (knownMilestones != null) {
      const fresh = milestones.find((id) => !knownMilestones.includes(id) && badgeLabels[id]);
      if (fresh) {
        setCelebrating(fresh);
      }
    }
  }
  if (state && knownUnlockKey !== openTrickKey) {
    const previous = knownUnlockKey;
    setKnownUnlockKey(openTrickKey);
    if (previous != null) {
      const prevIds = previous ? previous.split(',') : [];
      const fresh = openTrickKey.split(',').filter((id) => id && !prevIds.includes(id));
      if (fresh.length > 0) {
        setUnlockQueue((queue) => [...queue, ...fresh]);
      }
    }
  }
  if (state && !celebrating && !unlocking && unlockQueue.length > 0) {
    setUnlocking(unlockQueue[0]);
    setUnlockQueue((queue) => queue.slice(1));
  }
  useEffect(() => {
    if (celebrating) {
      playBadgeChime();
    }
  }, [celebrating]);
  useEffect(() => {
    if (!unlocking) {
      return;
    }
    playBadgeChime();
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [unlocking]);
  const finishCelebration = useCallback(() => setCelebrating(null), []);
  const finishUnlock = useCallback(() => setUnlocking(null), []);

  const preset = sceneById(state?.sceneId ?? 'livingroom');
  const scene = preset;

  useEffect(() => {
    if (!state) {
      return;
    }
    const next = { h: state.hydration, t: 100 - state.needs.hunger, e: state.needs.energy };
    const prev = prevNeeds.current;
    prevNeeds.current = next;
    if (!prev) {
      return;
    }
    if (prev.h >= needThreshold && next.h < needThreshold) {
      tips.offer('tip.water');
    }
    if (prev.t >= needThreshold && next.t < needThreshold) {
      tips.offer('tip.food');
    }
    if (prev.e >= needThreshold && next.e < needThreshold) {
      tips.offer('tip.sleep');
    }
  }, [state, tips]);

  const pieceIds = home.pieces.map((piece) => piece.id).join('|');
  if (pieceIds !== knownPieceIds) {
    const previous = knownPieceIds?.split('|').filter(Boolean) ?? null;
    const added = previous ? pieceIds.split('|').find((id) => id && !previous.includes(id)) : null;
    setKnownPieceIds(pieceIds);
    if (added && tips.propTaps >= 1) {
      setMovePieceId(added);
      tips.offer('tip.move');
    }
  }

  const freshKey = state
    ? [
        state.training.sit?.mastered ? 'sit' : '',
        state.training.paw?.mastered ? 'paw' : '',
        state.training.speak?.mastered ? 'speak' : '',
      ]
        .filter(Boolean)
        .join('|')
    : '';
  const freshIds = freshKey ? freshKey.split('|') : [];
  if (state && popped == null) {
    setPopped(freshIds);
  } else if (popped && freshIds.some((id) => !popped.includes(id))) {
    setPopped([...popped, ...freshIds.filter((id) => !popped.includes(id))]);
  }
  useEffect(() => {
    if (!state) {
      return;
    }
    const feedBlocked = actionReason(scene, 'feed');
    const waterBlocked = actionReason(scene, 'refillWater', state.waterLevel);
    const countPropTap = (kind: TipKind) => {
      const spot = placedInScene(home.pieces, home.placements, scene.id, kind);
      if (spot) {
        setMovePieceId(spot.pieceId);
      }
      const taps = tips.notePropTap();
      if (taps >= 2) {
        tips.offer('tip.move');
      }
    };
    askFeedRef.current = () => {
      if (feedBlocked) {
        flash(feedBlocked);
        tips.dismiss();
        return;
      }
      if (state.foodInBowl) {
        const result = stageHandle.current?.invite('food') ?? 'queued';
        if (result === 'already') {
          flash('The food bowl is already full.');
        }
        tips.dismiss();
        return;
      }
      setPlayOpen(false);
      setTreatOpen(false);
      setFeedNote(null);
      setFeedOpen(true);
    };
    askWaterRef.current = () => {
      if (waterBlocked) {
        flash(waterBlocked);
        tips.dismiss();
        return;
      }
      setPlayOpen(false);
      refillWater();
      stageHandle.current?.invite('water');
      countPropTap('water');
      tips.performed('tip.water');
    };
    askSleepRef.current = () => {
      if (state.asleep) {
        rest();
        tips.dismiss();
        return;
      }
      const result = stageHandle.current?.invite('bed') ?? 'queued';
      if (result === 'already') {
        return;
      }
      setPlayOpen(false);
      countPropTap('bed');
      tips.performed('tip.sleep');
    };
  }, [flash, home.pieces, home.placements, refillWater, rest, scene, state, tips]);

  const tipKind: TipKind | null =
    tips.current === 'tip.water' ? 'water' : tips.current === 'tip.food' ? 'food' : tips.current === 'tip.sleep' ? 'bed' : null;
  const tipSpot = tipKind
    ? placedInScene(home.pieces, home.placements, scene.id, tipKind)
    : tips.current === 'tip.move' && movePieceId
      ? (home.placements.find((spot) => spot.pieceId === movePieceId && spot.sceneId === scene.id) ?? null)
      : null;
  const tipPiece = tipSpot ? home.pieces.find((piece) => piece.id === tipSpot.pieceId) : null;
  const propTip = tipSpot ? stageToView(markerPoint(tipPiece?.kind, tipSpot)) : null;

  const hosted = (screen: ReactNode) => (
    <FindFriendsHost accountHandle={accountHandle} onChanged={() => setFriendTick((value) => value + 1)}>
      {screen}
      {addGate ? (
        <AccountSheet
          reason="friends"
          petName={state?.name ?? 'your pet'}
          onClose={() => {
            setAddGate(false);
            if (!readAccountLinked()) {
              void clearPendingAdd();
            } else {
              setFriendTick((value) => value + 1);
            }
          }}
        />
      ) : null}
    </FindFriendsHost>
  );

  if (!state || !mood) {
    return null;
  }

  if (playdateOpen) {
    return hosted(
      <PlaydateScreen
        pet={state}
        save={playdates.save}
        now={playdates.now}
        remaining={playdates.remaining}
        reducedMotion={reducedMotion}
        onSave={playdates.persist}
        onRewarded={finishPlaydate}
        onClose={() => {
          switchMusic();
          setPlaydateOpen(false);
        }}
        owned={owned}
        linked={readAccountLinked()}
        accountHandle={accountHandle}
      />
    );
  }

  if (settingsOpen) {
    return hosted(
      <>
        <PhoneColumn>
          <SettingsScreen
            petName={state.name}
            pendingFriends={incomingFriends.length}
            careRemindersOn={remindersOn}
            onCareReminders={setRemindersOn}
            onFriendsChanged={() => setFriendTick((value) => value + 1)}
            onClose={() => setSettingsOpen(false)}
          />
        </PhoneColumn>
        <HandlePrompt petName={state.name} idle={false} />
      </>
    );
  }

  if (facingOpen) {
    return hosted(
      <PhoneColumn>
        <FacingLab reducedMotion={reducedMotion} onClose={() => setFacingOpen(false)} />
      </PhoneColumn>
    );
  }

  if (clothingOpen) {
    return hosted(
      <PhoneColumn>
        <ClothingLab reducedMotion={reducedMotion} onClose={() => setClothingOpen(false)} />
      </PhoneColumn>
    );
  }

  if (shopOpen) {
    return hosted(
      <PetShopScreen
        pet={state}
        balance={economyApi.balance}
        inventory={economyApi.inventory}
        toys={home.toys}
        species={breedById(state.breedId)?.species === 'cat' ? 'cat' : 'dog'}
        reducedMotion={reducedMotion}
        onClose={() => setShopOpen(false)}
        onOpenCloset={() => {
          setShopOpen(false);
          setPantryOpen(false);
          setWardrobeOpen(true);
        }}
      />
    );
  }

  if (pantryOpen) {
    return hosted(
      <PhoneColumn>
      <PantryScreen
        inventory={economyApi.inventory}
        onClose={() => setPantryOpen(false)}
        onStore={() => setShopOpen(true)}
        onServe={(itemId) => {
          const used = economyApi.useItem(state, itemId, {}, newRequestId());
          if (used.ok && used.pet) {
            commitPet(used.pet);
          }
        }}
      />
      </PhoneColumn>
    );
  }

  if (wardrobeOpen) {
    return hosted(
      <WardrobeScreen
        pet={state}
        owned={owned}
        equipped={state.equipped}
        boops={economyApi.balance}
        onEquip={equip}
        reducedMotion={reducedMotion}
        onClose={() => setWardrobeOpen(false)}
        onOpenStore={() => setShopOpen(true)}
      />
    );
  }

  const origin = state.attributes.archetype;
  const style = currentStyle(origin, styleBasis(state), state.attributes.potential);
  const styleLine =
    style === origin
      ? archetypeNames[origin]
      : `Born: ${archetypeNames[origin]} · Style: ${archetypeStyleNames[style]}`;
  const species = breedById(state.breedId)?.species ?? 'dog';
  const playableToys = home.toys.filter((id) => playRuleFor(species, id));
  const savedToy = state.activeToyId;
  const activeToy =
    savedToy && playableToys.includes(savedToy)
      ? savedToy
      : playableToys.includes('ball')
        ? 'ball'
        : (playableToys[0] ?? 'ball');

  const tummy = 100 - state.needs.hunger;
  const feedReason = actionReason(scene, 'feed');
  const waterReason = actionReason(scene, 'refillWater', state.waterLevel);
  const careActions = [
    {
      id: 'feed',
      label: 'Feed',
      blocked: !!feedReason,
      need: tummy < needThreshold ? 'Hungry!' : null,
      onPress: () => askFeedRef.current(),
    },
    {
      id: 'refill',
      label: 'Water',
      blocked: !!waterReason,
      need: state.hydration < needThreshold ? 'Thirsty!' : null,
      onPress: () => askWaterRef.current(),
    },
    {
      id: 'treat',
      label: 'Treat',
      onPress: () => {
        tips.dismiss();
        setPlayOpen(false);
        setFeedOpen(false);
        setTreatNote(null);
        setTreatOpen(true);
      },
    },
    {
      id: state.asleep ? 'wake' : 'rest',
      label: state.asleep ? 'Wake' : 'Sleep',
      need: !state.asleep && state.needs.energy < needThreshold ? 'Sleepy!' : null,
      onPress: () => askSleepRef.current(),
    },
  ];
  const bondActions = [
    {
      id: 'cuddle',
      label: 'Cuddle',
      sunk: cuddleOn,
      onLongPress: () => setHelpOpen(true),
      onPress: () => {
        if (!cuddleOnRef.current) {
          const result = stageHandle.current?.pat() ?? 'none';
          if (result === 'bonus') {
            pet();
            applyActorHappiness(GREET.PAT_BONUS);
            return;
          }
          if (result === 'repeat') {
            return;
          }
        }
        tips.dismiss();
        toggleCuddle();
      },
    },
    {
      id: 'play',
      label: 'Play',
      sunk: playOpen,
      onPress: () => {
        tips.dismiss();
        setTreatOpen(false);
        setFeedOpen(false);
        setPlayOpen(true);
      },
    },
    {
      id: 'playdate',
      label: 'Playdate',
      onPress: () => {
        tips.dismiss();
        setPlayOpen(false);
        setWardrobeOpen(false);
        switchMusic();
        setPlaydateOpen(true);
      },
    },
  ];

  const showMoodBurst = (amount: number) => {
    const gain = Math.round(amount);
    if (gain <= 0) {
      return;
    }
    const mood = { color: tints.pink.icon, amount: gain, label: 'Mood' };
    setPops((current) => (current ? [...current, mood] : [mood]));
  };
  const rememberTreat = (before: typeof state.needs, after: typeof state.needs) => {
    const next = [...treatHoldsRef.current, needHold(before, after)];
    treatHoldsRef.current = next;
    setTreatHolds(next);
  };
  const releaseTreatHold = (end: 'oldest' | 'newest') => {
    const queue = treatHoldsRef.current;
    if (queue.length === 0) {
      return;
    }
    const released = end === 'oldest' ? queue[0] : queue[queue.length - 1];
    const next = end === 'oldest' ? queue.slice(1) : queue.slice(0, -1);
    treatHoldsRef.current = next;
    setTreatHolds(next);
    const shown: PointPop[] = [];
    const tummy = Math.round(-released.hunger);
    if (tummy > 0) {
      shown.push({ color: tints.peach.icon, amount: tummy, label: 'Tummy' });
    }
    const energy = Math.round(released.energy);
    if (energy > 0) {
      shown.push({ color: tints.butter.icon, amount: energy, label: 'Energy' });
    }
    if (shown.length > 0) {
      setPops((current) => (current ? [...current, ...shown] : shown));
    }
  };
  const noteGain = (trackId: string, before: typeof state, after: typeof state, deferMood = false) => {
    const steps = shownAttributeSteps(before, after);
    const ordered = [
      ...steps.filter((step) => step.trait !== 'intelligence'),
      ...steps.filter((step) => step.trait === 'intelligence'),
    ];
    const shown: PointPop[] = [];
    const prev = before.training[trackId]?.progress ?? 0;
    const next = after.training[trackId]?.progress ?? 0;
    if (next > prev) {
      shown.push({
        color: trainingPopColor,
        amount: Math.max(1, Math.round(next - prev)),
        label: trackName(trackId, species),
      });
    }
    for (const step of ordered) {
      shown.push({
        color: traitPopColor[step.trait],
        amount: step.delta,
        label: traitLabel[step.trait],
      });
    }
    const moodGain = Math.round(after.needs.happiness - before.needs.happiness);
    if (!deferMood && moodGain > 0) {
      shown.push({ color: tints.pink.icon, amount: moodGain, label: 'Mood' });
    }
    if (shown.length > 0) {
      setPops(shown);
    }
  };
  const afterPayout = (trackId: string, before: typeof state, after: typeof state, deferMood = false) => {
    noteGain(trackId, before, after, deferMood);
    const track = after.training[trackId];
    if (track && !track.mastered && isResting(track, Date.now())) {
      setDialog({ kind: 'break', trackId });
    } else {
      setDialog(null);
    }
  };
  const finishTreatBite = () => {
    const pending = state.care.pendingReward;
    if (pending?.choice !== 'treat') {
      return;
    }
    const paid = resolveTraining('treat');
    if (paid && !paid.waiting) {
      afterPayout(pending.trackId, paid.before, paid.after, true);
    }
  };
  const dialogLive = dialog != null && !(dialog.kind === 'good' && !state.care.pendingReward);
  const biteWaiting = state.care.pendingReward?.choice === 'treat';
  const propTypeOf = (value: string): TrickPropType | null =>
    value === 'podium' || value === 'tunnel' || value === 'hurdle' || value === 'cones' || value === 'hoop' ? value : null;
  const playCatalog = (trackId: string, learned: boolean) => {
    if (state.care.pendingReward?.choice === 'treat') {
      return;
    }
    const listing = trickListing(trackId);
    const track = state.training[trackId];
    if (!listing || !track) {
      return;
    }
    const mastered = learned || track.mastered;
    if (listing.propType && (stageHandle.current?.trickPropIds(listing.propType, true).length ?? 0) === 0) {
      const owned = trickPropsOf(currentOwner()).find((prop) => prop.sourceTrickId === trackId);
      const type = owned ? propTypeOf(owned.type) : null;
      if (owned && type) {
        placeIntent.current = { trackId, learned };
        stageHandle.current?.liftTrickProp({ instanceId: owned.instanceId, type, sourceTrickId: owned.sourceTrickId });
        return;
      }
    }
    let outcome: 'success' | 'early' | 'mid' | 'almost' = 'success';
    let pending: 'good' | 'miss' | null = null;
    if (!mastered) {
      if (isResting(track, clock)) {
        setDialog({ kind: 'break', trackId });
        return;
      }
      const progress = track.progress;
      const result = attemptTrick(trackId);
      if (!result) {
        return;
      }
      if (!result.mastered && result.ok) {
        pending = 'good';
      } else if (!result.mastered && result.confused) {
        outcome = failBand(progress);
        pending = 'miss';
      }
    }
    const ids = listing.propType ? (stageHandle.current?.trickPropIds(listing.propType, mastered) ?? []) : [];
    const started = stageHandle.current?.startTrick(trackId, outcome, ids) ?? false;
    if (!started) {
      queuedPlay.current = { trackId, outcome, dialog: pending, propIds: ids };
      return;
    }
    trickDialog.current = pending;
    trickTrack.current = trackId;
  };
  playCatalogRef.current = playCatalog;
  const practice = (trackId: string) => {
    if (trickTip?.id === trackId) {
      setTrickTip(null);
    }
    if (dialogLive || biteWaiting) {
      return;
    }
    if (trickListing(trackId)) {
      playCatalog(trackId, false);
      return;
    }
    const track = state.training[trackId];
    if (track && isResting(track, clock)) {
      setDialog({ kind: 'break', trackId });
      return;
    }
    if (trackId === 'speak') {
      offerSilentHint();
    }
    const result = attemptTrick(trackId);
    if (!result || result.mastered) {
      return;
    }
    if (result.ok) {
      setDialog({ kind: 'good', trackId });
    } else if (result.confused) {
      setDialog({ kind: 'miss', trackId });
    }
  };
  const learned = Object.values(state.training)
    .filter((track) => track.mastered)
    .map((track) => ({
      id: track.id,
      label: track.id === 'paw' ? (speciesLabel('paw', species) ?? 'Give paw') : trackName(track.id, species),
      onPress: () => {
        if (biteWaiting) {
          return;
        }
        if (trickTip?.id === track.id) {
          setTrickTip(null);
        }
        if (track.id === 'sit') {
          sit();
          return;
        }
        if (track.id === 'paw') {
          givePaw();
          return;
        }
        if (track.id === 'speak') {
          offerSilentHint();
          speak();
          return;
        }
        playCatalog(track.id, true);
      },
    }));
  const tricks = learned.map((trick) => ({
    ...trick,
    fresh: popped != null && !popped.includes(trick.id),
  }));

  const styleActions = [
    {
      id: 'wardrobe',
      label: 'Wardrobe',
      onPress: () => {
        tips.dismiss();
        setWardrobeOpen(true);
      },
    },
    {
      id: 'storage',
      label: 'Storage',
      onPress: () => {
        tips.dismiss();
        const placed = new Set(stageHandle.current?.placedTrickIds() ?? []);
        const props: StorageChoice[] = trickPropsOf(currentOwner())
          .filter((prop) => !placed.has(prop.instanceId))
          .map((prop) => ({
            id: prop.instanceId,
            label: trickListing(prop.sourceTrickId)?.propName ?? prop.type,
            kind: 'prop',
            type: prop.type,
            sourceTrickId: prop.sourceTrickId,
          }));
        const furniture: StorageChoice[] = scene.playerOwned
          ? home.pieces
              .filter((piece) => !home.placements.some((place) => place.pieceId === piece.id))
              .map((piece) => ({
                id: piece.id,
                label: pieceLabel(piece),
                kind: 'furniture' as const,
                sku: shopSku(piece) ?? piece.kind,
                plant: piece.plant,
              }))
          : [];
        setStorageItems(scene.playerOwned ? [...furniture, ...props] : props);
        setStorageEmpty(scene.playerOwned ? 'Nothing in storage.' : 'Furniture stays in your rooms.');
        setStorageOpen(true);
      },
    },
    {
      id: 'personality',
      label: 'Traits',
      onPress: () => {
        tips.dismiss();
        setPersonalityOpen((open) => !open);
      },
    },
    {
      id: soundOn ? 'sound' : 'soundOff',
      label: 'Sounds',
      switch: true,
      checked: soundOn,
      onPress: () => {
        tips.dismiss();
        toggleSound();
      },
    },
    {
      id: musicOn ? 'music' : 'musicOff',
      label: 'Music',
      switch: true,
      checked: musicOn,
      onPress: () => {
        tips.dismiss();
        toggleMusic();
      },
    },
  ];

  const tipBubble =
    tips.current === 'tip.cuddle' && coachTarget
      ? { flavor: 'bond' as const, icon: HandHeart, text: 'Stroke his back or head', bold: 'Stroke', target: coachTarget }
      : tips.current === 'tip.water' && propTip
        ? { flavor: 'care' as const, icon: Droplet, text: `Press Water to give ${petName} a drink`, bold: 'Water', target: propTip }
        : tips.current === 'tip.food' && propTip
          ? { flavor: 'care' as const, icon: Soup, text: 'Press Feed to fill the bowl', bold: 'Feed', target: propTip }
          : tips.current === 'tip.sleep' && propTip
            ? { flavor: 'care' as const, icon: Moon, text: `Press Sleep so ${petName} can nap`, bold: 'Sleep', target: propTip }
            : tips.current === 'tip.move' && propTip
              ? { flavor: 'style' as const, icon: Sparkles, text: 'Hold to move or store', bold: 'Hold', target: propTip }
              : null;

  const sheetTop = split ? 0 : previewBottom;
  const trickTitle = (trackId: string) => trackName(trackId, species);
  const leaveForShop = () => {
    setPlacesOpen(false);
    setDialog(null);
    const stage = stageHandle.current;
    if (!stage) {
      setShopOpen(true);
      return;
    }
    stage.depart(() => setShopOpen(true));
  };
  const shownDialog = dialogLive ? dialog : null;
  let trainingDialog: ReactNode = null;
  if (shownDialog?.kind === 'good') {
    const trackId = shownDialog.trackId;
    const label = trickTitle(trackId);
    trainingDialog = (
      <FunModal
        title={`Good job, ${state.name}!`}
        body={
          atSchool
            ? `Give a treat? Treats are on the house at Training School!`
            : `${state.name} nailed ${label}! Give a treat?\nTreats help ${state.name} learn faster!`
        }
        icon={Bone}
        tint="butter"
        sparkle
        reducedMotion={reducedMotion}
        top={sheetTop}
        primary={{
          label: 'Yes, give treat',
          onPress: () => {
            const startBite = (applied?: typeof state) => {
              const paid = resolveTraining('treat', applied, true);
              if (!paid) {
                return;
              }
              rememberTreat(paid.before.needs, paid.after.needs);
              if (paid.waiting) {
                setDialog(null);
                return;
              }
              afterPayout(trackId, paid.before, paid.after, true);
            };
            if (atSchool) {
              startBite();
              return;
            }
            const used = economyApi.useItem(state, basicTreatId, { context: 'training' }, newRequestId());
            if (!used.ok || !used.pet) {
              const paid = resolveTraining('none');
              if (paid) {
                noteGain(trackId, paid.before, paid.after);
              }
              setDialog({ kind: 'out', trackId });
              return;
            }
            startBite(used.pet);
          },
        }}
        secondary={{
          label: 'No',
          closeFirst: true,
          onPress: () => {
            const paid = resolveTraining('none');
            if (paid) {
              afterPayout(trackId, paid.before, paid.after);
            }
          },
        }}
      />
    );
  } else if (shownDialog?.kind === 'miss') {
    const trackId = shownDialog.trackId;
    const label = trickTitle(trackId);
    trainingDialog = (
      <FunModal
        title="Not quite!"
        body={`${state.name} didn't get ${label} this time. Try again?`}
        icon={CircleHelp}
        tint="lilac"
        reducedMotion={reducedMotion}
        top={sheetTop}
        primary={{
          label: 'Try again',
          onPress: () => {
            if (trackId === 'speak') {
              offerSilentHint();
            }
            const result = attemptTrick(trackId);
            if (!result || result.mastered) {
              setDialog(null);
              return;
            }
            if (result.ok) {
              setDialog({ kind: 'good', trackId });
            } else if (result.confused) {
              setDialog({ kind: 'miss', trackId });
            } else {
              setDialog(null);
            }
          },
        }}
        secondary={{ label: 'Not now', onPress: () => setDialog(null) }}
      />
    );
  } else if (shownDialog?.kind === 'out') {
    const trackId = shownDialog.trackId;
    trainingDialog = (
      <FunModal
        title="Uh oh, no treats left!"
        body={`The Pet Shop has more treats. ${state.name} still had fun practicing.`}
        icon={Cookie}
        tint="peach"
        reducedMotion={reducedMotion}
        top={sheetTop}
        primary={{
          label: 'OK',
          onPress: () => {
            const track = state.training[trackId];
            if (track && !track.mastered && isResting(track, clock)) {
              setDialog({ kind: 'break', trackId });
            } else {
              setDialog(null);
            }
          },
        }}
        secondary={{ label: 'Pet Shop', onPress: () => leaveForShop() }}
      />
    );
  } else if (shownDialog?.kind === 'break') {
    const track = state.training[shownDialog.trackId];
    const remain = track ? formatRest(restRemainingMs(track, clock)) : '0:00';
    const label = trickTitle(shownDialog.trackId);
    const body = track?.hadNoTreat
      ? `${state.name} lost focus! Treats help ${state.name} stay focused longer. ${state.name} can practice again in ${remain}.`
      : `Great work on ${label}! ${state.name} can practice again in ${remain}.`;
    const windOwned = economyApi.inventory.some((row) => row.itemId === 'second_wind' && row.qty > 0);
    const windCheck = economyApi.canAfford('second_wind');
    const windUnavailable = !windCheck.ok && windCheck.reason !== 'insufficient_boops';
    trainingDialog = (
      <FunModal
        title={`${state.name} needs a break!`}
        body={body}
        icon={Moon}
        tint="sky"
        reducedMotion={reducedMotion}
        top={sheetTop}
        primary={{
          label: windOwned ? 'Second Wind' : windUnavailable ? 'OK' : windCheck.ok ? 'Buy Second Wind' : 'Pet Shop',
          onPress: () => {
            if (!windOwned && windUnavailable) {
              setDialog(null);
              return;
            }
            if (!windOwned && !windCheck.ok) {
              leaveForShop();
              return;
            }
            const requestId = newRequestId();
            const used = windOwned
              ? economyApi.useItem(state, 'second_wind', { trickId: shownDialog.trackId }, requestId)
              : economyApi.buyAndUse(state, 'second_wind', { trickId: shownDialog.trackId }, requestId);
            if (!used.ok || !used.pet) {
              flash(!used.ok && used.reason === 'daily_limit' ? 'Second Wind is used up for today.' : 'Could not use that.');
              return;
            }
            commitPet(used.pet, 'speak');
            setDialog(null);
          },
        }}
        secondary={windUnavailable ? undefined : { label: 'OK', onPress: () => setDialog(null) }}
      />
    );
  }

  const placeSpecies = breedById(state.breedId)?.species ?? 'dog';
  const payoutPoint = burst?.origin ?? { x: stageWidth / 2, y: stageHeight * 0.5 };
  const payoutLocal = stageToView(payoutPoint);
  const payoutOrigin = { x: stageWindow.x + payoutLocal.x, y: stageWindow.y + payoutLocal.y };
  const finishBurst = () => {
    if (!burst || paidBurst.current === burst.id) {
      return;
    }
    paidBurst.current = burst.id ?? null;
    counterRef.current?.countBy(burst.amount);
    dismissBurst();
  };

  const homeHeader = (
    <View style={[styles.header, accountHandle ? styles.headerWithHandle : null]}>
      <Image
        source={require('../../assets/icon.png')}
        style={styles.logo}
        accessibilityLabel="Boop Boop"
        accessibilityIgnoresInvertColors
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Settings"
        onPress={() => setSettingsOpen(true)}
        style={styles.settingsHit}
      >
        {({ pressed }) => (
          <CandyShell tint={tints.pink} radius={22} uid="home-settings" pressed={pressed} style={styles.settings}>
            <Settings color={candyInk(tints.pink)} size={22} strokeWidth={iconStroke} />
            {incomingFriends.length > 0 ? <View style={styles.friendBadge} /> : null}
          </CandyShell>
        )}
      </Pressable>
      <View
        accessible
        accessibilityRole="header"
        accessibilityLabel={accountHandle ? `${state.name}, @${accountHandle}` : state.name}
        pointerEvents="none"
        style={[
          styles.nameSlot,
          accountHandle ? styles.nameSlotWithHandle : null,
          {
            paddingLeft: Math.max(148 + (boopEdge - 16), 128),
            paddingRight: 148 + (boopEdge - 16),
          },
        ]}
      >
        <Text style={styles.name} numberOfLines={1}>
          {state.name}
        </Text>
        {accountHandle ? (
          <Text style={styles.accountHandle} numberOfLines={1}>
            @{accountHandle}
          </Text>
        ) : null}
      </View>
      <BoopCounter
        ref={counterRef}
        value={economyApi.balance}
        payoutActive={burst != null}
        pending={pendingBoops}
        fromEdge={boopEdge}
        onPress={() => leaveForShop()}
      />
    </View>
  );

  const sheets = (
    <>
      {trainingDialog}
      {propOpen ? (
        <PropCard
          top={sheetTop}
          props={propChoices}
          onClose={() => setPropOpen(false)}
          onPick={(id) => {
            const owned = propChoices.find((prop) => prop.id === id);
            const type = owned ? propTypeOf(owned.type) : null;
            if (owned && type) {
              stageHandle.current?.liftTrickProp({ instanceId: owned.id, type, sourceTrickId: owned.sourceTrickId });
            }
            setPropOpen(false);
          }}
        />
      ) : null}
      {bowlNotice ? <NoticeSheet top={sheetTop} message={bowlNotice} onClose={() => setBowlNotice(null)} /> : null}
      {storageOpen ? (
        <StorageCard
          top={sheetTop}
          items={storageItems}
          empty={storageEmpty}
          onClose={() => setStorageOpen(false)}
          onPick={(item) => {
            if (item.kind === 'prop') {
              const type = item.type ? propTypeOf(item.type) : null;
              if (type && item.sourceTrickId) {
                stageHandle.current?.liftTrickProp({
                  instanceId: item.id,
                  type,
                  sourceTrickId: item.sourceTrickId,
                });
                armedMove.current = { id: item.id, prop: true };
              }
            } else {
              const piece = home.pieces.find((owned) => owned.id === item.id);
              const blocked = piece ? bowlAlreadyInRoom(home.pieces, home.placements, scene.id, piece.id) : null;
              if (blocked) {
                setBowlNotice(bowlRoomMessage(blocked));
                return;
              }
              const occupant = piece?.kind === 'bed' ? otherBedInRoom(home.pieces, home.placements, scene.id, piece.id) : null;
              if (piece && occupant) {
                const current = home.pieces.find((owned) => owned.id === occupant.pieceId);
                setBedSwap({
                  piece,
                  occupantId: occupant.pieceId,
                  name: current ? pieceLabel(current) : 'bed',
                  x: occupant.x,
                  y: occupant.y,
                });
                setStorageOpen(false);
                return;
              }
              const placed = piece ? stageHandle.current?.showStoredFurniture(piece) : null;
              if (piece && placed) {
                moveFurniture(piece.id, placed.sceneId, placed.x, placed.y);
                armedMove.current = { id: piece.id, prop: false };
              }
            }
            setStorageOpen(false);
          }}
        />
      ) : null}
      {playOpen ? (
        <ToyCard
          top={sheetTop}
          empty="No toys yet."
          toys={playableToys.map((id) => ({ id, label: catalogItem(id)?.name ?? (id === 'ball' ? 'Ball' : id) }))}
          selectedId={state.activeToyId}
          onClose={() => setPlayOpen(false)}
          onPick={(id) => {
            const playing = stageHandle.current?.playKind() ?? null;
            if (playing === id) {
              stageHandle.current?.clearPlay();
              chooseToy(id, 'clear');
              setPlayOpen(false);
              return;
            }
            if (id === 'wand' || id === 'laser') {
              chooseToy(id, 'hold');
              stageHandle.current?.startHeld(id);
            } else {
              stageHandle.current?.clearPlay();
              chooseToy(id, 'throw');
            }
            setPlayOpen(false);
          }}
        />
      ) : null}
      {feedOpen ? (
        <TreatPicker
          choices={foodsInInventory(economyApi.inventory, species)}
          note={feedNote}
          species={species}
          top={sheetTop}
          onClose={() => {
            setFeedOpen(false);
            setFeedNote(null);
          }}
          onPick={(foodId) => {
            const served = () => {
              const spot = placedInScene(home.pieces, home.placements, scene.id, 'food');
              if (spot) {
                setMovePieceId(spot.pieceId);
              }
              const taps = tips.notePropTap();
              if (taps >= 2) {
                tips.offer('tip.move');
              }
              tips.performed('tip.food');
              setFeedOpen(false);
              setFeedNote(null);
            };
            if (foodId === KIBBLE_ID) {
              if (!state.foodInBowl) {
                feed();
              }
              const result = stageHandle.current?.invite('food') ?? 'queued';
              if (result === 'already') {
                setFeedNote('The food bowl is already full.');
                return;
              }
              served();
              return;
            }
            const used = economyApi.useItem(state, foodId, {}, newRequestId());
            if (!used.ok || !used.pet) {
              setFeedNote(
                !used.ok && used.reason === 'full'
                  ? `${state.name} is too full for that.`
                  : !used.ok && used.reason === 'bowl_full'
                    ? 'The food bowl is already full.'
                    : 'No food available.',
              );
              return;
            }
            commitPet({ ...used.pet, asleep: false }, 'eat');
            served();
          }}
        />
      ) : null}
      {treatOpen ? (
        <TreatPicker
          choices={treatsInInventory(economyApi.inventory, species)}
          note={treatNote}
          species={species}
          top={sheetTop}
          onClose={() => {
            setTreatOpen(false);
            setTreatNote(null);
          }}
          onPick={(treatId) => {
            const gate = canGiveTreat(state, treatId);
            if (!gate.ok) {
              setTreatNote(
                gate.reason === 'energy_full'
                  ? 'Already full of energy!'
                  : gate.reason === 'mood_full'
                    ? 'Already super happy!'
                    : gate.reason === 'full'
                      ? `${state.name} is too full for a treat.`
                      : 'No treats available.',
              );
              return;
            }
            const used = economyApi.useItem(state, treatId, { context: 'casual' }, newRequestId());
            if (!used.ok || !used.pet) {
              setTreatNote(
                !used.ok && used.reason === 'energy_full'
                  ? 'Already full of energy!'
                  : !used.ok && used.reason === 'mood_full'
                    ? 'Already super happy!'
                    : !used.ok && used.reason === 'full'
                      ? `${state.name} is too full for a treat.`
                      : 'No treats available.',
              );
              return;
            }
            rememberTreat(state.needs, used.pet.needs);
            offerTreat(treatId, used.pet);
            setTreatOpen(false);
            setTreatNote(null);
          }}
        />
      ) : null}
    </>
  );

  const controls = atSchool ? (
    <>
      <SchoolControls
        ref={schoolRef}
        pet={state}
        species={species}
        balance={economyApi.balance}
        ownerId={state.ownerId || currentOwner()}
        ownedPropTypes={ownedPropTypes}
        now={clock}
        reducedMotion={reducedMotion}
        disabled={dialogLive || biteWaiting}
        highlightId={trickTip?.id ?? null}
        tip={
          trickTip?.first
            ? { id: trickTip.id, name: trickTip.name, propName: trickListing(trickTip.id)?.propName ?? null }
            : null
        }
        onTrain={practice}
        onPerform={(id) => learned.find((trick) => trick.id === id)?.onPress()}
        onProps={
          learned.length > 0
            ? () => {
                setPropChoices(
                  trickPropsOf(currentOwner()).map((prop) => ({
                    id: prop.instanceId,
                    label: trickListing(prop.sourceTrickId)?.propName ?? prop.type,
                    type: prop.type,
                    sourceTrickId: prop.sourceTrickId,
                  })),
                );
                setPropOpen(true);
              }
            : undefined
        }
        onDismissTip={() => setTrickTip(null)}
        onShop={() => setShopOpen(true)}
        onLeave={() => {
          if (state.care.pendingReward) {
            const trackId = state.care.pendingReward.trackId;
            const paid = resolveTraining('none');
            if (paid) {
              noteGain(trackId, paid.before, paid.after);
            }
            setDialog(null);
          }
          setPlacesOpen(true);
        }}
        onBuy={(trick) => {
          const bought = economyApi.buyTrick(state, trick.id, newRequestId());
          if (!bought.ok || !bought.pet) {
            return;
          }
          const first = !readSchoolTrickTip();
          commitPet(bought.pet);
          if (first) {
            setSchoolTrickTip();
          }
          setTrickTip({ id: trick.id, name: trick.name, first });
          schoolRef.current?.showTraining();
        }}
      />
      <CuddleHelpSheet visible={helpOpen} onClose={() => setHelpOpen(false)} />
      <SilentModeHint visible={silentHintOpen} onClose={dismissSilentHint} />
    </>
  ) : (
    <ScrollView style={styles.controls} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {atSchool ? null : (
          <NeedRings
            needs={presentNeeds(state.needs, sumHolds(treatHolds))}
            hydration={state.hydration}
            energyMark={roomRestBadge(home.pieces, home.placements, scene.id, state.asleep)}
          />
        )}
        {welcomeBack ? (
          <Pressable onPress={dismissWelcome} accessibilityRole="button">
            <Text style={styles.hint}>{state.name} missed you!</Text>
          </Pressable>
        ) : null}
        <View style={styles.where}>
          <Text style={styles.sectionTitle}>Where</Text>
          <Pressable
            onPress={() => {
              if (state.care.pendingReward) {
                const trackId = state.care.pendingReward.trackId;
                const paid = resolveTraining('none');
                if (paid) {
                  noteGain(trackId, paid.before, paid.after);
                }
                setDialog(null);
              }
              setPlacesOpen(true);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Go somewhere. ${state.name} is in the ${preset.name}`}
          >
            {({ pressed }) => {
              const flavor = placeFlavors[preset.iconId ?? preset.id] ?? 'peach';
              const tint = tints[flavor];
              const Icon = placeIcons[preset.iconId ?? preset.id] ?? placeIcons.livingroom;
              const ink = candyInk(tint);
              return (
                <CandyShell tint={tint} radius={24} pressed={pressed} uid={whereUid} style={styles.whereRow}>
                  <View style={[styles.whereBubble, { shadowColor: tint.lip }]}>
                    <Icon size={24} strokeWidth={iconStroke + 1} color={tint.icon} />
                  </View>
                  <View style={styles.whereCopy}>
                    <Text style={[styles.whereKicker, { color: ink }]}>{state.name} is in the</Text>
                    <Text style={[styles.whereName, { color: ink }]} numberOfLines={1}>
                      {preset.name}
                    </Text>
                  </View>
                  <View style={[styles.wherePill, { shadowColor: tint.lip }]}>
                    <Text style={[styles.wherePillText, { color: ink }]} numberOfLines={1}>
                      Go somewhere
                    </Text>
                    <ChevronRight size={16} strokeWidth={iconStroke + 1} color={ink} />
                  </View>
                </CandyShell>
              );
            }}
          </Pressable>
        </View>
        <TrainingRings
          pet={state}
          species={species}
          onPractice={practice}
          highlightId={trickTip?.id ?? unlocking}
          reducedMotion={reducedMotion}
          now={clock}
          disabled={dialogLive || biteWaiting}
          freeTreats={atSchool}
          tip={
            trickTip
              ? {
                  id: trickTip.id,
                  bold: trickTip.name,
                  text: `${trickTip.name} was added to your In Training section! Practice it here — or anywhere from Home.`,
                }
              : null
          }
        />
        {playdates.remaining > 0 ? (
          <Text style={styles.hint}>Next playdate in {formatCooldown(playdates.remaining)}</Text>
        ) : null}
        <HomeActionPanel
          species={species}
          reducedMotion={reducedMotion}
          care={careActions}
          bond={bondActions}
          style={styleActions}
          tricks={tricks}
          onProps={
            tricks.length > 0
              ? () => {
                  setPropChoices(
                    trickPropsOf(currentOwner()).map((prop) => ({
                      id: prop.instanceId,
                      label: trickListing(prop.sourceTrickId)?.propName ?? prop.type,
                      type: prop.type,
                      sourceTrickId: prop.sourceTrickId,
                    })),
                  );
                  setPropOpen(true);
                }
              : undefined
          }
        />
        {note ? <Text style={styles.hint}>{note}</Text> : null}
        {personalityOpen ? (
          <View style={styles.personality}>
            <Text style={styles.personalityMeta}>{styleLine}</Text>
            {traits.map((trait) => (
              <Text key={trait} style={styles.score}>
                {traitLabel[trait]} {formatScore(attributeScore(state, trait))} /{' '}
                {state.attributes.potential[trait]}
              </Text>
            ))}
          </View>
        ) : null}
        <CuddleHelpSheet visible={helpOpen} onClose={() => setHelpOpen(false)} />
        <SilentModeHint visible={silentHintOpen} onClose={dismissSilentHint} />
        <DebugPanel
          state={state}
          mood={mood}
          cue={cue}
          onAdvance={advanceBy}
          onAge={setAge}
          onVitality={setVitalityValue}
          onWeight={setWeightValue}
          hour={hour}
          onHour={setHour}
          onReset={reset}
          onNewPet={retire}
          onFlip={() => stageHandle.current?.flipFace()}
          onTimeScale={(scale) => stageHandle.current?.setTimeScale(scale)}
          onPlayGreeting={(id) => stageHandle.current?.playGreeting(id)}
          greetingIds={() => stageHandle.current?.greetingIds() ?? []}
          greetingLabel={() => stageHandle.current?.label() ?? ''}
          onFacing={() => setFacingOpen(true)}
          onClothing={() => setClothingOpen(true)}
          onGrant={(id) => {
            if (!state.ownerId) {
              return;
            }
            void grantDevItem(state.ownerId, species, state.equipped, id);
          }}
        />
    </ScrollView>
  );

  const homeIdle =
    stageReady &&
    !placesOpen &&
    !facingOpen &&
    !clothingOpen &&
    !personalityOpen &&
    !playOpen &&
    !heldPlay &&
    !treatOpen &&
    !feedOpen &&
    !cuddleOn &&
    !helpOpen &&
    !silentHintOpen &&
    !dialogLive &&
    !burst &&
    tips.current == null;

  return hosted(
    <View style={styles.screen}>
      <View
        style={[styles.root, { paddingTop: 64 + duoTop }]}
        accessibilityElementsHidden={placesOpen}
        importantForAccessibility={placesOpen ? 'no-hide-descendants' : 'auto'}
      >
      {celebrating ? (
        <BadgeCelebration
          title={celebrating === 'paw' ? trackName('paw', species) : (badgeLabels[celebrating] ?? 'Badge')}
          reducedMotion={reducedMotion}
          onDone={finishCelebration}
        />
      ) : null}
      {unlocking ? (
        <BadgeCelebration
          title={trackName(unlocking, species)}
          caption="New trick!"
          Icon={Sparkles}
          reducedMotion={reducedMotion}
          onDone={finishUnlock}
        />
      ) : null}
      <View style={styles.layout}>
        {split ? <View style={styles.headerRule}>{homeHeader}</View> : null}
        <View style={split ? styles.splitBody : styles.layout}>
      <View
        style={split ? styles.stagePane : [styles.sticky, shownDialog || treatOpen || feedOpen ? styles.stickyFront : null]}
        onLayout={(event) => {
          const { width, height, y } = event.nativeEvent.layout;
          if (split) {
            setStagePane((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
            return;
          }
          const next = y + height;
          setPreviewBottom((prev) => (prev === next ? prev : next));
        }}
      >
        {split ? null : homeHeader}
        <GestureDetector gesture={gesture}>
          <View
            ref={stageViewRef}
            collapsable={false}
            onLayout={rememberStage}
            style={
              split
                ? { width: '100%', height: '100%', maxWidth: '100%', maxHeight: '100%' }
                : { width: viewWidth, height: viewHeight, alignSelf: 'center', overflow: 'hidden' }
            }
          >
            <PetView
              frame={stageFrame}
              heightShare={!split && atSchool ? schoolStackedHeightShare : undefined}
              cuddleActive={cuddleOn}
              cuddleRef={cuddleHandle}
              stageRef={stageHandle}
              elapsedH={cue.elapsedH}
              energyGain={cue.energyGain}
              snapSceneToken={homeSnapToken}
              onGreeting={rememberGreeting}
              onCuddleEvent={onCuddleEvent}
              pet={state}
              furniture={home.pieces}
              placements={home.placements}
              toys={playableToys}
              playToy={activeToy}
              cueKind={cue.kind}
              cueToken={cue.token}
              treatId={cue.treatId}
              moodGain={cue.moodGain}
              onTreatMood={showMoodBurst}
              onTreatEaten={() => {
                releaseTreatHold('oldest');
                finishTreatBite();
              }}
              onTreatSkipped={() => {
                releaseTreatHold('newest');
                finishTreatBite();
              }}
              drop={cue.drop}
              flick={cue.flick}
              hour={hour}
              reducedMotion={reducedMotion}
              onWeightDelta={applyActorWeight}
              onEnergyDelta={applyActorEnergy}
              onHungerDelta={applyActorHunger}
              onHydrationDelta={applyActorHydration}
              onDrank={reportDrank}
              onAte={reportAte}
              onFellAsleep={beginRest}
              onTrickEnd={() => {
                const trackId = trickTrack.current;
                const kind = trickDialog.current;
                trickDialog.current = null;
                trickTrack.current = null;
                if (kind && trackId) {
                  setDialog({ kind, trackId });
                  return;
                }
                const next = queuedPlay.current;
                queuedPlay.current = null;
                if (next && (stageHandle.current?.startTrick(next.trackId, next.outcome, next.propIds) ?? false)) {
                  trickDialog.current = next.dialog;
                  trickTrack.current = next.trackId;
                }
              }}
              onPlayFind={noteFind}
              onHeld={(on) => {
                setHeldPlay(on);
                if (!on) {
                  chooseToy('', 'clearHeld');
                }
              }}
              parkVisitors
              parkOffers={parkOffers}
              parkStranger={parkStranger}
              onPointAdds={(adds) => {
                const shown: PointAdd[] = [];
                for (const gain of adds) {
                  if (gain.kind === 'mood' && !applyActorHappiness(gain.amount)) {
                    continue;
                  }
                  const view = stageToView({ x: gain.x, y: gain.y });
                  shown.push({ ...gain, x: view.x, y: view.y });
                }
                feedback.current?.pointAdds(shown);
              }}
            />
            {heldPlay ? (
              <View pointerEvents="none" style={styles.heldDone}>
                <Text style={styles.heldDoneText}>Done</Text>
              </View>
            ) : null}
            <CuddleFeedback feedbackRef={feedback} reducedMotion={reducedMotion} />
            {ghost && cuddleOn ? (
              <GhostFinger
                key={ghost.key}
                from={ghost.from}
                to={ghost.to}
                reducedMotion={reducedMotion}
                onDone={() => setGhost(null)}
              />
            ) : null}
            {tipBubble ? (
              <CandyTooltip
                flavor={tipBubble.flavor}
                icon={tipBubble.icon}
                text={tipBubble.text}
                boldWord={tipBubble.bold}
                target={tipBubble.target}
                bounds={{ width: viewWidth, height: viewHeight }}
                reducedMotion={reducedMotion}
              />
            ) : null}
          </View>
        </GestureDetector>
        {holdTarget ? (
          <HoldPieceSheet
            warning={holdTarget.warning}
            confirming={holdConfirm}
            onClose={closeHold}
            onKeep={closeHold}
            onMove={() => {
              const target = holdTarget;
              armedMove.current = { id: target.id, prop: target.prop };
              if (target.prop) {
                stageHandle.current?.setLiftedProp(target.id);
              } else {
                stageHandle.current?.setLifted(target.id);
              }
              closeHold();
            }}
            onStore={() => {
              const target = holdTarget;
              if (target.warning && !holdConfirm) {
                setHoldConfirm(true);
                return;
              }
              if (target.prop) {
                placeIntent.current = null;
                stageHandle.current?.stowTrickProp(target.id);
              } else {
                const woke = stageHandle.current?.stowFurniture(target.id) ?? false;
                stowFurniture(target.id);
                if (woke) {
                  rest();
                }
              }
              armedMove.current = null;
              closeHold();
            }}
          />
        ) : null}
      </View>
      {split ? (
        <FitScale designWidth={phoneColumnWidth} style={styles.controlColumn}>
          {controls}
          {sheets}
        </FitScale>
      ) : (
        <View style={styles.controlsHost}>{controls}</View>
      )}
      {split ? null : sheets}
        </View>
      </View>
      {pops ? <AttributePops pops={pops} reducedMotion={reducedMotion} onDone={clearPops} /> : null}
      </View>
      {bedTip ? (
        <FunModal
          title="New bed"
          body="Your new bed is in Storage. Place it in a room to use it."
          icon={Moon}
          tint="lilac"
          reducedMotion={reducedMotion}
          primary={{ label: 'OK', onPress: () => setBedTip(false) }}
        />
      ) : null}
      {bedSwap ? (
        <FunModal
          title="Swap beds?"
          body={`The ${bedSwap.name} will go to Storage.`}
          icon={Moon}
          tint="lilac"
          reducedMotion={reducedMotion}
          primary={{
            label: 'Swap',
            onPress: () => {
              const swap = bedSwap;
              setBedSwap(null);
              stageHandle.current?.stowFurniture(swap.occupantId);
              stowFurniture(swap.occupantId);
              const shown = stageHandle.current?.showStoredFurniture(swap.piece) ?? null;
              if (shown) {
                stageHandle.current?.moveFurniture(swap.piece.id, swap.x, swap.y);
                moveFurniture(swap.piece.id, scene.id, swap.x, swap.y);
                armedMove.current = { id: swap.piece.id, prop: false };
              }
            },
          }}
          secondary={{ label: 'Cancel', onPress: () => setBedSwap(null) }}
        />
      ) : null}
      {placesOpen ? (
        <View style={styles.placesCover} accessibilityViewIsModal>
          <PhoneColumn>
          <PlacesScreen
            species={placeSpecies}
            currentSceneId={preset.id}
            petName={state.name}
            reducedMotion={reducedMotion}
            onPick={setScene}
            onClose={() => setPlacesOpen(false)}
            onShop={() => leaveForShop()}
          />
          </PhoneColumn>
        </View>
      ) : null}
      {burst && stageReady ? (
        <BoopsPayout
          key={burst.id}
          amount={burst.amount}
          coinCount={burst.coinCount}
          origin={payoutOrigin}
          counter={counterRef}
          reducedMotion={reducedMotion}
          onDone={finishBurst}
        />
      ) : null}
      <HandlePrompt petName={state.name} idle={homeIdle} />
      {requestsOpen && incomingFriends.length > 0 ? (
        <FriendRequestModal
          rows={incomingFriends}
          onClose={() => {
            const newest = newestRequestAt(incomingFriends.map((row) => row.createdAt));
            if (newest) {
              void writeFriendSeenAt(newest);
            }
            setRequestsOpen(false);
            setForceRequests(false);
          }}
          onChanged={() => setFriendTick((value) => value + 1)}
          onAccepted={() => {
            void friendPromptShouldShow('accept').then((show) => {
              if (show) {
                setFriendPrompt(true);
              }
            });
          }}
          onReport={(userId, handle) => setFriendReport({ userId, handle })}
          onBlock={(userId, handle) => setFriendBlock({ userId, handle })}
        />
      ) : null}
      {friendReport ? (
        <ReportSheet
          onClose={() => setFriendReport(null)}
          onPick={(reason, target) => {
            const person = friendReport;
            setFriendReport(null);
            void reportPlayer(person.userId, target, reason).then((result) => {
              if (result.ok) {
                setFriendThanks(person);
              }
            });
          }}
        />
      ) : null}
      {friendThanks ? (
        <ReportThanks
          onClose={() => setFriendThanks(null)}
          onBlock={() => {
            setFriendBlock(friendThanks);
            setFriendThanks(null);
          }}
        />
      ) : null}
      {friendBlock ? (
        <BlockConfirm
          handle={friendBlock.handle}
          onCancel={() => setFriendBlock(null)}
          onBlock={() => {
            const person = friendBlock;
            setFriendBlock(null);
            void blockPlayer(person.userId).then(() => setFriendTick((value) => value + 1));
          }}
        />
      ) : null}
      {friendPrompt ? <FriendNotifyPrompt onClose={() => setFriendPrompt(false)} /> : null}
      <Day3Prompt petName={state.name} idle={homeIdle} />
      <ReauthPrompt petName={state.name} idle={homeIdle} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  heldDone: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    backgroundColor: '#fffaf4',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#e4d3c4',
  },
  heldDoneText: {
    color: '#3a2a22',
    fontSize: 13,
    fontWeight: '600',
  },
  layout: {
    flex: 1,
  },
  headerRule: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D0D8E3',
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
    justifyContent: 'center',
  },
  controlColumn: {
    flexGrow: 0,
    flexShrink: 1,
    flexBasis: phoneColumnWidth,
    maxWidth: phoneColumnWidth,
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
    position: 'relative',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: '#D0D8E3',
  },
  controlsHost: {
    flex: 1,
    minHeight: 0,
  },
  placesCover: {
    ...StyleSheet.absoluteFill,
    zIndex: 20,
    elevation: 20,
  },
  root: {
    flex: 1,
    backgroundColor: '#F4F7FB',
    paddingTop: 64,
  },
  sticky: {
    gap: 12,
    paddingBottom: 8,
    backgroundColor: '#F4F7FB',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D0D8E3',
    zIndex: 1,
  },
  stickyFront: {
    zIndex: 40,
  },
  controls: {
    flex: 1,
    zIndex: 2,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 16,
  },
  header: {
    height: 52,
    justifyContent: 'center',
  },
  // The name stays on the same line as the logo and Boop pill. The handle hangs under it.
  headerWithHandle: {
    height: 68,
  },
  logo: {
    position: 'absolute',
    left: 20,
    top: 2,
    width: 48,
    height: 48,
    borderRadius: 12,
  },
  settingsHit: {
    position: 'absolute',
    left: 76,
    top: 4,
    zIndex: 2,
  },
  settings: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EE5C40',
  },
  // Equal insets keep the name on the screen center. The Boop pill is wider than
  // the logo, so both sides use that wider clearance and a long name still clears it.
  nameSlot: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: 148,
  },
  nameSlotWithHandle: {
    justifyContent: 'flex-start',
    paddingTop: 9,
  },
  name: {
    textAlign: 'center',
    fontFamily: fontFamily.fredokaBold,
    fontSize: 28,
    lineHeight: 34,
    color: '#243044',
  },
  accountHandle: {
    textAlign: 'center',
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 14,
    lineHeight: 18,
    color: '#5C6B80',
  },
  score: {
    fontSize: 14,
    color: '#5C6B80',
  },
  personality: {
    gap: 2,
  },
  personalityMeta: {
    fontSize: 15,
    color: '#243044',
    marginBottom: 4,
  },
  scenes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  scene: {
    backgroundColor: '#E4E8EF',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  sceneLabel: {
    color: '#243044',
    fontSize: 13,
  },
  sceneSelected: {
    backgroundColor: '#2f7d5b',
  },
  sceneSelectedLabel: {
    color: '#fff',
    fontSize: 13,
  },
  learned: {
    gap: 8,
  },
  utilityButtons: {
    marginTop: 16,
  },
  sectionTitle: {
    color: '#243044',
    fontSize: 15,
    fontWeight: '800',
  },
  where: {
    gap: 8,
  },
  whereRow: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
  },
  whereBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    shadowOpacity: 0.35,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  whereCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  whereKicker: {
    fontSize: 12,
    fontWeight: '800',
  },
  whereName: {
    fontSize: 17,
    fontWeight: '900',
  },
  wherePill: {
    height: 36,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    gap: 2,
    paddingHorizontal: 12,
    shadowOpacity: 0.35,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  wherePillText: {
    fontSize: 13,
    fontWeight: '900',
  },
  badge: {
    backgroundColor: '#FFF3C4',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeLabel: {
    color: '#8A4210',
    fontSize: 13,
    fontWeight: '700',
  },
  hint: {
    fontSize: 12.5,
    color: '#5C6B80',
  },
});
