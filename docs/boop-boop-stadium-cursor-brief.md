# Cursor Brief: Stadium (Lobby, Sign-up, Race Call, Starting Gate)

## Goal

Build the Stadium place on the map: where players see upcoming races, sign up, get called back when a race is about to start, and gather at the starting gate. The race itself (gameplay) is a separate brief; this one ends by handing off to a placeholder race screen.

**Status: shipped** through the starting gate. Race gameplay is in `docs/boop-boop-race-foundation-cursor-brief.md`. Fun Run, Hurdles, Dock Dive, Obstacle Course, and 800 Meters are playable. Solo results go through the deployed `race_report` Edge Function. Sniff Out, Trick Show, and Weave are cancelled. The launch board is applied (`20261030130000_launch_race_schedule.sql`): 5-minute slots, Fun Run and Dock Dive every slot, Hurdles and Obstacle Course alternating, trick gates restored, and a 1-minute rest per event. `20261101120000_eight_hundred_meters.sql` is applied and adds 800 Meters to every slot. `20261101160000_one_race_per_slot.sql` is applied: one active entry per start time.

## Global rules

- **Match the existing app look. Do not invent new styles.** Use the same glossy, puffy cotton candy button component used on the Home screen (action buttons, learned tricks, badges), the same modal/sheet styles, fonts, outline weights and color tokens. The hex values in the mocks are reference only; map them to existing theme tokens. Button roles:
  - Primary action (Sign up, Sign up [pet]): the pink glossy button
  - Go / confirm (Go to the Stadium, selected time slot): the mint/green glossy button
  - Race with friends: the lavender glossy button
  - Secondary (Withdraw, Not now, Skip this race): the existing white or text-only secondary style
- All numbers are defaults in the gameplay config, not hardcoded: slot length (5 min), events per slot (4), slots shown (3), race capacity (6), gate opens (60 s before start), race call and local notification (30 s before start), line-up lock (10 s before start), rest per event (1 min), NPC fill count. The server's `stadium_config` row is the source of truth (`20261030130000_launch_race_schedule.sql`, plus `20261101120000_eight_hundred_meters.sql` for the fourth event). The client defaults match.
- No speech balloons over pets; no tooltips or banners on the starting gate or during races.
- The Stadium needs a connection. Offline: show the header plus a friendly "The Stadium needs internet to race" state with a back button. Everything else in the app keeps working offline.
- Use **server time** for every countdown (keep a server-clock offset); never trust the device clock for slot times.
- Respect the OS "reduce motion" setting: show the header poster instead of the video (section 2).

---

## 1. Screens

| # | Screen | When it shows |
| --- | --- | --- |
| 1 | Stadium lobby | Entering the Stadium. Sign-ups stay listed under Your races |
| 2 | Sign-up sheet | Tapping Sign up on a race card (bottom sheet over the lobby) |
| 3 | Signed up (ticket) | Right after signing up, and from **Your races** on the lobby |
| 4 | Race call | In-app card 30 s before the start, when the player is anywhere other than the gate |
| 5 | Starting gate | From 60 s before start, reached from the race call, the push notification, or the ticket |
| — | Race (placeholder) | At start time; receives the race id and line-up. Built in the next brief |

## 2. Stadium header (lobby screen)

The header is a muted looping video in `assets/lobby/`, not a live sky scene.

- `stadium-phone.mp4` and `stadium-phone.png` — 700×360. Phones and portrait. The banner is the full width at that aspect.
- `stadium-tall.mp4` and `stadium-tall.png` — 600×800. Fills the left pane on a landscape split.

Play the MP4 with expo-video: muted, looping, no controls, `contentFit="cover"`. The PNG is the first frame. It sits under the video until that frame renders, and it is the only frame when Reduce Motion is on. Playback pauses in the background. Leaving the Stadium releases the player.

"Stadium" and the next race time are real text over the hero, under the control row, not drawn into the art. The back button, the Boop Boop app mark, and the same pink settings button as the living room and bedroom sit on the left. The pet chip stays on the right (name, level, class). A waiting friend request puts the same red dot on that settings button. Opening Settings covers the Stadium and returns to the same screen. This hero keeps its falling confetti. The art does not follow the park's weather or time of day.

## 3. Lobby (screen 1)

On a landscape split the tall hero fills the left side. The lobby, ticket, sign-up form, and starting gate sit in a phone-width column on the right. The sign-up form fills that column instead of a bottom sheet. A race stays full screen.

