import { createElement, useEffect, useState } from 'react';
import { Check, Clock, Cookie, Lock } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { iconFor } from '../actionIcons';
import { fontFamily } from '../font';
import { formatRest, restRemainingMs } from '../../sim/training';
import { trackDef, trackName } from '../../sim/tracks';
import type { PetState, Trait } from '../../sim/types';
import { iconStroke } from '../theme';
import { familyPaint, GlossyFace, greySurface, ink, ProgressRing, secondary, white } from './gloss';
import { colorFamilyOf, raisesLine, trainKind, trainingOrder, type TrainKind } from './order';
import { trickIcon } from './trickIcon';

type Tip = { id: string; name: string; propName: string | null };

type Props = {
  pet: PetState;
  species: 'dog' | 'cat';
  now: number;
  reducedMotion: boolean;
  disabled: boolean;
  highlightId?: string | null;
  tip?: Tip | null;
  onTrain: (id: string) => void;
  onPerform: (id: string) => void;
  onProps?: () => void;
  onDismissTip: () => void;
};

function iconOf(id: string, species: 'dog' | 'cat'): LucideIcon {
  return iconFor(id, species) ?? trickIcon(id);
}

function subline(kind: TrainKind, traits: Trait[]): string {
  if (kind === 'new') {
    return 'New · 0%';
  }
  if (kind === 'almost') {
    return 'Almost learned!';
  }
  if (kind === 'resting') {
    return 'Taking a break';
  }
  if (kind === 'locked') {
    return 'Locked';
  }
  return raisesLine(traits);
}

