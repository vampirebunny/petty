import { StyleSheet, View } from 'react-native';

type Props = {
  step: 1 | 2 | 3 | 4;
};

const total = 4;

// Four dots, with the current step as a wider pill.
export function StepIndicator({ step }: Props) {
  return (
    <View style={styles.row} accessibilityLabel={`Step ${step} of ${total}`} accessibilityRole="progressbar">
      {Array.from({ length: total }, (_, index) => (
        <View key={index} style={[styles.dot, index + 1 === step && styles.current, index + 1 < step && styles.done]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D0D8E3',
  },
  done: {
    backgroundColor: '#8DA2BD',
  },
  current: {
    width: 24,
    backgroundColor: '#243044',
  },
});
