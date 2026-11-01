import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { onFriendAcceptNotice, requestFriendAcceptOpen, type FriendAcceptNotice as Notice } from '../friends/open';
import { fontFamily } from './font';

type Props = {
  reducedMotion: boolean;
};

const holdMs = 4200;

export function FriendAcceptNotice({ reducedMotion }: Props) {
  const [queue, setQueue] = useState<Notice[]>([]);
  const current = queue[0] ?? null;
  const opacity = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => onFriendAcceptNotice((notice) => setQueue((rows) => [...rows, notice])), []);

  useEffect(() => {
    if (!current) return;
    opacity.value = reducedMotion ? 1 : withTiming(1, { duration: 180 });
    const timer = setTimeout(() => setQueue((rows) => rows.slice(1)), holdMs);
    return () => clearTimeout(timer);
  }, [current, opacity, reducedMotion]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (!current) return null;

  const open = () => {
    const notice = current;
    setQueue((rows) => rows.slice(1));
    requestFriendAcceptOpen({ raceId: notice.raceId, joined: notice.joined });
  };

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <Animated.View style={style}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={current.message}
          onPress={open}
          style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        >
          <Text style={styles.title}>Boop Boop</Text>
          <Text style={styles.body}>{current.message}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 56,
    left: 16,
    right: 16,
    zIndex: 70,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(74,53,96,0.94)',
    gap: 2,
  },
  pressed: {
    opacity: 0.86,
  },
  title: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 15,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  body: {
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 14,
    color: '#FFFFFF',
    textAlign: 'center',
  },
});
