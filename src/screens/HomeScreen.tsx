import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AccessibilityInfo, AppState, Image, Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
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
import { releaseMusic, setMusicEnabled, suspendMusic } from '../audio/music';
import { setSoundEnabled } from '../audio/voice';
import type { CuddleOut } from '../actor';
import { stageHeight, stageWidth } from '../actor/geometry';
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
import { BoopCounter } from '../ui/BoopCounter';
import type { BoopCounterHandle } from '../ui/BoopCounter';
import { fontFamily } from '../ui/font';
import { iconStroke } from '../ui/theme';
import { usePet } from '../state/usePet';
import { usePlayerHome } from '../state/usePlayerHome';
import { useEconomy } from '../economy/useEconomy';
import { basicTreatId } from '../economy/state';
import { catalogItem } from '../economy/catalog';
import { newRequestId, outfitsOwned } from '../economy/service';
import { refreshShopCatalog } from '../economy/shopSync';
import type { ShopCategory } from '../economy/shop';
import { playRuleFor } from '../items/playRules';
import { canGiveTreat, treatsInInventory } from '../treats';
import { trackName } from '../sim/tracks';
import { ghostDelayMs, ghostEligible, startCuddleSession } from '../cuddle/guidance';
import { HomeActionPanel } from '../ui/HomeActionPanel';
import { ToyCard } from '../ui/ToyCard';
import { needThreshold } from '../ui/candyTokens';
import { CandyTooltip } from '../ui/tips/CandyTooltip';
import { useCandyTips } from '../ui/tips/useCandyTips';
import { PlaydateScreen } from './PlaydateScreen';
import { FacingLab } from './FacingLab';
import { WardrobeScreen } from './WardrobeScreen';
import { usePlaydates } from '../state/usePlaydates';
import { formatCooldown } from '../playdate/cooldown';
import { DebugPanel } from '../ui/DebugPanel';
import { NeedRings } from '../ui/NeedRings';
import { TrainingRings } from '../ui/TrainingRings';
import { FunModal } from '../ui/FunModal';
import { TreatPicker } from '../ui/TreatPicker';
import { AttributePops, trainingPopColor, traitPopColor } from '../ui/AttributePops';
import type { PointPop } from '../ui/AttributePops';
import { formatRest, isResting, restRemainingMs } from '../sim/training';
import { BadgeCelebration } from '../ui/BadgeCelebration';
import { Bone, ChevronRight, CircleHelp, Cookie, Droplet, HandHeart, Moon, Soup, Sparkles } from 'lucide-react-native';
import { playBadgeChime } from '../audio/badge';
import { GREET } from '../actor/greetings';
import { PetView } from '../ui/PetView';
import { PhoneColumn } from '../ui/PhoneColumn';
import { useStageSize } from '../ui/useStageSize';
import { isLandscapeSplit, phoneColumnWidth } from '../ui/wideLayout';
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
    attemptTrick,
    resolveTraining,
    moveFurniture,
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
  const [shopTab, setShopTab] = useState<ShopCategory | null>(null);
  const [, setShopStamp] = useState(0);
  const counterRef = useRef<BoopCounterHandle>(null);
  const stageViewRef = useRef<View>(null);
  const [stageWindow, setStageWindow] = useState({ x: 0, y: 0 });
  const [stageReady, setStageReady] = useState(false);
  const paidBurst = useRef<number | null>(null);
  const cancelBurstsRef = useRef(cancelBursts);
  useEffect(() => {
    cancelBurstsRef.current = cancelBursts;
  }, [cancelBursts]);
  const [pops, setPops] = useState<PointPop[] | null>(null);
  const clearPops = useCallback(() => setPops(null), []);
  const [dialog, setDialog] = useState<
    | { kind: 'good' | 'miss' | 'out' | 'break'; trackId: string }
    | null
  >(null);
  const [previewBottom, setPreviewBottom] = useState(0);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const split = isLandscapeSplit(windowWidth, windowHeight);
  const [stagePane, setStagePane] = useState<{ width: number; height: number } | null>(null);
  const stageFrame = split
    ? {
        width: stagePane?.width ?? Math.max(280, windowWidth - phoneColumnWidth),
        height: stagePane?.height ?? windowHeight,
        maxHeightShare: 1,
      }
    : undefined;
  const { viewWidth, viewHeight, contentWidth } = useStageSize(stageFrame);
  const lastStrokeAt = useRef(0);
  const [playdateOpen, setPlaydateOpen] = useState(false);
  const playdates = usePlaydates(state?.ownerId);
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
    setShopTab(null);
  }, [homeSnapToken]);
  const whereUid = useId().replace(/:/g, '');
  const [facingOpen, setFacingOpen] = useState(false);
  const [personalityOpen, setPersonalityOpen] = useState(false);
  const [playOpen, setPlayOpen] = useState(false);
  const [treatOpen, setTreatOpen] = useState(false);
  const [treatNote, setTreatNote] = useState<string | null>(null);
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
      const point = stagePoint(x, y, viewWidth, viewHeight, contentWidth);
      if (point.x < 0 || point.x > stageWidth) {
        return;
      }
      throwAt(point.x, point.y);
    },
    [contentWidth, throwAt, viewHeight, viewWidth],
  );
  const flickHere = useCallback(
    (x: number, y: number, vx: number, vy: number) => {
      const point = stagePoint(x, y, viewWidth, viewHeight, contentWidth);
      if (point.x < 0 || point.x > stageWidth) {
        return;
      }
      const scaleX = stageWidth / Math.max(contentWidth, 1);
      const scaleY = stageHeight / Math.max(viewHeight, 1);
      flickAt(point.x, point.y, vx * scaleX, vy * scaleY);
    },
    [contentWidth, flickAt, viewHeight, viewWidth],
  );
  const stageToView = useCallback(
    (point: { x: number; y: number }) => {
      const pad = (viewWidth - contentWidth) / 2;
      return {
        x: pad + (point.x / stageWidth) * contentWidth,
        y: (point.y / stageHeight) * viewHeight,
      };
    },
    [contentWidth, viewHeight, viewWidth],
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
        const stage = stagePoint(event.x, event.y, viewWidth, viewHeight, contentWidth);
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
    [acceptingTouch, contentWidth, viewHeight, viewWidth],
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
      const stage = stagePoint(x, y, viewWidth, viewHeight, contentWidth);
      sendCuddleEvents(tracker.current.move(x, y, Date.now(), handle.zoneAt(stage.x, stage.y)));
    },
    [contentWidth, sendCuddleEvents, viewHeight, viewWidth],
  );
  const cuddleTap = useCallback(
    (x: number, y: number) => {
      const handle = cuddleHandle.current;
      if (!handle || !acceptingTouch()) {
        return;
      }
      const stage = stagePoint(x, y, viewWidth, viewHeight, contentWidth);
      if (handle.zoneAt(stage.x, stage.y) === 'nose') {
        touchedRef.current = true;
        tipsRef.current.performed('tip.cuddle');
        handle.touch({ kind: 'boop', zone: 'nose', x: stage.x });
      }
    },
    [acceptingTouch, contentWidth, viewHeight, viewWidth],
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
  const flickPiece = useRef<string | null>(null);
  const pieceAt = useCallback(
    (x: number, y: number) => {
      const point = stagePoint(x, y, viewWidth, viewHeight, contentWidth);
      return stageHandle.current?.furnitureAt(point.x, point.y) ?? null;
    },
    [contentWidth, viewHeight, viewWidth],
  );
  const onStageTap = useCallback(
    (x: number, y: number) => {
      const pieceId = pieceAt(x, y);
      if (!pieceId) {
        tipsRef.current.dismiss();
        dropRef.current(x, y);
        return;
      }
      const action = stageHandle.current?.pieceAction(pieceId) ?? null;
      if (!action) {
        tipsRef.current.dismiss();
        return;
      }
      stageHandle.current?.squish(pieceId);
      if (action === 'food') {
        askFeedRef.current();
      } else if (action === 'water') {
        askWaterRef.current();
      } else {
        askSleepRef.current();
      }
    },
    [pieceAt],
  );
  const onHoldStart = useCallback(
    (x: number, y: number) => {
      const pieceId = pieceAt(x, y);
      holdPiece.current = pieceId;
      if (!pieceId) {
        return;
      }
      stageHandle.current?.setLifted(pieceId);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [pieceAt],
  );
  const onHoldMove = useCallback(
    (x: number, y: number) => {
      const pieceId = holdPiece.current;
      if (!pieceId) {
        return;
      }
      const point = stagePoint(x, y, viewWidth, viewHeight, contentWidth);
      stageHandle.current?.moveFurniture(pieceId, point.x, point.y);
    },
    [contentWidth, viewHeight, viewWidth],
  );
  const onHoldEnd = useCallback(
    (x: number, y: number) => {
      const pieceId = holdPiece.current;
      holdPiece.current = null;
      stageHandle.current?.setLifted(null);
      if (!pieceId) {
        return;
      }
      const point = stagePoint(x, y, viewWidth, viewHeight, contentWidth);
      const placed = stageHandle.current?.moveFurniture(pieceId, point.x, point.y);
      if (placed) {
        moveFurnitureRef.current(pieceId, placed.sceneId, placed.x, placed.y);
      }
      tipsRef.current.performed('tip.move');
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [contentWidth, viewHeight, viewWidth],
  );
  const onFlickStart = useCallback(
    (x: number, y: number) => {
      flickPiece.current = pieceAt(x, y);
    },
    [pieceAt],
  );
  const onFlickMove = useCallback((x: number, y: number) => {
    if (flickPiece.current) {
      return;
    }
    void x;
    void y;
    strokeRef.current();
  }, []);
  const onFlickEnd = useCallback(
    (x: number, y: number, vx: number, vy: number) => {
      const pieceId = flickPiece.current;
      flickPiece.current = null;
      if (pieceId) {
        return;
      }
      if (Math.hypot(vx, vy) >= flickSpeedThreshold) {
        flickRef.current(x, y, vx, vy);
      }
    },
    [],
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
        runOnJS(onFlickMove)(event.x, event.y);
      })
      .onEnd((event) => {
        runOnJS(onFlickEnd)(event.x, event.y, event.velocityX, event.velocityY);
      });
    return Gesture.Exclusive(tap, hold, flick);
  }, [
    cuddleOn,
    onCuddleEndStage,
    onCuddleMoveStage,
    onCuddleTapStage,
    onFlickEnd,
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
    stageViewRef.current?.measureInWindow((x, y) => {
      setStageWindow((prev) => (prev.x === x && prev.y === y ? prev : { x, y }));
      setStageReady(true);
    });
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
        ...(['sit', 'speak', 'paw'] as const).filter((id) => state.milestones.includes(id)).map((id) => `badge:${id}`),
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
      setPlayOpen(false);
      if (!state.foodInBowl) {
        feed();
      }
      const result = stageHandle.current?.invite('food') ?? 'queued';
      if (result === 'already') {
        flash('The food bowl is already full.');
        tips.dismiss();
        return;
      }
      countPropTap('food');
      tips.performed('tip.food');
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
  }, [feed, flash, home.pieces, home.placements, refillWater, rest, scene, state, tips]);

  const tipKind: TipKind | null =
    tips.current === 'tip.water' ? 'water' : tips.current === 'tip.food' ? 'food' : tips.current === 'tip.sleep' ? 'bed' : null;
  const tipSpot = tipKind
    ? placedInScene(home.pieces, home.placements, scene.id, tipKind)
    : tips.current === 'tip.move' && movePieceId
      ? (home.placements.find((spot) => spot.pieceId === movePieceId && spot.sceneId === scene.id) ?? null)
      : null;
  const tipPiece = tipSpot ? home.pieces.find((piece) => piece.id === tipSpot.pieceId) : null;
  const propTip = tipSpot ? stageToView(markerPoint(tipPiece?.kind, tipSpot)) : null;

  if (!state || !mood) {
    return null;
  }

  if (playdateOpen) {
    return (
      <PhoneColumn>
      <PlaydateScreen
        pet={state}
        save={playdates.save}
        now={playdates.now}
        remaining={playdates.remaining}
        reducedMotion={reducedMotion}
        onSave={playdates.persist}
        onRewarded={finishPlaydate}
        onClose={() => setPlaydateOpen(false)}
        owned={owned}
      />
      </PhoneColumn>
    );
  }

  if (facingOpen) {
    return (
      <PhoneColumn>
        <FacingLab reducedMotion={reducedMotion} onClose={() => setFacingOpen(false)} />
      </PhoneColumn>
    );
  }

  if (shopTab) {
    return (
      <PetShopScreen
        pet={state}
        balance={economyApi.balance}
        inventory={economyApi.inventory}
        toys={home.toys}
        species={breedById(state.breedId)?.species === 'cat' ? 'cat' : 'dog'}
        initialTab={shopTab}
        reducedMotion={reducedMotion}
        onClose={() => setShopTab(null)}
        onOpenCloset={() => {
          setShopTab(null);
          setPantryOpen(false);
          setWardrobeOpen(true);
        }}
      />
    );
  }

  if (pantryOpen) {
    return (
      <PhoneColumn>
      <PantryScreen
        inventory={economyApi.inventory}
        onClose={() => setPantryOpen(false)}
        onStore={() => setShopTab('treats')}
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
    return (
      <WardrobeScreen
        pet={state}
        owned={owned}
        equipped={state.equipped}
        onEquip={equip}
        reducedMotion={reducedMotion}
        onClose={() => setWardrobeOpen(false)}
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
  const dialogLive = dialog != null && !(dialog.kind === 'good' && !state.care.pendingReward);
  const practice = (trackId: string) => {
    if (dialogLive) {
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
  const learned = [
    ...(state.training.sit?.mastered ? [{ id: 'sit', label: 'Sit', onPress: sit }] : []),
    ...(state.training.paw?.mastered
      ? [{ id: 'paw', label: speciesLabel('paw', species) ?? 'Give paw', onPress: givePaw }]
      : []),
    ...(state.training.speak?.mastered
      ? [
          {
            id: 'speak',
            label: 'Speak',
            onPress: () => {
              offerSilentHint();
              speak();
            },
          },
        ]
      : []),
  ];
  const badgeIds = ['sit', 'speak', 'paw'] as const;
  const tricks = learned.map((trick) => ({
    ...trick,
    fresh: popped != null && !popped.includes(trick.id),
  }));
  const badgeCoins = badgeIds.flatMap((id) => {
    if (!state.milestones.includes(id)) {
      return [];
    }
    return [
      {
        id,
        label: id === 'paw' ? (speciesLabel('paw', species) ?? 'Paw') : badgeLabels[id],
        fresh: popped != null && !popped.includes(`badge:${id}`),
      },
    ];
  });

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
        ? { flavor: 'care' as const, icon: Droplet, text: 'Tap the bowl to give Z water', bold: 'Tap', target: propTip }
        : tips.current === 'tip.food' && propTip
          ? { flavor: 'care' as const, icon: Soup, text: 'Tap the bowl to feed Z', bold: 'Tap', target: propTip }
          : tips.current === 'tip.sleep' && propTip
            ? { flavor: 'care' as const, icon: Moon, text: 'Tap the bed so Z can nap', bold: 'Tap', target: propTip }
            : tips.current === 'tip.move' && propTip
              ? { flavor: 'style' as const, icon: Sparkles, text: 'Hold to move things around', bold: 'Hold', target: propTip }
              : null;

  const sheetTop = split ? 0 : previewBottom;
  const trickTitle = (trackId: string) => trackName(trackId, species);
  const leaveForShop = (tab: ShopCategory) => {
    setPlacesOpen(false);
    setDialog(null);
    const stage = stageHandle.current;
    if (!stage) {
      setShopTab(tab);
      return;
    }
    stage.depart(() => setShopTab(tab));
  };
  const shownDialog = dialogLive ? dialog : null;
  let trainingDialog: ReactNode = null;
  if (shownDialog?.kind === 'good') {
    const trackId = shownDialog.trackId;
    const label = trickTitle(trackId);
    trainingDialog = (
      <FunModal
        title={`Good job, ${state.name}!`}
        body={`${state.name} nailed ${label}! Give a treat?\nTreats help ${state.name} learn faster!`}
        icon={Bone}
        tint="butter"
        sparkle
        reducedMotion={reducedMotion}
        top={sheetTop}
        primary={{
          label: 'Yes, give treat',
          onPress: () => {
            const used = economyApi.useItem(state, basicTreatId, { context: 'training' }, newRequestId());
            if (!used.ok || !used.pet) {
              const paid = resolveTraining('none');
              if (paid) {
                noteGain(trackId, paid.before, paid.after);
              }
              setDialog({ kind: 'out', trackId });
              return;
            }
            const paid = resolveTraining('treat', used.pet);
            if (paid) {
              afterPayout(trackId, paid.before, paid.after, true);
            }
          },
        }}
        secondary={{
          label: 'No',
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
        secondary={{ label: 'Pet Shop', onPress: () => leaveForShop('treats') }}
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
              leaveForShop('boosts');
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
    <View style={styles.header}>
      <Image
        source={require('../../assets/icon.png')}
        style={styles.logo}
        accessibilityLabel="Boop Boop"
        accessibilityIgnoresInvertColors
      />
      <View pointerEvents="none" style={styles.nameSlot}>
        <Text accessibilityRole="header" style={styles.name} numberOfLines={1}>
          {state.name}
        </Text>
      </View>
      <BoopCounter
        ref={counterRef}
        value={economyApi.balance}
        payoutActive={burst != null}
        pending={pendingBoops}
        onPress={() => leaveForShop('treats')}
      />
    </View>
  );

  const sheets = (
    <>
      {trainingDialog}
      {playOpen ? (
        <ToyCard
          top={sheetTop}
          empty="No toys yet."
          toys={playableToys.map((id) => ({ id, label: catalogItem(id)?.name ?? (id === 'ball' ? 'Ball' : id) }))}
          onClose={() => setPlayOpen(false)}
          onPick={(id) => {
            const swapped = stageHandle.current?.swapToy(id) ?? false;
            chooseToy(id, !swapped);
            setPlayOpen(false);
          }}
        />
      ) : null}
      {treatOpen ? (
        <TreatPicker
          choices={treatsInInventory(economyApi.inventory, species)}
          note={treatNote}
          reducedMotion={reducedMotion}
          top={sheetTop}
          onClose={() => {
            setTreatOpen(false);
            setTreatNote(null);
          }}
          onPick={(treatId) => {
            const gate = canGiveTreat(state, treatId);
            if (!gate.ok) {
              setTreatNote(
                gate.reason === 'full' ? `${state.name} is too full for a treat.` : 'No treats available.',
              );
              return;
            }
            const used = economyApi.useItem(state, treatId, { context: 'casual' }, newRequestId());
            if (!used.ok || !used.pet) {
              setTreatNote(
                !used.ok && used.reason === 'full' ? `${state.name} is too full for a treat.` : 'No treats available.',
              );
              return;
            }
            offerTreat(treatId, used.pet);
            setTreatOpen(false);
            setTreatNote(null);
          }}
        />
      ) : null}
    </>
  );

  return (
    <View style={styles.screen}>
      <View
        style={styles.root}
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
        style={split ? styles.stagePane : [styles.sticky, shownDialog || treatOpen ? styles.stickyFront : null]}
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
            style={{ width: viewWidth, height: viewHeight, alignSelf: 'center' }}
          >
            <PetView
              frame={stageFrame}
              cuddleActive={cuddleOn}
              cuddleRef={cuddleHandle}
              stageRef={stageHandle}
              elapsedH={cue.elapsedH}
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
              shimmerIds={[
                tips.seen('tip.water') && state.hydration < needThreshold
                  ? (placedInScene(home.pieces, home.placements, scene.id, 'water')?.pieceId ?? null)
                  : null,
                tips.seen('tip.food') && tummy < needThreshold
                  ? (placedInScene(home.pieces, home.placements, scene.id, 'food')?.pieceId ?? null)
                  : null,
                tips.seen('tip.sleep') && state.needs.energy < needThreshold
                  ? (placedInScene(home.pieces, home.placements, scene.id, 'bed')?.pieceId ?? null)
                  : null,
              ].filter((id): id is string => id != null)}
              onPlayFind={noteFind}
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
      </View>
      <View style={split ? styles.controlColumn : styles.controlsHost}>
      <ScrollView style={styles.controls} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <NeedRings needs={state.needs} hydration={state.hydration} />
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
                    <Text style={[styles.wherePillText, { color: ink }]}>Go somewhere</Text>
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
          highlightId={unlocking}
          reducedMotion={reducedMotion}
          now={clock}
          disabled={dialogLive}
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
          badges={badgeCoins}
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
        />
      </ScrollView>
      {split ? sheets : null}
      </View>
      {split ? null : sheets}
        </View>
      </View>
      {pops ? <AttributePops pops={pops} reducedMotion={reducedMotion} onDone={clearPops} /> : null}
      </View>
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
            onShop={() => leaveForShop('treats')}
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
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
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlColumn: {
    width: phoneColumnWidth,
    flexShrink: 0,
    minHeight: 0,
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
  logo: {
    position: 'absolute',
    left: 20,
    top: 2,
    width: 48,
    height: 48,
    borderRadius: 12,
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
  name: {
    textAlign: 'center',
    fontFamily: fontFamily.fredokaBold,
    fontSize: 28,
    lineHeight: 34,
    color: '#243044',
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
