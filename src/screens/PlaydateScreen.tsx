import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';

import { breedById, ownedScenes, scenesFor } from '../actor';
import { seedOf } from '../actor/mulberry';
import type { OwnedItem } from '../actor/closet';
import { activityById, offerActivities, trainedLabel } from '../playdate/activities';
import { offerGroupActivities } from '../playdate/group';
import { formatFriendNames, toggleFriend } from '../playdate/party';
import { formatCooldown } from '../playdate/cooldown';
import { localDateKey, personalityHint } from '../playdate/hint';
import { dailyCast, withPlayerAge } from '../playdate/npcs';
import { createGroupPlaydateRecord, createPlaydateRecord } from '../playdate/record';
import { attributeGains, bondHint, rareEventLine } from '../playdate/rewards';
import type { AttributeGain } from '../playdate/rewards';
import { latestPlaydateTags, recentPlaydateTags, relationshipFor, rememberPlaydate } from '../playdate/save';
import { snapshotFromFriend, snapshotPet } from '../playdate/snapshot';
import type { ActivityDefinition, PetSnapshot, PlaydateRecord, PlaydateSave } from '../playdate/types';
import type { FriendRow } from '../friends/types';
import type { Equipped, PetState } from '../sim/types';
import { PlaydateResults } from '../ui/PlaydateResults';
import type { ResultsNote } from '../ui/PlaydateResults';
import { PlaydateStage } from '../ui/PlaydateStage';
import { SnapshotStill } from '../ui/SnapshotStill';
import { CandyButton } from '../ui/closet/CandyButton';
import { PlaydateFriends } from '../ui/PlaydateFriends';
import { fontFamily } from '../ui/font';
import { PhoneColumn } from '../ui/PhoneColumn';
import { WardrobePicker } from '../ui/WardrobePicker';
import { minTouch } from '../ui/theme';

function guestNames(record: PlaydateRecord): string {
  const names = record.party && record.party.length > 0 ? record.party.map((pet) => pet.name) : [record.petB.name];
  return formatFriendNames(names);
}

function resultNotes(record: PlaydateRecord, petName: string): ResultsNote[] {
  const notes: ResultsNote[] = record.outcome.rareEvents
    .filter((event) => event.type === 'trick_shown')
    .map((event) => ({
      id: event.trickId,
      label: rareEventLine(event, petName, record.petB.name),
      tone: 'rare' as const,
    }));
  if (record.beats.some((beat) => beat.tag === 'golden')) {
    notes.push({ id: 'golden', label: 'A golden moment.', tone: 'golden' });
  }
  return notes;
}

type Step = 'partner' | 'place' | 'activity' | 'outfit' | 'play' | 'results';

// Wall-clock wait after both pets have arrived and are in frame together.
const skipAfterTogetherMs = 3000;

type Props = {
  pet: PetState;
  save: PlaydateSave;
  now: number;
  remaining: number;
  reducedMotion: boolean;
  onSave: (save: PlaydateSave) => void;
  onRewarded: (happiness: number, attributes: PlaydateRecord['outcome']['attributeXp'], playdateId: string) => void;
  onClose: () => void;
  owned: readonly OwnedItem[];
  linked: boolean;
  accountHandle: string | null;
};

