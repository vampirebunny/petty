import { StyleSheet, Text, View } from 'react-native';

import { badgeLabel } from '../../sim/badges';
import { fontFamily } from '../font';
import { theme } from '../theme';
import { BadgeMedal } from './BadgeMedal';

type Props = {
  badges: string[];
};

export function BadgeShelf({ badges }: Props) {
  if (badges.length === 0) {
    return null;
  }
  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Badges</Text>
      <View style={styles.grid}>
        {badges.map((id) => (
          <View key={id} style={styles.cell}>
            <BadgeMedal id={id} size={56} />
            <Text style={styles.name} numberOfLines={2}>
              {badgeLabel(id)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  heading: {
    textAlign: 'center',
    fontFamily: fontFamily.fredokaBold,
    fontSize: 16,
    color: theme.ink,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  cell: {
    width: 84,
    alignItems: 'center',
    gap: 4,
  },
  name: {
    textAlign: 'center',
    fontFamily: fontFamily.bold,
    fontSize: 11,
    lineHeight: 14,
    color: theme.ink,
  },
});
