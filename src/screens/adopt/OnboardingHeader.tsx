import { StyleSheet, Text, View } from 'react-native';

import { fontFamily } from '../../ui/font';
import { BackButton } from './BackButton';
import { StepIndicator } from './StepIndicator';

type Props = {
  title: string;
  step: 1 | 2 | 3 | 4;
  onBack?: () => void;
  backLabel?: string;
};

// Same face as the pet name on the home screen, held on the screen center.
// Equal side insets clear the back button and the step dots without shifting the title.
export function OnboardingHeader({ title, step, onBack, backLabel }: Props) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <View style={styles.back}>
          <BackButton label={backLabel ?? 'Back'} onPress={onBack} />
        </View>
      ) : null}
      <View pointerEvents="none" style={styles.titleSlot}>
        <Text
          accessibilityRole="header"
          style={styles.title}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.65}
        >
          {title}
        </Text>
      </View>
      <View style={styles.steps}>
        <StepIndicator step={step} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 52,
    justifyContent: 'center',
  },
  back: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    zIndex: 1,
  },
  steps: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    zIndex: 1,
  },
  titleSlot: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: 80,
  },
  title: {
    textAlign: 'center',
    fontFamily: fontFamily.fredokaBold,
    fontSize: 28,
    lineHeight: 34,
    color: '#243044',
  },
});
