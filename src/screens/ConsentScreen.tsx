import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import type { DevAgeSignal } from '../age/ageSignal';
import { PRIVACY_URL, TERMS_URL } from '../config/legal';

type Props = {
  askAge: boolean;
  onYes: () => void;
  onNo: () => void;
  onAcceptTerms: () => void;
  onSimulate: (signal: DevAgeSignal) => void;
};

const devSignals: DevAgeSignal[] = ['adult', 'teen', 'under13', 'unknown'];

export function ConsentScreen({ askAge, onYes, onNo, onAcceptTerms, onSimulate }: Props) {
  const [answer, setAnswer] = useState<'yes' | 'no' | null>(null);
  const canContinue = !askAge || answer != null;

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Boop Boop</Text>
      {askAge ? (
        <View style={styles.question}>
          <Text style={styles.body}>Are you at least 13 years old?</Text>
          <Pressable
            style={styles.choice}
            accessibilityRole="radio"
            accessibilityState={{ selected: answer === 'yes' }}
            onPress={() => setAnswer('yes')}
          >
            <View style={[styles.mark, answer === 'yes' && styles.markSelected]} />
            <Text style={styles.choiceLabel}>Yes</Text>
          </Pressable>
          <Pressable
            style={styles.choice}
            accessibilityRole="radio"
            accessibilityState={{ selected: answer === 'no' }}
            onPress={() => setAnswer('no')}
          >
            <View style={[styles.mark, answer === 'no' && styles.markSelected]} />
            <Text style={styles.choiceLabel}>No</Text>
          </Pressable>
        </View>
      ) : null}
      <Text style={styles.legal}>By proceeding, you agree to our Terms of Service and Privacy Policy.</Text>
      <Pressable
        style={[styles.primary, !canContinue && styles.primaryDisabled]}
        disabled={!canContinue}
        onPress={() => {
          if (!askAge) {
            onAcceptTerms();
            return;
          }
          if (answer === 'yes') {
            onYes();
          } else if (answer === 'no') {
            onNo();
          }
        }}
      >
        <Text style={styles.primaryLabel}>Continue</Text>
      </Pressable>
      <View style={styles.links}>
        <Pressable onPress={() => void WebBrowser.openBrowserAsync(TERMS_URL)}>
          <Text style={styles.link}>Terms of Service</Text>
        </Pressable>
        <Pressable onPress={() => void WebBrowser.openBrowserAsync(PRIVACY_URL)}>
          <Text style={styles.link}>Privacy Policy</Text>
        </Pressable>
      </View>
      {__DEV__ ? (
        <View style={styles.dev}>
          {devSignals.map((signal) => (
            <Pressable key={signal} style={styles.devButton} onPress={() => onSimulate(signal)}>
              <Text style={styles.devLabel}>Dev signal {signal}</Text>
            </Pressable>
          ))}
        </View>
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
    gap: 16,
  },
  title: {
    fontSize: 32,
    color: '#243044',
  },
  question: {
    gap: 12,
  },
  body: {
    fontSize: 18,
    color: '#243044',
  },
  choice: {
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C5CEDA',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mark: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#243044',
  },
  markSelected: {
    backgroundColor: '#243044',
  },
  choiceLabel: {
    fontSize: 16,
    color: '#243044',
  },
  legal: {
    fontSize: 13,
    color: '#5C6B80',
  },
  primary: {
    backgroundColor: '#243044',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryDisabled: {
    opacity: 0.4,
  },
  primaryLabel: {
    color: '#fff',
    fontSize: 16,
  },
  links: {
    flexDirection: 'row',
    gap: 20,
  },
  link: {
    fontSize: 15,
    color: '#243044',
    textDecorationLine: 'underline',
  },
  dev: {
    gap: 8,
    marginTop: 12,
  },
  devButton: {
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
