export type RelationState = 'none' | 'request_sent' | 'request_received' | 'friends' | 'cooldown';

export type RelationAction = {
  label: string;
  disabled: boolean;
  cancel: boolean;
  action: 'send' | 'accept' | 'none';
};

export const inviteUrl = 'https://boopboop.mylisto.app';

/** Search, requests, and the invite share are for a linked account only. */
export function canUseFriends(linked: boolean): boolean {
  return linked;
}

/** True when the typed handle is the signed-in player's, ignoring case and a leading @. */
export function isOwnHandle(typed: string, mine: string | null): boolean {
  if (!mine) {
    return false;
  }
  const clean = typed.trim().replace(/^@/, '');
  const own = mine.trim().replace(/^@/, '');
  return clean.length > 0 && clean.toLowerCase() === own.toLowerCase();
}

export function relationAction(state: RelationState): RelationAction {
  switch (state) {
    case 'none':
      return { label: 'Send request', disabled: false, cancel: false, action: 'send' };
    case 'request_sent':
      return { label: 'Request sent', disabled: true, cancel: true, action: 'none' };
    case 'request_received':
      return { label: 'Accept request', disabled: false, cancel: false, action: 'accept' };
    case 'friends':
      return { label: 'Friends', disabled: true, cancel: false, action: 'none' };
    case 'cooldown':
      return { label: "You can't send another request yet.", disabled: true, cancel: false, action: 'none' };
  }
}

export function inviteShareMessage(handle: string | null): string {
  const base = `I've been playing Boop Boop, a virtual pet game. Adopt a pet so ours can have playdates! ${inviteUrl}`;
  if (!handle) {
    return base;
  }
  return `${base}\nMy handle is @${handle}`;
}

export function friendErrorCopy(error: string, kind: 'request' | 'report' = 'request'): string {
  switch (error) {
    case 'rate_limit':
      return kind === 'report'
        ? "You've sent a lot of reports today. Try again tomorrow."
        : "You've sent a lot of requests today. Try again tomorrow.";
    case 'own_full':
      return 'Your friend list is full.';
    case 'their_full':
      return 'Their friend list is full.';
    case 'cooldown':
      return "You can't send another request yet.";
    case 'no_handle':
      return 'Pick a handle first.';
    case 'account_required':
      return 'Create an account to find friends.';
    case 'offline':
      return "You'll need internet for that.";
    case 'not_found':
      return 'No player found with that handle.';
    default:
      return "That didn't work. Try again.";
  }
}
