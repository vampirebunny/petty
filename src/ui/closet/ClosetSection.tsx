import { StyleSheet, Text, View } from 'react-native';

import type { WearItem } from '../../actor/wardrobe';
import type { OutfitSlot } from '../../sim/types';
import { fontFamily } from '../font';
import { ClosetTile } from './ClosetTile';
import { closet, storage } from './closetStyle';

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
  const rows = chunk(items, spec.cols);
  const tray = spec.kind === 'tray';
  const body = rows.map((row, index) => (
    <View key={index}>
      {spec.kind === 'rail' ? <View style={styles.rail} /> : null}
      {spec.kind === 'rod' ? <View style={styles.rod} /> : null}
      <View style={styles.row}>
        {row.map((item) => {
          const worn = wornId === item.id;
          return (
            <ClosetTile
              key={item.id}
              slot={slot}
              item={item}
              worn={worn}
              tray={tray}
              reducedMotion={reducedMotion}
              onPress={() => onPress(item.id, worn)}
            />
          );
        })}
        {Array.from({ length: spec.cols - row.length }, (_, pad) => (
          <View key={`pad-${pad}`} style={styles.pad} />
        ))}
      </View>
      {spec.kind === 'shelf' || spec.kind === 'rack' ? <View style={styles.plank} /> : null}
    </View>
  ));

  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.plate}>
        {spec.title}
      </Text>
      {tray ? <View style={styles.tray}>{body}</View> : body}
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
  tray: {
    padding: 8,
    borderRadius: 14,
    backgroundColor: closet.tray.bg,
    borderWidth: 3,
    borderColor: closet.tray.border,
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'stretch',
  },
  pad: {
    flex: 1,
  },
  plank: {
    height: 10,
    borderRadius: 5,
    backgroundColor: closet.wood.plank,
    borderBottomWidth: 4,
    borderBottomColor: closet.wood.edge,
    marginTop: -4,
    marginHorizontal: -4,
  },
  rail: {
    height: 8,
    borderRadius: 4,
    backgroundColor: closet.wood.plank,
    borderBottomWidth: 3,
    borderBottomColor: closet.wood.edge,
    marginBottom: -14,
  },
  rod: {
    height: 6,
    borderRadius: 3,
    backgroundColor: closet.rod.bar,
    borderBottomWidth: 2,
    borderBottomColor: closet.rod.edge,
    marginBottom: -12,
  },
});
