import { StyleSheet, Text, View } from 'react-native';

import { fontFamily } from './font';

type Props = {
  level: number;
  goal: string | null;
  into: number;
  need: number;
};

export function LevelBar({ level, goal, into, need }: Props) {
  const fill = goal || need <= 0 ? (goal ? 0 : 1) : Math.max(0, Math.min(1, into / need));
  const caption = need <= 0 ? 'Level 100' : `${Math.floor(into)} / ${Math.round(need)}`;
  return (
    <View style={styles.wrap} accessibilityRole="text" accessibilityLabel={goal ? `Level ${level}` : `Level ${level}. ${caption}`}>
      <Text style={styles.level} numberOfLines={1}>
        Level {level}
      </Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${fill * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 2,
  },
  level: {
    textAlign: 'center',
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 12,
    lineHeight: 14,
    color: '#5C6B80',
  },
  track: {
    width: 112,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E4E8EF',
    overflow: 'hidden',
  },
  fill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF7BA5',
  },
});
