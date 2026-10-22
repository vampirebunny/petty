import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { fontFamily } from './font';
import { PawCoin } from '../components/currency/PawCoin';

const countUpMs = 700;
const countDownMs = 400;
const pillMs = 320;
const spinMs = 500;

export type BoopCounterHandle = {
  countBy: (amount: number) => void;
  snap: () => void;
  coinCenterInWindow: () => { x: number; y: number } | null;
};

type Props = {
  value: number;
  payoutActive: boolean;
};

function formatBoops(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

export const BoopCounter = forwardRef<BoopCounterHandle, Props>(function BoopCounter({ value, payoutActive }, ref) {
  const [shown, setShown] = useState(value);
  const [announced, setAnnounced] = useState(value);
  const shownRef = useRef(value);
  const targetRef = useRef(value);
  const valueRef = useRef(value);
  const holding = useRef(false);
  const gen = useRef(0);
  const frame = useRef(0);
  const coinRef = useRef<View>(null);
  const coinWindow = useRef<{ x: number; y: number } | null>(null);
  const pill = useSharedValue(1);
  const coinSpin = useSharedValue(0);

  valueRef.current = value;

  const rememberCoin = () => {
    coinRef.current?.measureInWindow((x, y, width, height) => {
      coinWindow.current = { x: x + width / 2, y: y + height / 2 };
    });
  };

  const animate = useCallback((to: number, duration: number) => {
    const token = gen.current + 1;
    gen.current = token;
    holding.current = true;
    targetRef.current = to;
    const from = shownRef.current;
    const started = Date.now();
    const step = () => {
      if (gen.current !== token) {
        return;
      }
      const t = Math.min(1, (Date.now() - started) / duration);
      const eased = 1 - (1 - t) ** 3;
      const next = Math.round(from + (to - from) * eased);
      shownRef.current = next;
      setShown(next);
      if (t < 1) {
        frame.current = requestAnimationFrame(step);
        return;
      }
      holding.current = false;
      shownRef.current = to;
      targetRef.current = to;
      setShown(to);
      setAnnounced(to);
    };
    frame.current = requestAnimationFrame(step);
  }, []);

  const pop = () => {
    pill.value = withSequence(
      withTiming(1.2, { duration: pillMs / 2, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: pillMs / 2, easing: Easing.out(Easing.cubic) }),
    );
    coinSpin.value = 0;
    coinSpin.value = withTiming(360, { duration: spinMs, easing: Easing.out(Easing.cubic) });
  };

  useImperativeHandle(ref, () => ({
    countBy: (amount: number) => {
      const ledger = valueRef.current;
      const from = shownRef.current;
      const base = Math.max(from, targetRef.current);
      const target = Math.min(ledger, base + amount);
      if (target !== from) {
        animate(target, countUpMs);
      } else {
        targetRef.current = target;
        setAnnounced(target);
      }
      pop();
    },
    snap: () => {
      gen.current += 1;
      cancelAnimationFrame(frame.current);
      holding.current = false;
      const next = valueRef.current;
      shownRef.current = next;
      targetRef.current = next;
      setShown(next);
      setAnnounced(next);
    },
    coinCenterInWindow: () => coinWindow.current,
  }));

  useEffect(() => {
    if (payoutActive) {
      return;
    }
    if (holding.current) {
      if (value < targetRef.current) {
        animate(value, countDownMs);
      }
      return;
    }
    if (value > shownRef.current) {
      gen.current += 1;
      cancelAnimationFrame(frame.current);
      shownRef.current = value;
      targetRef.current = value;
      setShown(value);
      setAnnounced(value);
      return;
    }
    if (value < shownRef.current && targetRef.current !== value) {
      animate(value, countDownMs);
    }
  }, [animate, payoutActive, value]);

  useEffect(() => {
    return () => cancelAnimationFrame(frame.current);
  }, []);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pill.value }],
  }));

  return (
    <Animated.View
      accessibilityLabel={`${announced} Boops`}
      style={[styles.pill, pillStyle]}
      onLayout={rememberCoin}
    >
      <View ref={coinRef} onLayout={rememberCoin}>
        <PawCoin size={22} spinAngle={coinSpin} shine shineMs={3000} />
      </View>
      <Text style={styles.value}>{formatBoops(shown)}</Text>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    right: 16,
    top: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingTop: 4,
    paddingBottom: 4,
    paddingLeft: 5,
    paddingRight: 12,
    transformOrigin: 'right center',
  },
  value: {
    fontFamily: fontFamily.black,
    fontSize: 17,
    color: '#E07B12',
  },
});
