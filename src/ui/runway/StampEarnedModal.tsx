import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { readAwardsCache, type CachedAward } from '../../awards/cache';
import { coverArt, isSashAward, stampArt } from '../../awards/runwayArt';
import { trophyArt } from '../../awards/trophyArt';
import { Cover, Sash, Stamp, Trophy } from '../awards';
import { fontFamily } from '../font';
import { PrimaryButton } from '../refresh/PrimaryButton';
import { ui } from '../refresh/tokens';

type Props = {
  awards: CachedAward[];
  petId: string;
  capLine?: string | null;
  onDone: () => void;
  onSeeAwards?: () => void;
};

function titleOf(id: string): string {
  if (isSashAward(id)) {
    return 'Crowd Favorite!';
  }
  if (id.startsWith('stamp_')) {
    return 'New stamp!';
  }
  if (id.startsWith('cover_') || id.startsWith('friend_')) {
    return 'New cover!';
  }
  return 'New trophy!';
}

function AwardArt({ id }: { id: string }) {
  const stamp = stampArt(id);
  if (stamp) {
    return <Stamp kind={stamp.kind} motif={stamp.motif} size={196} />;
  }
  if (isSashAward(id)) {
    return <Sash size={168} />;
  }
  const cover = coverArt(id);
  if (cover) {
    return <Cover kind={cover.kind} icon={cover.icon} material={cover.material} level={cover.level} size={168} />;
  }
  const trophy = trophyArt(id);
  return <Trophy shape={trophy.shape} material={trophy.material} event={trophy.event} size={168} />;
}

export function StampEarnedModal({ awards, petId, capLine, onDone, onSeeAwards }: Props) {
  const ordered = useMemo(() => {
    let sizes: Record<string, number> = {};
    try {
      sizes = Object.fromEntries(readAwardsCache(petId).definitions.map((row) => [row.id, row.size]));
    } catch {
      sizes = {};
    }
    return [...awards].sort((a, b) => (sizes[a.definitionId] ?? 1) - (sizes[b.definitionId] ?? 1));
  }, [awards, petId]);
  const [index, setIndex] = useState(0);
  if (ordered.length === 0) {
    return null;
  }
  const current = ordered[Math.min(index, ordered.length - 1)];
  const last = index >= ordered.length - 1;
  const canSeeAwards = last && Boolean(onSeeAwards);
  const dismiss = last ? onDone : () => setIndex((value) => value + 1);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={last ? onDone : dismiss}>
      <View style={styles.dim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} accessibilityLabel="Dismiss" />
        <View style={styles.wrap}>
          <View style={styles.art}>
            <AwardArt id={current.definitionId} />
          </View>
          <View style={styles.card}>
            <Text style={styles.title}>{titleOf(current.definitionId)}</Text>
            {last && capLine ? <Text style={styles.cap}>{capLine}</Text> : null}
            <PrimaryButton
              label={last ? onSeeAwards ? 'See Awards' : 'Nice' : 'Next'}
              onPress={() => {
                if (last) {
                  if (onSeeAwards) {
                    onSeeAwards();
                    return;
                  }
                  onDone();
                  return;
                }
                setIndex((value) => value + 1);
              }}
            />
            {canSeeAwards ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onDone} style={styles.close}>
                <Text style={styles.closeLabel}>Close</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: {
    flex: 1,
    backgroundColor: 'rgba(42, 28, 58, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  wrap: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    zIndex: 1,
  },
  art: {
    zIndex: 2,
    marginBottom: -48,
    transform: [{ rotate: '-6deg' }],
  },
  card: {
    alignSelf: 'stretch',
    borderRadius: 28,
    backgroundColor: '#FFF8F2',
    paddingTop: 64,
    paddingHorizontal: 22,
    paddingBottom: 22,
    gap: 16,
    alignItems: 'center',
  },
  title: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 26,
    color: '#4A3560',
    textAlign: 'center',
  },
  cap: {
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: '#7A6390',
    textAlign: 'center',
  },
  close: {
    alignSelf: 'stretch',
    minHeight: 50,
    borderRadius: ui.radius.pill,
    backgroundColor: ui.card,
    borderBottomWidth: 5,
    borderBottomColor: ui.cardEdge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeLabel: {
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 16,
    color: ui.disabledInk,
  },
});
