import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Trait } from '../sim/types';
import { tints } from './candy';
import { PlusBurst, plusBurstMs } from './PlusBurst';

export const traitPopColor: Record<Trait, string> = {
  stamina: tints.peach.icon,
  agility: tints.aqua.icon,
  intelligence: tints.lilac.icon,
  boldness: tints.coral.icon,
  affection: tints.pink.icon,
  obedience: tints.sky.icon,
};

export const trainingPopColor = tints.butter.icon;

export type PointPop = {
  color: string;
  amount: number;
  label: string;
};

type Props = {
  pops: PointPop[];
  reducedMotion: boolean;
  onDone: () => void;
};

export function AttributePops({ pops, reducedMotion, onDone }: Props) {
  const [index, setIndex] = useState(0);
  const pop = pops[index];

  useEffect(() => {
    if (!pop) {
      return;
    }
    const timer = setTimeout(() => {
      if (index + 1 >= pops.length) {
        onDone();
      } else {
        setIndex(index + 1);
      }
    }, reducedMotion ? 420 : plusBurstMs);
    return () => clearTimeout(timer);
  }, [index, onDone, pop, pops.length, reducedMotion]);

  if (!pop) {
    return null;
  }
  const side = index % 2 === 0 ? -16 : 16;
  return (
    <View pointerEvents="none" style={[styles.layer, { marginLeft: side }]}>
      <PlusBurst
        key={`${index}-${pop.label}`}
        color={pop.color}
        amount={pop.amount}
        label={pop.label}
        reducedMotion={reducedMotion}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: '22%',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 50,
  },
});
