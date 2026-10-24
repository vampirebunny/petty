import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Handshake, Heart, Sparkles, Star } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import { playBadgeChime } from '../audio/badge';
import { traitName } from '../playdate/rewards';
import type { AttributeGain } from '../playdate/rewards';
import type { PetSnapshot } from '../playdate/types';
import type { Trait } from '../sim/types';
import { traitPopColor } from './AttributePops';
import { GainBar, formatScore } from './GainBar';
import { PlusBurst } from './PlusBurst';
import { SnapshotStill } from './SnapshotStill';
import { candyInk, tints } from './candy';
import type { Tint } from './candy';
import { fontFamily } from './font';
import { iconSize, iconStroke, minTouch, theme } from './theme';

export type ResultsNote = {
  id: string;
  label: string;
  tone: 'rare' | 'golden';
};

type Step =
  | { id: string; kind: 'mood' | 'bond'; amount: number; label: string; color: string; strong?: boolean }
  | { id: string; kind: 'trait'; amount: number; label: string; color: string }
  | { id: string; kind: 'rare' };

type Props = {
  title: string;
  friendName: string;
  petA: PetSnapshot;
  petB: PetSnapshot;
  moodDelta: number;
  bondDelta: number;
  // Bars from the pet before the rewards landed. Null on a history replay, which shows no bars.
  gains: readonly AttributeGain[] | null;
  fallbackXp: Partial<Record<Trait, number>> | null;
  notes: readonly ResultsNote[];
  replay: boolean;
  reducedMotion: boolean;
  onReplay: () => void;
  onDone: () => void;
};

const holdMs = 900;

function useCountUp(target: number, instant: boolean, duration: number): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (instant) {
      return;
    }
    const start = Date.now();
    let frame = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      setN(target * (1 - (1 - t) ** 3));
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [duration, instant, target]);
  return instant ? target : n;
}

function PopIn({
  instant,
  rise = false,
  fill = false,
  children,
}: {
  instant: boolean;
  rise?: boolean;
  fill?: boolean;
  children: ReactNode;
}) {
  const v = useSharedValue(instant ? 1 : 0);
  useEffect(() => {
    v.value = instant ? 1 : withSpring(1, { damping: 12, stiffness: 180 });
  }, [instant, v]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.35 + 0.65 * v.value,
    transform: rise ? [{ translateY: (1 - v.value) * 16 }] : [{ scale: 0.86 + 0.14 * v.value }],
  }));
  return <Animated.View style={[fill && styles.fill, style]}>{children}</Animated.View>;
}

function StatChip({
  icon: Icon,
  label,
  delta,
  tint,
  instant,
}: {
  icon: LucideIcon;
  label: string;
  delta: number;
  tint: Tint;
  instant: boolean;
}) {
  const n = useCountUp(delta, instant, 600);
  return (
    <View style={[styles.chip, { backgroundColor: tint.top }]} accessibilityLabel={`${label} plus ${delta}`}>
      <View style={styles.bubble}>
        <Icon size={iconSize} strokeWidth={iconStroke} color={tint.icon} />
      </View>
      <Text style={[styles.chipValue, { color: candyInk(tint) }]}>+{Math.round(n)}</Text>
      <Text style={styles.chipLabel}>{label}</Text>
    </View>
  );
}

function RareCard({ note }: { note: ResultsNote }) {
  const tint = note.tone === 'golden' ? tints.butter : tints.lilac;
  return (
    <View style={[styles.rare, { backgroundColor: tint.top }]}>
      <Sparkles size={iconSize} strokeWidth={iconStroke} color={tint.icon} />
      <View style={styles.rareCopy}>
        {note.tone === 'rare' ? <Text style={[styles.rareKicker, { color: tint.icon }]}>Rare moment</Text> : null}
        <Text style={styles.rareLabel}>{note.label}</Text>
      </View>
    </View>
  );
}