Top to bottom:
1. Header (section 2). Top left: back, the Boop Boop mark, and Settings. Top right: the pet chip (name, level, class). "Stadium" and the next race time sit under that row. The same bar stays on the ticket, sign-up, friend setup, waiting room, and starting gate. A race stays full screen.
2. **Your races**, when the pet is in any: every open-race sign-up and the friend game, soonest first. Each row shows the event, the start time, and the class (or "Friend game"). **Open** goes to that race's page: the ticket for an open race, the waiting room for a friend game. Entering the Stadium always lands on the lobby. Back from the ticket returns here.
3. "Upcoming races" with time-slot buttons for the next 3 slots (e.g. 3:05 / 3:10 / 3:15, each with "in m:ss"). The next slot is selected by default. The list rolls forward as slots start.
4. Race cards for the selected slot (4 per slot). Each card shows the icon, name, an OPEN or AWAY tag where it applies, who can enter (Dogs / Cats / Dogs & cats), and "x of 6 signed up". Card states:
   - **Can enter**: pink Sign up button
   - **Missing trick**: lock line ("Requires skills in Jump the Hurdle") and a disabled "Not qualified" pill. Tapping the card offers a link to the Training School.
   - **Wrong species**: disabled "Cats only" / "Dogs only" pill
   - **Resting**: disabled "Resting" pill and the line "Again in m:ss". Only cards of the rested event that start before the rest ends show this.
   - **Same time**: disabled "Same time" pill when the pet is already entered in another event at that start.
5. "Race with friends" (lavender) at the bottom: opens the friend game flow (`docs/boop-boop-friend-games-addendum.md`). Guests get the create-account sheet. A game the pet is already in is a row under **Your races**, not a separate button.

Energy, mood, and hydration bars are on the sign-up sheet, the ticket, and Fun Run (including 800 Meters). They are not on this lobby. Hurdles, Obstacle Course, and Dock Dive do not show them.

**Slot schedule rules (server side):**
- A slot starts every 5 minutes on the clock (:00, :05, :10…).
- Each slot has 4 events, all open to dogs and cats: Fun Run, Dock Dive, 800 Meters, and one of Hurdles or Obstacle Course.
- **Veteran Cup** is an extra card for senior pets only, every 15 minutes. See the race foundation brief.
- A pet races in its highest class. Fun Run and 800 Meters are the exception: every level races in one Open field. Neighboring classes can merge at gate open, into the lower class, when the combined field fits.

## 4. Sign-up (screen 2)

- Tapping Sign up opens the bottom sheet: event name, start time and countdown, class; the line-up so far (real players who've signed up, and the pet's own lane); race readiness (bars labeled "[pet]'s energy", "[pet]'s mood", and "[pet]'s hydration", with a short nudge when any is under 50); two rule lines; **Sign up [pet name]** and **Not now**.
- Line-up copy (replaces the mock's "Open lanes fill with friendly NPC pets at the start"): **"If no one else joins, friendly NPC pets will race with you."**
- Rule lines: "Go anywhere you like. We'll call you 30 seconds before the start." / "Free to enter. Change your mind? You can withdraw until 10 seconds before the start."
- On the player's **first** sign-up ever, request notification permission here (contextual, not at launch). If declined, sign-up still works; the in-app race call still shows.

**Sign-up rules:**
- Free entry, no energy or hydration minimum. Each race input spends 0.2 energy and 0.3 hydration, and both stop at 0. Fun Run and 800 Meters get slower as either falls into a penalty band. See the race foundation brief.
- **One active sign-up per start time.** A second event in that same slot shows "Same time". Other slots stay open.
- Players can sign up for any slot shown (up to ~15 min ahead).
- Blocked when that event's 1-minute rest (from the last race's start) is still running at the new race's start. The rest is written with the results; withdrawing, missing the gate, or a cancelled race does not start it. A pet can enter a different event during the rest.
- Re-check eligibility server side (trick learned, species, class, cooldown, no other active entry at that start time).
- Race placement: within event + class, fill races in sign-up order up to capacity 6; when one fills, the next sign-up opens a new race in the same slot. Friends signing up for the same event and class go into the same race when there's room.

## 5. Signed up, race call, notification (screens 3–4)

**Ticket (screen 3):** shown right after signing up, and when the player opens that race from **Your races**. Entering the Stadium with a sign-up stays on the lobby. Shows "YOU'RE IN!", event, time, class; "Gate opens in m:ss" and "Race starts in m:ss"; the note "You don't have to wait here. We'll call you 30 seconds before the start, wherever you are."; "Get [pet] ready" with energy, mood, and hydration bars, then "Tip: Energy, mood, and hydration affect performance. Get [pet] ready by raising energy, mood, and hydration."; buttons (Play → existing play flow, shown once the gate opens; Mood treat → uses one from the Pantry, showing the owned count, and at 0 offers Visit Pet Shop); before the gate opens, **Wait somewhere else** takes the player to the map; other events in the slot shown disabled ("In a race"); **Withdraw from race** at the bottom. Back returns to the lobby.

The player is free to leave the Stadium and do anything.

