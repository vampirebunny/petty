import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { stampHowTo, stampLabel } from '../../awards/caseModel';
import { Stamp, type StampKind, type StampMotif } from '../awards';
import { fontFamily } from '../font';
import { caseTokens } from './tokens';

type Props = {
  kind: StampKind;
  motif: StampMotif;
  earned: boolean;
  wornLabel?: string | null;
  onClose: () => void;
};

export function StampSheet({ kind, motif, earned, wornLabel, onClose }: Props) {
  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <View style={styles.dim}>
        <View style={styles.card}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.closeHit}>
            <Text style={styles.close}>Close</Text>
          </Pressable>
          <View style={styles.art}>
            <Stamp kind={kind} motif={motif} earned={earned} size={140} />
          </View>
          <Text style={styles.title}>{stampLabel(kind)}</Text>
          <Text style={styles.how}>{stampHowTo(kind)}</Text>
          {kind === 'rack' && wornLabel ? <Text style={styles.worn}>{wornLabel}</Text> : null}
          <Text style={styles.state}>{earned ? 'Earned' : 'Not earned yet'}</Text>
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
    gap: 8,
    alignItems: 'center',
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
  art: {
    paddingVertical: 8,
  },
  title: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 22,
    color: caseTokens.ink,
  },
  how: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    lineHeight: 21,
    color: caseTokens.muted,
    textAlign: 'center',
  },
  worn: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 15,
    color: caseTokens.ink,
  },
  state: {
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    color: caseTokens.muted,
  },
});
