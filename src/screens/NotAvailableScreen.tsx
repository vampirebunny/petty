import { StyleSheet, Text, View } from 'react-native';

export function NotAvailableScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Boop Boop</Text>
      <Text style={styles.body}>Boop Boop is not available on this device right now.</Text>
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
});
