import type { RunwayThemeId } from '../runway/catalog';
import type { RunwaySubmission } from '../runway/types';
import type { RaceClass, RaceCup, RaceEvent } from '../sim/stadium';

export type InviteFormat = 'runway' | 'race';
export type InviteSurface = 'in_app' | 'push';
export type InviteTrigger = 'first' | 'lapsed' | 'new';

export type FormatState = {
  offered: boolean;
  offeredOpenedDays: number | null;
  enteredOpenedDays: number | null;
  consecutiveDismissals: number;
  totalDismissals: number;
  pausedUntil: number;
  stopped: boolean;
};

export type InviteCounters = {
  shownDay: string | null;
  lastFormat: InviteFormat | null;
  seenThemeIds: string[];
  seenTrickIds: string[];
  lastClass: string | null;
  pushesEnabled: boolean;
  friendPushDay: string | null;
  unansweredPushes: number;
  pushesStopped: boolean;
  pendingPushAt: number | null;
  runway: FormatState;
  race: FormatState;
};

export type RunwayInvitation = {
  id: string;
  type: 'runway';
  createdAt: number;
  expiresAt: number;
  surface: InviteSurface;
  trigger: InviteTrigger;
  themeId: RunwayThemeId;
  themeName: string;
  trackId: string;
  showId: string;
  npcSubmissions: RunwaySubmission[];
};

export type RaceInvitation = {
  id: string;
  type: 'race';
  createdAt: number;
  expiresAt: number;
  surface: InviteSurface;
  trigger: InviteTrigger;
  eventId: string;
  event: RaceEvent;
  cup: RaceCup;
  classId: RaceClass;
  startsAt: number;
  bib: number;
};

export type Invitation = RunwayInvitation | RaceInvitation;

export type RaceOption = {
  eventId: string;
  event: RaceEvent;
  cup: RaceCup;
  classId: RaceClass;
  state: string;
  startsAt: number;
};
