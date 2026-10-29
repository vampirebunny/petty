# Cursor Brief Addendum: Friend Games

An addition to the gameplay progression brief. Build after live races (phase 7), since it reuses that tech. All numbers go in the gameplay config.

Alongside open scheduled races, a player can create a private race just for friends. It reuses the live-race tech from section 9 of the gameplay brief: synchronized countdown, each phone simulates its own pet, the server verifies results, and NPC autoplay takes over on disconnect.

## Creating a game

1. In the Stadium, the player taps **Invite friends**.
2. Picks the event: Fun Run, Agility, Trick Show, or Fetch/Swat (same species rules as open races). For Agility, also picks the course: Hurdles only, Hurdles + tunnel, Hurdles + tunnel + weave, or Full course.
3. Selects up to 5 friends:
   - **Recent** at the top: the 5 friends this player invited most recently (stored per player, not per pet), newest first.
   - **All friends** below.
   - A friend whose pet lacks a trick on the chosen course shows dimmed and can't be selected, with the reason (e.g. "Needs Jump the Hurdle").
4. Taps **Send invites**.

## Invites

- Sent as a push notification and an in-app notification (reuse the existing friend-request push and on-open modal patterns).
- The invite shows who's inviting, the event (and course), with **Accept** and **Decline**.
- **Accept** takes the invitee straight into the game lobby (opening the app from the push if needed).
- Invites expire after 10 minutes. An invite accepted after the game started or was cancelled shows "This game already started" or "This game was cancelled."
- A player can be in only one lobby at a time. Accepting an invite declines any other pending invites, and entering a lobby removes the player from any open-race sign-up for the current slot.

## Lobby

- **Initiator** sees "Waiting for players to join," each invitee's status (waiting, joined, declined), a **Start** button and a **Cancel** button.
  - Start is disabled until at least one friend has joined.
  - When every invitee has joined, Start pulses but the game still waits for the initiator.
  - Cancel ends the game for everyone; joined players see "[name] cancelled the game" and return to the Stadium.
- **Invitees** who joined see who's in and "Waiting for [initiator] to start," with a **Leave** button.
- On Start, only pets that have joined race; pending invites are withdrawn. No NPCs fill empty spots, so a race can be as small as 2 pets.
- If the initiator doesn't start within 10 minutes of sending invites, the game cancels automatically for everyone.

## Race rules

- Starts when the initiator taps Start, not on the 15-minute schedule.
- No classes: every friend game runs at a single **Friendly pace (1.15×)**, so pets of any level can race. Attributes, tricks and player skill still decide the result.
- Same events, controls, scoring, skill check and energy/mood effects as open races.

## Rewards

- XP only, using the race XP table (entered / 3rd / 2nd / 1st), and counting toward the same 8-races-per-day XP cap.
- No ribbons or trophies; those come only from open races.
- Results screen shows final placings for everyone in the game.
