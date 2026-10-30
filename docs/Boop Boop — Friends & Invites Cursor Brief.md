# Boop Boop — Friends & Invites Cursor Brief

Oct 25, 2026 · @A

## Overview

Add a friend graph so players can add each other by handle, manage requests and blocks, and invite people to download Boop Boop. Friends will power playdates (up to 5 friends per playdate, built separately), gifting and birthday parties later; this brief covers only the friend graph, its screens and the invite link.

**In scope**

- Supabase tables and server functions for requests, friendships, blocks and reports
- Friends section on the playdate screen
- Find friends (search by exact handle, send request)
- Friend request modal on app open
- Friends section in Settings, including Blocked list
- Push notifications for friend requests, with the permission prompt moved out of launch
- Invite a friend banner and share link
- Expanding the existing account deletion to cover all new data

**Out of scope**: group playdates, gifting, birthday parties, chat or free text of any kind.

**Changes from earlier plans**

- No Boops reward for invites, and no invite limit. The invite banner is a plain share, so there is no referral attribution, crediting or anti-farming work.
- A player who installs from an invite link does not become a friend automatically.
- The notification permission prompt no longer appears at launch (see Push notifications).
- Guests and anonymous sessions cannot search, send a request, or open the invite share. Those controls exist only for a linked account (Apple or Google, `is_anonymous` false).

## Resolved decisions

- Cross-user reads and every write go through security-definer RPCs. Keys reference `auth.users`. Row-level security is a backstop: authenticated clients have no table grants on the friend tables. A requester cannot read declined or expired rows.
- Decline removes the request from Sent immediately and starts the cooldown. The sender is not told it was declined. Pending rows older than 30 days become `expired` inside the RPCs and use that same cooldown. During cooldown, Find friends still finds the player and shows a disabled "You can't send another request yet." with no Cancel.
- Send limits are a rolling 24 hours. The friend cap is checked for both players on send and on accept. Copy says whose list is full: "Your friend list is full." or "Their friend list is full." Limits live in one `friend_config` row, including a report cap of 10 per 24 hours.
- `send_friend_request` locks the pair in sorted-id order. If the other player already has a pending request, that request is accepted in the same transaction.
- Friend cards return the fields the playdate still needs to draw a pet (name, species, breed, look, outfit, and the render stats). They omit inventory, care, and the raw pet document. No active pet returns the handle and an empty pet.
- A report stores the handle text and pet name text from that moment. Handles and new pet names use the same word list as pet naming. Names already saved stay until the next rename.
- Account deletion runs one SQL function before `deleteUser`: remove friend rows and tokens, anonymize reports about the player, and hold the handle for 15 days in `handle_holds`.
- Care reminders do not call the OS permission dialog. Friend requests use the three pre-prompt moments and Expo push tokens. The friend-request switch is account-wide and separate from the on-device care-reminder preference.

## Data model and server functions

Tables are keyed on the player's `auth.users` id (never the pet). Anonymous users are rejected by every friend RPC. Clients call RPCs for reads and writes. They do not insert into these tables.

```sql
friend_requests
  id uuid pk
  requester_id uuid -> auth.users
  addressee_id uuid -> auth.users
  status text  -- pending | accepted | declined | canceled | expired
  created_at timestamptz
  responded_at timestamptz null
  -- unique (requester_id, addressee_id) where status = 'pending'

friendships
  user_a_id uuid -> auth.users   -- always the smaller id
  user_b_id uuid -> auth.users   -- always the larger id
  created_at timestamptz
  -- pk (user_a_id, user_b_id); check user_a_id < user_b_id

blocks
  blocker_id uuid -> auth.users
  blocked_id uuid -> auth.users
  created_at timestamptz
  -- pk (blocker_id, blocked_id)

reports
  id uuid pk
  reporter_id uuid -> auth.users
  reported_id uuid -> auth.users null
  handle_text text
  pet_name_text text
  reported_deleted boolean
  target text   -- handle | pet_name
  reason text   -- preset reason key
  created_at timestamptz
  status text   -- open | reviewed | actioned

push_tokens
  player_id uuid -> auth.users
  token text
  platform text  -- ios | android
  updated_at timestamptz
  -- pk (player_id, token)
```

**Row-level security**

