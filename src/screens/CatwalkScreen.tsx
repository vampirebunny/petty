import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { ChevronLeft, Pause, Play } from 'lucide-react-native';

import { breedById } from '../actor/breeds';
import { outfitSlots, wearItem, type WearItem } from '../actor/wardrobe';
import { track, trackScreen } from '../analytics/analytics';
import { listenPreview, previewRunwayTrack, stopRunwayPreview } from '../audio/runwayPreview';
import { syncCatwalkMusic } from '../audio/remoteCatwalkMusic';
import { rackForTheme, runwayThemes, runwayTracks, themeById, type RunwayCostume, type RunwayThemeId } from '../runway/catalog';
import { runwayConfig } from '../runway/config';
import { equipFromDraft } from '../runway/lookEquip';
import { buildSoloShow } from '../runway/npcs';
import { deleteSoloShow, hideFriendShow, loadRunwaySave, rememberShow, saveRunwaySave, visibleShows } from '../runway/storage';
import { costumeToOutfit, type LocalRunwayShow } from '../runway/types';
import { recordFormatEntered } from '../invites/store';
import type { RunwayInvitation } from '../invites/types';
import type { Equipped, OutfitSlot, PetState } from '../sim/types';
import { ClosetSection } from '../ui/closet/ClosetSection';
import { ClosetTile } from '../ui/closet/ClosetTile';
import { closet, tileColumns } from '../ui/closet/closetStyle';
import { fontFamily } from '../ui/font';
import { OutfitPreview, useOutfitClock } from '../ui/OutfitPreview';
import { RunwayView } from '../ui/runway/RunwayView';
import { SoundBars } from '../ui/runway/SoundBars';
import { ThemeStill } from '../ui/runway/ThemeStill';
import { iconStroke } from '../ui/theme';

function costumeWear(piece: RunwayCostume): { slot: OutfitSlot; item: WearItem } {
  const mapped = costumeToOutfit[piece.slot];
  const slot: OutfitSlot = mapped === 'back' ? 'jacket' : mapped;
  return {
    slot,
    item: {
      id: piece.id,
      slot,
      label: piece.name,
      shape: piece.shape,
      colorway: { ...piece.colorway },
    },
  };
}

function chunkCostumes<T>(items: T[], cols: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += cols) {
    rows.push(items.slice(i, i + cols));
  }
  return rows;
}

type Props = {
  pet: PetState;
  ownerId: string;
  owned: readonly { slot: OutfitSlot; id: string }[];
  reducedMotion: boolean;
  /** Seeded NPC show from an invitation. Starts on the three-look step. */
  seed?: RunwayInvitation | null;
  onClose: () => void;
};

type Step = 'lobby' | 'theme' | 'track' | 'backstage' | 'runway' | 'past';

type DraftLook = {
  lookNumber: 1 | 2 | 3;
  wardrobe: Equipped;
  costumes: string[];
};

const pageDark = '#2C2C30';
const panelDark = '#3A3A40';
const inkLight = '#F4F1EA';
const mutedLight = '#B8B4AE';
const accent = '#C9B6FF';

function emptyLooks(equipped: Equipped): DraftLook[] {
  return [
    { lookNumber: 1, wardrobe: { ...equipped }, costumes: [] },
    { lookNumber: 2, wardrobe: {}, costumes: [] },
    { lookNumber: 3, wardrobe: {}, costumes: [] },
  ];
}

function themeColumns(width: number): number {
  if (width >= 1100) {
    return 4;
  }
  if (width >= 700) {
    return 3;
  }
  return 2;
}

