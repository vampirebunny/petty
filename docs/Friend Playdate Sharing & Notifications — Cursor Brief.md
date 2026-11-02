# Friend Playdate Sharing & Notifications — Cursor Brief

Nov 1, 2026 · @A

Migration `20261101240000_friend_playdates.sql` is applied.

## Context and goal

When a player has a playdate with a friend, that friend gets one notification and can watch the replay on their own phone. NPC playdates stay local.

The friend's pet is snapshotted into the scene on the initiator's phone. The server stores that finished record so each guest can replay it. Bond, XP, Boops, items, and the one-hour cooldown apply only to the player who started the playdate. The friend's bond does not change, and being in someone else's playdate does not start their cooldown.

## Notifications

One push per playdate, sent the same way as a friend-game invite.

- The client calls `notify_friend_playdate` after `submit_friend_playdate` succeeds. `notified_at` makes a retry send nothing.
- Title `Boop Boop`. Body `@handle arranged a playdate!` for a pair and for a group. No pet names.
- Blocks are checked. The only mute is the account-wide Friend requests switch. There is no per-friend mute, no hourly cap, no daily rollup, and no quiet hours. A playdate that syncs late still sends that one push.
- A tap does not open a screen. While the app is open, there is no in-app banner and no deep link. Receiving the push only refreshes the unseen count.
- If notifications are off, the friend still gets the in-app marks below.

## Unwatched replays

Incoming friend playdates land in Recent playdates, newest first, together with playdates this player started.

- A dot on the Bond tab, the same dot a suggestion uses.
- A red count on the Playdate card. No badge when the count is zero.
- A New mark on each unwatched row under Recent playdates.

Opening a replay clears its mark. The history list keeps every unwatched incoming row. Watched rows stay capped at 3. A record newer than this build shows "Update Boop Boop to watch this playdate" instead of replaying, and opening that row still clears the mark.

The history line for an incoming playdate names the friend's own pet first. The replay uses the stored beats. If the initiator's account is deleted, that pet is Pup or Kitty and the row says Former player.

## Data

`playdates` holds the client uuid, the initiator, the record jsonb, the record version, when it was played, and `notified_at`.

`playdate_participants` has a row for the initiator and each guest, plus `seen_at`.

`submit_friend_playdate` is initiator-only. A guest who is not a current mutual friend, or who is blocked in either direction, is dropped. If no guest remains, nothing is stored. The same id again is a no-op and does not change bond.

A player can read a playdate only through their participant row. Only the function inserts. A player can set their own `seen_at`.

Account deletion removes that player's participant rows. Playdates they started stay for the others, with their pet renamed and the row marked Former player. A playdate with no participants left is deleted.

## Client

Friend playdates use a client uuid as `playdateId`. NPC ids stay as they are.

Before the scene is built, friend cards refresh with about a 2 second timeout. If that fails, the list already on screen is used.

The initiator's phone saves the playdate as it does today, then uploads. A failure stays pending and retries on app open and when the app becomes active again.

The friend's phone loads guest rows on app open, when a playdate push arrives, and when the playdate screen opens. Those rows merge into the local history without bond, rewards, or cooldown.
