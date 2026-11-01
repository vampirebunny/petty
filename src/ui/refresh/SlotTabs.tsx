import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';

import { fontFamily } from '../font';
import { ui } from './tokens';

export type ClosetTab = 'hat' | 'glasses' | 'neckwear' | 'jacket' | 'boots';

const tabs: { id: ClosetTab; label: string }[] = [
  { id: 'hat', label: 'Hats' },
  { id: 'glasses', label: 'Glasses' },
  { id: 'neckwear', label: 'Neck' },
  { id: 'jacket', label: 'Body' },
  { id: 'boots', label: 'Boots' },
];

type Props = {
  value: ClosetTab;
  onChange: (tab: ClosetTab) => void;
  worn?: ReadonlySet<ClosetTab>;
};

export function SlotTabs({ value, onChange, worn }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bar} contentContainerStyle={styles.row}>
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(tab.id)}
            style={[styles.pill, active && styles.pillOn]}
          >
            <Text style={[styles.label, active && styles.labelOn]}>{tab.label}</Text>
            {worn?.has(tab.id) ? <View style={styles.dot} /> : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexGrow: 0,
    flexShrink: 0,
  },
  row: {
    gap: 8,
    paddingHorizontal: 16,
    minHeight: 44,
    alignItems: 'center',
  },
  pill: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: ui.radius.pill,
    backgroundColor: ui.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 2,
    borderColor: ui.card,
  },
  pillOn: {
    borderColor: ui.equipped.main,
    borderBottomColor: ui.equipped.tabEdge,
  },
  label: {
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 14,
    color: ui.ink,
  },
  labelOn: {
    color: ui.equipped.text,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: ui.equipped.main,
  },
});
