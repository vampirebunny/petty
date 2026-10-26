import { useEffect, useState } from 'react';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { Fredoka_600SemiBold, Fredoka_700Bold } from '@expo-google-fonts/fredoka';
import {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
} from '@expo-google-fonts/nunito';
import { Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AdoptScreen } from './src/screens/AdoptScreen';
import { MeetScreen } from './src/screens/adopt/MeetScreen';
import { ConsentScreen } from './src/screens/ConsentScreen';
import { NotAvailableScreen } from './src/screens/NotAvailableScreen';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import HomeScreen from './src/screens/HomeScreen';
import { useAgeGate } from './src/state/useAgeGate';
import { useIdentity } from './src/state/useIdentity';
import { usePet } from './src/state/usePet';
import { onAccountFlags, readRestoreInProgress } from './src/db/accountMeta';
import { onLocalWiped } from './src/compliance/accountWipe';
import { releaseWelcomeHold } from './src/state/sessionGate';
import {
  clearLeftoverGuestSession,
  commitPendingInstall,
  hasPendingInstall,
  installServerPet,
  supersedePendingGuest,
} from './src/compliance/restoreAccount';
import { StandbyOverlay } from './src/ui/StandbyOverlay';
import { FinishSignIn } from './src/ui/FinishSignIn';
import { CandyShell, candyInk, tints } from './src/ui/candy';
import { fontFamily } from './src/ui/font';
import { PhoneColumn } from './src/ui/PhoneColumn';
import { useDeviceOrientation } from './src/ui/useDeviceOrientation';

export default function App() {
  useDeviceOrientation();
  const pet = usePet();
  const { setRemindersOn, adopt, ready: petReady, state: petState } = pet;
  const identity = useIdentity();
  const gate = useAgeGate({ onUnavailable: () => setRemindersOn(false) });
  const [fontsLoaded, fontError] = useFonts({
    [fontFamily.regular]: Nunito_400Regular,
    [fontFamily.semibold]: Nunito_600SemiBold,
    [fontFamily.bold]: Nunito_700Bold,
    [fontFamily.extraBold]: Nunito_800ExtraBold,
    [fontFamily.black]: Nunito_900Black,
    [fontFamily.fredokaSemibold]: Fredoka_600SemiBold,
    [fontFamily.fredokaBold]: Fredoka_700Bold,
  });
  const fontsReady = fontsLoaded || fontError != null;
  const restoreInProgress = identity.ready && readRestoreInProgress() != null;
  const [entry, setEntry] = useState<'checking' | 'offline' | 'welcome' | 'started'>('checking');
  const [entryAttempt, setEntryAttempt] = useState(0);
  const [signInBusy, setSignInBusy] = useState(false);
  useEffect(() => {
    if (identity.ready && !restoreInProgress) {
      void supersedePendingGuest();
      void clearLeftoverGuestSession();
    }
  }, [identity.ready, restoreInProgress]);
  useEffect(() => {
    if (!identity.ready || !petReady || petState || readRestoreInProgress()) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const result = await installServerPet();
      if (cancelled) {
        return;
      }
      if (result === 'offline') {
        setEntry('offline');
      } else if (result === 'home') {
        setEntry('started');
      } else {
        setEntry('welcome');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [identity.ready, petReady, petState, entryAttempt]);
  const { width: windowWidth } = useWindowDimensions();
  const splashSize = Math.min(200, Math.round(windowWidth * 0.5));
  // True only in the session where the pet was just adopted, so the intro shows once and is not saved.
  const [meeting, setMeeting] = useState(false);
  const [, setAccountTick] = useState(0);
  useEffect(() => onAccountFlags(() => setAccountTick((value) => value + 1)), []);
  useEffect(
    () =>
      onLocalWiped(() => {
        setMeeting(false);
        setEntry('welcome');
      }),
    [],
  );

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
  const ownerId = identity.ownerId;
  const booted = fontsReady && petReady && identity.ready && ownerId;
  const gateScreen = () => {
    if (gate.phase === 'loading') {
      return screen;
    }
    if (gate.phase === 'unavailable') {
      return (
        <PhoneColumn>
          <NotAvailableScreen />
        </PhoneColumn>
      );
    }
    if (gate.phase === 'consent') {
      return (
        <PhoneColumn>
          <ConsentScreen
            askAge={gate.askAge}
            onYes={() => void gate.continueYes()}
            onNo={() => void gate.continueNo()}
            onAcceptTerms={() => void gate.acceptUpdatedTerms()}
          />
        </PhoneColumn>
      );
    }
    return null;
  };
  if (booted && ownerId) {
    const gated = gateScreen();
    if (restoreInProgress && !signInBusy) {
      screen = (
        <PhoneColumn>
          <FinishSignIn
            petName={petState?.name ?? 'your pet'}
            onSettled={() => setEntryAttempt((value) => value + 1)}
          />
        </PhoneColumn>
      );
    } else if (petState && gated) {
      screen = gated;
    } else if (petState && meeting) {
      screen = (
        <PhoneColumn>
          <MeetScreen pet={petState} onStart={() => setMeeting(false)} />
        </PhoneColumn>
      );
    } else if (petState) {
      screen = <HomeScreen petApi={pet} />;
    } else if (entry === 'checking') {
      // Splash stays up while the Keychain session is pulled.
    } else if (entry === 'offline') {
      screen = (
        <PhoneColumn>
          <View style={styles.offline}>
            <Text style={styles.offlineText}>Connect to the internet to bring back your pet.</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setEntry('checking');
                setEntryAttempt((value) => value + 1);
              }}
              style={styles.retryHit}
            >
              {({ pressed }) => (
                <CandyShell tint={tints.sky} radius={24} uid="bring-back" pressed={pressed} style={styles.retry}>
                  <Text style={[styles.retryText, { color: candyInk(tints.sky) }]}>Try again</Text>
                </CandyShell>
              )}
            </Pressable>
          </View>
        </PhoneColumn>
      );
    } else if (entry === 'welcome') {
      screen = (
        <PhoneColumn>
          <WelcomeScreen
            onGetStarted={() => {
              releaseWelcomeHold();
              if (!hasPendingInstall()) {
                setEntry('started');
                return;
              }
              setEntry('checking');
              void (async () => {
                const committed = await commitPendingInstall();
                setEntry(committed === 'offline' ? 'offline' : 'started');
              })();
            }}
          />
        </PhoneColumn>
      );
    } else if (gated) {
      screen = gated;
    } else {
      screen = (
        <PhoneColumn>
          <AdoptScreen
            onBusyChange={setSignInBusy}
            onAdopt={(...args) => {
              setMeeting(true);
              adopt(...args, ownerId);
            }}
          />
        </PhoneColumn>
      );
    }
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      {screen}
      <StandbyOverlay pet={petState} />
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
  offline: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF4F8',
    paddingHorizontal: 28,
    gap: 20,
  },
  offlineText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#7A1E44',
    textAlign: 'center',
  },
  retryHit: {
    alignSelf: 'stretch',
  },
  retry: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: {
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 18,
  },
});
