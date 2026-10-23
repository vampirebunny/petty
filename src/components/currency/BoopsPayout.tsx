import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { playBloop } from '../../audio/bloop';
import { fontFamily } from '../../ui/font';
import type { BoopCounterHandle } from '../../ui/BoopCounter';
import { PawCoin } from './PawCoin';
import { hasWindowSize, usableCoinCenter } from './windowSample';

const coinSize = 56;
const dropMs = 950;
const flyMs = 420;
const spinMs = 600;
const labelMs = 1300;
const fiveOffsets = [-80, -40, 0, 40, 80];

type Point = { x: number; y: number };

type Props = {
  amount: number;
  coinCount: 1 | 5;
  origin: Point;
  counter: RefObject<BoopCounterHandle | null>;
  reducedMotion: boolean;
  hopPet?: boolean;
  onDone: () => void;
};

type Frame = { origin: Point; target: Point };

function easeInOut(t: number): number {
  'worklet';
  const x1 = 0.42;
  const y1 = 0;
  const x2 = 0.58;
  const y2 = 1;
  let guess = t;
  for (let i = 0; i < 6; i += 1) {
    const cx = 3 * x1;
    const bx = 3 * (x2 - x1) - cx;
    const ax = 1 - cx - bx;
    const xEst = ((ax * guess + bx) * guess + cx) * guess;
    const dx = (3 * ax * guess + 2 * bx) * guess + cx;
    if (Math.abs(dx) < 1e-4) {
      break;
    }
    guess = Math.min(1, Math.max(0, guess - (xEst - t) / dx));
  }
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  return ((ay * guess + by) * guess + cy) * guess;
}

function dropPose(p: number): { y: number; scale: number; opacity: number } {
  'worklet';
  const keys = [
    { t: 0, y: -160, scale: 0.6, opacity: 0 },
    { t: 0.28, y: 0, scale: 1, opacity: 1 },
    { t: 0.46, y: -54, scale: 1, opacity: 1 },
    { t: 0.62, y: 0, scale: 1, opacity: 1 },
    { t: 0.76, y: -20, scale: 1, opacity: 1 },
    { t: 0.88, y: 0, scale: 1, opacity: 1 },
    { t: 0.94, y: -6, scale: 1, opacity: 1 },
    { t: 1, y: 0, scale: 1, opacity: 1 },
  ];
  let index = 1;
  while (index < keys.length - 1 && p > keys[index].t) {
    index += 1;
  }
  const from = keys[index - 1];
  const to = keys[index];
  const span = to.t - from.t;
  const local = span <= 0 ? 1 : Math.min(1, Math.max(0, (p - from.t) / span));
  const eased = easeInOut(local);
  return {
    y: from.y + (to.y - from.y) * eased,
    scale: from.scale + (to.scale - from.scale) * eased,
    opacity: from.opacity + (to.opacity - from.opacity) * eased,
  };
}

function labelPose(p: number): { y: number; opacity: number } {
  'worklet';
  const eased = 1 - (1 - p) ** 3;
  if (eased < 0.2) {
    const t = eased / 0.2;
    return { opacity: t, y: 10 * (1 - t) };
  }
  if (eased < 0.75) {
    const t = (eased - 0.2) / 0.55;
    return { opacity: 1, y: -14 * t };
  }
  const t = (eased - 0.75) / 0.25;
  return { opacity: 1 - t, y: -14 + -10 * t };
}

