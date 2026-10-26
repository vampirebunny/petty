import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { SlideInDown, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { fontFamily } from '../font';
import { BedIcon, CatioIcon, SofaIcon } from '../places/locationIcons';
import type { HomeRoom } from './rooms';

type Props = {
  rooms: HomeRoom[];
  reducedMotion: boolean;
  onClose: () => void;
  onPick: (id: HomeRoom['id']) => void;
};

const icons = {
  livingroom: SofaIcon,
  bedroom: BedIcon,
  catio: CatioIcon,
};

export function HomeRoomSheet({ rooms, reducedMotion, onClose, onPick }: Props) {
  const drag = useSharedValue(0);
  const pan = Gesture.Pan()
    .onUpdate((event) => {
      drag.value = Math.max(0, event.translationY);
    })
    .onEnd((event) => {
      if (event.translationY > 80 || event.velocityY > 800) {
        runOnJS(onClose)();
        return;
      }
      drag.value = withTiming(0, { duration: 180 });
    });
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: drag.value }] }));
  const centered = rooms.length < 3;

  return (
    <View style={styles.layer}>
      <Pressable accessibilityLabel="Back to map" onPress={onClose} style={styles.dim} />
      <Animated.View
        entering={reducedMotion ? undefined : SlideInDown.duration(280)}
        style={[styles.sheet, sheetStyle]}
      >
        <GestureDetector gesture={pan}>
          <View>
            <View style={styles.grab} />
            <Text style={styles.title}>Home</Text>
            <Text style={styles.subtitle}>Which room?</Text>
          </View>
        </GestureDetector>
        <View style={[styles.grid, centered && styles.gridCentered]}>
          {rooms.map((room) => {
            const Icon = icons[room.id];
            return (
              <Pressable
                key={room.id}
                accessibilityRole="button"
                accessibilityLabel={room.name}
                onPress={() => onPick(room.id)}
                style={styles.room}
              >
                {({ pressed }) => (
                  <View style={[styles.roomFace, pressed && styles.roomPressed]}>
                    <Icon size={88} />
                    <View style={styles.pill}>
                      <Text style={styles.pillText}>{room.name}</Text>
                    </View>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to map" onPress={onClose} style={styles.back}>
          <Text style={styles.backText}>Back to map</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
  },
  dim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(44, 47, 74, 0.28)',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingBottom: 28,
    paddingHorizontal: 16,
  },
  grab: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#E1E3EE',
    marginTop: 10,
    marginBottom: 12,
  },
  title: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 28,
    color: '#2C2F4A',
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 15,
    color: '#6B6F8A',
    textAlign: 'center',
    marginBottom: 8,
  },
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    paddingTop: 8,
  },
  gridCentered: {
    justifyContent: 'center',
    gap: 18,
  },
  room: {
    flex: 1,
    maxWidth: 140,
    minHeight: 44,
  },
  roomFace: {
    alignItems: 'center',
  },
  roomPressed: {
    transform: [{ translateY: 2 }],
  },
  pill: {
    marginTop: -16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    shadowColor: '#282C50',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  pillText: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 13,
    color: '#2C2F4A',
    textAlign: 'center',
  },
  back: {
    alignSelf: 'center',
    marginTop: 18,
    backgroundColor: '#F4F1FF',
    borderRadius: 22,
    paddingHorizontal: 22,
    paddingVertical: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  backText: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 16,
    color: '#7A5AF5',
  },
});
