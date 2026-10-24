import { useEffect, useState } from 'react';

import { day3Due, dismissDay3, onAccountPrompts } from '../compliance/accountPrompts';
import { onAccountFlags, onStandbyChange, readAccountLinked, readStandby } from '../db/accountMeta';
import { AccountSheet } from './AccountSheet';

type Props = {
  petName: string;
  idle: boolean;
};

export function Day3Prompt({ petName, idle }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => onAccountPrompts(() => setTick((value) => value + 1)), []);
  useEffect(() => onAccountFlags(() => setTick((value) => value + 1)), []);
  useEffect(() => onStandbyChange(() => setTick((value) => value + 1)), []);

  if (!idle || readStandby() || !day3Due()) {
    return null;
  }

  return (
    <AccountSheet
      reason="day3"
      petName={petName}
      onClose={() => {
        if (!readAccountLinked()) {
          dismissDay3();
        }
      }}
    />
  );
}
