import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Network from 'expo-network';

import { onStandbyChange, readOtherDeviceLabel, readStandby, setStandby } from '../db/accountMeta';
import { claimDevice } from '../sync/activeDevice';
import { devicePhrase } from '../sync/deviceLabel';
import { reconcileFromServer } from '../sync/reconcile';
import { requestSettle } from '../state/sessionGate';
import { fontFamily } from './font';

export function StandbyOverlay() {
  const [standby, setStandbyOn] = useState(readStandby());

  useEffect(() => onStandbyChange(() => setStandbyOn(readStandby())), []);

  if (!standby) {
    return null;
  }

  const phrase = devicePhrase(readOtherDeviceLabel());

  return (
    <View style={styles.scrim}>
      <Text style={styles.title}>{`You're playing on ${phrase}.`}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          void (async () => {
            const net = await Network.getNetworkStateAsync();
            if (!net.isConnected) {
              Alert.alert('Play here', "You'll need internet to play here.");
              return;
            }
            const claim = await claimDevice();
            if (!claim) {
              Alert.alert('Play here', "You'll need internet to play here.");
              return;
            }
            await reconcileFromServer(claim);
            setStandby(false);
            requestSettle();
          })();
        }}
        style={styles.button}
      >
        <Text style={styles.buttonLabel}>Play here</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(42, 20, 66, 0.72)',
    padding: 28,
  },
  title: {
    color: '#fff',
    fontFamily: fontFamily.extraBold,
    fontSize: 28,
    textAlign: 'center',
  },
  button: {
    marginTop: 24,
    backgroundColor: '#FAAB45',
    borderRadius: 999,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  buttonLabel: {
    fontFamily: fontFamily.extraBold,
    fontSize: 18,
  },
});
