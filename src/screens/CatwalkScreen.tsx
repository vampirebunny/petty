import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { ChevronLeft, Clock } from 'lucide-react-native';

import { breedById } from '../actor/breeds';
import { outfitSlots, wearItem } from '../actor/wardrobe';
import { track, trackScreen } from '../analytics/analytics';
import { listenPreview, previewRunwayTrack, stopRunwayPreview } from '../audio/runwayPreview';
import { syncCatwalkMusic } from '../audio/remoteCatwalkMusic';
import { readAccountLinked, serverNow } from '../db/accountMeta';
import { loadFriends } from '../friends/api';
import type { FriendRow } from '../friends/types';
import { recordFormatEntered } from '../invites/store';
import type { RunwayInvitation } from '../invites/types';
import { allCostumes, costumeById, runwayThemes, runwayTracks, themeById, type RunwayThemeId } from '../runway/catalog';
import { runwayConfig } from '../runway/config';
import {
  castRunwayVote,
  createRunwayShow,
  getRunwayShow,
  hideRunwayShowRemote,
  listMyRunwayShows,
  notifyRunwayShow,
  respondRunwayInvite,
  runwayErrorCopy,
  submitRunwayLooks,
} from '../runway/friendShows';
import { equipFromDraft } from '../runway/lookEquip';
import { buildSoloShow, freezePlayerLooks } from '../runway/npcs';
import { friendNextUnlockAt, friendUnlockCount, soloShowRackIds } from '../runway/rack';
import {
  joinedShowHint,
  lobbyShowLabel,
  localShowFromDetail,
  mergeShowDetails,
  mySubmissionId,
  routeShow,
  showInJoinedLobby,
  showNeedsLooks,
  submissionsAreClosed,
  votingStillOpen,
  type RunwayContestant,
  type RunwayShowDetail,
  type RunwayShowSummary,
  type RecentInvitee,
  type ShowStep,
} from '../runway/showRead';
import {
  deleteSoloShow,
  hideFriendShow,
  loadRunwaySave,
  loadSeenClosedSubmissions,
  loadSeenResults,
  markClosedSubmissionsSeen,
  markResultsSeen,
  rememberShow,
  saveRunwaySave,
  visibleShows,
} from '../runway/storage';
import type { LocalRunwayShow } from '../runway/types';
import type { Equipped, OutfitSlot, PetState } from '../sim/types';
import { AccountSheet } from '../ui/AccountSheet';
import { ClosetSection } from '../ui/closet/ClosetSection';
import { tileColumns } from '../ui/closet/closetStyle';
import { fontFamily } from '../ui/font';
import { FunModal } from '../ui/FunModal';
import { OutfitPreview, useOutfitClock } from '../ui/OutfitPreview';
import { BackstageStage, LobbyBanner, ThemeBanner } from '../ui/runway/CatwalkArt';
import { CatwalkFrame } from '../ui/runway/CatwalkFrame';
import { CostumeTile } from '../ui/runway/CostumeTile';
import { MusicMenu } from '../ui/runway/MusicMenu';
import { RunwayView } from '../ui/runway/RunwayView';
import { CandyButton } from '../ui/stadium/CandyButton';
import { ink, softInk } from '../ui/stadium/parts';
import { iconStroke } from '../ui/theme';
import { isLandscapeSplit, phoneColumnWidth } from '../ui/wideLayout';

function chunk<T>(items: T[], cols: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += cols) {
    rows.push(items.slice(i, i + cols));
  }
  return rows;
}

function formatWhen(ms: number): string {
  return new Date(ms).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
}

