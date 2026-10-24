import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Group, Picture, Skia } from '@shopify/react-native-skia';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { wearItem } from '../../actor/wardrobe';
import type { ShopCatalog } from '../../economy/shop';
import { ICON_BOX, itemIconPicture } from '../skia/itemIcon';
import { drawToyShape, drawTreatShape } from '../skia/scenery';
import { shop } from './theme';

// Toy and treat art is authored to fit its own box, so every item uses the same radius. The box is
// BOX_PER_RADIUS (3) × radius, which fills about 84% of the tile.
export const ICON_RADIUS = 0.28;

type Props = {
  itemId: string;
  catalog: ShopCatalog | null;
  size: number;
  soon?: boolean;
  species?: 'dog' | 'cat' | null;
};

// "Coming soon" and anything without art yet: a puffy mystery box with a question mark.
function MysteryBox({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="mysteryBox" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#E7DBFB" />
          <Stop offset="1" stopColor="#A68AE4" />
        </LinearGradient>
        <LinearGradient id="mysteryLid" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFB8D2" />
          <Stop offset="1" stopColor="#E5679A" />
        </LinearGradient>
      </Defs>
      <Ellipse cx={50} cy={88} rx={32} ry={4.5} fill="#8A5A7A" opacity={0.18} />
      <Rect x={20} y={42} width={60} height={42} rx={8} fill="url(#mysteryBox)" stroke="#5E46A6" strokeWidth={2.5} />
      <Rect x={45} y={42} width={10} height={42} fill="#FFD45A" stroke="#B8891E" strokeWidth={1.6} />
      <Path
        d="M28 62 C28 56 33 53 37 55 C41 57 40 62 36 64 L36 67"
        stroke="#5E46A6"
        strokeWidth={3.2}
        fill="none"
        strokeLinecap="round"
      />
      <Circle cx={36} cy={73} r={2} fill="#5E46A6" />
      <Rect x={15} y={32} width={70} height={14} rx={6} fill="url(#mysteryLid)" stroke="#9E3A68" strokeWidth={2.5} />
      <Rect x={45} y={32} width={10} height={14} fill="#FFD45A" stroke="#B8891E" strokeWidth={1.6} />
      <Path d="M50 32 C42 18 28 20 32 28 C35 33 44 32 50 32 Z" fill="#FFD45A" stroke="#B8891E" strokeWidth={2} strokeLinejoin="round" />
      <Path d="M50 32 C58 18 72 20 68 28 C65 33 56 32 50 32 Z" fill="#FFD45A" stroke="#B8891E" strokeWidth={2} strokeLinejoin="round" />
      <Circle cx={50} cy={31} r={4} fill="#F5B921" stroke="#B8891E" strokeWidth={1.6} />
      <Path d="M20 36 L44 36" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" opacity={0.7} />
      <Path d="M84 16 L86 21 L91 23 L86 25 L84 30 L82 25 L77 23 L82 21 Z" fill="#FF8FB8" />
      <Path d="M14 54 L15.5 57.5 L19 59 L15.5 60.5 L14 64 L12.5 60.5 L9 59 L12.5 57.5 Z" fill="#7FC4F5" />
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
    const radius = size * ICON_RADIUS;
    const mid = size / 2;
    if (item.category === 'toys') {
      drawToyShape(canvas, item.id, mid, mid, radius, 0, 'icon');
    } else {
      drawTreatShape(canvas, item.id, mid, mid, radius, 0, species, 'icon');
    }
    return recorder.finishRecordingAsPicture();
  }, [item, size, soon, species, wear]);

  if (!item || soon || item.shop === 'coming_soon' || (item.category === 'clothes' && !wear)) {
    return <MysteryBox size={size} />;
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
