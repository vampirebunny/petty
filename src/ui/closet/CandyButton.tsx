import { StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';

import { fontFamily } from '../font';
import { closet } from './closetStyle';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
};

export function CandyButton({ label, onPress, disabled = false, accessibilityLabel }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, disabled && styles.disabled]}
    >
      <View pointerEvents="none" style={styles.gloss} />
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'stretch',
    minHeight: 48,
    marginHorizontal: 16,
    borderRadius: 24,
    backgroundColor: closet.accent,
    borderBottomWidth: 4,
    borderBottomColor: closet.accentDark,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  disabled: {
    opacity: 0.45,
  },
  gloss: {
    position: 'absolute',
    top: 0,
    left: 8,
    right: 8,
    height: '46%',
    backgroundColor: 'rgba(255,255,255,0.38)',
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: fontFamily.extraBold,
  },
});
