import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fontFamily } from './font';

export type StorageChoice = {
  id: string;
  label: string;
  kind: 'furniture' | 'prop';
  type?: string;
  sourceTrickId?: string;
};

type Props = {
  items: StorageChoice[];
  empty: string;
  top: number;
  onClose: () => void;
  onPick: (item: StorageChoice) => void;
};

export function StorageCard({ items, empty, top, onClose, onPick }: Props) {
  return (
    <View style={[styles.layer, { top }]} pointerEvents="box-none">
      <Pressable style={styles.dim} accessibilityLabel="Close storage" onPress={onClose} />
      <View style={styles.card}>
        <Text style={styles.title}>Storage</Text>
        {items.length === 0 ? (
          <Text style={styles.empty}>{empty}</Text>
        ) : (
          <View style={styles.row}>
            {items.map((item) => (
              <Pressable
                key={`${item.kind}:${item.id}`}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                onPress={() => onPick(item)}
                style={styles.choice}
              >
                <Text style={styles.label}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 30,
    paddingHorizontal: 20,
  },
  dim: {
    ...StyleSheet.absoluteFill,
  },
  card: {
    backgroundColor: '#FFF6FB',
    borderRadius: 24,
    padding: 16,
    gap: 12,
  },
  title: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 22,
    color: '#6B4C7A',
  },
  empty: {
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 16,
    color: '#6B4C7A',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  choice: {
    minWidth: 88,
    minHeight: 44,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: '#FFE4F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 14,
    color: '#6B4C7A',
    textAlign: 'center',
  },
});
