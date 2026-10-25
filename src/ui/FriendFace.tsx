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
  if (!snapshot) {
    return <View style={styles.empty} />;
  }
  return <SnapshotStill snapshot={snapshot} width={72} height={90} />;
}

const styles = StyleSheet.create({
  empty: {
    width: 72,
    height: 90,
    borderRadius: 16,
    backgroundColor: '#F6F0E8',
  },
});
