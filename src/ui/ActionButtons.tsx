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
            style={[styles.button, action.reason ? styles.disabled : null]}
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
    rowGap: 6,
  },
  button: {
    flexBasis: '25%',
    flexGrow: 0,
    minHeight: minTouch + 20,
    minWidth: minTouch,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  pill: {
    width: 56,
    height: 32,
    borderRadius: 16,
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
    textAlign: 'center',
  },
});
