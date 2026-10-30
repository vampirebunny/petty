import { useEffect, useRef } from 'react';

import type { RaceClass, RaceCup, RaceEvent } from '../sim/stadium';
import { track } from './analytics';

type RaceBits = { event: RaceEvent; classId: RaceClass; cup: RaceCup };

export function useCompetitionResult(race: RaceBits, ready: boolean, place: number | undefined): void {
  const sent = useRef(false);
  useEffect(() => {
    if (!ready || place == null || sent.current) {
      return;
    }
    sent.current = true;
    track('competition_result', {
      type: race.event,
      class: race.classId,
      cup: race.cup,
      placement: place,
      ribbon: place >= 1 && place <= 3 ? 1 : 0,
    });
  }, [place, race.classId, race.cup, race.event, ready]);
}
