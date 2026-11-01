import { StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';

import { candyInk } from '../candy';
import { fontFamily } from '../font';
import { Gloss } from './Gloss';
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
        const candy = ui.candy[tab.id];
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={alert ? `${tab.label}, suggested` : tab.label}
            onPress={() => onChange(tab.id)}
            style={[styles.tab, active && [styles.active, { borderBottomColor: candy.lip }]]}
          >
            {active ? (
              <>
                <LinearGradient colors={[candy.top, candy.base, candy.bottom]} locations={[0, 0.45, 1]} style={styles.fill} />
                <Gloss radius={22} />
              </>
            ) : null}
            <Text style={[styles.label, active ? { color: candyInk(candy) } : styles.labelOff]}>{tab.label}</Text>
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
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: ui.gloss.top,
    borderBottomWidth: 3,
  },
  fill: {
    ...StyleSheet.absoluteFill,
  },
  label: {
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 14,
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
