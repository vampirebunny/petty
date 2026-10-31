import { StyleSheet, Text, View } from 'react-native';

import { fontFamily } from './font';

export function ParkFriendsBubble({ friends }: { friends: readonly { userId: string; handle: string }[] }) {
  if (friends.length === 0) {
    return null;
  }
  return (
    <View pointerEvents="none" style={styles.card}>
      <Text style={styles.title}>Friends at the Park</Text>
      {friends.map((friend) => (
        <View key={friend.userId} style={styles.row}>
          <View style={styles.dot} />
          <Text style={styles.handle} numberOfLines={1}>
            @{friend.handle}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    maxWidth: 240,
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: '#FFF6FB',
    borderWidth: 1,
    borderColor: '#F3D3E2',
    shadowColor: '#E98DAE',
    shadowOpacity: 0.28,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    gap: 4,
  },
  title: {
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 10,
    lineHeight: 12,
    color: '#C04D78',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3CB371',
  },
  handle: {
    flexShrink: 1,
    fontFamily: fontFamily.bold,
    fontSize: 13,
    lineHeight: 16,
    color: '#5C3A4A',
  },
});
