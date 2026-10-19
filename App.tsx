import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Image, StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

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
  const { width: windowWidth } = useWindowDimensions();
  const splashSize = Math.min(200, Math.round(windowWidth * 0.5));
  // True only in the session where the pet was just adopted, so the intro shows once and is not saved.
  const [meeting, setMeeting] = useState(false);

  let screen = (
    <View style={styles.loading}>
      <Image
        source={require('./assets/splash-icon.png')}
        resizeMode="contain"
        style={{ width: splashSize, height: splashSize }}
        accessibilityLabel="Boop Boop"
        accessibilityIgnoresInvertColors
      />
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

  return (
    <GestureHandlerRootView style={styles.root}>
      {screen}
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
    backgroundColor: '#FAAB45',
  },
});
