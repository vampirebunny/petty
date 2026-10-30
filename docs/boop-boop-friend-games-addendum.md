# Cursor Brief Addendum: Friend Games

**Shipped.** Migration `20261030110000_friend_games.sql` and the `notify_friend_game` Edge Function are deployed. The client is `src/stadium/friendGames.ts`, `FriendGameSetup`, `FriendRoom`, and `FriendGameInviteModal`.

An addition to the gameplay progression brief. Built on live open races (phase 7, **shipped**): synchronized countdown on server time, each phone simulates its own pet and streams its state (`race:{raceId}:run`), and the server replays and verifies results. All numbers go in the gameplay config.

Alongside open scheduled races (anyone online, guests included), a player can create a private race just for friends. It is entered from the **Race with friends** button at the bottom of the Stadium lobby. Think intramural vs. varsity: friend games are for fun, and open races are the record.

## Who can play

- Friend games need an account. A guest who taps **Race with friends** gets the create-account sheet (`AccountSheet reason="friends"`).
- Only mutual friends can be invited. A stranger can never be in a friend game unless the player added them as a friend beforehand.
- Blocked players never appear in the list and can't join.

## Creating a game

1. In the Stadium, the player taps **Race with friends**.
2. Picks the event: **Fun Run, Hurdles, or Obstacle Course** (same trick rules as open races). Dock Dive is not offered; it isn't a good live race. Sniff Out, Trick Show, and Weave are cancelled.
3. Picks when it starts: **in 2, 5, or 15 minutes** (default 5; `gameplayConfig.friendGames.delaysMin`).
4. Selects up to 5 friends. The list shows friends only:
   - **Recent** at the top: the 5 friends this player invited most recently (stored per player, not per pet), newest first.
   - **All friends** below.
   - A friend whose pet lacks a trick on the chosen course shows dimmed and can't be selected, with the reason (e.g. "Needs Jump the Hurdle").
5. Taps **Send invites**. This completes the "Start a friends game" tutorial action and suggestion.

There is no scheduling for a specific date and time yet. That is a possible later brief (time zones are easy; reminders, RSVPs, and overlap rules are the work).

## Invites

- Sent as a push when the app is closed or in the background, if notifications are allowed. The same push opens the invite modal immediately when the app is already open. The modal also loads pending invites on open, on return to the foreground, and every 20 seconds while Home is showing. Push respects blocks and the friend-request notification setting.
- The invite shows who's inviting, the event, the start countdown, with **Accept** and **Decline**.
- **Accept** takes the invitee straight into the waiting room (opening the app from the push if needed).
- Invites expire at line-up lock (start − 10 s). An invite answered after that shows "This game already started"; a cancelled game shows "This game was cancelled."
- A player can be in only one race at a time. Accepting an invite declines the player's other pending invites.
- **Conflict:** if the player already has an open-race sign-up or another friend game, accepting (or creating a game) shows a warning. The player can confirm, which withdraws them from the other race, or back out.

## Waiting room

- Everyone in the room sees the event, the countdown to the start, and each invitee's status (Waiting, Joined, Declined). Joined means in the waiting room right now.
- Timer only: there is no early Start button.
- **At the start time:** if the inviter and at least one friend are in the room, the race starts with exactly those pets. Anyone not in the room is locked out, and pending invites are withdrawn. No NPCs fill empty spots, so a race can be as small as 2 pets.
- If no friend is in the room, the game cancels for everyone.
- **The inviter leaving cancels the game for everyone.** Tapping **Cancel game** (with a confirm) cancels it at once; joined players see "@handle cancelled the game" and return to the Stadium. Stepping back to the lobby keeps the room open ("Back to your friend game"), but an inviter who isn't in the room at the start cancels it.
- An invitee can step out and come back before the start. **Leave game** withdraws them.

## Race rules

- Starts at the game's start time, not on the slot schedule.
- Every pet races on **Open** class settings, whatever its level.
- Same events, controls, scoring, and energy/mood effects as open races.
- Each pet shows its real coat, age, and outfit from the server copy of the pet.
- A player who drops mid-race keeps racing on their own phone. Other phones freeze that pet and show "Reconnecting". A missing report is DNF. No NPC autoplay.

## Rewards

- **None** beyond the race itself: no XP, ribbons, trophies, or race badges (First Race, Blue Ribbon, Moving Up, Ribbon Rack). It does not count for "Compete in the Stadium".
- No 6-minute rest.
- The same energy cost as an open race (`gameplayConfig.races.energyCost`).
- Results screen shows final placings for everyone in the game.

## Data and server

A friend game is a private race, so it reuses the whole open-race lifecycle (lock, presence, start, live sync, `race_report` replay, ranking, `race_state`). Migration `20261030110000_friend_games.sql`:

- Each game gets its own `competition_slots` row (`private = true`, negative id), a `competition_events` row with `cup = 'friends'`, and a `races` row in class `open` with `host_player_id`. Private slots never show on the lobby board.
- `friend_game_invites` (`race_id`, `inviter_id`, `invitee_id`, `status` pending / accepted / declined / withdrawn, `notified_at`).
- `advance_races`: friends races never get NPCs, and cancel at lock or start unless the host and at least one friend are checked in. Pending invites are withdrawn at lock. `stadium_finish_cooldown` skips them.
- RPCs: `friend_game_candidates`, `create_friend_game`, `list_friend_game_invites`, `respond_friend_game_invite`, `friend_game_state`, `friend_game_heartbeat`, `leave_friend_game`. `get_upcoming_slots` returns `friend_game_race_id` for the pet's active friend game.
- Edge Function `notify_friend_game` sends the invite pushes (`data: { kind: 'friend_game', raceId }`). A foreground delivery opens the invite modal; a background or closed app shows the system notification, and a tap opens the modal.
