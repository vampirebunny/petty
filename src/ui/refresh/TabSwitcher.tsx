import { StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';

import { fontFamily } from '../font';
import { ui } from './tokens';

export type HomeTab = 'care' | 'bond' | 'train' | 'style';

const tabs: { id: HomeTab; label: string }[] = [
  { id: 'care', label: 'Care' },
  { id: 'bond', label: 'Bond' },
  { id: 'train', label: 'Train' },
  { id: 'style', label: 'Style' },
];

type Props = {
  value: HomeTab;
  onChange: (tab: HomeTab) => void;
  alerts?: ReadonlySet<HomeTab>;
};

export function TabSwitcher({ value, onChange, alerts }: Props) {
  return (
    <View style={styles.track}>
      {tabs.map((tab) => {
        const active = tab.id === value;
        const alert = alerts?.has(tab.id) === true;
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={alert ? `${tab.label}, suggested` : tab.label}
            onPress={() => onChange(tab.id)}
            style={[styles.tab, active && styles.active]}
          >
            <Text style={[styles.label, active ? styles.labelOn : styles.labelOff]}>{tab.label}</Text>
            {alert ? <View style={styles.dot} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: ui.segmentTrack,
    borderRadius: ui.radius.pill,
    padding: 4,
    minHeight: 52,
  },
  tab: {
    flex: 1,
    minHeight: 44,
    borderRadius: ui.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  active: {
    backgroundColor: ui.card,
    borderBottomWidth: 2,
    borderBottomColor: ui.cardEdge,
  },
  label: {
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 14,
  },
  labelOn: {
    color: ui.ink,
  },
  labelOff: {
    color: ui.inkMuted,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: ui.accent.care.main,
  },
});
