import { StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';

import { firstGoals } from '../../awards/caseModel';
import type { CachedAward } from '../../awards/cache';
import { CandyShell, candyInk, tints } from '../candy';
import { fontFamily } from '../font';
import { Trophy } from '../awards';
import { caseTokens } from './tokens';

type Props = {
  name: string;
  awards: CachedAward[];
  onStadium: () => void;
};

export function EmptyRaces({ name, awards, onStadium }: Props) {
  const goals = firstGoals(awards);
  return (
    <View style={styles.wrap}>
      <View style={styles.shelf}>
        {[0, 1, 2].map((slot) => (
          <Trophy key={slot} shape={slot === 1 ? 'grand' : 'handles'} material="gold" earned={false} size={72} />
        ))}
      </View>
      <Text style={styles.title}>{`${name}'s shelf is ready`}</Text>
      <Text style={styles.line}>Win a first ribbon at the Stadium and it will land right here.</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Go to the Stadium" onPress={onStadium} style={styles.hit}>
        {({ pressed }) => (
          <CandyShell tint={tints.butter} radius={24} uid="trophy-stadium" pressed={pressed} style={styles.go}>
            <Text style={[styles.goLabel, { color: candyInk(tints.butter) }]}>Go to the Stadium</Text>
          </CandyShell>
        )}
      </Pressable>
      <View style={styles.goals}>
        <Text style={styles.goalTitle}>First goals</Text>
        {goals.map((goal) => (
          <Text key={goal.id} style={styles.goal}>
            {goal.done ? '✓' : '○'} {goal.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 14,
    paddingTop: 8,
  },
  shelf: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: 16,
    backgroundColor: caseTokens.shelf,
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 12,
  },
  title: {
    textAlign: 'center',
    fontFamily: fontFamily.fredokaBold,
    fontSize: 22,
    color: caseTokens.ink,
  },
  line: {
    textAlign: 'center',
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    lineHeight: 21,
    color: caseTokens.muted,
  },
  hit: {
    alignSelf: 'stretch',
  },
  go: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goLabel: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 18,
  },
  goals: {
    gap: 6,
    paddingTop: 6,
  },
  goalTitle: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 16,
    color: caseTokens.ink,
  },
  goal: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    color: caseTokens.muted,
  },
});