Authenticated clients have no grants on these tables. RPCs are security definer and enforce the rules:

- Lists return a requester's own pending rows only. Declined and expired rows stay on the server for the cooldown.
- Blocks are visible only to the blocker. Never expose who blocked them.
- Reports are insert-only through `report_player`. No client reads.
- Push tokens are written only by `register_push_token`.

`notification_settings` stores the account-wide friend-request switch. `friend_config` stores the limits.

**Server functions**

| Function | Does |
| --- | --- |
| lookup\_handle(handle) | Exact, case-insensitive match. Returns handle, current pet card, and relationship state (none, friends, request sent, request received, cooldown). Returns not found if either side has blocked the other, or if the handle is the caller's own. Anonymous callers get `account_required`. |
| list\_incoming\_requests, list\_sent\_requests, list\_friends, list\_blocked | The screens read these. Same anonymous rejection. |
| send\_friend\_request(handle) | Requires a claimed handle. Validates: not self, not already friends, no block either way, under rate limit and friend cap, not in cooldown. If the other player already sent a pending request, accepts it instead. The client then calls the notify edge function, which pushes the addressee. |
| respond\_friend\_request(id, action) | action = accept or decline. Accept writes the friendship row and closes the request in one transaction. Decline is silent to the sender. |
| cancel\_friend\_request(id) | Sender cancels their own pending request. |
| remove\_friend(user\_id) | Deletes the friendship. No notification. |
| block\_player(user\_id) | In one transaction: insert block, delete any friendship, cancel pending requests both ways. |
| unblock\_player(user\_id) | Deletes the block only. Does not restore the friendship. |
| report\_player(user\_id, target, reason) | Inserts a report. Reporting does not block automatically; the UI offers Block next. |
| register\_push\_token(token, platform) | Upserts the token for the caller. |

**Limits (config values, not hardcoded)**

| Setting | Starting value |
| --- | --- |
| Friend requests sent per rolling 24 hours | 20 |
| Reports per rolling 24 hours | 10 |
| Max friends | 100 |
| Cooldown after a decline or expiry | 30 days |
| Pending request expiry | 30 days |

## Screens

All new UI follows the existing cotton candy style: glossy, puffy buttons and fun modals, no flat system dialogs except the native share sheet and OS permission prompts.

### Playdate screen: Friends section

- New Friends section alongside the existing NPC playdate options.
- With friends: list each friend's handle, current pet name and pet avatar. Rows are display-only in this pass.
- With no friends: show "No friends yet."
- Linked accounts see Find friends, with or without friends, and the Invite a friend banner below the section.
- Guests and anonymous sessions see "No friends yet." and a create-account button. No handle field and no invite banner. The button opens the existing account sheet (`friends`). Search and invite appear only after the account is linked.

### Find friends

1. Text field: "Enter a friend's handle". Strip a leading @, trim spaces, compare case-insensitively.
2. Search calls lookup\_handle. Exact match only: no autocomplete, no partial results, no browsing.
3. Found: show a confirmation card with handle, pet avatar and pet name, and one button whose label depends on state:
   - none: Send request
   - request sent: Request sent (disabled), with Cancel request
   - request received: Accept request
   - friends: Friends (disabled)
   - cooldown: "You can't send another request yet." (disabled, no Cancel)
4. Not found (including blocked either way, or own handle): "No player found with that handle."
5. After Send request: confirm in place ("Request sent!"). If this is the player's first sent request, run the notification pre-prompt (see Push notifications).
6. Errors from limits show friendly copy, e.g. "You've sent a lot of requests today. Try again tomorrow."

### Friend request modal (on app open)

- On app open or return to foreground, if the player has pending incoming requests they haven't seen in this modal yet, show it.
- Each row: pet avatar, handle, pet name, and Accept, Decline and Block buttons.
- Dismiss with the X or a tap anywhere outside the modal.
- After dismissal, show the modal again only when a new request arrives, not on every launch. Track the last-seen request ID or timestamp locally.
- Dismissed requests stay in Settings > Friends. Show a badge on the Settings icon and the Friends row while any incoming request is pending.
- The list scrolls when there are many requests.
- Block here uses the same confirm step as everywhere else.

### Settings > Friends

