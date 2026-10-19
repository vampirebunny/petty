import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { DebugBreedsScreen } from './src/screens/DebugBreedsScreen';
import { AdoptScreen } from './src/screens/AdoptScreen';
import { MeetScreen } from './src/screens/adopt/MeetScreen';
import { ConsentScreen } from './src/screens/ConsentScreen';
import { NotAvailableScreen } from './src/screens/NotAvailableScreen';
import HomeScreen from './src/screens/HomeScreen';
import { useAgeGate } from './src/state/useAgeGate';
import { usePet } from './src/state/usePet';

export default function App() {
  const pet = usePet();
  const gate = useAgeGate({ onUnavailable: () => pet.setRemindersOn(false) });
  // True only in the session where the pet was just adopted, so the intro shows once and is not saved.
  const [meeting, setMeeting] = useState(false);
  // Dev builds only: the breed identity debug screen.
  const [debugBreeds, setDebugBreeds] = useState(false);

  let screen = (
    <View style={styles.loading}>
      <Text style={styles.loadingText}>Boop Boop</Text>
    </View>
  );
  if (gate.phase !== 'loading' && pet.ready) {
    if (gate.phase === 'unavailable') {
      screen = <NotAvailableScreen />;
    } else if (gate.phase === 'consent') {
      screen = (
        <ConsentScreen
          askAge={gate.askAge}
          onYes={() => void gate.continueYes()}
          onNo={() => void gate.continueNo()}
          onAcceptTerms={() => void gate.acceptUpdatedTerms()}
        />
      );
    } else if (!pet.state) {
      screen = (
        <AdoptScreen
          onAdopt={(...args) => {
            setMeeting(true);
            pet.adopt(...args);
          }}
        />
      );
    } else if (meeting) {
      screen = <MeetScreen pet={pet.state} onStart={() => setMeeting(false)} />;
    } else {
      screen = (
        <HomeScreen petApi={pet} />
      );
    }
  }

  if (__DEV__ && debugBreeds) {
    screen = <DebugBreedsScreen onClose={() => setDebugBreeds(false)} />;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      {screen}
      {__DEV__ && !debugBreeds ? (
        <Pressable style={styles.debugButton} onPress={() => setDebugBreeds(true)} hitSlop={8}>
          <Text style={styles.debugText}>Breeds</Text>
        </Pressable>
      ) : null}
      <StatusBar style="auto" />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F7FB',
  },
  debugButton: {
    position: 'absolute',
    top: 48,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(36,48,68,0.55)',
  },
  debugText: {
    fontSize: 11,
    color: '#ffffff',
  },
  loadingText: {
    fontSize: 20,
    color: '#243044',
  },
});
