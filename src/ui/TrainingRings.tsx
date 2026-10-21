import { useEffect, useId, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronsDown, Hand, Lock, Moon, Volume2 } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { formatRest, isResting, restRemainingMs } from '../sim/training';
import { trackDef, trackName } from '../sim/tracks';
import type { PetState } from '../sim/types';
import { iconFor } from './actionIcons';
import { CandyShell, GRAY, WHITE, candyInk, tints } from './candy';
import type { Tint, TintName } from './candy';
import { iconStroke } from './theme';

type Props = {
  pet: PetState;
  species: 'dog' | 'cat';
  onPractice: (trackId: string) => void;
  highlightId?: string | null;
  reducedMotion?: boolean;
  now: number;
  disabled?: boolean;
};

type Card = {
  label: string;
  Icon: LucideIcon;
  tint: TintName;
  tiers: { min: number; text: string }[];
};

const cards: Record<string, Card> = {
  sit: {
    label: 'Sit',
    Icon: ChevronsDown,
    tint: 'sky',
    tiers: [
      { min: 75, text: 'Almost!' },
      { min: 50, text: 'Getting it' },
      { min: 25, text: 'Learning' },
      { min: 0, text: 'Tap to train' },
    ],
  },
  speak: {
    label: 'Speak',
    Icon: Volume2,
    tint: 'lilac',
    tiers: [
      { min: 75, text: 'Almost!' },
      { min: 50, text: 'Getting it' },
      { min: 25, text: 'Learning' },
      { min: 0, text: 'Tap to train' },
    ],
  },
  paw: {
    label: 'Paw',
    Icon: Hand,
    tint: 'pistachio',
    tiers: [
      { min: 75, text: 'Almost!' },
      { min: 50, text: 'Getting it' },
      { min: 25, text: 'Learning' },
      { min: 0, text: 'Tap to train' },
    ],
  },
};

const order = ['sit', 'speak', 'paw'];

export function trainingIds(pet: PetState, species: 'dog' | 'cat'): string[] {
  return order.filter((id) => {
    const track = pet.training[id];
    const def = trackDef(id);
    return track && def && def.species.includes(species) && !track.mastered;
  });
}

function cardFor(id: string, species: 'dog' | 'cat'): Card {
  const card = cards[id];
  if (id !== 'paw') {
    return card;
  }
  return { ...card, label: trackName(id, species), Icon: iconFor(id, species) ?? Hand };
}

