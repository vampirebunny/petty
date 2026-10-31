import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';

import { breedById } from '../actor/breeds';
import { outfitSlots, wearItem } from '../actor/wardrobe';
import { trackScreen } from '../analytics/analytics';
import { rackForTheme, runwayThemes, runwayTracks, themeById, type RunwayThemeId } from '../runway/catalog';
import { runwayConfig } from '../runway/config';
import { buildSoloShow } from '../runway/npcs';
import { deleteSoloShow, hideFriendShow, loadRunwaySave, rememberShow, saveRunwaySave, visibleShows } from '../runway/storage';
import type { LocalRunwayShow } from '../runway/types';
import type { Equipped, OutfitSlot, PetState } from '../sim/types';
import { fontFamily } from '../ui/font';
import { RunwayView } from '../ui/runway/RunwayView';
import { iconStroke } from '../ui/theme';

type Props = {
  pet: PetState;
  ownerId: string;
  owned: readonly { slot: OutfitSlot; id: string }[];
  reducedMotion: boolean;
  onClose: () => void;
};

type Step = 'lobby' | 'theme' | 'track' | 'backstage' | 'runway' | 'past';

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

export function CatwalkScreen({ pet, ownerId, owned, reducedMotion, onClose }: Props) {
  const [step, setStep] = useState<Step>('lobby');
  const [themeId, setThemeId] = useState<RunwayThemeId>('royal');
  const [trackId, setTrackId] = useState(runwayTracks[0]?.id ?? 'fashion-show-music');
  const [looks, setLooks] = useState<DraftLook[]>(() => emptyLooks(pet.equipped));
  const [lookIndex, setLookIndex] = useState(0);
  const [show, setShow] = useState<LocalRunwayShow | null>(null);
  const [history, setHistory] = useState<LocalRunwayShow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    trackScreen('catwalk');
  }, []);

  const refreshHistory = useCallback(async () => {
    const save = await loadRunwaySave(ownerId);
    setHistory(visibleShows(save));
  }, [ownerId]);

  const rack = useMemo(() => rackForTheme(themeId), [themeId]);
  const claimedInDraft = useMemo(() => new Set(looks.flatMap((look) => look.costumes)), [looks]);
  const current = looks[lookIndex];

  const ownedForSlot = (slot: OutfitSlot) =>
    owned.filter((row) => row.slot === slot).map((row) => ({ id: row.id, label: wearItem(slot, row.id)?.label ?? row.id }));

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
            return !piece || piece.slot !== (slot === 'hat' ? 'head' : slot === 'glasses' ? 'face' : slot === 'neckwear' ? 'neck' : slot === 'jacket' ? 'body' : 'feet');
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
    try {
      const species = breedById(pet.breedId)?.species === 'cat' ? 'cat' : 'dog';
      const built = buildSoloShow({
        ownerId,
        themeId,
        trackId,
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

  if (step === 'runway' && show) {
    return (
      <RunwayView
        show={show}
        viewerSubmissionId={show.submissions[0]?.submissionId}
        reducedMotion={reducedMotion}
        onDone={() => {
          setShow(null);
          setStep('lobby');
        }}
      />
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => {
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
              setStep('track');
              return;
            }
            setStep('lobby');
          }}
          style={styles.back}
        >
          <ChevronLeft size={22} color="#4B3B7A" strokeWidth={iconStroke} />
        </Pressable>
        <View>
          <Text style={styles.title}>{runwayConfig.venueName}</Text>
          <Text style={styles.sub}>
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
          <Pressable accessibilityRole="button" style={[styles.card, styles.cardMuted]} onPress={() => setError('Friend shows need a signed-in account. Open Past Shows after you host one.')}>
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
          {runwayThemes.map((theme) => (
            <Pressable
              key={theme.id}
              accessibilityRole="button"
              style={[styles.card, themeId === theme.id && styles.cardOn]}
              onPress={() => {
                setThemeId(theme.id);
                setStep('track');
              }}
            >
              <Text style={styles.cardTitle}>{theme.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {step === 'track' ? (
        <ScrollView contentContainerStyle={styles.scroll}>
          {runwayTracks.map((track) => (
            <Pressable
              key={track.id}
              accessibilityRole="button"
              style={[styles.card, trackId === track.id && styles.cardOn]}
              onPress={() => {
                setTrackId(track.id);
                setLooks(emptyLooks(pet.equipped));
                setLookIndex(0);
                setStep('backstage');
              }}
            >
              <Text style={styles.cardTitle}>{track.title}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {step === 'backstage' ? (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.section}>{themeById(themeId)?.name} · Look {lookIndex + 1} of 3</Text>
          <View style={styles.row}>
            {[0, 1, 2].map((i) => (
              <Pressable key={i} onPress={() => setLookIndex(i)} style={[styles.chip, lookIndex === i && styles.chipOn]}>
                <Text style={styles.chipText}>Look {i + 1}</Text>
              </Pressable>
            ))}
          </View>
          {outfitSlots.map((slot) => (
            <View key={slot} style={styles.block}>
              <Text style={styles.blockTitle}>{slot}</Text>
              <View style={styles.wrap}>
                {ownedForSlot(slot).map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => toggleWardrobe(slot, item.id)}
                    style={[styles.tile, current.wardrobe[slot] === item.id && styles.tileOn]}
                  >
                    <Text style={styles.tileText}>{item.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
          <View style={styles.block}>
            <Text style={styles.blockTitle}>Costume rack</Text>
            <View style={styles.wrap}>
              {rack.map((piece) => {
                const taken = claimedInDraft.has(piece.id) && !current.costumes.includes(piece.id);
                const on = current.costumes.includes(piece.id);
                return (
                  <Pressable
                    key={piece.id}
                    disabled={taken}
                    onPress={() => toggleCostume(piece.id)}
                    style={[styles.tile, on && styles.tileOn, taken && styles.tileTaken]}
                  >
                    <Text style={styles.tileText}>{taken ? `${piece.name} · Taken` : piece.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable accessibilityRole="button" style={[styles.primary, (!looksValid || busy) && styles.primaryOff]} onPress={() => void submitSolo()}>
            <Text style={styles.primaryText}>{busy ? 'Starting…' : 'Start the show'}</Text>
          </Pressable>
        </ScrollView>
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
  header: { paddingTop: 56, paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fontFamily.fredokaBold, fontSize: 24, color: '#4B3B7A' },
  sub: { fontFamily: fontFamily.regular, fontSize: 14, color: '#7A6B9A' },
  scroll: { padding: 16, gap: 12, paddingBottom: 40 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 16, gap: 6 },
  cardMuted: { opacity: 0.85 },
  cardOn: { borderWidth: 2, borderColor: '#7853E6' },
  cardTitle: { fontFamily: fontFamily.fredokaSemibold, fontSize: 18, color: '#4B3B7A' },
  cardBody: { fontFamily: fontFamily.regular, fontSize: 14, color: '#7A6B9A' },
  section: { fontFamily: fontFamily.fredokaSemibold, fontSize: 16, color: '#4B3B7A' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: '#EFE8FF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  chipOn: { backgroundColor: '#7853E6' },
  chipText: { fontFamily: fontFamily.semibold, color: '#4B3B7A', fontSize: 13 },
  block: { gap: 8 },
  blockTitle: { fontFamily: fontFamily.semibold, color: '#4B3B7A', textTransform: 'capitalize' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
  tileOn: { backgroundColor: '#D9C8FF' },
  tileTaken: { opacity: 0.45 },
  tileText: { fontFamily: fontFamily.regular, color: '#4B3B7A', fontSize: 13 },
  primary: { backgroundColor: '#7853E6', borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  primaryOff: { opacity: 0.5 },
  primaryText: { fontFamily: fontFamily.fredokaBold, color: '#fff', fontSize: 16 },
  error: { fontFamily: fontFamily.regular, color: '#C0392B', fontSize: 13 },
});