export function PlaydateScreen({ pet, save, now, remaining, reducedMotion, onSave, onRewarded, onClose, owned, linked, accountHandle }: Props) {
  const ownerId = pet.ownerId ?? '';
  const date = localDateKey(now);
  const partners = useMemo(
    () => withPlayerAge(dailyCast(save.cast, ownerId, date), pet.ageDays),
    [date, ownerId, pet.ageDays, save.cast],
  );
  const [step, setStep] = useState<Step>('partner');
  const [picked, setPicked] = useState<string[]>([]);
  const [guests, setGuests] = useState<PetSnapshot[] | null>(null);
  const [partner, setPartner] = useState<PetSnapshot | null>(null);
  const [sceneId, setSceneId] = useState(pet.sceneId);
  const [activity, setActivity] = useState<ActivityDefinition | null>(null);
  const [outfit, setOutfit] = useState<Equipped>({ ...pet.equipped });
  const [record, setRecord] = useState<PlaydateRecord | null>(null);
  const [replay, setReplay] = useState(false);
  // What the paid playdate added, worked out from the pet before the rewards landed.
  const [gains, setGains] = useState<AttributeGain[] | null>(null);
  const [skipReady, setSkipReady] = useState(false);
  const finished = useRef(false);
  const skipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSkipTimer = () => {
    if (skipTimer.current != null) {
      clearTimeout(skipTimer.current);
      skipTimer.current = null;
    }
  };

  useEffect(() => clearSkipTimer, []);

  const resetSkip = () => {
    clearSkipTimer();
    setSkipReady(false);
  };

  const dogsTogether = () => {
    clearSkipTimer();
    setSkipReady(false);
    skipTimer.current = setTimeout(() => {
      skipTimer.current = null;
      setSkipReady(true);
    }, skipAfterTogetherMs);
  };

  const preview = useMemo(() => snapshotPet(pet, pet.equipped, '', 'preview'), [pet]);
  const petSpecies = breedById(pet.breedId)?.species === 'cat' ? 'cat' : 'dog';
  const friendParty = guests != null && guests.length > 0;
  const places = friendParty ? ownedScenes(petSpecies) : scenesFor(partner ? [petSpecies, partner.species] : petSpecies);
  const activities =
    guests && guests.length >= 2
      ? offerGroupActivities(guests, sceneId, date)
      : partner
        ? offerActivities(preview, partner, sceneId, date)
        : [];
  const cooling = remaining > 0;
  const countdown = `Next playdate in ${formatCooldown(remaining)}`;
  const heading =
    step === 'outfit'
      ? `${pet.name}'s outfit`
      : step === 'place'
        ? 'Where to?'
        : step === 'activity'
          ? 'What will they do?'
          : step === 'play'
            ? 'Playdate'
            : step === 'results'
              ? 'Results'
              : 'Who wants to play?';

  const back = () => {
    if (step === 'partner') {
      onClose();
      return;
    }
    if (step === 'place') {
      setStep('partner');
      return;
    }
    if (step === 'activity') {
      setStep('place');
      return;
    }
    if (step === 'outfit') {
      setStep('activity');
      return;
    }
    onClose();
  };

  const finish = () => {
    if (finished.current) {
      setStep('results');
      return;
    }
    finished.current = true;
    if (record && !replay) {
      const remembered = rememberPlaydate(save, record, Date.now());
      onSave(remembered.save);
      if (remembered.applied) {
        setGains(attributeGains(pet, record.outcome));
        onRewarded(record.outcome.moodDelta, record.outcome.attributeXp, record.playdateId);
      }
    }
    setStep('results');
  };

  const inviteFriends = (rows: FriendRow[]) => {
    const snaps = rows.flatMap((row) => {
      if (!row.pet) {
        return [];
      }
      const snap = snapshotFromFriend(row.userId, row.pet);
      return snap ? [snap] : [];
    });
    const first = snaps[0];
    if (!first) {
      return;
    }
    setGuests(snaps);
    setPartner(first);
    setActivity(null);
    setStep('place');
  };

  const start = () => {
    if (!partner || !activity || cooling || !ownerId) {
      return;
    }
    const createdAt = new Date().toISOString();
    const seed = seedOf(`${pet.id}|${guests?.map((guest) => guest.snapshotId).join(',') ?? partner.snapshotId}|${createdAt}`) >>> 0;
    if (guests && guests.length >= 2) {
      const next = createGroupPlaydateRecord({
        pet,
        guests,
        activity,
        sceneId,
        outfit,
        seed,
        createdAt,
        ownerId,
      });
      finished.current = false;
      setReplay(false);
      setGains(null);
      resetSkip();
      setRecord(next);
      setStep('play');
      return;
    }
    const next = createPlaydateRecord({
      pet,
      partner,
      activity,
      sceneId,
      outfit,
      seed,
      createdAt,
      ownerId,
      recentTags: recentPlaydateTags(save.history),
      latestTags: latestPlaydateTags(save.history),
      bond: relationshipFor(save, pet.id, partner.snapshotId)?.bond ?? 0,
    });
    finished.current = false;
    setReplay(false);
    setGains(null);
    resetSkip();
    setRecord(next);
    setStep('play');
  };

  const watch = (saved: PlaydateRecord) => {
    finished.current = false;
    setGains(null);
    resetSkip();
    setReplay(true);
    setRecord(saved);
    setPartner(saved.petB);
    setActivity(activityById(saved.activityId));
    setStep('play');
  };

  const screen = (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={back} style={styles.headerButton}>
          <Text style={styles.headerLabel}>{step === 'play' ? 'Leave' : 'Back'}</Text>
        </Pressable>
        <View pointerEvents="none" style={styles.titleSlot}>
          <Text accessibilityRole="header" style={styles.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
            {heading}
          </Text>
        </View>
      </View>
      {cooling && step !== 'play' && step !== 'results' ? <Text style={styles.countdown}>{countdown}</Text> : null}
      {step === 'outfit' ? (
        <WardrobePicker
          subject={{
            breedId: pet.breedId,
            ageDays: pet.ageDays,
            weight: pet.weight,
            vitality: pet.vitality,
            look: pet.look,
            seed: pet.attributes.seed,
          }}
          owned={owned}
          equipped={outfit}
          reducedMotion={reducedMotion}
          onEquip={(slot, itemId) => {
            setOutfit((current) => {
              const next = { ...current };
              if (itemId == null) {
                delete next[slot];
              } else {
                next[slot] = itemId;
              }
              return next;
            });
          }}
          footer={
            <CandyButton
              label={cooling ? countdown : 'Start'}
              accessibilityLabel={cooling ? countdown : 'Start playdate'}
              disabled={cooling}
              onPress={start}
            />
          }
        />
      ) : (
      <ScrollView style={styles.scroller} contentContainerStyle={styles.scroll}>
        {step === 'partner' ? (
          <View style={styles.stack}>
            <PlaydateFriends
              linked={linked}
              petName={pet.name}
              handle={accountHandle}
              cooling={cooling}
              selected={picked}
              onToggle={(userId) => setPicked((current) => toggleFriend(current, userId))}
              onInvite={inviteFriends}
            />
            {partners.map((npc) => {
              const bond = relationshipFor(save, pet.id, npc.snapshotId)?.bond ?? 0;
              return (
                <Pressable
                  key={npc.snapshotId}
                  accessibilityRole="button"
                  accessibilityLabel={npc.name}
                  accessibilityState={{ disabled: cooling }}
                  disabled={cooling}
                  onPress={() => {
                    setGuests(null);
                    setPartner(npc);
                    setStep('place');
                  }}
                  style={[styles.card, cooling && styles.dimmed]}
                >
                  <SnapshotStill snapshot={npc} width={96} height={120} />
                  <View style={styles.cardCopy}>
                    <Text style={styles.cardTitle}>{npc.name}</Text>
                    <Text style={styles.cardMeta}>{breedById(npc.breedId)?.name ?? npc.breedId}</Text>
                    <Text style={styles.cardMeta}>{personalityHint(npc)}</Text>
                    <Text style={styles.cardMeta}>{bondHint(bond)}</Text>
                  </View>
                </Pressable>
              );
            })}
            {save.history.length > 0 ? (
              <View style={styles.stack}>
                <Text style={styles.section}>Recent playdates</Text>
                {save.history.map((saved) => (
                  <Pressable
                    key={saved.playdateId}
                    accessibilityRole="button"
                    accessibilityLabel={`Replay playdate with ${guestNames(saved)}`}
                    onPress={() => watch(saved)}
                    style={styles.choice}
                  >
                    <Text style={styles.choiceLabel}>
                      {guestNames(saved)} · {activityById(saved.activityId)?.name ?? 'Playdate'}
                      {saved.beats.some((beat) => beat.tag === 'golden') ? ' · Golden' : ''}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
        {step === 'place' ? (
          <View style={styles.stack}>
            {places.map((scene) => (
              <Pressable
                key={scene.id}
                accessibilityRole="button"
                accessibilityLabel={scene.name}
                accessibilityState={{ disabled: cooling }}
                disabled={cooling}
                onPress={() => {
                  setSceneId(scene.id);
                  setActivity(null);
                  setStep('activity');
                }}
                style={[styles.choice, scene.id === sceneId && styles.choiceOn, cooling && styles.dimmed]}
              >
                <Text style={styles.choiceLabel}>{scene.name}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {step === 'activity' ? (
          <View style={styles.stack}>
            {activities.length === 0 ? <Text style={styles.cardMeta}>Nothing fits this pair here today.</Text> : null}
            {activities.map((entry) => (
              <Pressable
                key={entry.id}
                accessibilityRole="button"
                accessibilityLabel={entry.name}
                accessibilityState={{ disabled: cooling }}
                disabled={cooling}
                onPress={() => {
                  setActivity(entry);
                  setOutfit({ ...pet.equipped });
                  setStep('outfit');
                }}
                style={[styles.choice, cooling && styles.dimmed]}
              >
                <Text style={styles.choiceLabel}>{entry.name}</Text>
                <Text style={styles.cardMeta}>{trainedLabel(entry)}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {step === 'play' && record ? (
          <View style={styles.stack}>
            <Text style={styles.activity}>
              {activityById(record.activityId)?.name ?? 'Playdate'} with {guestNames(record)}
            </Text>
            <PlaydateStage record={record} reducedMotion={reducedMotion} onDone={finish} onTogether={dogsTogether} />
            {skipReady ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Skip to results" onPress={finish} style={styles.start}>
                <Text style={styles.startLabel}>Skip to results</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {step === 'results' && record ? (
          <PlaydateResults
            title={replay ? 'Replay' : 'What a good playdate'}
            friendName={guestNames(record)}
            petA={record.petA}
            petB={record.petB}
            moodDelta={record.outcome.moodDelta}
            bondDelta={record.outcome.bondDelta}
            gains={gains}
            fallbackXp={gains ? null : record.outcome.attributeXp}
            notes={resultNotes(record, pet.name)}
            replay={replay}
            reducedMotion={reducedMotion}
            onReplay={() => {
              finished.current = true;
              setReplay(true);
              resetSkip();
              setStep('play');
            }}
            onDone={onClose}
          />
        ) : null}
      </ScrollView>
      )}
      </View>
  );
  // Partner, place, activity, playback, and results stay a phone column. The outfit step
  // uses the whole window so the preview and the closet can sit side by side.
  return step === 'outfit' ? screen : <PhoneColumn>{screen}</PhoneColumn>;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F4F7FB',
    paddingTop: 64,
  },
  header: {
    height: 52,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  headerButton: {
    alignSelf: 'flex-start',
    minWidth: minTouch,
    minHeight: minTouch,
    justifyContent: 'center',
  },
  headerLabel: {
    color: '#16466F',
    fontSize: 16,
  },
  titleSlot: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: 96,
  },
  title: {
    textAlign: 'center',
    fontFamily: fontFamily.fredokaBold,
    fontSize: 28,
    lineHeight: 34,
    color: '#243044',
  },
  countdown: {
    paddingHorizontal: 20,
    paddingTop: 8,
    color: '#16466F',
    fontSize: 15,
  },
  scroller: {
    flex: 1,
  },
  previewDock: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 12,
  },
  scroll: {
    padding: 20,
    gap: 12,
    paddingBottom: 40,
  },
  scrollUnderPreview: {
    paddingTop: 12,
  },
  stack: {
    gap: 12,
  },
  preview: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
  },
  section: {
    color: '#243044',
    fontSize: 18,
    fontWeight: '600',
  },
  activity: {
    textAlign: 'center',
    fontFamily: fontFamily.fredokaBold,
    fontSize: 22,
    lineHeight: 28,
    color: '#243044',
  },
  card: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 10,
    alignItems: 'center',
  },
  cardCopy: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    color: '#243044',
    fontSize: 18,
    fontWeight: '600',
  },
  cardMeta: {
    color: '#5C6B80',
    fontSize: 14,
  },
  choice: {
    minHeight: minTouch,
    justifyContent: 'center',
    backgroundColor: '#E4E8EF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  choiceOn: {
    backgroundColor: '#DDF6E8',
  },
  choiceLabel: {
    color: '#243044',
    fontSize: 16,
  },
  slotRow: {
    gap: 8,
  },
  start: {
    minHeight: minTouch,
    borderRadius: 14,
    backgroundColor: '#4FC98A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  dimmed: {
    opacity: 0.4,
  },
  startOff: {
    backgroundColor: '#C5D0DC',
  },
  startLabel: {
    color: '#14503A',
    fontSize: 16,
    fontWeight: '600',
  },
});