function Spotlight({
  active,
  reducedMotion,
  children,
}: {
  active: boolean;
  reducedMotion: boolean;
  children: ReactNode;
}) {
  const scale = useSharedValue(1);
  useEffect(() => {
    if (!active || reducedMotion) {
      scale.value = 1;
      return;
    }
    scale.value = withRepeat(
      withSequence(withTiming(1.08, { duration: 280 }), withTiming(1, { duration: 280 })),
      6,
      false,
    );
  }, [active, reducedMotion, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Animated.View style={[styles.spot, active && styles.spotOn, style]}>{children}</Animated.View>;
}

function IconBubble({ tint, Icon }: { tint: Tint; Icon: LucideIcon }) {
  const uid = useId().replace(/:/g, '');
  return (
    <View style={[styles.bubble, { shadowColor: tint.lip }]}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
        <Defs>
          <LinearGradient id={`bubble${uid}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={WHITE} />
            <Stop offset="1" stopColor={WHITE} stopOpacity={0.6} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" rx="22" fill={`url(#bubble${uid})`} />
      </Svg>
      <Icon size={24} strokeWidth={iconStroke + 1} color={tint.icon} />
    </View>
  );
}

function ProgressBar({ tint, value }: { tint: Tint; value: number }) {
  const [trackWidth, setTrackWidth] = useState(0);
  const portion = Math.max(0, Math.min(100, value)) / 100;
  const fill = trackWidth * portion;
  return (
    <View
      style={styles.track}
      onLayout={(event) => {
        const next = event.nativeEvent.layout.width;
        setTrackWidth((current) => (current === next ? current : next));
      }}
    >
      {fill > 0 ? (
        <View style={[styles.fill, { width: fill, backgroundColor: tint.icon }]}>
          <View style={styles.fillGloss} />
        </View>
      ) : null}
    </View>
  );
}

function TrainingCard({
  card,
  value,
  locked,
  resting,
  restLabel,
  fresh,
  onPress,
}: {
  card: Card;
  value: number;
  locked: boolean;
  resting: boolean;
  restLabel: string;
  fresh: boolean;
  onPress?: () => void;
}) {
  const uid = useId().replace(/:/g, '');
  const tint = locked || resting ? GRAY : tints[card.tint];
  const ink = candyInk(tint);
  const tier = card.tiers.find((entry) => value >= entry.min) ?? card.tiers[card.tiers.length - 1];
  const caption = locked ? 'Locked' : resting ? restLabel : value <= 0 ? tier.text : `${tier.text} · ${Math.round(value)}%`;
  const Icon = locked ? Lock : resting ? Moon : card.Icon;
  return (
    <Pressable
      disabled={locked || !onPress}
      onPress={onPress}
      style={styles.card}
      accessibilityRole="button"
      accessibilityState={{ disabled: locked, selected: fresh }}
      accessibilityLabel={`${card.label}, ${caption}`}
    >
      {({ pressed }) => (
        <CandyShell tint={tint} radius={24} selected={fresh} pressed={pressed && !locked} uid={uid} style={styles.face}>
          <IconBubble tint={tint} Icon={Icon} />
          <Text style={[styles.name, { color: ink }]} numberOfLines={1}>
            {card.label}
          </Text>
          <ProgressBar tint={tint} value={locked ? 0 : value} />
          <Text style={[styles.caption, { color: ink }]} numberOfLines={1}>
            {caption}
          </Text>
          {fresh ? (
            <View style={styles.sticker}>
              <Text style={[styles.stickerText, { color: ink }]}>New!</Text>
            </View>
          ) : null}
        </CandyShell>
      )}
    </Pressable>
  );
}

export function TrainingRings({ pet, species, onPractice, highlightId, reducedMotion = false, now, disabled = false }: Props) {
  const ids = trainingIds(pet, species);
  if (ids.length === 0) {
    return null;
  }
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>In Training</Text>
      <View style={styles.row}>
        {ids.map((id) => {
          const track = pet.training[id];
          const def = trackDef(id);
          if (!track || !def) {
            return null;
          }
          const locked = !track.unlocked;
          const resting = isResting(track, now);
          const justReady =
            track.restUntil != null && now >= track.restUntil && now - track.restUntil < 1600;
          const fresh = (id === highlightId && !locked) || justReady;
          return (
            <Spotlight key={id} active={fresh} reducedMotion={reducedMotion}>
              <TrainingCard
                card={cardFor(id, species)}
                value={track.progress}
                locked={locked}
                resting={resting}
                restLabel={`Rest ${formatRest(restRemainingMs(track, now))}`}
                fresh={fresh}
                onPress={locked || disabled ? undefined : () => onPractice(id)}
              />
            </Spotlight>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, marginBottom: 16 },
  title: { color: '#243044', fontSize: 15, fontWeight: '800' },
  row: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  spot: { flex: 1, maxWidth: 112 },
  spotOn: {
    borderRadius: 28,
    shadowColor: '#FF7BA5',
    shadowOpacity: 0.55,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  card: { flex: 1 },
  face: {
    alignItems: 'center',
    gap: 6,
    paddingTop: 12,
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  bubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: WHITE,
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  name: { fontSize: 14, fontWeight: '900' },
  track: {
    alignSelf: 'stretch',
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.78)',
    overflow: 'hidden',
  },
  fill: {
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
  },
  fillGloss: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  caption: { fontSize: 11, fontWeight: '800' },
  sticker: {
    position: 'absolute',
    top: 8,
    right: 6,
    backgroundColor: WHITE,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 2,
    transform: [{ rotate: '8deg' }],
  },
  stickerText: { fontSize: 10, fontWeight: '900' },
});
