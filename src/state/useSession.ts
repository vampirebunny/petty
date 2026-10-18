import { useCallback, useEffect, useState } from 'react';

import { clearAttestation, loadAttestation, saveAttestation, type Attestation } from '../storage/session';

export function useSession() {
  const [attestation, setAttestation] = useState<Attestation | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void loadAttestation().then((value) => {
      if (!cancelled) {
        setAttestation(value);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const pass = useCallback(() => {
    setAttestation('passed');
    void saveAttestation('passed');
  }, []);

  const block = useCallback(() => {
    setAttestation('blocked');
    void saveAttestation('blocked');
  }, []);

  const clear = useCallback(() => {
    setAttestation(null);
    void clearAttestation();
  }, []);

  return {
    ready: attestation !== undefined,
    attestation: attestation ?? null,
    pass,
    block,
    clear,
  };
}
