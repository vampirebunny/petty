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
  // Toggled on: the button fills with its full tint.
  active?: boolean;
  // Set when the scene cannot offer this action. The button dims and tapping it explains why.
  reason?: string;
};

type Props = {
  actions: PetAction[];
  species?: ActionSpecies;
  onBlocked?: (reason: string) => void;
};

// Each action gets a candy tint: soft `bg` at rest, a darker `edge` for the chunky bottom lip,
// and a saturated `strong` that fills the icon bubble (and the whole button when active).
type Tint = { bg: string; edge: string; strong: string; ink: string };

const tints: Record<string, Tint> = {
  pink: { bg: '#FFE3EC', edge: '#F5B5C9', strong: '#FF7BA5', ink: '#8A1F4B' },
  peach: { bg: '#FFE9D6', edge: '#F7C49A', strong: '#FF9F5A', ink: '#8A4210' },
  butter: { bg: '#FFF5CC', edge: '#F2DC82', strong: '#FFCB3D', ink: '#7A5A00' },
  mint: { bg: '#DDF6E8', edge: '#A6DFC0', strong: '#4FC98A', ink: '#14503A' },
  sky: { bg: '#DCEEFF', edge: '#A7CDF2', strong: '#5AA9F0', ink: '#16466F' },
  lilac: { bg: '#EBE2FF', edge: '#C6B4F2', strong: '#9B7BF0', ink: '#412784' },
};

const tintFor: Record<string, keyof typeof tints> = {
  sit: 'peach',
  paw: 'butter',
  speak: 'sky',
  cuddle: 'pink',
  rest: 'lilac',
  wake: 'butter',
  feed: 'peach',
  refill: 'sky',
  play: 'mint',
  playdate: 'lilac',
  wardrobe: 'pink',
  sound: 'sky',
  soundOff: 'sky',
  music: 'lilac',
  musicOff: 'lilac',
  personality: 'mint',
  help: 'lilac',
};

export function ActionButtons({ actions, species = 'dog', onBlocked }: Props) {
  return (
    <View style={styles.row}>
      {actions.map((action) => {
        const Icon = iconFor(action.id, species);
        const tint = tints[tintFor[action.id] ?? 'mint'];
        const on = !!action.active;
        const color = on ? '#FFFFFF' : tint.ink;
        return (
          <Pressable
            key={action.id}
            style={({ pressed }: { pressed: boolean }) => [
              styles.button,
              {
                backgroundColor: on ? tint.strong : tint.bg,
                borderColor: on ? tint.edge : '#FFFFFF',
                borderBottomColor: on ? tint.ink : tint.edge,
                shadowColor: tint.strong,
              },
              pressed && styles.buttonPressed,
              action.reason ? styles.disabled : null,
            ]}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            accessibilityState={{ disabled: !!action.reason, selected: on }}
            onPress={() => (action.reason ? onBlocked?.(action.reason) : action.onPress())}
            onLongPress={action.onLongPress}
          >
            <View
              style={[
                styles.bubble,
                { backgroundColor: on ? 'rgba(255,255,255,0.28)' : '#FFFFFF' },
              ]}
            >
              {Icon ? (
                <Icon
                  size={iconSize}
                  strokeWidth={iconStroke + 0.5}
                  color={on ? '#FFFFFF' : tint.strong}
                />
              ) : null}
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
    width: 88,
    minHeight: minTouch + 30,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 6,
    borderRadius: 30,
    borderWidth: 2,
    borderBottomWidth: 5,
    shadowOpacity: 0.28,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  buttonPressed: {
    transform: [{ translateY: 3 }, { scale: 0.95 }],
    borderBottomWidth: 2,
  },
  bubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.ink,
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
});