New Friends row in the Settings page (opened from the icon next to the pet's name). Guests see the create-account prompt when they tap it, and do not reach search or invite. Linked accounts see the Friends screen, top to bottom:

1. **Find friends** button
2. **Invite a friend** banner
3. **Requests**: incoming requests with Accept, Decline and Block
4. **Sent**: outgoing pending requests with Cancel
5. **Friends**: each friend with handle, pet avatar and pet name; a menu per friend with Remove friend, Block and Report
6. **Blocked list** button: opens a list of blocked players (handle only) with Unblock on each

Unblock does not re-add the friend. The player has to send a new request.

Empty states: "No requests right now." / "No friends yet." / "You haven't blocked anyone."

## Blocking, reporting and edge cases

**Blocking** is silent and total. When A blocks B:

- The friendship is removed and pending requests in both directions are canceled.
- Neither can find the other with lookup\_handle.
- B no longer appears in A's playdate friend list, and vice versa. This includes retired pets as playdate partners once that feature exists.
- Future gifts and party invites between them are blocked (enforce in those features' server functions by checking the blocks table both ways).
- B is never notified.

Confirm before blocking: "Block @handle? They won't be able to find you or send you requests." with Block and Cancel.

**Reporting** (required by Apple and Google for apps where players see each other's handles and pet names):

- Report is available from the friend menu, each request row, and the Find friends result card.
- Preset reasons only, no free text: Inappropriate handle, Inappropriate pet name, Something else.
- After reporting, show "Thanks, we'll take a look." and offer Block.
- Reports land in the reports table for manual review in the Supabase dashboard.

**Content filtering**: run a profanity and slur filter on handles at creation and on pet names at naming. Reject with "Try a different name." Use a maintained word list and match on normalized text (lowercase, common letter-number swaps).

**Edge cases**

- Both players send requests to each other at the same time: send\_friend\_request accepts the existing incoming request instead of creating a duplicate.
- Declined requests leave Sent immediately. The sender is never told it was declined. Until the cooldown ends, Find friends shows the disabled cooldown label. Expiry does the same.
- Friend cap reached on either side: the request can't be sent or accepted. Copy names whose list is full.
- The player retires their pet: friendships are unaffected because they belong to the player. Friend lists show the new current pet.
- Offline: Friends screens show the last cached list with a small "Offline" note; send, accept, block and report are disabled until online.

## Push notifications

Remove the notification permission request from app launch. Ask only when the player does something that makes notifications useful, with an in-game pre-prompt first. iOS shows the system prompt only once, so never call it unless the player said yes to the pre-prompt.

**When to show the pre-prompt** (only if permission is undetermined and the pre-prompt hasn't been declined in the last 14 days):

1. Right after the player sends their first friend request
2. Right after the player accepts their first friend request
3. On first open of Settings > Friends after creating an account

**Pre-prompt modal** (game style): "Want to know when friends send requests?" with Turn on and Not now. Turn on calls the OS prompt. Not now closes and records the date.

Care reminders keep their on-device preference and do not request permission while scheduling. Turning that preference on is their ask. One OS permission covers both. Granting it for friend requests also allows care reminders to schedule on the next save. The friend-request switch does not cancel care reminders.

**Setup**

- Use expo-notifications. The app registers an Expo push token. The notify edge function sends through the Expo push API.
- Android 13 and later: request the POST\_NOTIFICATIONS runtime permission through the same pre-prompt flow.
- Android: create a "Friends" notification channel so players can control it separately.
- On grant, and on every app start while granted, call register\_push\_token. Delete this device's token when the device loses active-device status, and delete every token on account deletion.
- If permission was denied, the Friends screen shows a small "Notifications are off" note with a button to open system settings.

**Friend request push**

- After a pending send, the notify edge function pushes every token for the addressee. It skips the push when their friend-request switch is off.
- Copy: "@handle wants to be friends!" (no other personal data in the payload).
- Tapping it opens the app to the friend request modal. If the app is already open, that same push opens the modal without a tap.
- Skip the push if the sender is blocked by the addressee (should be impossible, but check).
- Remove tokens the push service reports as invalid.

**In-app toggles**: Settings gets Care reminders (on device) and Friend requests (account-wide, checked before sending).

## Invite a friend

The invite banner shares a download link through the native share sheet. It is separate from friend requests: there is no reward, no limit, and installing from the link does not create a friendship.

**Banner**

- Shown on the playdate screen (below the Friends section) and in Settings > Friends (below Find friends).
- Copy: "Invite a friend to Boop Boop" with a short subline: "Share the app so your pets can play together."
- Shown only for a linked account. Guests and anonymous sessions do not get the banner or the share sheet.

**Share sheet**

- Tapping the banner opens the native share sheet (React Native Share API), so the player picks Messages, WhatsApp, email or anything else installed.
- Share text:

> I've been playing Boop Boop, a virtual pet game. Adopt a pet so ours can have playdates! \[link\]

- If the player has a handle, append: "My handle is @handle". That lets the friend send a request once they're set up.

**Link**

- One static link: https://boopboop.mylisto.app/get, with no per-player tracking. The site root and the legal pages stay where they are.
- `/get` renders the Boop Boop icon, a line about the game, and both store badges. When store URLs are set, a phone user agent redirects to the matching store. There are no store listings in the repo yet, so the badges stay on the page until those URLs are filled. Desktop and unknown devices are not redirected.
- Universal links allow only `/get` (`apple-app-site-association` for team `89T43H6V58`, bundle `app.mylisto.boop`). Android `assetlinks.json` waits on the Play signing fingerprint, which is not in the repo. Universal links open the app when the URL is tapped from another app or site, not when it is typed into Safari.

## Account deletion expansion

The delete-account edge function calls `delete_friend_data` before `deleteUser`. That SQL function, in one transaction:

- friend\_requests where the player is requester or addressee
- friendships that include the player
- blocks where the player is blocker or blocked
- push\_tokens for the player
- reports filed by the player; reports about the player are anonymized (reported\_id set to null, a deleted flag kept) so the moderation record stays without identifying them
- the player's notification settings

After deletion:

- The handle is held for 15 days, then released for reuse, so nobody can immediately impersonate the deleted player. Store held handles with a release date and reject them at handle creation until then. Note the 15-day hold in the privacy policy.
- The player's current and retired pets disappear from every friend's lists and from future playdate partner choices.
- Other players get no notification; the friend simply disappears from their list.

Client side: unregister the push token and clear cached friend data before signing out.

## Compliance and acceptance

**Store compliance (non-code tasks for the owner)**

- [ ] Apple: update the age rating questionnaire to reflect player-to-player interaction and user-generated handles and pet names
- [ ] Apple: update App Privacy labels for handles, the friend graph and push tokens
- [ ] Google Play: update the Data safety form with the same data
- [ ] Privacy policy: add friends, blocks, reports, push tokens and handle retention after deletion
- [ ] Terms: prohibit offensive handles and pet names, and describe reporting
- [ ] Publish a support contact in the app and store listings
- [ ] App Review notes: explain that friends are added only by exact handle and there is no chat

**Acceptance criteria**

- [ ] No notification permission prompt at launch; pre-prompt appears only at the three listed moments
- [ ] Guests and anonymous sessions never see the search field or the invite share. Friend RPCs return `account_required`. Create account is the only friends entry, and search and invite appear after the account is linked.
- [ ] Exact-handle search works case-insensitively with or without a leading @; partial handles return nothing
- [ ] A blocked player (either direction) and the player's own handle both return "No player found"
- [ ] Sending a request to someone who already requested you creates a friendship, not a duplicate
- [ ] The request modal shows on open for new requests, closes via X or outside tap, and doesn't reappear until another request arrives
- [ ] Settings badge shows while incoming requests are pending
- [ ] Accept, decline, cancel, remove, block, unblock and report all work from every screen that offers them
- [ ] Block removes the friendship and pending requests in both directions in one transaction
- [ ] Unblock does not restore the friendship
- [ ] Daily request limit, friend cap and decline cooldown come from config
- [ ] Friend request push arrives on iOS and Android and opens the request modal
- [ ] Invite banner opens the native share sheet with the share text, link and handle when available
- [ ] Invite link is `/get`. Installed taps can open the app. Desktop shows both badges. Phone store redirects run once the store URLs are set.
- [ ] Account deletion removes all friend-related rows and the player disappears from friends' lists
- [ ] Row-level security verified: a player cannot read other players' requests, blocks or reports
