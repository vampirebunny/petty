import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  asleep: boolean;
  onFeed: () => void;
  onRest: () => void;
};

export function ActionButtons({ asleep, onFeed, onRest }: Props) {
  return (
    <View style={styles.row}>
      <Pressable style={styles.button} onPress={onFeed}>
        <Text style={styles.label}>Feed</Text>
      </Pressable>
      <Pressable style={styles.button} onPress={onRest}>
        <Text style={styles.label}>{asleep ? 'Wake' : 'Rest'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    backgroundColor: '#243044',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  label: {
    color: '#fff',
    fontSize: 16,
  },
});
