import { memo, useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { Canvas, Group, Picture } from '@shopify/react-native-skia';
import { Check } from 'lucide-react-native';

import type { WearItem } from '../../actor/wardrobe';
import type { OutfitSlot } from '../../sim/types';
import { fontFamily } from '../font';
import { ICON_BOX, itemIconPicture } from '../skia/itemIcon';
import { closet } from './closetStyle';

type Props = {
  slot: OutfitSlot;
  item: WearItem;
  worn: boolean;
  onPress: () => void;
  reducedMotion: boolean;
};

const iconCap = { hat: 60, jacket: 64, glasses: 66, neckwear: 66, boots: 66 };

function ClosetTileInner({ slot, item, worn, onPress, reducedMotion }: Props) {
  const [lift] = useState(() => new Animated.Value(worn ? -3 : 0));
  const [width, setWidth] = useState(0);
  const bg = closet.section.bg;
  const cap = iconCap[slot];
  const size = width > 0 ? Math.min(cap, Math.max(0, width - 8)) : cap;

  useEffect(() => {
    const to = worn ? -3 : 0;
    if (reducedMotion) {
      lift.setValue(to);
      return;
    }
    Animated.spring(lift, { toValue: to, useNativeDriver: true, speed: 20, bounciness: 4 }).start();
  }, [lift, reducedMotion, worn]);

  return (
    <View style={styles.wrap} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {worn ? <View style={styles.ledge} /> : null}
      <Animated.View style={[styles.lift, { transform: [{ translateY: lift }] }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={worn ? `${item.label}, wearing` : item.label}
          accessibilityState={{ selected: worn }}
          onPress={onPress}
          style={[styles.tile, worn && styles.worn]}
        >
          {worn ? (
            <View style={styles.badge}>
              <Check color="#FFFFFF" size={12} strokeWidth={4} />
            </View>
          ) : null}
          {size > 0 ? (
            <Canvas style={{ width: size, height: size }}>
              <Group transform={[{ scale: size / ICON_BOX }]}>
                <Picture picture={itemIconPicture(slot, item, bg)} />
              </Group>
            </Canvas>
          ) : null}
          <Text
            numberOfLines={2}
            style={[styles.label, worn && styles.wornLabel]}
          >
            {item.label}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

export const ClosetTile = memo(ClosetTileInner, (prev, next) => {
  return (
    prev.slot === next.slot &&
    prev.item.id === next.item.id &&
    prev.worn === next.worn &&
    prev.reducedMotion === next.reducedMotion
  );
});

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minHeight: 96,
  },
  lift: {
    flex: 1,
  },
  ledge: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 0,
    height: 3,
    borderRadius: 2,
    backgroundColor: closet.tile.ledge,
  },
  tile: {
    flex: 1,
    minHeight: 96,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    paddingTop: 8,
    paddingHorizontal: 2,
    paddingBottom: 6,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
  },
  worn: {
    backgroundColor: closet.tile.selectedBg,
    borderColor: closet.accent,
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: closet.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: closet.tile.label,
    fontSize: 11,
    fontFamily: fontFamily.extraBold,
    textAlign: 'center',
  },
  wornLabel: {
    color: closet.accentDark,
    fontFamily: fontFamily.black,
  },
});
