import { StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';

import { iconFor } from './actionIcons';
import type { ActionSpecies } from './actionIcons';
import { iconSize, iconStroke, minTouch, theme } from './theme';

export type PetAction = {
  id: string;
  label: string;
  onPress: () => void;
  onLongPress?: () => void;
  // Toggled on: the button gets the accent pill.
  active?: boolean;
  // Set when the scene cannot offer this action. The button dims and tapping it explains why.
  reason?: string;
};

type Props = {
  actions: PetAction[];
  species?: ActionSpecies;
  onBlocked?: (reason: string) => void;
};

export function ActionButtons({ actions, species = 'dog', onBlocked }: Props) {
  return (
    <View style={styles.row}>
      {actions.map((action) => {
        const Icon = iconFor(action.id, species);
        const color = action.active ? theme.accentDark : theme.ink;
        return (
          <Pressable
            key={action.id}
            style={({ pressed }: { pressed: boolean }) => [
              styles.button,
              action.active && styles.buttonActive,
              pressed && styles.buttonPressed,
              action.reason ? styles.disabled : null,
            ]}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            accessibilityState={{ disabled: !!action.reason, selected: !!action.active }}
            onPress={() => (action.reason ? onBlocked?.(action.reason) : action.onPress())}
            onLongPress={action.onLongPress}
          >
            <View style={[styles.pill, action.active && styles.pillActive]}>
              {Icon ? <Icon size={iconSize} strokeWidth={iconStroke} color={color} /> : null}
            </View>
            <Text style={[styles.label, { color }]} numberOfLines={1}>
              {action.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 10,
    columnGap: 10,
    justifyContent: 'center',
  },
  button: {
    width: 76,
    minHeight: minTouch + 26,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderBottomWidth: 4,
    borderBottomColor: 'rgba(36, 48, 68, 0.18)',
    backgroundColor: '#F3F6FB',
    shadowColor: theme.ink,
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  buttonActive: {
    borderColor: theme.accent,
    borderBottomColor: theme.accentDark,
    backgroundColor: '#EAF8F1',
  },
  buttonPressed: {
    transform: [{ translateY: 2 }, { scale: 0.96 }],
    borderBottomWidth: 2,
  },
  pill: {
    width: 48,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: {
    backgroundColor: theme.accent,
  },
  disabled: {
    opacity: 0.35,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});
