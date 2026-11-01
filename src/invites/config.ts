import { careConfig } from '../sim/careConfig';

// Every invitation rule number lives here.
export const inviteConfig = {
  /** NPC invitations wait until the pet reaches this level. */
  minLevel: 6,
  /** A race invite uses a card that starts at least this far out. */
  leadMs: 2 * 60 * 1000,
  runwayExpireMs: 24 * 60 * 60 * 1000,
  /** Active days without entering a format before it can be offered again. */
  lapsedActiveDays: 4,
  pauseAfterDismissals: 2,
  stopAfterDismissals: 3,
  pauseMs: 7 * 24 * 60 * 60 * 1000,
  firstPushMs: 20 * 60 * 60 * 1000,
  pushBackoffMs: [2 * 24 * 60 * 60 * 1000, 7 * 24 * 60 * 60 * 1000],
  /** After this many unanswered pushes, stop until the player opens the app. */
  pushStopAfter: 3,
  quietStartHour: careConfig.quietStartHour,
  quietEndHour: careConfig.quietEndHour,
  bibMin: 10,
  bibMax: 99,
  buttonFadeMs: 700,
  handoffMs: 950,
} as const;
