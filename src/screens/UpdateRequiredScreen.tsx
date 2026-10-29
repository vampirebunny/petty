import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { storeUrl } from '../appUpdate/stores';
import { CandyShell, candyInk, tints } from '../ui/candy';
import { fontFamily } from '../ui/font';

export function UpdateRequiredScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Boop Boop needs an update</Text>
      <Text style={styles.body}>Install the latest version to keep playing.</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          void Linking.openURL(storeUrl());
        }}
        style={styles.hit}
      >
        {({ pressed }) => (
          <CandyShell tint={tints.sky} radius={24} uid="update-required" pressed={pressed} style={styles.button}>
            <Text style={[styles.buttonText, { color: candyInk(tints.sky) }]}>Update</Text>
          </CandyShell>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF4F8',
    paddingHorizontal: 28,
    gap: 16,
  },
  title: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 28,
    color: '#7A1E44',
    textAlign: 'center',
  },
  body: {
    fontFamily: fontFamily.extraBold,
    fontSize: 18,
    color: '#7A1E44',
    textAlign: 'center',
  },
  hit: {
    alignSelf: 'stretch',
    marginTop: 8,
  },
  button: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 18,
  },
});