function FlyingCoin({
  offset,
  delay,
  index,
  origin,
  targetX,
  targetY,
  aim,
  onArrive,
}: {
  offset: number;
  delay: number;
  index: number;
  origin: Point;
  targetX: SharedValue<number>;
  targetY: SharedValue<number>;
  aim: (then: () => void) => void;
  onArrive: (index: number) => void;
}) {
  const drop = useSharedValue(0);
  const fly = useSharedValue(0);
  const phase = useSharedValue(0);
  const spin = useSharedValue(0);
  const arriveRef = useRef(onArrive);
  const launched = useRef(false);
  const reported = useRef(false);
  useEffect(() => {
    arriveRef.current = onArrive;
  }, [onArrive]);

  useEffect(() => {
    const notify = (coinIndex: number) => {
      if (reported.current) {
        return;
      }
      reported.current = true;
      arriveRef.current(coinIndex);
    };
    const launch = () => {
      if (launched.current) {
        return;
      }
      launched.current = true;
      aim(() => {
        phase.value = 1;
        fly.value = withTiming(1, { duration: flyMs, easing: Easing.bezier(0.5, 0, 0.9, 0.6) }, (done) => {
          if (done) {
            runOnJS(notify)(index);
          }
        });
      });
    };
    spin.value = withRepeat(withTiming(360, { duration: spinMs, easing: Easing.linear }), -1, false);
    const landAt = delay + Math.round(dropMs * 0.28);
    const dropSound = setTimeout(() => playBloop(index), landAt);
    drop.value = withDelay(
      delay,
      withTiming(1, { duration: dropMs, easing: Easing.linear }, (finished) => {
        if (finished) {
          runOnJS(launch)();
        }
      }),
    );
    // If the drop animation never reports completion, still show the coin and send it.
    const backup = setTimeout(() => {
      drop.value = 1;
      launch();
    }, delay + dropMs + 50);
    const arriveBackup = setTimeout(() => notify(index), delay + dropMs + flyMs + 160);
    return () => {
      clearTimeout(dropSound);
      clearTimeout(backup);
      clearTimeout(arriveBackup);
    };
  }, [aim, delay, drop, fly, index, phase, spin]);

  const style = useAnimatedStyle(() => {
    const pose = dropPose(drop.value);
    const flying = phase.value >= 1;
    const glide = fly.value;
    const x = flying ? offset + (targetX.value - origin.x - offset) * glide : offset;
    const y = flying ? pose.y + (targetY.value - origin.y - pose.y) * glide : pose.y;
    const scale = flying ? 1 + (0.4 - 1) * glide : pose.scale;
    return {
      opacity: pose.opacity,
      transform: [{ translateX: x }, { translateY: y }, { scale }],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.coin, { left: origin.x - coinSize / 2, top: origin.y - coinSize / 2 }, style]}
    >
      <PawCoin size={coinSize} spinAngle={spin} shine />
    </Animated.View>
  );
}

const plusHalo = [
  [-1.6, 0],
  [1.6, 0],
  [0, -1.6],
  [0, 1.6],
  [-1.2, -1.2],
  [1.2, -1.2],
  [-1.2, 1.2],
  [1.2, 1.2],
] as const;

function PlusLabel({ amount, labelY }: { amount: number; labelY: SharedValue<number> }) {
  const text = `+${new Intl.NumberFormat('en-US').format(amount)}`;
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(1, { duration: labelMs, easing: Easing.linear });
  }, [progress]);
  const style = useAnimatedStyle(() => {
    const pose = labelPose(progress.value);
    return {
      opacity: pose.opacity,
      top: labelY.value + 16,
      transform: [{ translateY: pose.y }],
    };
  });
  return (
    <Animated.View style={[styles.plusWrap, style]}>
      <View>
        {plusHalo.map(([x, y]) => (
          <Text key={`${x}${y}`} style={[styles.plus, styles.plusEdge, { transform: [{ translateX: x }, { translateY: y }] }]}>
            {text}
          </Text>
        ))}
        <Text style={styles.plus}>{text}</Text>
      </View>
    </Animated.View>
  );
}

