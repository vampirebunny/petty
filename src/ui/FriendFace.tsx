import { StyleSheet, View } from 'react-native';

import { snapshotFromFriend } from '../playdate/snapshot';
import type { FriendPet } from '../friends/types';
import { SnapshotStill } from './SnapshotStill';

type Props = {
  userId: string;
  pet: FriendPet | null;
};

export function FriendFace({ userId, pet }: Props) {
  const snapshot = pet ? snapshotFromFriend(userId, pet) : null;
  // The portrait sits inside invite rows. Skia keeps the touch unless the wrapper opts out,
  // so the first taps on a friend never reach the row.
  return (
    <View pointerEvents="none">
      {snapshot ? <SnapshotStill snapshot={snapshot} width={72} height={90} /> : <View style={styles.empty} />}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    width: 72,
    height: 90,
    borderRadius: 16,
    backgroundColor: '#F6F0E8',
  },
});
