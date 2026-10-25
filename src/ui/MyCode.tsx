import { StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { ChevronLeft } from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';

import { buildFriendLink } from '../friends/friendLink';
import { CandyShell, candyInk, tints } from './candy';
import { fontFamily } from './font';
import { iconStroke, theme } from './theme';

type Props = {
  handle: string;
  onClose: () => void;
  onScan: () => void;
};

export function MyCode({ handle, onClose, onScan }: Props) {
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onClose} style={styles.backHit}>
          {({ pressed }) => (
            <CandyShell tint={tints.sky} radius={22} uid="code-back" pressed={pressed} style={styles.back}>
              <ChevronLeft color={candyInk(tints.sky)} size={22} strokeWidth={iconStroke} />
            </CandyShell>
          )}
        </Pressable>
        <Text style={styles.title}>My code</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.paper}>
          <QRCode value={buildFriendLink(handle)} size={220} color={theme.ink} backgroundColor="#ffffff" quietZone={16} />
        </View>
        <Text style={styles.handle}>@{handle}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Scan a code" onPress={onScan} style={styles.primary}>
          <Text style={styles.primaryText}>Scan a code</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F7F1EA',
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
  body: {
    alignItems: 'center',
    padding: 24,
    gap: 18,
  },
  paper: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 8,
  },
  handle: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 22,
    color: theme.ink,
  },
  primary: {
    minHeight: 48,
    minWidth: 180,
    borderRadius: 24,
    backgroundColor: tints.lilac.icon,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  primaryText: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 16,
    color: '#fff',
  },
});