**Local notification:** at sign-up, and when a friend game is joined, schedule a local notification for **start − 30 s** (the gate itself still opens at start − 60 s): title "[Pet]'s race starts in 30 seconds! 🏁", body "[Event] is about to begin. Tap to head to the Stadium." Cancel it on withdraw, if the race is cancelled, or if the player is already at the gate or in that friend game's waiting room. Tapping an open-race reminder opens the app **directly to the starting gate**. Tapping a friend-game reminder (`friend_game_call`) opens that waiting room. While the app is open, the system banner stays hidden and the in-app race call is the notice.

**In-app race call (screen 4):** if the app is open and the player is anywhere other than the gate (or that friend game's waiting room) at start − 30 s (park, home, a mini-game, The Catwalk, the Stadium lobby), show the race call card: "The gate is open!", the event, a live countdown, **Go to the starting gate** (mint) and **Skip this race**.
- **Go to the starting gate** leaves the current screen, including The Catwalk, and opens the gate immediately. A friend-game call opens that game's waiting room instead. **Skip the map walk** for this jump, since the walk would eat the countdown.
- Skip this race = withdraw.
- In a mini-game: show the card at the end of the current run, or as a small pause-and-ask if the countdown would otherwise run out. Don't interrupt mid-jump without pausing.
- Don't show it if the player is already at the gate.

## 6. Starting gate (screen 5)

Opens at start − 60 s. Header: event name and class, "Starting gate", big countdown "Starts in 0:42". A tip line for the event (e.g. "Tap right as [pet] reaches each hoop."), then "Tip: Energy, mood, and hydration improve performance". **Withdraw** at the bottom until line-up lock.

**Lanes: show only live players. No open lanes, no NPC placeholders.**
- List only real players in this race: the player's own pet first, then other signed-up players.
- Each row: lane number, pet avatar, pet name, handle and level, and a status chip: **Ready** (on the gate screen now) or **On the way** (signed up, not yet at the gate).
- If the player is the only live player, show just their one row. Do not show "Open lane" or "An NPC pet joins" rows.
- Live presence via a Supabase Realtime channel per race: being on the gate screen = checked in. Rows update as players arrive, leave or withdraw.

**At line-up lock (start − 10 s):** Withdraw disappears. Players not at the gate are marked no-show and removed from the list (no penalty, no cooldown, notification cancelled).

**At start (server decides, using checked-in players only):**
- **1 live player:** add NPC pets to fill the race (up to capacity, default 5 NPCs), matched to the class. The NPCs appear when the race screen opens, not on the gate.
- **2 or more live players:** **no NPCs at all.** The race runs with only the live players who checked in.
- **0 live players** (everyone withdrew or didn't show): cancel the race quietly.

Then navigate everyone at the gate to the race placeholder screen with the race id and final line-up (players + any NPCs). The placeholder just shows the line-up and a "Race coming soon" back button for now.

If the app is backgrounded on the gate screen at start, the player counts only if they were checked in at lock; when they return, take them into the race in progress, or to the lobby if it has ended.

## 7. Withdraw

- Allowed from the ticket, the race call ("Skip this race") and the gate, until 10 s before the start.
- No confirmation modal needed. It's free, has no penalty and doesn't start the cooldown. Show a light toast "You've withdrawn from [Event]" and return to the lobby (or stay where the player was, for the race call).
- Cancels the local notification and frees the lane for new sign-ups.

## 8. Data (Supabase)

Suggested tables (adjust to existing conventions):
- `competition_slots`: id, starts_at
- `competition_events`: id, slot_id, event_type, species_allowed (dog / cat / both), required_trick_id (nullable), is_away, away_location (nullable)
- `races`: id, event_id, class, capacity, status (open / locked / running / finished / cancelled)
- `race_entries`: id, race_id, pet_id, player_id, lane, status (signed_up / checked_in / withdrawn / no_show / finished), signed_up_at
- Pet cooldown: store `race_cooldown_until` on the pet (set when a race finishes).

Server functions (RPC or edge functions): `get_upcoming_slots(pet_id)` returns slots, events, signed-up counts and per-card eligibility for this pet; `sign_up(pet_id, event_id)` does validation and race placement and returns the entry; `withdraw(entry_id)`; and a scheduled job that creates future slots and events from the rotation, locks races at T−10 s, and starts races at T0 (no-shows, NPC fill rule, cancellations). Clients only read and subscribe; the server makes every decision.

## 9. Build order

1. Data and server functions, with the slot generator and rotation rule
2. Lobby with live slots and card states (the poster is fine until the video is wired)
3. Sign-up sheet and ticket, including one-active-entry, cooldown and withdraw
4. Local notification, deep link and in-app race call
5. Starting gate with presence, line-up lock and the start rules (NPCs only when solo), handing off to the placeholder race screen
6. Header video, poster, and reduce-motion support (section 2)

Each step should ship working on its own.
