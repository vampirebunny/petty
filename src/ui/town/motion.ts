import { useEffect } from 'react';
import { Easing, cancelAnimation, useSharedValue, withDelay, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';

/** 0 at rest. Sweeps 0 to 1 and back while motion is allowed. */
export function usePulse(reduced: boolean, duration: number, delay = 0): SharedValue<number> {
  const value = useSharedValue(0);
  useEffect(() => {
    if (reduced) {
      cancelAnimation(value);
      value.value = 0;
      return () => cancelAnimation(value);
    }
    value.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }), -1, true),
    );
    return () => cancelAnimation(value);
  }, [delay, duration, reduced, value]);
  return value;
}
