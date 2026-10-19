import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AdoptScreen } from './src/screens/AdoptScreen';
import { MeetScreen } from './src/screens/adopt/MeetScreen';
import { AttestScreen } from './src/screens/AttestScreen';
import { BlockedScreen } from './src/screens/BlockedScreen';
import HomeScreen from './src/screens/HomeScreen';
import { usePet } from './src/state/usePet';
import { useSession } from './src/state/useSession';

export default function App() {
  const session = useSession();
  const pet = usePet();
  // True only in the session where the pet was just adopted, so the intro shows once and is not saved.
  const [meeting, setMeeting] = useState(false);

  let screen = (
    <View style={styles.loading}>
      <Text style={styles.loadingText}>Boop Boop</Text>
    </View>
  );
  if (session.ready && pet.ready) {
    if (session.attestation === 'blocked') {
      screen = <BlockedScreen />;
    } else if (session.attestation !== 'passed') {
      screen = (
        <AttestScreen
          onPass={session.pass}
          onBlock={() => {
            session.block();
            pet.setRemindersOn(false);
          }}
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
      screen = <HomeScreen petApi={pet} onClearAttestation={session.clear} />;
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
    backgroundColor: '#F4F7FB',
  },
  loadingText: {
    fontSize: 20,
    color: '#243044',
  },
});
