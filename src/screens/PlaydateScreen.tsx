import { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';

import { breedById, scenesFor } from '../actor';
import { seedOf } from '../actor/mulberry';
import type { OwnedItem } from '../actor/closet';
import { activityById, offerActivities, trainedLabel } from '../playdate/activities';
import { formatCooldown } from '../playdate/cooldown';
import { localDateKey, personalityHint } from '../playdate/hint';
import { dailyCast } from '../playdate/npcs';
import { createPlaydateRecord } from '../playdate/record';
import { attributeGains, bondHint, rareEventLine, traitName } from '../playdate/rewards';
import type { AttributeGain } from '../playdate/rewards';
import { latestPlaydateTags, recentPlaydateTags, relationshipFor, rememberPlaydate } from '../playdate/save';
import { snapshotPet } from '../playdate/snapshot';
import type { ActivityDefinition, PetSnapshot, PlaydateRecord, PlaydateSave } from '../playdate/types';
import type { Equipped, PetState, Trait } from '../sim/types';
import { GainBar, gainColors } from '../ui/GainBar';
import { PlaydateStage } from '../ui/PlaydateStage';
import { SnapshotStill } from '../ui/SnapshotStill';
import { CandyButton } from '../ui/closet/CandyButton';
import { WardrobePicker } from '../ui/WardrobePicker';
import { minTouch } from '../ui/theme';

type Step = 'partner' | 'place' | 'activity' | 'outfit' | 'play' | 'results';

type Props = {
  pet: PetState;
  save: PlaydateSave;
  now: number;
  remaining: number;
  reducedMotion: boolean;
  onSave: (save: PlaydateSave) => void;
  onRewarded: (happiness: number, attributes: PlaydateRecord['outcome']['attributeXp']) => void;
  onClose: () => void;
  owned: readonly OwnedItem[];
};

export function PlaydateScreen({ pet, save, now, remaining, reducedMotion, onSave, onRewarded, onClose, owned }: Props) {
  const ownerId = pet.ownerId ?? '';
  const date = localDateKey(now);
  const partners = useMemo(() => dailyCast(save.cast, ownerId, date), [date, ownerId, save.cast]);
  const [step, setStep] = useState<Step>('partner');
  const [partner, setPartner] = useState<PetSnapshot | null>(null);
  const [sceneId, setSceneId] = useState(pet.sceneId);
  const [activity, setActivity] = useState<ActivityDefinition | null>(null);
  const [outfit, setOutfit] = useState<Equipped>({ ...pet.equipped });
  const [record, setRecord] = useState<PlaydateRecord | null>(null);
  const [replay, setReplay] = useState(false);
  // What the paid playdate added, worked out from the pet before the rewards landed.
  const [gains, setGains] = useState<AttributeGain[] | null>(null);
  const finished = useRef(false);

  const preview = useMemo(() => snapshotPet(pet, pet.equipped, '', 'preview'), [pet]);
  const petSpecies = breedById(pet.breedId)?.species === 'cat' ? 'cat' : 'dog';
  const places = scenesFor(partner ? [petSpecies, partner.species] : petSpecies);
  const activities = partner ? offerActivities(preview, partner, sceneId, date) : [];
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
        onRewarded(record.outcome.moodDelta, record.outcome.attributeXp);
      }
    }
    setStep('results');
  };

  const start = () => {
    if (!partner || !activity || cooling || !ownerId) {
      return;
    }
    const createdAt = new Date().toISOString();
    const seed = seedOf(`${pet.id}|${partner.snapshotId}|${createdAt}`) >>> 0;
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
    setRecord(next);
    setStep('play');
  };

  const watch = (saved: PlaydateRecord) => {
    finished.current = false;
    setGains(null);
    setReplay(true);
    setRecord(saved);
    setPartner(saved.petB);
    setActivity(activityById(saved.activityId));
    setStep('play');
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={back} style={styles.headerButton}>
          <Text style={styles.headerLabel}>{step === 'play' ? 'Leave' : 'Back'}</Text>
        </Pressable>
        <Text style={styles.title}>{heading}</Text>
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
                    accessibilityLabel={`Replay playdate with ${saved.petB.name}`}
                    onPress={() => watch(saved)}
                    style={styles.choice}
                  >
                    <Text style={styles.choiceLabel}>
                      {saved.petB.name} · {activityById(saved.activityId)?.name ?? 'Playdate'}
                      {saved.outcome.rareEvents.some((event) => event.type === 'upset') ? ' · Upset' : ''}
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
            <Text style={styles.section}>
              {activityById(record.activityId)?.name ?? 'Playdate'} with {record.petB.name}
            </Text>
            <PlaydateStage record={record} reducedMotion={reducedMotion} onDone={finish} />
            <Pressable accessibilityRole="button" accessibilityLabel="Skip to results" onPress={finish} style={styles.start}>
              <Text style={styles.startLabel}>Skip to results</Text>
            </Pressable>
          </View>
        ) : null}
        {step === 'results' && record ? (
          <View style={styles.stack}>
            <Text style={styles.cardTitle}>{replay ? 'Replay' : 'What a good playdate'}</Text>
            <Text style={styles.cardMeta}>Happiness +{record.outcome.moodDelta}</Text>
            {gains && gains.length > 0 ? (
              <View style={styles.gains}>
                {gains.map((entry) => (
                  <GainBar
                    key={entry.trait}
                    label={traitName[entry.trait]}
                    before={entry.before}
                    gain={entry.gain}
                    potential={entry.potential}
                  />
                ))}
                <View style={styles.legend}>
                  <View style={[styles.swatch, { backgroundColor: gainColors.before }]} />
                  <Text style={styles.legendLabel}>Before</Text>
                  <View style={[styles.swatch, { backgroundColor: gainColors.gain }]} />
                  <Text style={styles.legendLabel}>Gained today</Text>
                  <View style={[styles.swatch, { backgroundColor: gainColors.potential }]} />
                  <Text style={styles.legendLabel}>Potential</Text>
                </View>
              </View>
            ) : (
              Object.entries(record.outcome.attributeXp).map(([trait, gain]) => (
                <Text key={trait} style={styles.cardMeta}>
                  {traitName[trait as Trait]} +{gain}
                </Text>
              ))
            )}
            <Text style={styles.cardMeta}>Bond +{record.outcome.bondDelta}</Text>
            {record.outcome.rareEvents.map((event) => (
              <Text key={event.type === 'trick_shown' ? event.trickId : event.type} style={styles.rare}>
                {rareEventLine(event, pet.name, record.petB.name)}
              </Text>
            ))}
            {record.beats.some((beat) => beat.tag === 'golden') ? <Text style={styles.rare}>A golden moment.</Text> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Replay"
              onPress={() => {
                finished.current = true;
                setReplay(true);
                setStep('play');
              }}
              style={styles.choice}
            >
              <Text style={styles.choiceLabel}>Replay</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Done" onPress={onClose} style={styles.start}>
              <Text style={styles.startLabel}>Done</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F4F7FB',
    paddingTop: 64,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
  },
  headerButton: {
    minWidth: minTouch,
    minHeight: minTouch,
    justifyContent: 'center',
  },
  headerLabel: {
    color: '#16466F',
    fontSize: 16,
  },
  title: {
    flex: 1,
    color: '#243044',
    fontSize: 18,
    fontWeight: '600',
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
  gains: {
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
  legendLabel: {
    color: '#5C6B80',
    fontSize: 12,
    marginRight: 6,
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
  rare: {
    color: '#412784',
    fontSize: 16,
  },
});
