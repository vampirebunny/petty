import { Pressable, StyleSheet, View } from 'react-native';

type Props = {
  label: string;
  onPress: () => void;
};

// A 44 by 44 round button with a chevron drawn from a rotated corner.
export function BackButton({ label, onPress }: Props) {
  return (
    <Pressable style={styles.button} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <View style={styles.chevron} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevron: {
    width: 10,
    height: 10,
    marginLeft: 3,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#243044',
    transform: [{ rotate: '45deg' }],
  },
});