export function InTrainingList({
  pet,
  species,
  now,
  reducedMotion,
  disabled,
  highlightId,
  tip,
  onTrain,
  onPerform,
  onProps,
  onDismissTip,
}: Props) {
  const [expiredId, setExpiredId] = useState<string | null>(null);
  useEffect(() => {
    if (!highlightId) {
      return;
    }
    const timer = setTimeout(() => setExpiredId(highlightId), 10000);
    return () => clearTimeout(timer);
  }, [highlightId]);
  const ringId = highlightId && highlightId !== expiredId ? highlightId : null;

  const rows = trainingOrder(
    Object.values(pet.training)
      .filter((track) => {
        if (track.mastered) {
          return false;
        }
        const def = trackDef(track.id);
        return Boolean(def && def.species.includes(species));
      })
      .map((track) => ({
        id: track.id,
        progress: track.progress,
        unlocked: track.unlocked,
        restUntil: track.restUntil,
        source: track.source,
        lastPracticedAt: track.lastPracticedAt,
      })),
    now,
  );
  const learned = Object.values(pet.training)
    .filter((track) => {
      if (!track.mastered) {
        return false;
      }
      const def = trackDef(track.id);
      return Boolean(def && def.species.includes(species));
    })
    .map((track) => track.id)
    .sort((a, b) => {
      const order = ['sit', 'speak', 'paw'];
      const ai = order.indexOf(a);
      const bi = order.indexOf(b);
      if (ai !== -1 || bi !== -1) {
        return (ai === -1 ? order.length : ai) - (bi === -1 ? order.length : bi);
      }
      return trackName(a, species).localeCompare(trackName(b, species));
    });

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>In Training</Text>
        <View style={styles.treats}>
          <Cookie size={14} strokeWidth={iconStroke + 0.4} color="#A3245A" />
          <Text style={styles.treatsText}>Treats are free here</Text>
        </View>
      </View>
      {rows.length === 0 ? <Text style={styles.empty}>Nothing in training yet.</Text> : null}
      <View style={styles.list}>
        {rows.map((id) => {
          const track = pet.training[id];
          if (!track) {
            return null;
          }
          const kind = trainKind(track, now);
          return (
            <TrainRow
              key={id}
              id={id}
              name={trackName(id, species)}
              progress={track.progress}
              kind={kind}
              traits={trackDef(id)?.linked ?? []}
              restLabel={formatRest(restRemainingMs(track, now))}
              highlighted={ringId === id}
              reducedMotion={reducedMotion}
              disabled={disabled || kind === 'locked'}
              onTrain={kind === 'locked' ? undefined : () => onTrain(id)}
              tip={tip?.id === id ? tip : null}
              onDismissTip={onDismissTip}
              Icon={kind === 'locked' ? Lock : iconOf(id, species)}
            />
          );
        })}
      </View>
      {learned.length > 0 ? (
        <View style={styles.learned}>
          <View style={styles.header}>
            <Text style={styles.title}>Learned</Text>
            {onProps ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Props" onPress={onProps} style={styles.prop}>
                <Text style={styles.propText}>Props</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.list}>
            {learned.map((id) => {
              const glyph = iconOf(id, species);
              const family = familyPaint[colorFamilyOf(id)];
              const name = trackName(id, species);
              return (
                <Pressable
                  key={id}
                  accessibilityRole="button"
                  accessibilityLabel={`Perform ${name}`}
                  disabled={disabled}
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onPerform(id);
                  }}
                >
                  {({ pressed }) => (
                    <GlossyFace
                      colors={family.card}
                      lip={family.inset}
                      shadow={family.drop}
                      soft={family.soft}
                      radius={24}
                      pressed={pressed}
                      style={styles.row}
                    >
                      <View pointerEvents="none" style={styles.learnedHit}>
                        <ProgressRing progress={100} color={family.ring[1]}>
                          {createElement(glyph, { size: 22, strokeWidth: iconStroke + 0.4, color: family.ring[1] })}
                        </ProgressRing>
                        <View style={styles.copy}>
                          <Text style={[styles.name, { color: family.name }]} numberOfLines={1}>
                            {name}
                          </Text>
                          <Text style={styles.sub}>Learned</Text>
                        </View>
                        <View style={styles.restPill}>
                          <Check size={16} strokeWidth={iconStroke + 0.6} color={family.ring[1]} />
                        </View>
                      </View>
                    </GlossyFace>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function TrainRow({
  id,
  name,
  progress,
  kind,
  traits,
  restLabel,
  highlighted,
  reducedMotion,
  disabled,
  onTrain,
  tip,
  onDismissTip,
  Icon,
}: {
  id: string;
  name: string;
  progress: number;
  kind: TrainKind;
  traits: Trait[];
  restLabel: string;
  highlighted: boolean;
  reducedMotion: boolean;
  disabled: boolean;
  onTrain?: () => void;
  tip: Tip | null;
  onDismissTip: () => void;
  Icon: LucideIcon;
}) {
  const family = familyPaint[colorFamilyOf(id)];
  const resting = kind === 'resting' || kind === 'locked';
  const scale = useSharedValue(1);
  useEffect(() => {
    if (!highlighted || reducedMotion) {
      scale.value = 1;
      return;
    }
    scale.value = withSequence(withTiming(1.02, { duration: 200 }), withTiming(1, { duration: 200 }));
  }, [highlighted, reducedMotion, scale]);
  const pulse = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const content = (
    <>
      <ProgressRing progress={progress} color={resting ? '#C5C9D6' : family.ring[1]} track={resting ? '#D7DBE6' : white}>
        <Icon size={22} strokeWidth={iconStroke + 0.4} color={resting ? '#8B90A5' : family.ring[1]} />
      </ProgressRing>
      <View style={styles.copy}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: resting ? secondary : family.name }]} numberOfLines={1}>
            {name}
          </Text>
          <Text style={[styles.percent, { color: resting ? secondary : family.name }]}>{Math.round(progress)}%</Text>
        </View>
        <Text style={styles.sub} numberOfLines={1}>
          {subline(kind, traits)}
        </Text>
      </View>
      {kind === 'resting' ? (
        <View style={styles.restPill}>
          <Clock size={14} strokeWidth={iconStroke + 0.4} color={secondary} />
          <Text style={styles.restText}>{restLabel}</Text>
        </View>
      ) : onTrain ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Train ${name}`}
          disabled={disabled}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onTrain();
          }}
        >
          {({ pressed }) => (
            <GlossyFace colors={family.ring} lip={family.base} shadow={family.base} radius={999} pressed={pressed} style={styles.train}>
              <Text style={styles.trainText}>Train</Text>
            </GlossyFace>
          )}
        </Pressable>
      ) : (
        <View style={styles.restPill}>
          <Lock size={14} strokeWidth={iconStroke + 0.4} color={secondary} />
          <Text style={styles.restText}>Locked</Text>
        </View>
      )}
    </>
  );
  const row = resting ? (
    <View style={[styles.row, styles.rowRest]}>{content}</View>
  ) : (
    <GlossyFace colors={family.card} lip={family.inset} shadow={family.drop} soft={family.soft} radius={24} style={styles.row}>
      {content}
    </GlossyFace>
  );
  const face =
    kind === 'resting' && onTrain ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${name} is resting. ${restLabel} until practice.`}
        disabled={disabled}
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onTrain();
        }}
      >
        {row}
      </Pressable>
    ) : (
      row
    );
  return (
    <View>
      <Animated.View style={[highlighted ? styles.highlight : null, pulse]}>{face}</Animated.View>
      {tip ? (
        <View style={styles.tip}>
          <Text style={styles.tipTitle}>{tip.name} is in training!</Text>
          <Text style={styles.tipBody}>
            Train it here, or from anywhere using this list.
            {tip.propName ? ` The ${tip.propName} is in your Storage too.` : ''}
          </Text>
          <Pressable accessibilityRole="button" onPress={onDismissTip} style={styles.gotIt}>
            <Text style={styles.gotItText}>Got it</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { fontFamily: fontFamily.fredokaSemibold, fontSize: 22, color: ink, flexShrink: 1 },
  treats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFE3EE',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexShrink: 1,
  },
  treatsText: { fontFamily: fontFamily.extraBold, fontSize: 13, color: '#A3245A' },
  empty: { fontFamily: fontFamily.bold, fontSize: 14, color: secondary },
  list: { gap: 12 },
  learned: { gap: 12, marginTop: 8 },
  prop: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  propText: { fontFamily: fontFamily.fredokaSemibold, fontSize: 14, color: ink },
  row: {
    minHeight: 84,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  learnedHit: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowRest: { borderRadius: 24, backgroundColor: greySurface },
  copy: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flexShrink: 1, fontFamily: fontFamily.fredokaSemibold, fontSize: 20 },
  percent: { fontFamily: fontFamily.extraBold, fontSize: 14 },
  sub: { fontFamily: fontFamily.bold, fontSize: 13, color: secondary },
  train: { minHeight: 48, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  trainText: { fontFamily: fontFamily.fredokaSemibold, fontSize: 16, color: white },
  restPill: {
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  restText: { fontFamily: fontFamily.extraBold, fontSize: 14, color: secondary },
  highlight: {
    borderRadius: 30,
    borderWidth: 3,
    borderColor: '#F59A12',
    padding: 4,
    backgroundColor: white,
  },
  tip: {
    marginTop: 8,
    backgroundColor: ink,
    borderRadius: 20,
    padding: 14,
    gap: 6,
  },
  tipTitle: { fontFamily: fontFamily.fredokaSemibold, fontSize: 18, color: white },
  tipBody: { fontFamily: fontFamily.bold, fontSize: 14, color: white },
  gotIt: {
    alignSelf: 'flex-start',
    marginTop: 4,
    backgroundColor: white,
    borderRadius: 999,
    paddingHorizontal: 14,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gotItText: { fontFamily: fontFamily.fredokaSemibold, fontSize: 14, color: ink },
});
