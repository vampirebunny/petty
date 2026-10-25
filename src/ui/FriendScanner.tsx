import { useEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Pressable } from 'react-native-gesture-handler';
import { ChevronLeft } from 'lucide-react-native';

import { parseFriendLink } from '../friends/friendLink';
import { setSuppressOpenPath } from '../state/sessionGate';
import { CandyShell, candyInk, tints } from './candy';
import { fontFamily } from './font';
import { iconStroke, theme } from './theme';

type Props = {
  onClose: () => void;
  onHandle: (handle: string) => void;
  onType: () => void;
};

export function FriendScanner({ onClose, onHandle, onType }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [note, setNote] = useState<string | null>(null);
  const seen = useRef<string | null>(null);
  const asked = useRef(false);

  useEffect(() => {
    if (!permission || permission.granted || asked.current) {
      return;
    }
    asked.current = true;
    void requestPermission();
  }, [permission, requestPermission]);

  const denied = permission != null && !permission.granted && permission.status === 'denied';

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onClose} style={styles.backHit}>
          {({ pressed }) => (
            <CandyShell tint={tints.sky} radius={22} uid="scan-back" pressed={pressed} style={styles.back}>
              <ChevronLeft color={candyInk(tints.sky)} size={22} strokeWidth={iconStroke} />
            </CandyShell>
          )}
        </Pressable>
        <Text style={styles.title}>Scan a code</Text>
      </View>
      {permission?.granted ? (
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={(result) => {
            if (seen.current === result.data) {
              return;
            }
            seen.current = result.data;
            const handle = parseFriendLink(result.data);
            if (!handle) {
              setNote("That's not a Boop Boop code");
              return;
            }
            onHandle(handle);
          }}
        />
      ) : (
        <View style={styles.fallback}>
          <Text style={styles.note}>
            {denied
              ? "Camera access is off, so codes can't be scanned."
              : 'Boop Boop uses the camera to scan friends’ codes.'}
          </Text>
          {denied ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setSuppressOpenPath(true);
                void Linking.openSettings();
              }}
              style={styles.primary}
            >
              <Text style={styles.primaryText}>Open settings</Text>
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" onPress={onType} style={styles.secondary}>
            <Text style={styles.secondaryText}>Type a handle instead</Text>
          </Pressable>
        </View>
      )}
      {note ? <Text style={styles.banner}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F7F1EA',
    paddingTop: 64,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
  },
  backHit: {
    minWidth: 44,
    minHeight: 44,
  },
  back: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 22,
    color: theme.ink,
  },
  camera: {
    flex: 1,
    margin: 20,
    borderRadius: 24,
    overflow: 'hidden',
  },
  fallback: {
    padding: 24,
    gap: 16,
  },
  note: {
    fontFamily: fontFamily.bold,
    fontSize: 16,
    lineHeight: 22,
    color: theme.ink,
  },
  primary: {
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: tints.lilac.icon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 16,
    color: '#fff',
  },
  secondary: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    fontFamily: fontFamily.extraBold,
    fontSize: 15,
    color: candyInk(tints.lilac),
  },
  banner: {
    fontFamily: fontFamily.bold,
    fontSize: 15,
    color: theme.ink,
    textAlign: 'center',
    padding: 16,
  },
});
