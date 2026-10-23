import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Group, Picture, Skia } from '@shopify/react-native-skia';
import Svg, { Ellipse, Path, Rect } from 'react-native-svg';

import { wearItem } from '../../actor/wardrobe';
import type { ShopCatalog } from '../../economy/shop';
import { ICON_BOX, itemIconPicture } from '../skia/itemIcon';
import { drawToyShape, drawTreatShape } from '../skia/scenery';
import { shop } from './theme';

type Props = {
  itemId: string;
  catalog: ShopCatalog | null;
  size: number;
  soon?: boolean;
};

function Gift({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Rect x={12} y={28} width={40} height={26} rx={6} fill={shop.pinkLight} />
      <Rect x={9} y={20} width={46} height={10} rx={4} fill={shop.pink} />
      <Rect x={29} y={20} width={6} height={34} fill={shop.gold} />
      <Ellipse cx={26} cy={16} rx={8} ry={6} fill={shop.gold} />
      <Ellipse cx={38} cy={16} rx={8} ry={6} fill={shop.gold} />
      <Path d="M32 18 L29 12 L32 16 L35 12 Z" fill={shop.goldDeep} />
    </Svg>
  );
}

export function ItemArt({ itemId, catalog, size, soon }: Props) {
  const item = catalog?.items.find((entry) => entry.id === itemId) ?? null;
  const wear = item?.slot && item.wearId ? wearItem(item.slot, item.wearId) : null;
  const picture = useMemo(() => {
    if (!item || soon || item.shop === 'coming_soon' || wear || item.category === 'clothes') {
      return null;
    }
    const recorder = Skia.PictureRecorder();
    const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, size, size));
    if (item.category === 'toys') {
      drawToyShape(canvas, item.id, size / 2, size / 2 + 2, size * 0.28);
    } else {
      drawTreatShape(canvas, item.id === 'second_wind' ? 'special' : item.id, size / 2, size / 2, size * 0.28);
    }
    return recorder.finishRecordingAsPicture();
  }, [item, size, soon, wear]);
  useEffect(() => () => picture?.dispose(), [picture]);

  if (!item || soon || item.shop === 'coming_soon' || (item.category === 'clothes' && !wear)) {
    return <Gift size={size} />;
  }
  if (wear && item.slot) {
    const icon = itemIconPicture(item.slot, wear, shop.bg);
    return (
      <Canvas style={{ width: size, height: size }}>
        <Group transform={[{ scale: size / ICON_BOX }]}>
          <Picture picture={icon} />
        </Group>
      </Canvas>
    );
  }
  if (!picture) {
    return <View style={[styles.fallback, { width: size, height: size }]} />;
  }
  return (
    <Canvas style={{ width: size, height: size }}>
      <Picture picture={picture} />
    </Canvas>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
});
