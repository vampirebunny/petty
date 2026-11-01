import { AppState } from 'react-native';

import { foregroundNotificationBehavior } from '../present';

function note(kind?: string) {
  return { request: { content: { data: kind ? { kind } : {} } } };
}

describe('foreground notifications', () => {
  const state = AppState.currentState;

  afterEach(() => {
    Object.defineProperty(AppState, 'currentState', { value: state, configurable: true });
  });

  it('keeps social notices in the app while it is open', () => {
    Object.defineProperty(AppState, 'currentState', { value: 'active', configurable: true });
    expect(foregroundNotificationBehavior(note('runway_vote')).shouldShowBanner).toBe(false);
    expect(foregroundNotificationBehavior(note('friend_request')).shouldShowBanner).toBe(false);
    expect(foregroundNotificationBehavior(note('friend_game_accepted')).shouldShowBanner).toBe(false);
    expect(foregroundNotificationBehavior(note()).shouldShowBanner).toBe(true);
  });

  it('still shows a system banner when the app is not active', () => {
    Object.defineProperty(AppState, 'currentState', { value: 'background', configurable: true });
    expect(foregroundNotificationBehavior(note('runway_vote')).shouldShowBanner).toBe(true);
  });
});