export function BoopsPayout({
  amount,
  coinCount,
  origin,
  counter,
  reducedMotion,
  hopPet = false,
  onDone,
}: Props) {
  void hopPet;
  const overlayRef = useRef<View>(null);
  const [frame, setFrame] = useState<Frame | null>(null);
  const placedRef = useRef(false);
  const targetX = useSharedValue(0);
  const targetY = useSharedValue(0);
  const labelY = useSharedValue(0);
  const [labelReady, setLabelReady] = useState(false);
  const arrived = useRef(0);
  const alive = useRef(true);
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  }, [onDone]);
  const offsets = coinCount === 1 ? [0] : fiveOffsets;

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (!reducedMotion) {
      return;
    }
    doneRef.current();
  }, [reducedMotion]);

  const place = useCallback((x: number, y: number, width: number, height: number) => {
    if (!hasWindowSize({ x, y, width, height })) {
      return false;
    }
    const local = { x: origin.x - x, y: origin.y - y };
    const coin = usableCoinCenter(counter.current?.coinCenterInWindow());
    const target = coin ? { x: coin.x - x, y: coin.y - y } : { x: local.x, y: local.y - 180 };
    // Reanimated shared values are updated when the overlay is measured.
    // eslint-disable-next-line react-hooks/immutability
    targetX.value = target.x;
    // eslint-disable-next-line react-hooks/immutability
    targetY.value = target.y;
    if (coin) {
      // eslint-disable-next-line react-hooks/immutability
      labelY.value = target.y;
      setLabelReady(true);
    }
    placedRef.current = true;
    setFrame((current) => {
      if (!current) {
        return { origin: local, target };
      }
      const dx = local.x - current.origin.x;
      const dy = local.y - current.origin.y;
      if (dx * dx + dy * dy < 36) {
        return current;
      }
      return { ...current, origin: local };
    });
    return true;
  }, [counter, labelY, origin.x, origin.y, targetX, targetY]);

  const aim = useCallback((then: () => void) => {
    const overlay = overlayRef.current;
    if (!overlay) {
      then();
      return;
    }
    overlay.measureInWindow((x, y, width, height) => {
      if (hasWindowSize({ x, y, width, height })) {
        const coin = usableCoinCenter(counter.current?.coinCenterInWindow());
        if (coin) {
          targetX.value = coin.x - x;
          targetY.value = coin.y - y;
          labelY.value = coin.y - y;
          setLabelReady(true);
        }
      }
      then();
    });
  }, [counter, labelY, targetX, targetY]);

  const measure = useCallback(() => {
    overlayRef.current?.measureInWindow((x, y, width, height) => {
      place(x, y, width, height);
    });
  }, [place]);

  useEffect(() => {
    if (reducedMotion || frame) {
      return;
    }
    let attempt = 0;
    let retry = 0;
    let cancelled = false;
    const finishUnmeasured = () => {
      if (cancelled || placedRef.current) {
        return;
      }
      place(0, 0, 1, 1);
    };
    const read = () => {
      const overlay = overlayRef.current;
      if (!overlay) {
        return;
      }
      overlay.measureInWindow((x, y, width, height) => {
        if (cancelled) {
          return;
        }
        if (place(x, y, width, height)) {
          return;
        }
        attempt += 1;
        if (attempt < 8) {
          retry = requestAnimationFrame(read);
          return;
        }
        finishUnmeasured();
      });
    };
    retry = requestAnimationFrame(read);
    const giveUp = setTimeout(finishUnmeasured, 400);
    return () => {
      cancelled = true;
      cancelAnimationFrame(retry);
      clearTimeout(giveUp);
    };
  }, [frame, place, reducedMotion]);

  useEffect(() => {
    if (reducedMotion) {
      return;
    }
    measure();
  }, [measure, reducedMotion]);

  const onArrive = (index: number) => {
    if (!alive.current) {
      return;
    }
    playBloop(index);
    arrived.current += 1;
    if (arrived.current >= offsets.length) {
      doneRef.current();
    }
  };

  return (
    <View ref={overlayRef} pointerEvents="none" collapsable={false} style={styles.overlay} onLayout={measure}>
      {frame && !reducedMotion ? (
        <>
          {labelReady ? <PlusLabel amount={amount} labelY={labelY} /> : null}
          {offsets.map((offset, index) => (
            <FlyingCoin
              key={offset}
              offset={offset}
              delay={index * 120}
              index={index}
              origin={frame.origin}
              targetX={targetX}
              targetY={targetY}
              aim={aim}
              onArrive={onArrive}
            />
          ))}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 15,
    elevation: 15,
    backgroundColor: 'transparent',
  },
  coin: {
    position: 'absolute',
    width: coinSize,
    height: coinSize,
  },
  plusWrap: {
    position: 'absolute',
    right: 16,
    alignItems: 'flex-end',
  },
  plus: {
    fontFamily: fontFamily.black,
    fontSize: 28,
    color: '#F6C445',
    textAlign: 'right',
  },
  plusEdge: {
    position: 'absolute',
    color: '#FFFFFF',
  },
});
