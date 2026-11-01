import { useMemo } from 'react';
import { Canvas, Group, Picture } from '@shopify/react-native-skia';

import type { WearItem } from '../../actor/wardrobe';
import type { OutfitSlot } from '../../sim/types';
import { ICON_BOX, itemIconBounds, itemIconPicture } from '../skia/itemIcon';
import { itemArtSize } from './ItemTile';
import { ui } from './tokens';

const MARGIN = 4;
// A tiny collar should not blow up to jacket size.
const MAX_ZOOM = 2;

type Props = {
  slot: OutfitSlot;
  item: WearItem;
};

export function ItemIconArt({ slot, item }: Props) {
  const box = useMemo(() => itemIconBounds(slot, item, ui.card), [slot, item]);
  const base = itemArtSize.height / ICON_BOX;
  const k = Math.min(
    (itemArtSize.width - MARGIN * 2) / box.width,
    (itemArtSize.height - MARGIN * 2) / box.height,
    base * MAX_ZOOM,
  );
  return (
    <Canvas style={itemArtSize}>
      <Group
        transform={[
          { translateX: itemArtSize.width / 2 - (box.x + box.width / 2) * k },
          { translateY: itemArtSize.height / 2 - (box.y + box.height / 2) * k },
          { scale: k },
        ]}
      >
        <Picture picture={itemIconPicture(slot, item, ui.card)} />
      </Group>
    </Canvas>
  );
}
