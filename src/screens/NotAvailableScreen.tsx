import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  onDevClear?: () => void;
};

export function NotAvailableScreen({ onDevClear }: Props) {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Boop Boop</Text>
      <Text style={styles.body}>Boop Boop is not available on this device right now.</Text>
      {__DEV__ && onDevClear ? (
        <Pressable style={styles.dev} onPress={onDevClear}>
          <Text style={styles.devLabel}>Dev clear age check</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F4F7FB',
    paddingTop: 96,
    paddingHorizontal: 24,
    gap: 12,
  },
  title: {
    fontSize: 32,
    color: '#243044',
  },
  body: {
    fontSize: 18,
    color: '#243044',
  },
  dev: {
    marginTop: 24,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#E4E8EF',
  },
  devLabel: {
    color: '#243044',
    fontSize: 14,
  },
});
