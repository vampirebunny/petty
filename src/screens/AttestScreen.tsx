import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  onPass: () => void;
  onBlock: () => void;
};

export function AttestScreen({ onPass, onBlock }: Props) {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Boop Boop</Text>
      <Text style={styles.body}>This app is for ages 13 and up.</Text>
      <Pressable style={styles.primary} onPress={onPass}>
        <Text style={styles.primaryLabel}>I am 13 or older</Text>
      </Pressable>
      <Pressable style={styles.secondary} onPress={onBlock}>
        <Text style={styles.secondaryLabel}>I am under 13</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F4F7FB',
    paddingTop: 96,
    paddingHorizontal: 24,
    gap: 16,
  },
  title: {
    fontSize: 32,
    color: '#243044',
  },
  body: {
    fontSize: 18,
    color: '#243044',
    marginBottom: 12,
  },
  primary: {
    backgroundColor: '#243044',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryLabel: {
    color: '#fff',
    fontSize: 16,
  },
  secondary: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#E4E8EF',
  },
  secondaryLabel: {
    color: '#243044',
    fontSize: 16,
  },
});
