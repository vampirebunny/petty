import { StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';

export type PetAction = {
  id: string;
  label: string;
  onPress: () => void;
  primary?: boolean;
  // Set when the scene cannot offer this action. The button dims and tapping it explains why.
  reason?: string;
};

type Props = {
  actions: PetAction[];
  onBlocked: (reason: string) => void;
};

export function ActionButtons({ actions, onBlocked }: Props) {
  return (
    <View style={styles.row}>
      {actions.map((action) => (
        <Pressable
          key={action.id}
          style={[styles.button, action.primary && styles.primary, action.reason ? styles.disabled : null]}
          accessibilityState={{ disabled: !!action.reason }}
          onPress={() => (action.reason ? onBlocked(action.reason) : action.onPress())}
        >
          <Text style={styles.label}>{action.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  button: {
    flexGrow: 1,
    flexBasis: '22%',
    backgroundColor: '#243044',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  primary: {
    backgroundColor: '#2f7d5b',
  },
  disabled: {
    opacity: 0.35,
  },
  label: {
    color: '#fff',
    fontSize: 15,
    textAlign: 'center',
  },
});