export function PlaydateResults({
  title,
  friendName,
  petA,
  petB,
  moodDelta,
  bondDelta,
  gains,
  fallbackXp,
  notes,
  replay,
  reducedMotion,
  onReplay,
  onDone,
}: Props) {
  const quiet = replay || reducedMotion;
  const gainKey = (gains ?? []).map((entry) => `${entry.trait}:${entry.gain}`).join('|');
  const noteKey = notes.map((note) => `${note.id}:${note.tone}`).join('|');
  const steps = useMemo(() => {
    const next: Step[] = [
      { id: 'mood', kind: 'mood', amount: moodDelta, label: 'Mood', color: tints.pink.icon, strong: true },
    ];
    if (bondDelta > 0) {
      next.push({ id: 'bond', kind: 'bond', amount: bondDelta, label: 'Bond', color: tints.lilac.icon });
    }
    for (const entry of gains ?? []) {
      next.push({
        id: `trait:${entry.trait}`,
        kind: 'trait',
        amount: entry.gain,
        label: traitName[entry.trait],
        color: traitPopColor[entry.trait],
      });
    }
    for (const note of notes) {
      next.push({ id: `rare:${note.id}`, kind: 'rare' });
    }
    return next;
    // Keys stand in for the arrays so a parent re-render does not restart the sequence.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bondDelta, gainKey, moodDelta, noteKey]);

  const [cursor, setCursor] = useState(quiet ? 0 : -1);
  const [skipped, setSkipped] = useState(false);
  const played = useRef(-1);
  const revealed = quiet || skipped;
  const done = revealed || cursor >= steps.length;
  const visible = (index: number) => revealed || cursor >= index;
  const current = !revealed && cursor >= 0 && cursor < steps.length ? steps[cursor] : null;

  useEffect(() => {
    if (revealed || cursor >= steps.length) {
      return;
    }
    if (cursor >= 0 && played.current < cursor) {
      played.current = cursor;
      const step = steps[cursor];
      if (step.kind === 'rare') {
        playBadgeChime();
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (step.amount >= 0.05) {
        const strong = 'strong' in step && step.strong;
        void Haptics.impactAsync(strong ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
      }
    }
    const timer = setTimeout(() => setCursor((value) => value + 1), cursor < 0 ? 450 : holdMs);
    return () => clearTimeout(timer);
  }, [cursor, revealed, steps]);

  const burst =
    current && current.kind !== 'rare' && current.amount >= 0.05
      ? { amount: Math.round(current.amount * 10) / 10, label: current.label, color: current.color }
      : null;
  const grants = gains
    ? []
    : (Object.entries(fallbackXp ?? {}) as [Trait, number][]).filter(([, amount]) => amount > 0);
  const moodIndex = steps.findIndex((step) => step.kind === 'mood');
  const bondIndex = steps.findIndex((step) => step.kind === 'bond');
  const firstTrait = steps.findIndex((step) => step.kind === 'trait');

  const press = (action: () => void) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    action();
  };

  return (
    <View style={styles.stack} accessibilityLiveRegion="polite">
      <Pressable
        accessible={false}
        disabled={done}
        onPress={() => setSkipped(true)}
        style={styles.stageWrap}
      >
        <View style={styles.stage}>
          <SnapshotStill snapshot={petA} width={132} height={156} focus />
          <SnapshotStill snapshot={petB} width={132} height={156} focus />
        </View>
        {burst ? (
          <View pointerEvents="none" style={styles.burst}>
            <PlusBurst
              key={current?.id}
              color={burst.color}
              amount={burst.amount}
              label={burst.label}
              reducedMotion={reducedMotion}
            />
          </View>
        ) : null}
      </Pressable>

      <PopIn instant={quiet}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>with {friendName}</Text>
      </PopIn>

      {visible(moodIndex) ? (
        <View style={styles.chips}>
          <PopIn fill instant={revealed}>
            <StatChip icon={Heart} label="Mood" delta={moodDelta} tint={tints.pink} instant={revealed} />
          </PopIn>
          {bondIndex >= 0 ? (
            visible(bondIndex) ? (
              <PopIn fill instant={revealed}>
                <StatChip icon={Handshake} label="Bond" delta={bondDelta} tint={tints.lilac} instant={revealed} />
              </PopIn>
            ) : (
              <View style={styles.fill} />
            )
          ) : null}
        </View>
      ) : null}

      {gains && gains.length > 0 && firstTrait >= 0 && visible(firstTrait) ? (
        <View style={styles.card}>
          <Text style={styles.kicker}>Grew today</Text>
          {gains.map((entry) => {
            const index = steps.findIndex((step) => step.id === `trait:${entry.trait}`);
            if (!visible(index)) {
              return null;
            }
            const maxed = entry.potential > 0 && entry.after >= entry.potential - 0.01;
            return (
              <View key={entry.trait} style={styles.trait}>
                <GainBar
                  label={traitName[entry.trait]}
                  before={entry.before}
                  gain={entry.gain}
                  potential={entry.potential}
                  animate={!revealed}
                />
                {maxed ? (
                  <View style={styles.maxed}>
                    <Star size={14} strokeWidth={iconStroke} color={tints.butter.icon} />
                    <Text style={styles.maxedLabel}>Reached full potential</Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}

      {!gains && grants.length > 0 ? (
        <View style={styles.card}>
          {grants.map(([trait, amount]) => (
            <Text key={trait} style={styles.grant}>
              {traitName[trait]} +{formatScore(amount)}
            </Text>
          ))}
        </View>
      ) : null}

      {notes.map((note) => {
        const index = steps.findIndex((step) => step.id === `rare:${note.id}`);
        if (!visible(index)) {
          return null;
        }
        return (
          <PopIn key={note.id} instant={revealed}>
            <RareCard note={note} />
          </PopIn>
        );
      })}

      {done ? (
        <PopIn instant={reducedMotion} rise>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Done"
              onPress={() => press(onDone)}
              style={({ pressed }) => [styles.done, pressed && styles.pressed]}
            >
              <Text style={styles.doneLabel}>Done</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Watch it again"
              onPress={() => press(onReplay)}
              style={({ pressed }) => [styles.replay, pressed && styles.pressed]}
            >
              <Text style={styles.replayLabel}>Watch it again</Text>
            </Pressable>
          </View>
        </PopIn>
      ) : (
        <Pressable accessibilityRole="button" accessibilityLabel="Skip to the end" onPress={() => setSkipped(true)} style={styles.skipHit}>
          <Text style={styles.skip}>Tap to skip</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 14,
  },
  stageWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  stage: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'stretch',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    paddingTop: 8,
  },
  burst: {
    position: 'absolute',
    top: 18,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  title: {
    color: theme.ink,
    fontSize: 28,
    lineHeight: 34,
    fontFamily: fontFamily.fredokaBold,
    textAlign: 'center',
  },
  subtitle: {
    color: theme.muted,
    fontSize: 15,
    fontFamily: fontFamily.semibold,
    marginTop: 2,
    textAlign: 'center',
  },
  chips: {
    flexDirection: 'row',
    gap: 12,
  },
  fill: {
    flex: 1,
  },
  chip: {
    alignSelf: 'stretch',
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 2,
  },
  bubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipValue: {
    fontSize: 26,
    fontFamily: fontFamily.black,
  },
  chipLabel: {
    fontSize: 14,
    fontFamily: fontFamily.semibold,
    color: theme.muted,
  },
  card: {
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
  },
  kicker: {
    color: theme.muted,
    fontSize: 13,
    fontFamily: fontFamily.extraBold,
  },
  trait: {
    gap: 4,
  },
  maxed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  maxedLabel: {
    color: candyInk(tints.butter),
    fontSize: 13,
    fontFamily: fontFamily.bold,
  },
  grant: {
    color: theme.muted,
    fontSize: 14,
    fontFamily: fontFamily.semibold,
  },
  rare: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    padding: 14,
  },
  rareCopy: {
    flex: 1,
    gap: 2,
  },
  rareKicker: {
    fontSize: 13,
    fontFamily: fontFamily.extraBold,
  },
  rareLabel: {
    color: theme.ink,
    fontSize: 15,
    fontFamily: fontFamily.semibold,
  },
  actions: {
    gap: 12,
  },
  done: {
    minHeight: minTouch,
    borderRadius: 14,
    backgroundColor: '#4FC98A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  doneLabel: {
    color: theme.accentDark,
    fontSize: 16,
    fontFamily: fontFamily.semibold,
  },
  replay: {
    minHeight: minTouch,
    borderRadius: 12,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  replayLabel: {
    color: theme.ink,
    fontSize: 16,
    fontFamily: fontFamily.semibold,
  },
  pressed: {
    opacity: 0.85,
  },
  skipHit: {
    minHeight: minTouch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skip: {
    color: theme.muted,
    fontSize: 14,
    fontFamily: fontFamily.semibold,
  },
});
