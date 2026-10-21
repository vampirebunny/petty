import { StyleSheet, Text, View } from 'react-native';

import type { WearItem } from '../../actor/wardrobe';
import type { OutfitSlot } from '../../sim/types';
import { fontFamily } from '../font';
import { ClosetTile } from './ClosetTile';
import { closet, storage, tileColumns } from './closetStyle';

type Props = {
  slot: OutfitSlot;
  items: WearItem[];
  wornId: string | undefined;
  onPress: (itemId: string, worn: boolean) => void;
  reducedMotion: boolean;
};

function chunk<T>(items: T[], cols: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += cols) {
    rows.push(items.slice(i, i + cols));
  }
  return rows;
}

export function ClosetSection({ slot, items, wornId, onPress, reducedMotion }: Props) {
  if (items.length === 0) {
    return null;
  }
  const spec = storage[slot];
  const rows = chunk(items, tileColumns);

  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.plate}>
        {spec.title}
      </Text>
      {rows.map((row, index) => (
        <View key={index} style={styles.row}>
          {row.map((item) => {
            const worn = wornId === item.id;
            return (
              <ClosetTile
                key={item.id}
                slot={slot}
                item={item}
                worn={worn}
                reducedMotion={reducedMotion}
                onPress={() => onPress(item.id, worn)}
              />
            );
          })}
          {Array.from({ length: tileColumns - row.length }, (_, pad) => (
            <View key={`pad-${pad}`} style={styles.pad} />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: closet.section.bg,
    borderWidth: 2,
    borderColor: closet.section.border,
    borderRadius: 16,
    paddingTop: 12,
    paddingHorizontal: 10,
    paddingBottom: 10,
    gap: 8,
  },
  plate: {
    alignSelf: 'flex-start',
    paddingVertical: 3,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: closet.plate.bg,
    borderWidth: 2,
    borderColor: closet.plate.border,
    color: closet.plate.text,
    fontSize: 13,
    fontFamily: fontFamily.black,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'stretch',
  },
  pad: {
    flex: 1,
  },
});
