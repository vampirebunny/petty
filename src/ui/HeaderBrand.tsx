import { Image, Pressable, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { Settings } from 'lucide-react-native';

import { CandyShell, candyInk, tints } from './candy';
import { iconStroke } from './theme';

type Props = {
  onSettings: () => void;
  /** Red dot when a friend request is waiting, same as the home header. */
  pendingFriends?: boolean;
  uid?: string;
  style?: StyleProp<ViewStyle>;
};

/** App mark and settings button, matching the living room and bedroom header. */
export function HeaderBrand({ onSettings, pendingFriends = false, uid = 'header-settings', style }: Props) {
  return (
    <View style={[styles.slot, style]}>
      <View style={styles.row}>
        <Image
          source={require('../../assets/icon.png')}
          style={styles.logo}
          accessibilityLabel="Boop Boop"
          accessibilityIgnoresInvertColors
        />
        <Pressable accessibilityRole="button" accessibilityLabel="Settings" onPress={onSettings}>
          {({ pressed }) => (
            <CandyShell tint={tints.pink} radius={22} uid={uid} pressed={pressed} style={styles.settings}>
              <Settings color={candyInk(tints.pink)} size={22} strokeWidth={iconStroke} />
              {pendingFriends ? <View style={styles.friendBadge} /> : null}
            </CandyShell>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 12,
  },
  settings: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EE5C40',
  },
});
