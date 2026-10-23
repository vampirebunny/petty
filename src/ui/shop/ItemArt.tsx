import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Group, Picture, Skia } from '@shopify/react-native-skia';
import Svg, { Ellipse, Path, Rect } from 'react-native-svg';

import { wearItem } from '../../actor/wardrobe';
import type { ShopCatalog, ShopCategory } from '../../economy/shop';
import { ICON_BOX, itemIconPicture } from '../skia/itemIcon';
import { drawToyShape, drawTreatShape } from '../skia/scenery';
import { shop } from './theme';

// How much of the square each shape may use. Wide toys stay inside the frame; round ones grow to fill it.
function artRadius(category: ShopCategory, id: string, size: number): number {
  if (category === 'toys') {
    if (id === 'frisbee') {
      return size * 0.31;
    }
    if (id === 'rope') {
      return size * 0.26;
    }
    if (id === 'stick' || id === 'squeaky') {
      return size * 0.36;
    }
    return size * 0.44;
  }
  return size * 0.44;
}

type Props = {
  itemId: string;
  catalog: ShopCatalog | null;
  size: number;
  soon?: boolean;
  species?: 'dog' | 'cat' | null;
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

export function ItemArt({ itemId, catalog, size, soon, species = null }: Props) {
  const item = catalog?.items.find((entry) => entry.id === itemId) ?? null;
  const wear = item?.slot && item.wearId ? wearItem(item.slot, item.wearId) : null;
  const picture = useMemo(() => {
    if (!item || soon || item.shop === 'coming_soon' || wear || item.category === 'clothes') {
      return null;
    }
    const recorder = Skia.PictureRecorder();
    const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, size, size));
    const radius = artRadius(item.category, item.id, size);
    const mid = size / 2;
    if (item.category === 'toys') {
      drawToyShape(canvas, item.id, mid, mid, radius);
    } else {
      const artId = item.id === 'second_wind' ? 'special' : item.id === 'biscuit' ? 'biscuit' : item.id;
      drawTreatShape(canvas, artId, mid, mid, radius, 0, item.id === 'biscuit' ? species : null);
    }
    return recorder.finishRecordingAsPicture();
  }, [item, size, soon, species, wear]);

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
