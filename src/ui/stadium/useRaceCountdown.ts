import { useEffect, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';

import { playRaceStart, preloadRaceStart, stopRaceStart } from '../../audio/raceStart';
import { serverNow } from '../../db/accountMeta';
import { countBeat, countLabelFor, countdownSpanMs } from './raceCountdown';

export function useRaceCountdown(startsAt: number, finished: boolean) {
  const [now, setNow] = useState(() => serverNow());
  const lastCountBeat = useRef<number | null>(null);
  const startSound = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(serverNow()), 50);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    preloadRaceStart();
    return () => stopRaceStart();
  }, []);

  const untilStart = startsAt - now;
  const going = untilStart <= 0;
  const beat = countBeat(untilStart);
  const countLabel = countLabelFor(untilStart);

  useEffect(() => {
    if (finished || beat == null || lastCountBeat.current === beat) return;
    lastCountBeat.current = beat;
    if (!startSound.current) {
      startSound.current = true;
      const into = Math.max(0, (countdownSpanMs - (startsAt - serverNow())) / 1000);
      playRaceStart(into);
    }
    if (beat === 0) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (beat <= 3) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [beat, finished, startsAt]);

  return { untilStart, going, beat, countLabel };
}
