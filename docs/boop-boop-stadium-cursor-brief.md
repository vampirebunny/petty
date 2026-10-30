# Cursor Brief: Stadium (Lobby, Sign-up, Race Call, Starting Gate)

## Goal

Build the Stadium place on the map: where players see upcoming races, sign up, get called back when a race is about to start, and gather at the starting gate. The race itself (gameplay) is a separate brief; this one ends by handing off to a placeholder race screen.

Visual reference: the "Boop Boop Stadium" design canvas, screens 1–5 (Stadium lobby, Sign-up sheet, Signed up, Race call, Starting gate). Use the mocks for layout, hierarchy and copy. **Where this brief and the mocks disagree, this brief wins** (notably the starting gate's lane and NPC rules, section 6).

**Status: shipped** through the starting gate. Race gameplay is in `docs/boop-boop-race-foundation-cursor-brief.md`. Fun Run, Hurdles, Dock Dive, and Obstacle Course are playable. Solo results go through the deployed `race_report` Edge Function. Sniff Out, Trick Show, and Weave are cancelled. Testing migrations (`20261029370000_test_fast_slots.sql`, `20261029390000_test_hurdles_every_slot.sql`, `20261029430000_schedule_ship_roster.sql`, `20261029440000_obstacle_course.sql`) stay in effect until testing ends.

## Global rules

- **Match the existing app look. Do not invent new styles.** Use the same glossy, puffy cotton candy button component used on the Home screen (action buttons, learned tricks, badges), the same modal/sheet styles, fonts, outline weights and color tokens. The hex values in the mocks are reference only; map them to existing theme tokens. Button roles:
  - Primary action (Sign up, Sign up [pet]): the pink glossy button
  - Go / confirm (Go to the Stadium, selected time slot): the mint/green glossy button
  - Race with friends: the lavender glossy button
  - Secondary (Withdraw, Not now, Skip this race): the existing white or text-only secondary style
- All numbers are defaults in the gameplay config, not hardcoded: slot length (5 min), events per slot (3), slots shown (3), race capacity (6), gate opens (60 s before start), race call and local notification (30 s before start), line-up lock (10 s before start), rest per event (6 min), NPC fill count. The server's `stadium_config` row is the source of truth. For testing, `20261029370000_test_fast_slots.sql` sets 1-minute slots and no rest, `20261029390000_test_hurdles_every_slot.sql` puts Hurdles in every slot with no Jump the Hurdle requirement, and `20261029430000_schedule_ship_roster.sql` keeps that board while scheduling only the ship roster (Fun Run, Dock Dive, Hurdles, Obstacle Course). The client defaults match. Restore 5 minutes, 6 minutes, the Hurdles / Obstacle Course third-event rotation, and the hurdle trick before launch.
- No speech balloons over pets; no tooltips or banners on the starting gate or during races.
- The Stadium needs a connection. Offline: show the header plus a friendly "The Stadium needs internet to race" state with a back button. Everything else in the app keeps working offline.
- Use **server time** for every countdown (keep a server-clock offset); never trust the device clock for slot times.
- Respect the OS "reduce motion" setting: stop the ambient animations (section 2) and keep the header static.

---

## 1. Screens

| # | Screen | When it shows |
| --- | --- | --- |
| 1 | Stadium lobby | Entering the Stadium with no active sign-up |
| 2 | Sign-up sheet | Tapping Sign up on a race card (bottom sheet over the lobby) |
| 3 | Signed up (ticket) | Entering the Stadium while the pet has an active sign-up; also right after signing up |
| 4 | Race call | In-app card 30 s before the start, when the player is anywhere other than the gate |
| 5 | Starting gate | From 60 s before start, reached from the race call, the push notification, or the ticket |
| — | Race (placeholder) | At start time; receives the race id and line-up. Built in the next brief |

## 2. Stadium header (lobby screen)

Build the header as a **scene in the existing scene system** (same pattern as the park and living room in `scenes.ts` / `props.ts`), not as a static image. That way it automatically gets the same sky, time of day, weather, sun/moon (with moon phases) and seasonal behavior as every other place. **Weather and time of day must match what the park and living room show at that moment**: read from the same shared weather/time source, never roll weather separately for the Stadium.

New props, drawn in the existing prop style (outline weight, cotton candy palette):
- `stadiumFacade`: pink curved front wall with a lighter top stripe, arched windows, central gate with bars and a pink paw emblem
- `stadiumStands`: lavender stands curving above the facade
- `crowd`: rows of small pastel pet heads peeking over the rim, a few holding tiny flags
- `scoreboard`: on posts above the stands; shows "NEXT RACE" and the next slot time (live data, not fixed text)
- `lightTower` (×2): poles with lamp heads, left and right
- `pennant`: flag on a pole (two on the rim, small ones in the crowd)
- `bunting`: triangle flags strung along the facade
- `ribbonBanner`: lavender ribbon with folded tails; the "Stadium" title is real text on top (accessible heading), not drawn into the art

Ambient animation (Reanimated/Skia, the same approach as existing wind-reactive props):
- **Pennants and bunting wave**: sine-wave flutter with different phase per flag. Amplitude and speed come from the shared wind/weather state (calm = gentle, windy = strong). Reuse the existing pennant/wind logic if there is one.
- **Fans move about**: each head bobs 1–3 px with its own random phase and period (0.8–1.6 s); small sideways sways now and then. Every ~20–30 s (random), a "wave" ripples across the crowd left to right. Crowd flags wiggle.
- **Light towers**: lamps on and soft beams visible at dusk, evening and night, with a slow ±5° sweep; off (no beams) in daytime.
- **Weather**: rain shows rain particles and a wet sheen like other scenes; snow adds snowflakes and snow caps on the rim, towers and scoreboard; rare rainbows follow the existing rules.
- Pause all header animation when the screen isn't focused or the app is in the background. Keep it light: one header scene, no per-frame allocations.

## 3. Lobby (screen 1)

Top to bottom:
1. Header scene (section 2), with the back-to-map button top left and the pet chip top right (name, level, class).
2. Energy and mood bars for the pet (existing stat values; they affect race performance).
3. "Upcoming races" with time-slot buttons for the next 3 slots (e.g. 3:05 / 3:10 / 3:15, each with "in m:ss"). The next slot is selected by default. The list rolls forward as slots start.
4. Race cards for the selected slot (3 per slot). Each card shows the icon, name, an OPEN or AWAY tag where it applies, who can enter (Dogs / Cats / Dogs & cats), and "x of 6 signed up". Card states:
   - **Can enter**: pink Sign up button
   - **Missing trick**: lock line ("Requires skills in Jump the Hurdle") and a disabled "Not qualified" pill. Tapping the card offers a link to the Training School.
   - **Wrong species**: disabled "Cats only" / "Dogs only" pill
   - **Resting**: disabled "Resting" pill and the line "Again in m:ss". Only cards of the rested event that start before the rest ends show this.
5. "Race with friends" (lavender) at the bottom: opens the friend competition flow from the friends addendum (stub it if not built yet).

**Slot schedule rules (server side):**
- A slot starts every 5 minutes on the clock (:00, :05, :10…).
- Each slot has 3 events, all open to dogs and cats: **Fun Run** every slot, plus 2 featured events from Dock Dive, Sniff Out, Trick Show, Hurdles, Weave, and Obstacle Course. Every slot includes at least one featured event that needs no tricks (Dock Dive or Sniff Out).
- **Veteran Cup** is a fourth card for senior pets only, every 15 minutes. See the race foundation brief.
- A pet races in its highest class. Fun Run is the exception: every level races in one Open field. Neighboring classes can merge at gate open, into the lower class, when the combined field fits.

## 4. Sign-up (screen 2)

- Tapping Sign up opens the bottom sheet: event name, start time and countdown, class; the line-up so far (real players who've signed up, and the pet's own lane); race readiness (energy and mood, with a short nudge to play or give a mood treat); two rule lines; **Sign up [pet name]** and **Not now**.
- Line-up copy (replaces the mock's "Open lanes fill with friendly NPC pets at the start"): **"If no one else joins, friendly NPC pets will race with you."**
- Rule lines: "Go anywhere you like. We'll call you 30 seconds before the start." / "Free to enter. Change your mind? You can withdraw until 10 seconds before the start."
- On the player's **first** sign-up ever, request notification permission here (contextual, not at launch). If declined, sign-up still works; the in-app race call still shows.

**Sign-up rules:**
- Free entry, no energy cost or minimum.
- **One active sign-up per pet.** While signed up, other races show "In a race".
- Players can sign up for any slot shown (up to ~15 min ahead).
- Blocked when that event's 6-minute rest (from the last race's start) is still running at the new race's start. The rest is written with the results; withdrawing, missing the gate, or a cancelled race does not start it. A pet can enter a different event during the rest.
- Re-check eligibility server side (trick learned, species, class, cooldown, no other active entry).
- Race placement: within event + class, fill races in sign-up order up to capacity 6; when one fills, the next sign-up opens a new race in the same slot. Friends signing up for the same event and class go into the same race when there's room.

## 5. Signed up, race call, notification (screens 3–4)

**Ticket (screen 3):** shown whenever the player enters the Stadium with an active sign-up, and right after signing up. Shows "YOU'RE IN!", event, time, class, lane; "Gate opens in m:ss" and "Race starts in m:ss"; the note "You don't have to wait here. We'll call you 30 seconds before the start, wherever you are."; "Get [pet] ready" buttons (Play → existing play flow, shown once the gate opens; Mood treat → uses one from the Pantry, showing the owned count, and at 0 offers Visit Pet Shop); before the gate opens, **Wait somewhere else** takes the player to the map; other events in the slot shown disabled ("In a race"); **Withdraw from race** at the bottom.

The player is free to leave the Stadium and do anything.

**Local notification:** at sign-up, schedule a local notification for **start − 30 s** (the gate itself still opens at start − 60 s): title "[Pet]'s race starts in 30 seconds! 🏁", body "[Event] is about to begin. Tap to head to the Stadium." Cancel it on withdraw, if the race is cancelled, or if the player is already at the gate. Tapping it opens the app **directly to the starting gate** (deep link with the race id).

**In-app race call (screen 4):** if the app is open and the player is anywhere other than the gate at start − 30 s (park, home, a mini-game, the Stadium lobby), show the race call card: "RACE CALL / The gate is open!", the event, a live countdown, **Go to the starting gate** (mint) and **Skip this race**.
- Go to the starting gate jumps straight to the gate. **Skip the map walk** for this jump, since the walk would eat the countdown.
- Skip this race = withdraw.
- In a mini-game: show the card at the end of the current run, or as a small pause-and-ask if the countdown would otherwise run out. Don't interrupt mid-jump without pausing.
- Don't show it if the player is already at the gate.

## 6. Starting gate (screen 5)

Opens at start − 60 s. Header: event name and class, "Starting gate", big countdown "Starts in 0:42". A tip line for the event (e.g. "Tap right as [pet] reaches each hoop."). **Withdraw** at the bottom until line-up lock.

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
2. Lobby with live slots and card states (static header art is fine at first)
3. Sign-up sheet and ticket, including one-active-entry, cooldown and withdraw
4. Local notification, deep link and in-app race call
5. Starting gate with presence, line-up lock and the start rules (NPCs only when solo), handing off to the placeholder race screen
6. Header scene with props, ambient animation, shared weather/time and reduce-motion support

Each step should ship working on its own.
