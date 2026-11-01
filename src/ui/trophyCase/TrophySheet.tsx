import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { TrophySheetModel } from '../../awards/caseModel';
import { featTitle, titleCase } from '../../awards/caseModel';
import { trophyArt } from '../../awards/trophyArt';
import { eventLabel } from '../../sim/stadium';
import type { RaceEvent } from '../../sim/stadium';
import { Trophy } from '../awards';
import { fontFamily } from '../font';
import { Bar, wonLine } from './bits';
import { caseTokens } from './tokens';

type Props = {
  model: TrophySheetModel | null;
  petName: string;
  onClose: () => void;
};

export function TrophySheet({ model, petName, onClose }: Props) {
  if (!model) {
    return null;
  }
  const heading = model.event
    ? `${eventLabel((model.event as RaceEvent) ?? 'funRun')} · ${model.title}`
    : model.feat
      ? featTitle(model.feat)
      : model.title;
  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <View style={styles.dim}>
        <View style={styles.card}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.closeHit}>
            <Text style={styles.close}>Close</Text>
          </Pressable>
          <Text style={styles.title}>{heading}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelf}>
            {model.rungs.map((rung) => {
              const art = trophyArt(rung.id);
              return (
                <View key={rung.id} style={styles.rung}>
                  <Trophy shape={art.shape} material={art.material} event={art.event} earned={rung.earned} size={72} />
                  <Text style={styles.rungLabel}>{rung.label}</Text>
                  {rung.earned ? <Text style={styles.meta}>{wonLine(petName, rung.earnedAt, rung.classId)}</Text> : null}
                </View>
              );
            })}
          </ScrollView>
          {model.need != null ? (
            <View style={styles.next}>
              <Text style={styles.nextLabel}>
                {model.nextLabel
                  ? `${model.have} / ${model.need} to ${model.nextLabel}`
                  : `${model.have} / ${model.need}`}
              </Text>
              <Bar have={model.have} need={model.need} />
            </View>
          ) : model.have > 0 ? (
            <Text style={styles.nextLabel}>{`${titleCase(model.feat ?? 'count')} · ${model.have}`}</Text>
          ) : model.nextLabel ? (
            <Text style={styles.nextLabel}>{model.nextLabel}</Text>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: {
    flex: 1,
    backgroundColor: 'rgba(42, 43, 74, 0.45)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: caseTokens.cream,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    gap: 12,
  },
  closeHit: {
    alignSelf: 'flex-end',
    minHeight: 44,
    justifyContent: 'center',
  },
  close: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 15,
    color: caseTokens.purple,
  },
  title: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 22,
    color: caseTokens.ink,
  },
  shelf: {
    gap: 14,
    paddingVertical: 8,
    alignItems: 'flex-end',
  },
  rung: {
    width: 96,
    alignItems: 'center',
    gap: 6,
  },
  rungLabel: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 13,
    color: caseTokens.ink,
    textAlign: 'center',
  },
  meta: {
    fontFamily: fontFamily.semibold,
    fontSize: 11,
    lineHeight: 14,
    color: caseTokens.muted,
    textAlign: 'center',
  },
  next: {
    gap: 6,
  },
  nextLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    color: caseTokens.muted,
  },
});
