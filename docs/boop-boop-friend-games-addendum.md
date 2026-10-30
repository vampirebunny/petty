# Cursor Brief Addendum: Friend Games

An addition to the gameplay progression brief. Build after live open races (phase 7, **shipped**), since it reuses that tech: synchronized countdown on server time, each phone simulates its own pet and streams its state (`race:{raceId}:run`), and the server replays and verifies results. All numbers go in the gameplay config.

Alongside open scheduled races (anyone online, guests included), a player can create a private race just for friends. It is entered from the **Race with friends** button at the bottom of the Stadium lobby.

## Who can play

- Friend games need an account. A guest who taps **Race with friends** gets the existing create-an-account prompt.
- Only mutual friends can be invited. A stranger can never be in a friend game unless the player added them as a friend beforehand.
- Blocked players never appear in the list and can't join.

## Creating a game

1. In the Stadium, the player taps **Race with friends**.
2. Picks the event: **Fun Run, Hurdles, or Obstacle Course** (same trick rules as open races). Dock Dive is not offered; it isn't a good live race. Sniff Out, Trick Show, and Weave are cancelled.
3. Selects up to 5 friends. The list shows friends only:
   - **Recent** at the top: the 5 friends this player invited most recently (stored per player, not per pet), newest first.
   - **All friends** below.
   - A friend whose pet lacks a trick on the chosen course shows dimmed and can't be selected, with the reason (e.g. "Needs Jump the Hurdle").
4. Taps **Send invites**. The game gets a start time (default 5 minutes from sending, config).

## Invites

- Sent as a push notification and an in-app notification (reuse the existing friend-request push and on-open modal patterns).
- The invite shows who's inviting, the event, the start countdown, with **Accept** and **Decline**.
- **Accept** takes the invitee straight into the waiting room (opening the app from the push if needed).
- An invite accepted after the game started or was cancelled shows "This game already started" or "This game was cancelled."
- A player can be in only one waiting room at a time. Accepting an invite declines any other pending invites.

## Waiting room

- Everyone in the room sees the event, the countdown to the start, and each invitee's status (waiting, joined, declined).
- Friends have until the start time to join. Joining means being in the waiting room screen.
- **At the start time:** if the inviter and at least one friend are in the room, the race starts with exactly those pets. Anyone not in the room is locked out of that game, and pending invites are withdrawn. No NPCs fill empty spots, so a race can be as small as 2 pets.
- If no friend is in the room at the start time, the game cancels for everyone.

## Race rules

- Starts at the game's start time, not on the 5-minute schedule.
- Same events, controls, scoring, skill check, and energy/mood effects as open races.
- Each pet shows its real coat, age, and outfit from the server copy of the pet.
- A player who drops mid-race keeps racing on their own phone. Other phones freeze that pet and show "Reconnecting". A missing report is DNF. No NPC autoplay.

## Rewards

- XP only, using the race XP table (entered / 3rd / 2nd / 1st), and counting toward the same 8-races-per-day XP cap.
- No ribbons or trophies; those come only from open races.
- Results screen shows final placings for everyone in the game.

## Open questions

- Can the inviter start early once a friend has joined, or is it timer only?
- Is the 5-minute delay fixed, or does the inviter pick from a few options?
- If the inviter leaves the room, does the game cancel or still run with two friends?
- Which course rules apply to every pet (Open class is the suggested default)? The earlier "Friendly pace (1.15×)" has no counterpart in the race code.
- Does a friend game start the event's 6-minute rest, and does it count for the "Race in the Stadium" goal and race badges?
- If a player with an open-race sign-up at an overlapping time accepts an invite, are they withdrawn from the open race?
