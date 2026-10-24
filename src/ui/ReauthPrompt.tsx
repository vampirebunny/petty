import { useEffect, useState } from 'react';

import { signBackIn } from '../compliance/reauth';
import { onStandbyChange, readStandby } from '../db/accountMeta';
import { authTransition, onAuthTransition } from '../state/sessionGate';
import { AccountSheet } from './AccountSheet';

type Props = {
  petName: string;
  idle: boolean;
};

export function ReauthPrompt({ petName, idle }: Props) {
  const [, setTick] = useState(0);
  const [seenIdle, setSeenIdle] = useState(idle);
  const [hiddenWhileIdle, setHiddenWhileIdle] = useState(false);
  if (idle !== seenIdle) {
    setSeenIdle(idle);
    if (!idle) {
      setHiddenWhileIdle(false);
    }
  }

  useEffect(() => onAuthTransition(() => setTick((value) => value + 1)), []);
  useEffect(() => onStandbyChange(() => setTick((value) => value + 1)), []);

  const waiting = authTransition() === 'reauth' && idle && !hiddenWhileIdle && !readStandby();
  if (!waiting) {
    return null;
  }

  return (
    <AccountSheet
      reason="reauth"
      petName={petName}
      onClose={() => setHiddenWhileIdle(true)}
      onCredential={(credential) => {
        void signBackIn(credential, petName);
      }}
    />
  );
}
