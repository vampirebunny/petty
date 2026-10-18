import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  asleep: boolean;
  canFeed: boolean;
  canDrink: boolean;
  canRest: boolean;
  onFeed: () => void;
  onDrink: () => void;
  onRest: () => void;
  onThrow: () => void;
};

export function ActionButtons({ asleep, canFeed, canDrink, canRest, onFeed, onDrink, onRest, onThrow }: Props) {
  return (
    <View style={styles.row}>
      <Pressable style={[styles.button, !canFeed && styles.disabled]} disabled={!canFeed} onPress={onFeed}>
        <Text style={styles.label}>Feed</Text>
      </Pressable>
      <Pressable style={[styles.button, !canDrink && styles.disabled]} disabled={!canDrink} onPress={onDrink}>
        <Text style={styles.label}>Drink</Text>
      </Pressable>
      <Pressable style={[styles.button, !canRest && styles.disabled]} disabled={!canRest} onPress={onRest}>
        <Text style={styles.label}>{asleep ? 'Wake' : 'Rest'}</Text>
      </Pressable>
      <Pressable style={styles.button} onPress={onThrow}>
        <Text style={styles.label}>Throw ball</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    flex: 1,
    backgroundColor: '#243044',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.35,
  },
  label: {
    color: '#fff',
    fontSize: 15,
    textAlign: 'center',
  },
});