function formatRemain(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function initial(handle: string): string {
  return (handle.replace(/^@/, '').charAt(0) || '?').toUpperCase();
}

function whoLabel(row: RunwayContestant): string {
  const pet = row.petName ? ` · ${row.petName}` : '';
  return row.isMe ? `You${pet}` : `@${row.handle}${pet}`;
}

type Props = {
  pet: PetState;
  ownerId: string;
  owned: readonly { slot: OutfitSlot; id: string }[];
  reducedMotion: boolean;
  /** Seeded NPC show from an invitation. Starts on the three-look step. */
  seed?: RunwayInvitation | null;
  /** Live friend show opened from a push. */
  showId?: string | null;
  onClose: () => void;
};

type Step = 'lobby' | 'theme' | 'invite' | ShowStep | 'runway' | 'past';

type DraftLook = {
  lookNumber: 1 | 2 | 3;
  wardrobe: Equipped;
  costumes: string[];
};

function emptyLooks(equipped: Equipped): DraftLook[] {
  return [
    { lookNumber: 1, wardrobe: { ...equipped }, costumes: [] },
    { lookNumber: 2, wardrobe: {}, costumes: [] },
    { lookNumber: 3, wardrobe: {}, costumes: [] },
  ];
}

function phoneArtHeight(step: Step, width: number): number {
  const w = Math.min(width, 560);
  if (step === 'lobby' || step === 'past' || step === 'judge') {
    return Math.round(w * (180 / 350));
  }
  if (step === 'backstage') {
    return Math.round(w * 0.78);
  }
  // Theme stills are 4:3, so the hero matches the thumbnail framing.
  return Math.round(w * 0.75);
}

export function CatwalkScreen({ pet, ownerId, owned, reducedMotion, seed = null, showId = null, onClose }: Props) {
  const { width, height } = useWindowDimensions();
  const split = isLandscapeSplit(width, height);
  const previewClock = useOutfitClock(reducedMotion);

  const [step, setStep] = useState<Step>(seed ? 'backstage' : 'lobby');
  const [hosting, setHosting] = useState(false);
  const [themeId, setThemeId] = useState<RunwayThemeId>(seed?.themeId ?? 'royal');
  const [trackId, setTrackId] = useState(seed?.trackId ?? runwayTracks[0]?.id ?? 'fashion-show-music');
  const [looks, setLooks] = useState<DraftLook[]>(() => emptyLooks(pet.equipped));
  const [lookIndex, setLookIndex] = useState(0);
  const [show, setShow] = useState<LocalRunwayShow | null>(null);
  const [viewerId, setViewerId] = useState<string | undefined>();
  const [watchReturn, setWatchReturn] = useState<Step>('lobby');
  const [history, setHistory] = useState<LocalRunwayShow[]>([]);
  const [remoteShows, setRemoteShows] = useState<RunwayShowSummary[]>([]);
  const [seenResults, setSeenResults] = useState<string[]>([]);
  const [seenClosed, setSeenClosed] = useState<string[]>([]);
  const [recent, setRecent] = useState<RecentInvitee[]>([]);
  const [detail, setDetail] = useState<RunwayShowDetail | null>(null);
  const [liveId, setLiveId] = useState<string | null>(seed ? null : showId);
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [friendQuery, setFriendQuery] = useState('');
  const [chosen, setChosen] = useState<string[]>([]);
  const [deadlineMinutes, setDeadlineMinutes] = useState<15 | 30 | 60 | 1440>(15);
  const [voteFor, setVoteFor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [soloShowId] = useState(() => seed?.showId ?? `solo-${ownerId}-${Date.now()}`);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const npcFriend = Boolean(seed && seed.type === 'runway');
  const liveFriend = !npcFriend && liveId != null;

  useEffect(() => {
    trackScreen('catwalk');
    void syncCatwalkMusic();
    return () => stopRunwayPreview();
  }, []);

  useEffect(() => listenPreview(setPreviewId), []);

  useEffect(() => {
    if (step !== 'invite' && step !== 'backstage') {
      stopRunwayPreview();
    }
  }, [step]);

  useEffect(() => {
    if (step !== 'backstage' && step !== 'status' && step !== 'vote' && step !== 'results' && step !== 'lobby') {
      return;
    }
    const timer = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [step]);

  const refreshHistory = useCallback(async () => {
    const save = await loadRunwaySave(ownerId);
    setHistory(visibleShows(save));
  }, [ownerId]);

  const refreshRemote = useCallback(async () => {
    if (!readAccountLinked()) {
      return;
    }
    const result = await listMyRunwayShows();
    if (!result.ok) {
      return;
    }
    setRemoteShows(result.data.shows);
    setRecent(result.data.recent);
  }, []);

  const petRef = useRef(pet);
  useEffect(() => {
    petRef.current = pet;
  }, [pet]);

  const openDetail = useCallback((next: RunwayShowDetail, force?: Step) => {
    setDetail(next);
    setLiveId(next.id);
    const theme = themeById(next.themeId);
    if (theme) {
      setThemeId(theme.id);
    }
    if (next.trackId) {
      setTrackId(next.trackId);
    }
    setError(null);
    const routed = force ?? routeShow(next, Date.now());
    if (routed === 'backstage') {
      setLooks(emptyLooks(petRef.current.equipped));
      setLookIndex(0);
    }
    if (!force && routed === 'vote' && next.submissions.length > 0) {
      setShow(localShowFromDetail(next));
      setViewerId(mySubmissionId(next));
      setWatchReturn('vote');
      setStep('runway');
      return;
    }
    setStep(routed);
  }, []);

  useEffect(() => {
    if (!showId || seed) {
      return;
    }
    let alive = true;
    void getRunwayShow(showId).then((result) => {
      if (!alive) {
        return;
      }
      if (!result.ok) {
        setError(runwayErrorCopy(result.error));
        setStep('lobby');
        return;
      }
      openDetail(result.data);
    });
    return () => {
      alive = false;
    };
  }, [openDetail, seed, showId]);

  useEffect(() => {
    if (step !== 'status' || !liveId || npcFriend) {
      return;
    }
    let alive = true;
    const pull = () => {
      void getRunwayShow(liveId).then((result) => {
        if (!alive || !result.ok) {
          return;
        }
        const routed = routeShow(result.data, Date.now());
        if (routed === 'vote' || routed === 'results') {
          openDetail(result.data);
          return;
        }
        setDetail((current) => (current && current.id === result.data.id ? mergeShowDetails(current, result.data) : result.data));
      });
    };
    pull();
    const timer = setInterval(pull, 15_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [step, liveId, npcFriend, openDetail]);

  useEffect(() => {
    if (step !== 'lobby' && step !== 'past') {
      return;
    }
    let alive = true;
    if (readAccountLinked()) {
      void listMyRunwayShows().then((result) => {
        if (!alive) {
          return;
        }
        if (!result.ok) {
          setError(runwayErrorCopy(result.error));
          return;
        }
        setError(null);
        setRemoteShows(result.data.shows);
        setRecent(result.data.recent);
      });
    }
    void loadRunwaySave(ownerId).then((save) => {
      if (!alive) {
        return;
      }
      setHistory(visibleShows(save));
    });
    void loadSeenResults(ownerId).then((seen) => {
      if (alive) {
        setSeenResults(seen);
      }
    });
    void loadSeenClosedSubmissions(ownerId).then((seen) => {
      if (alive) {
        setSeenClosed(seen);
      }
    });
    return () => {
      alive = false;
    };
  }, [ownerId, step]);

  const resultsShowId = step === 'results' && detail?.resultsRevealedAt != null ? detail.id : null;
  useEffect(() => {
    if (!resultsShowId) {
      return;
    }
    void markResultsSeen(ownerId, resultsShowId).then(setSeenResults);
  }, [ownerId, resultsShowId]);

  useEffect(() => {
    if (step !== 'invite') {
      return;
    }
    let alive = true;
    void loadFriends().then((bundle) => {
      if (alive) {
        setFriends(bundle.friends);
      }
    });
    return () => {
      alive = false;
    };
  }, [step]);

  const npcTaken = useMemo(() => {
    if (npcFriend && seed) {
      return new Set(seed.npcSubmissions.flatMap((row) => row.claimedCostumeIds));
    }
    return new Set(detail?.claimedCostumeIds ?? []);
  }, [detail?.claimedCostumeIds, npcFriend, seed]);

  const invitesSentAt = seed?.createdAt ?? detail?.invitesSentAt ?? nowTick;
  const rack = allCostumes();
  const soloOpenIds = useMemo(() => new Set(soloShowRackIds(soloShowId)), [soloShowId]);
  const unlockedCount = liveFriend ? friendUnlockCount(invitesSentAt, nowTick) : soloOpenIds.size;
  const nextUnlockAt = liveFriend ? friendNextUnlockAt(invitesSentAt, nowTick) : null;
  const costumeLocked = (costumeId: string) => {
    if (!liveFriend) {
      return !soloOpenIds.has(costumeId);
    }
    return rack.findIndex((piece) => piece.id === costumeId) >= unlockedCount;
  };

  const current = looks[lookIndex] ?? looks[0];
  const draftEquip = useMemo(
    () => equipFromDraft(current.wardrobe, current.costumes),
    [current.costumes, current.wardrobe],
  );

  const toggleWardrobe = (slot: OutfitSlot, id: string) => {
    setLooks((rows) =>
      rows.map((look, i) => {
        if (i !== lookIndex) {
          return look;
        }
        const next = { ...look.wardrobe };
        if (next[slot] === id) {
          delete next[slot];
          return { ...look, wardrobe: next };
        }
        next[slot] = id;
        const costumes = look.costumes.filter((costumeId) => costumeById(costumeId)?.slot !== slot);
        return { ...look, wardrobe: next, costumes };
      }),
    );
  };

  const toggleCostume = (costumeId: string) => {
    const piece = costumeById(costumeId);
    if (!piece || npcTaken.has(costumeId) || costumeLocked(costumeId)) {
      return;
    }
    setLooks((rows) =>
      rows.map((look, i) => {
        if (i !== lookIndex) {
          return look;
        }
        if (look.costumes.includes(costumeId)) {
          return { ...look, costumes: look.costumes.filter((id) => id !== costumeId) };
        }
        const wardrobe = { ...look.wardrobe };
        if (piece.slot !== 'back') {
          delete wardrobe[piece.slot];
        }
        const costumes = look.costumes.filter((id) => costumeById(id)?.slot !== piece.slot);
        return { ...look, wardrobe, costumes: [...costumes, costumeId] };
      }),
    );
  };

  const looksValid = looks.every((look) => look.costumes.length + Object.keys(look.wardrobe).length > 0);

  const goBack = () => {
    stopRunwayPreview();
    setError(null);
    if (step === 'lobby') {
      onClose();
      return;
    }
    if (step === 'theme') {
      setStep('lobby');
      return;
    }
    if (step === 'invite') {
      setStep('theme');
      return;
    }
    if (step === 'backstage') {
      if (npcFriend) {
        onClose();
        return;
      }
      if (liveFriend) {
        setStep('lobby');
        return;
      }
      setStep('theme');
      return;
    }
    setStep('lobby');
  };

  const startSolo = async () => {
    if (!looksValid || busy) {
      setError('Each look needs at least one piece.');
      return;
    }
    setBusy(true);
    setError(null);
    stopRunwayPreview();
    try {
      const species = breedById(pet.breedId)?.species === 'cat' ? 'cat' : 'dog';
      const built = buildSoloShow({
        ownerId,
        themeId,
        trackId,
        showId: seed?.showId ?? soloShowId,
        npcSubmissions: seed?.npcSubmissions,
        pet: {
          snapshotId: `self-${pet.id}`,
          source: 'self',
          name: pet.name,
          species,
          breedId: pet.breedId,
          look: { ...pet.look },
          ageDays: pet.ageDays,
          weight: pet.weight,
        },
        playerLooks: looks,
      });
      const save = await loadRunwaySave(ownerId);
      await saveRunwaySave(ownerId, rememberShow(save, built));
      setShow(built);
      setViewerId(built.submissions[0]?.submissionId);
      setWatchReturn('lobby');
      setStep('runway');
      void recordFormatEntered(ownerId, 'runway', pet.openedDays);
      await refreshHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the show.');
    } finally {
      setBusy(false);
    }
  };

  const submitLive = async () => {
    if (!liveId || !looksValid || busy) {
      setError('Each look needs at least one piece.');
      return;
    }
    setBusy(true);
    setError(null);
    stopRunwayPreview();
    const frozen = freezePlayerLooks(looks);
    const species = breedById(pet.breedId)?.species === 'cat' ? 'cat' : 'dog';
    const result = await submitRunwayLooks(
      liveId,
      {
        snapshotId: `self-${pet.id}`,
        source: 'self',
        name: pet.name,
        species,
        breedId: pet.breedId,
        look: { ...pet.look },
        ageDays: pet.ageDays,
        weight: pet.weight,
      },
      pet.name,
      frozen.looks,
      [...new Set(frozen.claimed)],
    );
    if (!result.ok) {
      setError(runwayErrorCopy(result.error));
      setBusy(false);
      return;
    }
    void notifyRunwayShow(liveId, 'runway_submitted');
    if (result.data.voting_opened) {
      void notifyRunwayShow(liveId, 'runway_vote');
    }
    const loaded = await getRunwayShow(liveId);
    setBusy(false);
    if (!loaded.ok) {
      setError(runwayErrorCopy(loaded.error));
      return;
    }
    openDetail(loaded.data);
    void recordFormatEntered(ownerId, 'runway', pet.openedDays);
  };

  const sendInvites = async () => {
    if (chosen.length < 1 || busy) {
      setError('Pick at least one friend.');
      return;
    }
    setBusy(true);
    setError(null);
    stopRunwayPreview();
    const deadline = new Date(serverNow() + deadlineMinutes * 60 * 1000).toISOString();
    const created = await createRunwayShow(themeId, trackId, deadline, chosen);
    if (!created.ok) {
      setError(runwayErrorCopy(created.error));
      setBusy(false);
      return;
    }
    void notifyRunwayShow(created.data.show_id, 'runway_show');
    const loaded = await getRunwayShow(created.data.show_id);
    setBusy(false);
    if (!loaded.ok) {
      setError(runwayErrorCopy(loaded.error));
      return;
    }
    openDetail(loaded.data, 'backstage');
  };

  const acceptInvite = async () => {
    if (!liveId || busy) {
      return;
    }
    setBusy(true);
    const result = await respondRunwayInvite(liveId, 'accept');
    if (!result.ok) {
      setError(runwayErrorCopy(result.error));
      setBusy(false);
      return;
    }
    const loaded = await getRunwayShow(liveId);
    setBusy(false);
    if (!loaded.ok) {
      setError(runwayErrorCopy(loaded.error));
      return;
    }
    const late = loaded.data.deadlineAt <= Date.now();
    openDetail(loaded.data, late ? undefined : 'backstage');
  };

  const declineInvite = async () => {
    if (!liveId || busy) {
      return;
    }
    setBusy(true);
    await respondRunwayInvite(liveId, 'decline');
    setBusy(false);
    setDetail(null);
    setLiveId(null);
    setStep('lobby');
  };

  const castVote = async () => {
    if (!liveId || !voteFor || busy) {
      return;
    }
    setBusy(true);
    const result = await castRunwayVote(liveId, voteFor);
    if (!result.ok) {
      setError(runwayErrorCopy(result.error));
      setBusy(false);
      return;
    }
    if (result.data.results_revealed) {
      void notifyRunwayShow(liveId, 'runway_results');
    }
    const loaded = await getRunwayShow(liveId);
    setBusy(false);
    if (!loaded.ok) {
      setError(runwayErrorCopy(loaded.error));
      return;
    }
    openDetail(loaded.data);
  };

  const watchDetail = async (next: RunwayShowDetail, back: Step) => {
    setError(null);
    const loaded = await getRunwayShow(next.id);
    const source = loaded.ok ? mergeShowDetails(next, loaded.data) : next;
    if (loaded.ok) {
      setDetail(source);
    }
    const local = localShowFromDetail(source);
    if (local.submissions.length === 0) {
      setError('Nothing to watch yet.');
      return;
    }
    setShow(local);
    setViewerId(mySubmissionId(source) ?? mySubmissionId(next));
    setWatchReturn(back);
    setStep('runway');
  };

  const watchFresh = async (back: Step) => {
    if (!detail) {
      return;
    }
    const loaded = await getRunwayShow(detail.id);
    if (!loaded.ok) {
      watchDetail(detail, back);
      return;
    }
    setDetail(loaded.data);
    watchDetail(loaded.data, back);
  };

  const openSummary = async (row: RunwayShowSummary) => {
    setBusy(true);
    const loaded = await getRunwayShow(row.id);
    setBusy(false);
    if (!loaded.ok) {
      setError(runwayErrorCopy(loaded.error));
      return;
    }
    openDetail(loaded.data);
  };

  const openJoinedShow = async (row: RunwayShowSummary) => {
    setBusy(true);
    const loaded = await getRunwayShow(row.id);
    setBusy(false);
    if (!loaded.ok) {
      setError(runwayErrorCopy(loaded.error));
      return;
    }
    if (submissionsAreClosed(loaded.data, nowTick)) {
      setSeenClosed(await markClosedSubmissionsSeen(ownerId, loaded.data.id));
    }
    const submitted = loaded.data.contestants.some((person) => person.isMe && person.submitted);
    const needsLooks = !submitted && showNeedsLooks(loaded.data, nowTick);
    const dismissed = loaded.data.myStatus === 'declined' && loaded.data.resultsRevealedAt == null;
    openDetail(loaded.data, dismissed ? 'join' : needsLooks ? 'backstage' : undefined);
  };

  const removeLocal = async (row: LocalRunwayShow) => {
    const save = await loadRunwaySave(ownerId);
    const next = row.mode === 'solo' ? deleteSoloShow(save, row.id) : hideFriendShow(save, row.id);
    await saveRunwaySave(ownerId, next);
    await refreshHistory();
  };

  const hideRemote = async (row: RunwayShowSummary) => {
    const result = await hideRunwayShowRemote(row.id);
    if (!result.ok) {
      setError(runwayErrorCopy(result.error));
      return;
    }
    await refreshRemote();
  };

  if (step === 'runway' && show) {
    return (
      <RunwayView
        show={show}
        viewerSubmissionId={viewerId ?? show.submissions[0]?.submissionId}
        reducedMotion={reducedMotion}
        doneLabel={watchReturn === 'vote' ? 'Continue' : 'Return to The Catwalk'}
        onDone={() => {
          if (seed && watchReturn === 'lobby') {
            track('invite_event_completed', { type: 'runway' });
          }
          setShow(null);
          setStep(watchReturn);
        }}
      />
    );
  }

  const column = split ? phoneColumnWidth : width;
  const tileW = Math.floor((column - 32 - 10) / 2);
  const previewW = split ? 280 : Math.min(240, width - 72);
  const previewH = split ? 230 : 160;
  const artHeight = phoneArtHeight(step, width);

  const art =
    step === 'lobby' || step === 'past' || step === 'judge' ? (
      <LobbyBanner />
    ) : step === 'backstage' ? (
      <BackstageStage themeId={themeId}>
        <OutfitPreview
          breedId={pet.breedId}
          ageDays={pet.ageDays}
          weight={pet.weight}
          vitality={pet.vitality}
          look={pet.look}
          equipped={draftEquip.equipped}
          wearDefs={draftEquip.wearDefs}
          backWear={draftEquip.backWear}
          width={previewW}
          height={previewH}
          t={previewClock}
          pose="sit"
          bare
        />
      </BackstageStage>
    ) : (
      <ThemeBanner themeId={themeId} />
    );

  const header = (
    <View style={styles.header} pointerEvents="box-none">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={step === 'lobby' ? 'Back to map' : 'Back'}
        onPress={goBack}
        style={styles.back}
      >
        <ChevronLeft size={22} color={ink} strokeWidth={iconStroke} />
      </Pressable>
      <Text style={styles.headerTitle}>{runwayConfig.venueName}</Text>
    </View>
  );

  const lobbyCards = remoteShows.filter((row) => row.resultsRevealedAt == null && row.myStatus === 'invited' && !row.amHost);
  const joinedShows = remoteShows.filter((row) => showInJoinedLobby(row, nowTick, seenResults, seenClosed));
  const query = friendQuery.trim().toLowerCase().replace(/^@/, '');
  const recentIds = new Set(recent.map((row) => row.userId));
  const matched = friends.filter((row) => !query || row.handle.toLowerCase().includes(query));
  const recentFriends = matched.filter((row) => recentIds.has(row.userId));
  const otherFriends = matched.filter((row) => !recentIds.has(row.userId));

  const musicLocked = liveFriend
    ? detail?.amHost
      ? 'Show music · your pick'
      : `Show music · picked by @${detail?.hostHandle ?? 'host'}`
    : npcFriend
      ? 'Show music'
      : undefined;

  const lastLook = lookIndex >= looks.length - 1;
  const nextLabel = !lastLook
    ? `Next: Look ${lookIndex + 2}`
    : liveFriend
      ? busy
        ? 'Submitting…'
        : 'Submit looks'
      : busy
        ? 'Starting…'
        : 'Start the show';

  const scored = (detail?.contestants ?? []).filter((row) => row.submitted && row.submissionId);
  const topVotes = Math.max(0, ...scored.map((row) => row.voteCount ?? 0));
  const winners = scored.filter((row) => (row.voteCount ?? 0) === topVotes && topVotes > 0);
  const pollLeft = detail?.pollClosesAt != null ? detail.pollClosesAt - nowTick : null;

  const notices = (
    <>
      {step === 'judge' ? (
        <FunModal
          title="Submissions are closed"
          body="But you can still be a judge! We'll let you know when voting opens."
          icon={Clock}
          tint="lilac"
          sparkle
          reducedMotion={reducedMotion}
          primary={{ label: 'Got it', onPress: () => setStep('lobby'), closeFirst: true }}
        />
      ) : null}
      {accountOpen ? <AccountSheet reason="friends" petName={pet.name} onClose={() => setAccountOpen(false)} /> : null}
    </>
  );

  let body: ReactNode = null;

  if (step === 'lobby') {
    body = (
      <>
        {lobbyCards.length > 0 ? <Text style={styles.section}>Show invites</Text> : null}
        {lobbyCards.map((row) => {
          const action = lobbyShowLabel(row, nowTick);
          const voted = action === 'Vote already cast; polls still open';
          return (
            <View key={row.id} style={styles.card}>
              <View style={styles.inviteRow}>
                <View style={styles.avatar}><Text style={styles.avatarText}>{initial(row.hostHandle)}</Text></View>
                <View style={styles.flex}>
                  <Text style={styles.cardTitle}>{row.amHost ? 'Your show' : `@${row.hostHandle} invited you`}</Text>
                  <Text style={styles.cardBody}>
                    {themeById(row.themeId)?.name ?? row.themeId}
                    {row.deadlineAt ? ` · submit by ${formatWhen(row.deadlineAt)}` : ''}
                  </Text>
                </View>
              </View>
              <CandyButton
                compact={!voted}
                lines={voted ? 2 : 1}
                role="friends"
                label={busy ? 'Opening…' : action}
                onPress={() => void openSummary(row)}
              />
            </View>
          );
        })}
        {joinedShows.map((row) => {
          const theme = themeById(row.themeId)?.name ?? 'Show';
          const who = row.amHost ? 'Your show' : `@${row.hostHandle}`;
          return (
            <CandyButton
              key={row.id}
              role="friends"
              lines={2}
              label={`${who} · ${theme}\n${joinedShowHint(row, nowTick)}`}
              disabled={busy}
              onPress={() => void openJoinedShow(row)}
            />
          );
        })}
        <CandyButton
          role="friends"
          label="Invite friends to a show"
          onPress={() => {
            if (!readAccountLinked()) {
              setAccountOpen(true);
              return;
            }
            setHosting(true);
            setError(null);
            setStep('theme');
          }}
        />
        <CandyButton
          role="primary"
          label="Solo show"
          onPress={() => {
            setHosting(false);
            setLiveId(null);
            setDetail(null);
            setError(null);
            setStep('theme');
          }}
        />
        <CandyButton role="secondary" label="Past Shows" onPress={() => setStep('past')} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </>
    );
  } else if (step === 'theme') {
    body = (
      <>
        <Text style={styles.section}>Your theme sets the venue.</Text>
        <View style={styles.grid}>
          {runwayThemes.map((theme) => {
            const on = theme.id === themeId;
            return (
              <Pressable
                key={theme.id}
                accessibilityRole="button"
                accessibilityLabel={theme.name}
                accessibilityState={{ selected: on }}
                onPress={() => setThemeId(theme.id)}
                style={[styles.themeTile, { width: tileW }, on && styles.themeTileOn]}
              >
                <View style={[styles.themeImage, { height: Math.round(tileW * 0.75) }]}>
                  <ThemeBanner themeId={theme.id} labeled={false} />
                </View>
                <Text style={styles.themeName} numberOfLines={2}>{theme.name}</Text>
              </Pressable>
            );
          })}
        </View>
        <CandyButton
          role="primary"
          label="Continue"
          onPress={() => {
            setError(null);
            if (hosting) {
              setStep('invite');
              return;
            }
            setLooks(emptyLooks(pet.equipped));
            setLookIndex(0);
            setStep('backstage');
          }}
        />
      </>
    );
  } else if (step === 'invite') {
    const renderFriend = (row: FriendRow) => {
      const on = chosen.includes(row.userId);
      return (
        <Pressable key={row.userId} accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => {
          setChosen((ids) => {
            if (ids.includes(row.userId)) {
              return ids.filter((id) => id !== row.userId);
            }
            if (ids.length >= runwayConfig.maxInvites) {
              return ids;
            }
            return [...ids, row.userId];
          });
        }} style={styles.friendRow}>
          <View pointerEvents="none" style={styles.friendRowInner}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{initial(row.handle)}</Text></View>
            <Text style={styles.cardTitle}>@{row.handle}</Text>
            <View style={[styles.check, on && styles.checkOn]} />
          </View>
        </Pressable>
      );
    };
    body = (
      <>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>{themeById(themeId)?.name}</Text>
          <Pressable onPress={() => setStep('theme')}><Text style={styles.link}>Change</Text></Pressable>
        </View>
        <Text style={styles.section}>{chosen.length} of {runwayConfig.maxInvites}</Text>
        {recentFriends.length > 0 ? <Text style={styles.kicker}>Recently invited</Text> : null}
        {recentFriends.map(renderFriend)}
        <Text style={styles.kicker}>All friends</Text>
        <TextInput
          value={friendQuery}
          onChangeText={setFriendQuery}
          placeholder="Search by handle"
          placeholderTextColor={softInk}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.search}
        />
        {otherFriends.length === 0 && recentFriends.length === 0 ? (
          <Text style={styles.cardBody}>Add friends to invite them.</Text>
        ) : null}
        {otherFriends.map(renderFriend)}
        <Text style={styles.kicker}>Submit by</Text>
        <View style={styles.row}>
          {([
            [15, '15 min'],
            [30, '30 min'],
            [60, '1 hour'],
            [1440, '24 hours'],
          ] as const).map(([minutes, label]) => (
            <Pressable key={minutes} onPress={() => setDeadlineMinutes(minutes)} style={[styles.deadline, deadlineMinutes === minutes && styles.deadlineOn]}>
              <Text style={[styles.deadlineText, deadlineMinutes === minutes && styles.deadlineTextOn]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.cardBody}>Costume pieces start unlocking 5 minutes after you send.</Text>
        <MusicMenu trackId={trackId} previewId={previewId} onPreview={previewRunwayTrack} onSelect={setTrackId} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <CandyButton role="primary" label={busy ? 'Sending…' : 'Send invites'} disabled={chosen.length < 1 || busy} onPress={() => void sendInvites()} />
      </>
    );
  } else if (step === 'join' && detail) {
    body = (
      <>
        <Text style={styles.cardTitle}>@{detail.hostHandle} invited you</Text>
        <Text style={styles.cardBody}>
          {themeById(detail.themeId)?.name} · submit by {formatWhen(detail.deadlineAt)}
        </Text>
        <Text style={styles.cardBody}>Walk the runway in 3 looks. Costume pieces unlock a few minutes after the invites go out.</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <CandyButton role="friends" label={busy ? 'Joining…' : 'Join'} disabled={busy} onPress={() => void acceptInvite()} />
        <CandyButton role="secondary" label="Not now" disabled={busy} onPress={() => void declineInvite()} />
      </>
    );
  } else if (step === 'backstage') {
    body = (
      <>
        {outfitSlots.map((slot) => (
          <ClosetSection
            key={slot}
            slot={slot}
            wornId={current.wardrobe[slot]}
            reducedMotion={reducedMotion}
            items={owned.flatMap((row) => {
              if (row.slot !== slot) {
                return [];
              }
              const wear = wearItem(slot, row.id);
              return wear ? [wear] : [];
            })}
            onPress={(itemId) => toggleWardrobe(slot, itemId)}
          />
        ))}
        <View style={styles.rack}>
          <Text style={styles.kicker}>Costume rack</Text>
          {liveFriend && unlockedCount < rack.length ? (
            <Text style={styles.cardBody}>Costumes begin unlocking in 5 minutes and then every few minutes after that.</Text>
          ) : null}
          {chunk(rack, tileColumns).map((row, index) => (
            <View key={index} style={styles.rackRow}>
              {row.map((piece) => {
                const locked = costumeLocked(piece.id);
                const taken = npcTaken.has(piece.id);
                const countdownLabel = locked && nextUnlockAt != null ? formatRemain(nextUnlockAt - nowTick) : null;
                return (
                  <CostumeTile
                    key={piece.id}
                    id={piece.id}
                    label={piece.name}
                    worn={current.costumes.includes(piece.id)}
                    locked={locked}
                    taken={taken}
                    countdownLabel={countdownLabel}
                    onPress={() => toggleCostume(piece.id)}
                  />
                );
              })}
              {Array.from({ length: tileColumns - row.length }, (_, pad) => (
                <View key={`pad-${pad}`} style={styles.flex} />
              ))}
            </View>
          ))}
        </View>
        <MusicMenu
          trackId={trackId}
          previewId={previewId}
          onPreview={previewRunwayTrack}
          onSelect={musicLocked ? undefined : setTrackId}
          lockedLabel={musicLocked}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </>
    );
  } else if (step === 'status' && detail) {
    const closeIn = detail.deadlineAt - nowTick;
    const waitingOnFriends = detail.contestants.some((row) => row.status === 'invited' || row.status === 'accepted');
    const runwayReady = detail.deadlineAt <= nowTick || (detail.votingOpensAt != null && detail.votingOpensAt <= nowTick) || !waitingOnFriends;
    body = (
      <>
        <Text style={styles.cardTitle}>{detail.myVoteSubmissionId ? 'Your vote is in' : "You're in!"}</Text>
        <Text style={styles.cardBody}>
          {detail.myVoteSubmissionId
            ? 'Results show once everyone votes, or when voting closes.'
            : 'Your 3 looks are locked in.'}
        </Text>
        <Text style={styles.kicker}>{detail.votingOpensAt ? 'Voting closes in' : 'Submissions close in'}</Text>
        <Text style={styles.countdown}>
          {formatRemain(detail.myVoteSubmissionId && pollLeft != null ? pollLeft : closeIn)}
        </Text>
        <Text style={styles.cardBody}>{formatWhen(detail.myVoteSubmissionId && detail.pollClosesAt ? detail.pollClosesAt : detail.deadlineAt)}</Text>
        <Text style={styles.section}>Contestants</Text>
        {detail.contestants.map((row) => (
          <View key={row.playerId} style={styles.friendRow}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{initial(row.isMe ? 'You' : row.handle)}</Text></View>
            <Text style={[styles.cardTitle, styles.flex]}>{row.isMe ? 'You' : `@${row.handle}`}</Text>
            <Text style={styles.cardBody}>{row.submitted ? 'Submitted' : row.status === 'judge' ? 'Judge' : 'Not yet'}</Text>
          </View>
        ))}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {runwayReady ? (
          <CandyButton
            role="primary"
            label={`Watch submitted shows (${detail.submissions.length})`}
            disabled={detail.submissions.length === 0}
            onPress={() => {
              const voteNext = detail.myVoteSubmissionId == null && detail.votingOpensAt != null && detail.votingOpensAt <= nowTick;
              void watchFresh(voteNext ? 'vote' : 'status');
            }}
          />
        ) : (
          <>
            <Text style={styles.cardBody}>Come back when all friends have submitted.</Text>
            <CandyButton role="secondary" label="Return to lobby" onPress={() => setStep('lobby')} />
          </>
        )}
      </>
    );
  } else if (step === 'vote' && detail) {
    body = (
      <>
        <Text style={styles.cardTitle}>Vote for the best show</Text>
        <Text style={styles.cardBody}>One vote each. Voting for yourself is fine!</Text>
        <Text style={styles.section}>Contestants</Text>
        {scored.map((row) => {
          const on = voteFor === row.submissionId;
          return (
            <Pressable
              key={row.submissionId}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`Vote for ${whoLabel(row)}`}
              onPress={() => setVoteFor(row.submissionId)}
              style={[styles.voteRow, on && styles.voteRowOn]}
            >
              <View style={styles.avatar}><Text style={styles.avatarText}>{initial(row.isMe ? 'You' : row.handle)}</Text></View>
              <View style={styles.flex}>
                <Text style={styles.cardTitle}>{row.isMe ? 'You' : `@${row.handle}`}</Text>
                {row.petName ? <Text style={styles.cardBody}>{row.petName}</Text> : null}
              </View>
              <View style={[styles.radio, on && styles.radioOn]} />
            </Pressable>
          );
        })}
        <Text style={styles.cardBody}>
          Results show once everyone votes
          {pollLeft != null ? `, or when voting closes in ${formatRemain(pollLeft)}` : ''}.
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <CandyButton role="primary" label={busy ? 'Casting…' : 'Cast my vote'} disabled={!voteFor || busy} onPress={() => void castVote()} />
      </>
    );
  } else if (step === 'results' && detail) {
    const banner = winners.length > 0
      ? winners.map((row) => (row.isMe ? `You${row.petName ? ` & ${row.petName}` : ''}` : `@${row.handle}${row.petName ? ` & ${row.petName}` : ''}`)).join(', ')
      : 'No votes yet';
    body = (
      <>
        <Text style={styles.cardTitle}>Results</Text>
        <Text style={styles.cardBody}>
          {themeById(detail.themeId)?.name} · {scored.reduce((sum, row) => sum + (row.voteCount ?? 0), 0)} votes
        </Text>
        <View style={styles.winner}>
          <Text style={styles.kicker}>Most votes</Text>
          <Text style={styles.winnerName}>{banner}</Text>
        </View>
        {[...scored].sort((a, b) => (b.voteCount ?? 0) - (a.voteCount ?? 0)).map((row) => (
          <View key={row.playerId} style={styles.friendRow}>
            <Text style={[styles.cardTitle, styles.flex]}>{whoLabel(row)}</Text>
            <Text style={styles.cardBody}>{row.voteCount ?? 0} {row.voteCount === 1 ? 'vote' : 'votes'}</Text>
          </View>
        ))}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <CandyButton role="primary" label="Watch the show again" disabled={detail.submissions.length === 0} onPress={() => void watchFresh('results')} />
        <CandyButton role="secondary" label="Back to The Catwalk" onPress={() => setStep('lobby')} />
      </>
    );
  } else if (step === 'past') {
    body = (
      <>
        <Text style={styles.cardTitle}>Past Shows</Text>
        {history.length === 0 && remoteShows.length === 0 ? <Text style={styles.cardBody}>No shows yet.</Text> : null}
        {remoteShows.map((row) => {
          const revealed = row.resultsRevealedAt != null;
          const voting = votingStillOpen(row, nowTick);
          const chip = revealed
            ? row.winnerHandles.length > 0
              ? `Most votes: ${row.winnerHandles.map((handle) => `@${handle}`).join(' & ')}`
              : 'No votes yet'
            : row.pollClosesAt != null && row.pollClosesAt <= nowTick
              ? 'Results coming'
              : 'Friend show';
          return (
            <View key={row.id} style={styles.card}>
              <Pressable onPress={() => void openSummary(row)}>
                <View style={styles.pastArt}>
                  <ThemeBanner themeId={row.themeId} />
                </View>
                <Text style={styles.cardTitle}>{themeById(row.themeId)?.name ?? row.themeId}</Text>
                <Text style={styles.cardBody}>
                  Friend show · {row.contestantCount} contestants · {row.createdAt ? formatWhen(row.createdAt) : ''}
                </Text>
                {revealed && row.standings.length > 0
                  ? row.standings.map((standing) => (
                      <Text key={`${row.id}-${standing.handle}`} style={styles.cardBody}>
                        @{standing.handle} · {standing.votes} {standing.votes === 1 ? 'vote' : 'votes'}
                      </Text>
                    ))
                  : null}
              </Pressable>
              <View style={styles.rowBetween}>
                {voting ? (
                  <CandyButton compact role="friends" label="Voting still open" onPress={() => void openSummary(row)} />
                ) : revealed && row.standings.length > 0 ? (
                  <View style={styles.chip}><Text style={styles.chipText}>Results</Text></View>
                ) : (
                  <View style={styles.chip}><Text style={styles.chipText}>{chip}</Text></View>
                )}
                <Pressable onPress={() => void hideRemote(row)}><Text style={styles.link}>Hide</Text></Pressable>
              </View>
            </View>
          );
        })}
        {history.filter((row) => row.mode === 'solo').map((row) => (
          <View key={row.id} style={styles.card}>
            <View style={styles.pastArt}>
              <ThemeBanner themeId={row.themeId} />
            </View>
            <Text style={styles.cardTitle}>{themeById(row.themeId)?.name ?? row.themeId}</Text>
            <Text style={styles.cardBody}>Solo show · {formatWhen(row.createdAt)}</Text>
            <View style={styles.rowBetween}>
              <View style={styles.chip}><Text style={styles.chipText}>Solo</Text></View>
              <View style={styles.row}>
                <Pressable onPress={() => { setShow(row); setViewerId(row.submissions[0]?.submissionId); setWatchReturn('past'); setStep('runway'); }}>
                  <Text style={styles.link}>Watch</Text>
                </Pressable>
                <Pressable onPress={() => void removeLocal(row)}><Text style={styles.link}>Delete</Text></Pressable>
              </View>
            </View>
          </View>
        ))}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </>
    );
  }

  return (
    <CatwalkFrame
      art={art}
      artHeight={artHeight}
      stickyArt={step === 'theme' || step === 'backstage'}
      dock={
        step === 'backstage' ? (
          <View style={styles.lookBar}>
            {looks.map((look, i) => (
              <Pressable key={look.lookNumber} onPress={() => setLookIndex(i)} style={[styles.lookChip, lookIndex === i && styles.lookChipOn]}>
                <Text style={[styles.lookText, lookIndex === i && styles.lookTextOn]}>Look {i + 1}</Text>
              </Pressable>
            ))}
          </View>
        ) : null
      }
      footer={
        step === 'backstage' ? (
          <View style={styles.footer}>
            <CandyButton
              role="primary"
              label={nextLabel}
              disabled={busy || (lastLook && !looksValid)}
              onPress={() => {
                if (lookIndex < looks.length - 1) {
                  setLookIndex(lookIndex + 1);
                  return;
                }
                if (liveFriend) {
                  void submitLive();
                  return;
                }
                void startSolo();
              }}
            />
          </View>
        ) : null
      }
      header={header}
      notices={notices}
    >
      {body}
    </CatwalkFrame>
  );
}

const styles = StyleSheet.create({
  header: {
    position: 'absolute',
    top: 52,
    left: 12,
    zIndex: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 26,
    color: '#FFFFFF',
    textShadowColor: 'rgba(42, 27, 74, 0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  section: { fontFamily: fontFamily.fredokaSemibold, fontSize: 16, color: ink },
  kicker: { fontFamily: fontFamily.semibold, fontSize: 13, color: softInk },
  card: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 14, gap: 8 },
  cardTitle: { fontFamily: fontFamily.fredokaSemibold, fontSize: 16, color: ink },
  cardBody: { fontFamily: fontFamily.regular, fontSize: 14, color: softInk },
  inviteRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  friendRow: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 10 },
  friendRowInner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#EFE9FF', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fontFamily.fredokaBold, color: '#4B3B7A', fontSize: 16 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  link: { fontFamily: fontFamily.fredokaSemibold, fontSize: 14, color: '#6E4FC0' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  themeTile: { borderRadius: 16, borderWidth: 3, borderColor: 'transparent', overflow: 'hidden', backgroundColor: '#FFFFFF' },
  themeTileOn: { borderColor: '#6E4FC0' },
  themeImage: { backgroundColor: '#3E2F6E' },
  themeName: { fontFamily: fontFamily.fredokaSemibold, fontSize: 13, color: ink, textAlign: 'center', paddingHorizontal: 6, paddingBottom: 8 },
  search: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: fontFamily.regular,
    fontSize: 15,
    color: ink,
  },
  check: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#C9B8F5' },
  checkOn: { backgroundColor: '#6E4FC0', borderColor: '#6E4FC0' },
  deadline: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: '#FFFFFF' },
  deadlineOn: { backgroundColor: '#EFE9FF', borderWidth: 2, borderColor: '#4B3B7A' },
  deadlineText: { fontFamily: fontFamily.semibold, fontSize: 14, color: ink },
  deadlineTextOn: { fontFamily: fontFamily.fredokaSemibold },
  lookBar: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, backgroundColor: '#FBF4FF' },
  footer: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 28, backgroundColor: '#FBF4FF' },
  lookChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: '#FFFFFF' },
  lookChipOn: { backgroundColor: '#EFE9FF', borderWidth: 2, borderColor: '#6E4FC0' },
  lookText: { fontFamily: fontFamily.semibold, fontSize: 14, color: softInk },
  lookTextOn: { color: ink, fontFamily: fontFamily.fredokaBold },
  rack: { gap: 8 },
  rackRow: { flexDirection: 'row', gap: 4, alignItems: 'stretch' },
  countdown: { fontFamily: fontFamily.fredokaBold, fontSize: 32, color: ink },
  voteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 12,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  voteRowOn: { backgroundColor: '#EFE9FF', borderColor: '#6E4FC0' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#C9B8F5' },
  radioOn: { backgroundColor: '#6E4FC0', borderColor: '#6E4FC0' },
  winner: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 16, gap: 4 },
  winnerName: { fontFamily: fontFamily.fredokaBold, fontSize: 22, color: ink },
  pastArt: { height: 120, borderRadius: 16, overflow: 'hidden' },
  chip: { backgroundColor: '#EFE9FF', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontFamily: fontFamily.fredokaSemibold, fontSize: 12, color: '#4B3B7A' },
  error: { fontFamily: fontFamily.regular, color: '#B4234A', fontSize: 13 },
});
