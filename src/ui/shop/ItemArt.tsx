import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Group, Picture, Skia } from '@shopify/react-native-skia';
import type { SkCanvas } from '@shopify/react-native-skia';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { todAt } from '../../actor/timeOfDay';
import { wearItem } from '../../actor/wardrobe';
import type { ShopCatalog } from '../../economy/shop';
import type { Env } from '../skia/env';
import { ICON_BOX, itemIconPicture } from '../skia/itemIcon';
import { drawProp, drawToyShape, drawTreatShape } from '../skia/scenery';
import { cabanaWidth } from '../../actor/furniture';
import { BedThumb, bedThumbId } from './BedThumb';
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

const furnitureIconEnv: Env = {
  tod: todAt(14),
  t: 0,
  reduced: true,
  bowlFill: 1,
  waterLevel: 1,
  glows: [],
  feeding: [],
};

// Shop tiles show the same drawing as the room, fitted into the tile.
function furnitureProp(itemId: string, plant?: 'catgrass' | 'flowers' | 'catnip') {
  if (itemId === 'bowl_food') {
    return { id: itemId, kind: 'bowl', x: 0, y: 0, contents: 'kibble', color: '#2f7d5b' };
  }
  if (itemId === 'bowl_water') {
    return { id: itemId, kind: 'bowl', x: 0, y: 0, contents: 'water', color: '#3f78b5' };
  }
  if (itemId === 'bed_standard') {
    return { id: itemId, kind: 'bed', x: 0, y: 0, w: 112, color: '#c2653d' };
  }
  if (itemId === 'scratcher') {
    return { id: itemId, kind: itemId, x: 0, y: 0, h: 74 };
  }
  if (itemId === 'planter') {
    return { id: itemId, kind: 'planter', x: 0, y: 0, w: 60, plant: plant ?? 'catgrass' };
  }
  if (itemId === 'catioPost') {
    return { id: itemId, kind: 'catioPost', x: 0, y: 0, h: 78 };
  }
  if (itemId === 'litterbox') {
    return { id: itemId, kind: 'litterbox', x: 0, y: 0 };
  }
  return { id: itemId, kind: itemId, x: 0, y: 0 };
}

function furnitureBounds(itemId: string) {
  if (itemId === 'scratcher') {
    return { x0: -40, y0: -86, x1: 44, y1: 12 };
  }
  if (itemId.startsWith('bowl_')) {
    return { x0: -36, y0: -28, x1: 36, y1: 16 };
  }
  if (itemId === 'bed_standard') {
    return { x0: -70, y0: -36, x1: 70, y1: 16 };
  }
  if (itemId === 'planter') {
    return { x0: -36, y0: -56, x1: 36, y1: 8 };
  }
  if (itemId === 'catioPost') {
    return { x0: -12, y0: -82, x1: 12, y1: 6 };
  }
  if (itemId === 'litterbox') {
    return { x0: -48, y0: -32, x1: 52, y1: 10 };
  }
  if (itemId === 'dogHouse') {
    const scale = cabanaWidth / 280;
    return { x0: (14 - 140) * scale, y0: (46 - 248) * scale, x1: (266 - 140) * scale, y1: (255 - 248) * scale };
  }
  return { x0: -104, y0: -214, x1: 104, y1: 14 };
}

function drawFurnitureIcon(
  canvas: SkCanvas,
  itemId: string,
  size: number,
  plant?: 'catgrass' | 'flowers' | 'catnip',
): void {
  const prop = furnitureProp(itemId, plant);
  const bounds = furnitureBounds(itemId);
  const pad = size * 0.1;
  const scale = Math.min((size - pad * 2) / (bounds.x1 - bounds.x0), (size - pad * 2) / (bounds.y1 - bounds.y0));
  canvas.save();
  canvas.translate(size / 2 - ((bounds.x0 + bounds.x1) / 2) * scale, size / 2 - ((bounds.y0 + bounds.y1) / 2) * scale);
  canvas.scale(scale, scale);
  drawProp(canvas, prop, furnitureIconEnv);
  canvas.restore();
}

export function FurnitureIcon({
  itemId,
  size,
  plant,
}: {
  itemId: string;
  size: number;
  plant?: 'catgrass' | 'flowers' | 'catnip';
}) {
  const picture = useMemo(() => {
    const recorder = Skia.PictureRecorder();
    const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, size, size));
    drawFurnitureIcon(canvas, itemId, size, plant);
    return recorder.finishRecordingAsPicture();
  }, [itemId, plant, size]);
  return (
    <Canvas style={{ width: size, height: size }}>
      <Picture picture={picture} />
    </Canvas>
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
    if (item.category === 'home') {
      drawFurnitureIcon(canvas, item.id, size);
    } else if (item.category === 'toys') {
      drawToyShape(canvas, item.id, mid, mid, radius, 0, 'icon');
    } else {
      drawTreatShape(canvas, item.id, mid, mid, radius, 0, species, 'icon');
    }
    return recorder.finishRecordingAsPicture();
  }, [item, size, soon, species, wear]);

  if (!item || soon || item.shop === 'coming_soon' || (item.category === 'clothes' && !wear)) {
    return <MysteryBox size={size} />;
  }
  if (bedThumbId(item.id)) {
    return <BedThumb itemId={item.id} size={size} />;
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
