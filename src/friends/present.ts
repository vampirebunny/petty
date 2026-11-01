import { AppState } from 'react-native';

type NoticeContent = { data?: unknown };

/** Social kinds already have an in-app surface. Care reminders have no kind and still use a banner. */
const inAppKinds = new Set([
  'friend_game_accepted',
  'friend_request',
  'friend_game',
  'friend_game_call',
  'race',
  'runway_show',
  'runway_submitted',
  'runway_vote',
  'runway_results',
]);

/** While the app is open, these notices stay in the app. A closed or backgrounded app still gets the system push. */
export function foregroundNotificationBehavior(notification: { request: { content: NoticeContent } }): {
  shouldShowBanner: boolean;
  shouldShowList: boolean;
  shouldPlaySound: boolean;
  shouldSetBadge: boolean;
} {
  const data = notification.request.content.data;
  const kind = data && typeof data === 'object' && 'kind' in data ? (data as { kind?: unknown }).kind : undefined;
  const inAppOnly = typeof kind === 'string' && inAppKinds.has(kind) && AppState.currentState === 'active';
  return {
    shouldShowBanner: !inAppOnly,
    shouldShowList: !inAppOnly,
    shouldPlaySound: false,
    shouldSetBadge: false,
  };
}
