import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fontFamily } from './font';
import { SheetDismiss } from './SheetDismiss';

export type PropChoice = {
  id: string;
  label: string;
};

type Props = {
  props: PropChoice[];
  top: number;
  onClose: () => void;
  onPick: (id: string) => void;
};

export function PropCard({ props, top, onClose, onPick }: Props) {
  return (
    <SheetDismiss top={top} label="Close props" onClose={onClose}>
      <View style={styles.card}>
        <Text style={styles.title}>Prop</Text>
        {props.length === 0 ? (
          <Text style={styles.empty}>No props yet.</Text>
        ) : (
          <View style={styles.row}>
            {props.map((prop) => (
              <Pressable
                key={prop.id}
                accessibilityRole="button"
                accessibilityLabel={prop.label}
                onPress={() => onPick(prop.id)}
                style={styles.prop}
              >
                <Text style={styles.label}>{prop.label}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </SheetDismiss>
  );
}

const styles = StyleSheet.create({
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
  prop: {
    minWidth: 88,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: '#FFE4F2',
  },
  label: {
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 14,
    color: '#6B4C7A',
    textAlign: 'center',
  },
});