export function CatwalkScreen({ pet, ownerId, owned, reducedMotion, seed = null, onClose }: Props) {
  const { width } = useWindowDimensions();
  const cols = themeColumns(width);
  const gap = 12;
  const pad = 16;
  const tileW = Math.floor((width - pad * 2 - gap * (cols - 1)) / cols);
  const tileH = Math.round(tileW * 0.72);
  const previewClock = useOutfitClock(reducedMotion);

  const [step, setStep] = useState<Step>(seed ? 'backstage' : 'lobby');
  const [themeId, setThemeId] = useState<RunwayThemeId>(seed?.themeId ?? 'royal');
  const [trackId, setTrackId] = useState(seed?.trackId ?? runwayTracks[0]?.id ?? 'fashion-show-music');
  const [looks, setLooks] = useState<DraftLook[]>(() => emptyLooks(pet.equipped));
  const [lookIndex, setLookIndex] = useState(0);
  const [show, setShow] = useState<LocalRunwayShow | null>(null);
  const [history, setHistory] = useState<LocalRunwayShow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  useEffect(() => {
    trackScreen('catwalk');
    void syncCatwalkMusic();
  }, []);

  useEffect(() => listenPreview(setPreviewId), []);

  useEffect(() => {
    if (step !== 'track') {
      stopRunwayPreview();
    }
  }, [step]);

  const refreshHistory = useCallback(async () => {
    const save = await loadRunwaySave(ownerId);
    setHistory(visibleShows(save));
  }, [ownerId]);

  const rack = useMemo(() => {
    const all = rackForTheme(themeId);
    if (!seed || seed.type !== 'runway') {
      return all;
    }
    const worn = new Set(seed.npcSubmissions.flatMap((row) => row.claimedCostumeIds));
    return all.filter((piece) => !worn.has(piece.id));
  }, [seed, themeId]);
  const claimedInDraft = useMemo(() => new Set(looks.flatMap((look) => look.costumes)), [looks]);
  const current = looks[lookIndex];
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
        } else {
          next[slot] = id;
          look.costumes = look.costumes.filter((costumeId) => {
            const piece = rack.find((row) => row.id === costumeId);
            return (
              !piece ||
              piece.slot !==
                (slot === 'hat' ? 'head' : slot === 'glasses' ? 'face' : slot === 'neckwear' ? 'neck' : slot === 'jacket' ? 'body' : 'feet')
            );
          });
        }
        return { ...look, wardrobe: next };
      }),
    );
  };

  const toggleCostume = (costumeId: string) => {
    const piece = rack.find((row) => row.id === costumeId);
    if (!piece) {
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
        if (claimedInDraft.has(costumeId) && !look.costumes.includes(costumeId)) {
          return look;
        }
        const slotKey =
          piece.slot === 'head'
            ? 'hat'
            : piece.slot === 'face'
              ? 'glasses'
              : piece.slot === 'neck'
                ? 'neckwear'
                : piece.slot === 'body'
                  ? 'jacket'
                  : piece.slot === 'feet'
                    ? 'boots'
                    : null;
        const wardrobe = { ...look.wardrobe };
        if (slotKey) {
          delete wardrobe[slotKey];
        }
        const costumes = look.costumes.filter((id) => {
          const other = rack.find((row) => row.id === id);
          return !other || other.slot !== piece.slot;
        });
        return { ...look, wardrobe, costumes: [...costumes, costumeId] };
      }),
    );
  };

  const looksValid = looks.every((look) => look.costumes.length + Object.keys(look.wardrobe).length > 0);

  const submitSolo = async () => {
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
        showId: seed?.showId,
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
      setStep('runway');
      void recordFormatEntered(ownerId, 'runway', pet.openedDays);
      await refreshHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the show.');
    } finally {
      setBusy(false);
    }
  };

  const removeShow = async (row: LocalRunwayShow) => {
    const save = await loadRunwaySave(ownerId);
    const next = row.mode === 'solo' ? deleteSoloShow(save, row.id) : hideFriendShow(save, row.id);
    await saveRunwaySave(ownerId, next);
    await refreshHistory();
  };

  const goBack = () => {
    stopRunwayPreview();
    if (step === 'lobby') {
      onClose();
      return;
    }
    if (step === 'theme') {
      setStep('lobby');
      return;
    }
    if (step === 'track') {
      setStep('theme');
      return;
    }
    if (step === 'backstage') {
      if (seed) {
        onClose();
        return;
      }
      setStep('track');
      return;
    }
    setStep('lobby');
  };

  if (step === 'runway' && show) {
    return (
      <RunwayView
        show={show}
        viewerSubmissionId={show.submissions[0]?.submissionId}
        reducedMotion={reducedMotion}
        onDone={() => {
          if (seed) {
            track('invite_event_completed', { type: 'runway' });
          }
          setShow(null);
          setStep('lobby');
        }}
      />
    );
  }

  const dark = step === 'backstage';
  const headerInk = dark ? inkLight : '#4B3B7A';
  const headerMuted = dark ? mutedLight : '#7A6B9A';

  return (
    <View style={[styles.root, dark && styles.rootDark]}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={goBack} style={[styles.back, dark && styles.backDark]}>
          <ChevronLeft size={22} color={headerInk} strokeWidth={iconStroke} />
        </Pressable>
        <View>
          <Text style={[styles.title, { color: headerInk }]}>{runwayConfig.venueName}</Text>
          <Text style={[styles.sub, { color: headerMuted }]}>
            {step === 'lobby'
              ? 'Put on a show'
              : step === 'theme'
                ? 'Pick a theme'
                : step === 'track'
                  ? 'Pick music'
                  : step === 'backstage'
                    ? 'Build 3 looks'
                    : 'Past shows'}
          </Text>
        </View>
      </View>

      {step === 'lobby' ? (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Pressable accessibilityRole="button" style={styles.card} onPress={() => setStep('theme')}>
            <Text style={styles.cardTitle}>Solo show</Text>
            <Text style={styles.cardBody}>Walk with {runwayConfig.npcCount} NPC models. No voting.</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={[styles.card, styles.cardMuted]}
            onPress={() => setError('Friend shows need a signed-in account. Open Past Shows after you host one.')}
          >
            <Text style={styles.cardTitle}>Friend show</Text>
            <Text style={styles.cardBody}>Invite friends, then vote. Requires an account.</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={styles.card}
            onPress={() => {
              void refreshHistory().then(() => setStep('past'));
            }}
          >
            <Text style={styles.cardTitle}>Past shows</Text>
            <Text style={styles.cardBody}>Watch or remove saved shows</Text>
          </Pressable>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>
      ) : null}

      {step === 'theme' ? (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={[styles.themeGrid, { gap }]}>
            {runwayThemes.map((theme) => (
              <Pressable
                key={theme.id}
                accessibilityRole="button"
                accessibilityLabel={theme.name}
                style={[styles.themeCard, { width: tileW }, themeId === theme.id && styles.themeCardOn]}
                onPress={() => {
                  setThemeId(theme.id);
                  setStep('track');
                }}
              >
                <ThemeStill themeId={theme.id} width={tileW - 4} height={tileH} />
                <Text style={styles.themeName} numberOfLines={2}>
                  {theme.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      ) : null}

      {step === 'track' ? (
        <ScrollView contentContainerStyle={styles.scroll}>
          {runwayTracks.map((track) => {
            const playing = previewId === track.id;
            const selected = trackId === track.id;
            return (
              <View key={track.id} style={[styles.trackRow, selected && styles.trackRowOn]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={playing ? `Pause ${track.title}` : `Preview ${track.title}`}
                  onPress={() => previewRunwayTrack(track.id)}
                  style={styles.playBtn}
                >
                  {playing ? <Pause size={20} color="#4B3B7A" strokeWidth={iconStroke} /> : <Play size={20} color="#4B3B7A" strokeWidth={iconStroke} />}
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  style={styles.trackHit}
                  onPress={() => {
                    stopRunwayPreview();
                    setTrackId(track.id);
                    setLooks(emptyLooks(pet.equipped));
                    setLookIndex(0);
                    setStep('backstage');
                  }}
                >
                  <Text style={styles.cardTitle}>{track.title}</Text>
                  {playing ? <SoundBars active color="#7853E6" /> : <Text style={styles.cardBody}>Tap play for a 10s clip</Text>}
                </Pressable>
              </View>
            );
          })}
        </ScrollView>
      ) : null}

      {step === 'backstage' ? (
        <View style={styles.backstage}>
          <View style={styles.previewWrap}>
            <Text style={styles.sectionDark}>
              {themeById(themeId)?.name} · Look {lookIndex + 1} of 3
            </Text>
            <OutfitPreview
              breedId={pet.breedId}
              ageDays={pet.ageDays}
              weight={pet.weight}
              vitality={pet.vitality}
              look={pet.look}
              equipped={draftEquip.equipped}
              wearDefs={draftEquip.wearDefs}
              width={Math.min(320, width - 48)}
              height={220}
              t={previewClock}
              pose="sit"
              bare
            />
            <View style={styles.row}>
              {[0, 1, 2].map((i) => (
                <Pressable key={i} onPress={() => setLookIndex(i)} style={[styles.chipDark, lookIndex === i && styles.chipDarkOn]}>
                  <Text style={[styles.chipTextDark, lookIndex === i && styles.chipTextOn]}>Look {i + 1}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <ScrollView style={styles.closetScroll} contentContainerStyle={styles.closetScrollContent}>
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
            <View style={styles.costumeCard}>
              <Text accessibilityRole="header" style={styles.costumePlate}>
                Costume rack
              </Text>
              {chunkCostumes(rack, tileColumns).map((row, index) => (
                <View key={index} style={styles.costumeRow}>
                  {row.map((piece) => {
                    const taken = claimedInDraft.has(piece.id) && !current.costumes.includes(piece.id);
                    const on = current.costumes.includes(piece.id);
                    const { slot, item } = costumeWear(piece);
                    return (
                      <View key={piece.id} style={[styles.costumeCell, taken && styles.tileTaken]}>
                        <ClosetTile
                          slot={slot}
                          item={item}
                          worn={on}
                          reducedMotion={reducedMotion}
                          onPress={() => {
                            if (!taken) {
                              toggleCostume(piece.id);
                            }
                          }}
                        />
                        {taken ? <Text style={styles.takenLabel}>Taken</Text> : null}
                      </View>
                    );
                  })}
                  {Array.from({ length: tileColumns - row.length }, (_, pad) => (
                    <View key={`pad-${pad}`} style={styles.costumePad} />
                  ))}
                </View>
              ))}
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable
              accessibilityRole="button"
              style={[styles.primary, (!looksValid || busy) && styles.primaryOff]}
              onPress={() => void submitSolo()}
            >
              <Text style={styles.primaryText}>{busy ? 'Starting…' : 'Start the show'}</Text>
            </Pressable>
          </ScrollView>
        </View>
      ) : null}

      {step === 'past' ? (
        <ScrollView contentContainerStyle={styles.scroll}>
          {history.length === 0 ? <Text style={styles.cardBody}>No shows yet.</Text> : null}
          {history.map((row) => (
            <View key={row.id} style={styles.card}>
              <Text style={styles.cardTitle}>{themeById(row.themeId)?.name ?? row.themeId}</Text>
              <Text style={styles.cardBody}>
                {row.mode === 'solo' ? 'Solo' : 'Friends'} · {new Date(row.createdAt).toLocaleString()}
              </Text>
              <View style={styles.row}>
                <Pressable
                  style={styles.chip}
                  onPress={() => {
                    setShow(row);
                    setStep('runway');
                  }}
                >
                  <Text style={styles.chipText}>Watch</Text>
                </Pressable>
                <Pressable style={styles.chip} onPress={() => void removeShow(row)}>
                  <Text style={styles.chipText}>{row.mode === 'solo' ? 'Delete' : 'Hide'}</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7F3FF' },
  rootDark: { backgroundColor: pageDark },
  header: { paddingTop: 56, paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  backDark: { backgroundColor: panelDark },
  title: { fontFamily: fontFamily.fredokaBold, fontSize: 24, color: '#4B3B7A' },
  sub: { fontFamily: fontFamily.regular, fontSize: 14, color: '#7A6B9A' },
  scroll: { padding: 16, gap: 12, paddingBottom: 40 },
  backstage: { flex: 1 },
  closetScroll: {
    flex: 1,
    backgroundColor: closet.scroll.bg,
    borderTopWidth: 6,
    borderTopColor: closet.scroll.topBorder,
  },
  closetScrollContent: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 40,
    gap: 14,
  },
  costumeCard: {
    backgroundColor: closet.section.bg,
    borderWidth: 2,
    borderColor: closet.section.border,
    borderRadius: 16,
    paddingTop: 12,
    paddingHorizontal: 10,
    paddingBottom: 10,
    gap: 8,
  },
  costumePlate: {
    alignSelf: 'flex-start',
    paddingVertical: 3,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: closet.plate.bg,
    borderWidth: 2,
    borderColor: closet.plate.border,
    color: closet.plate.text,
    fontSize: 13,
    fontFamily: fontFamily.black,
    overflow: 'hidden',
  },
  costumeRow: { flexDirection: 'row', gap: 4, alignItems: 'stretch' },
  costumeCell: { flex: 1, minWidth: 0 },
  costumePad: { flex: 1 },
  takenLabel: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 28,
    fontFamily: fontFamily.extraBold,
    fontSize: 11,
    color: closet.accentDark,
  },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 16, gap: 6 },
  cardMuted: { opacity: 0.85 },
  cardTitle: { fontFamily: fontFamily.fredokaSemibold, fontSize: 18, color: '#4B3B7A' },
  cardBody: { fontFamily: fontFamily.regular, fontSize: 14, color: '#7A6B9A' },
  themeGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  themeCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 2,
    paddingBottom: 10,
    gap: 8,
    overflow: 'hidden',
  },
  themeCardOn: { borderWidth: 2, borderColor: '#7853E6' },
  themeName: {
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 14,
    color: '#4B3B7A',
    textAlign: 'center',
    paddingHorizontal: 6,
  },
  trackRow: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  trackRowOn: { borderWidth: 2, borderColor: '#7853E6' },
  playBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EFE8FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackHit: { flex: 1, gap: 4 },
  previewWrap: {
    alignItems: 'center',
    backgroundColor: pageDark,
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  sectionDark: { fontFamily: fontFamily.fredokaSemibold, fontSize: 16, color: inkLight, alignSelf: 'stretch' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: '#EFE8FF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  chipText: { fontFamily: fontFamily.semibold, color: '#4B3B7A', fontSize: 13 },
  chipDark: { backgroundColor: panelDark, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  chipDarkOn: { backgroundColor: accent },
  chipTextDark: { fontFamily: fontFamily.semibold, color: mutedLight, fontSize: 13 },
  chipTextOn: { color: '#2C2C30' },
  tileTaken: { opacity: 0.45 },
  primary: { backgroundColor: '#7853E6', borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  primaryOff: { opacity: 0.5 },
  primaryText: { fontFamily: fontFamily.fredokaBold, color: '#fff', fontSize: 16 },
  error: { fontFamily: fontFamily.regular, color: '#FF8A80', fontSize: 13 },
});
