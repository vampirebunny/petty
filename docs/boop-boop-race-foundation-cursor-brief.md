# Cursor Brief: Race Foundation (+ Fun Run)

## Goal

Build the shared engine every Stadium competition runs on: the race screen, start and finish, multiplayer sync, server checking, NPC pets, rewards, and the race scene. Then build **Fun Run** on top of it as the first working event. Later briefs add one event at a time (Hurdles, Dock Dive, Obstacle Course) and should only need event-specific rules, controls and drawing. Sniff Out, Trick Show, and Weave are cancelled.

This brief picks up where the Stadium brief ends: the starting gate hands off the race id and final line-up (live players plus NPCs, if any).

## Decisions

These override the sections below. The old addendum is folded in here.

**Schedule.** Ship roster: Fun Run, Dock Dive, Hurdles, and Obstacle Course. Every 5-minute slot shows three events: Fun Run, Dock Dive, and one of Hurdles or Obstacle Course. The no-trick event besides Fun Run is always Dock Dive. Sniff Out, Trick Show, and Weave are cancelled and are not scheduled (their `event_type` values may remain in the DB check for old rows). All four ship events are playable. `20261030130000_launch_race_schedule.sql` is applied: 5-minute slots, the Hurdles / Obstacle Course rotation, the trick gates, and a 1-minute rest per event.

**Veteran Cup.** A fourth card, shown only to senior pets, in every third slot (every 15 minutes, on :00, :15, :30, and :45). It does not replace a regular race. The event rotates through Fun Run, Dock Dive, Hurdles, and Obstacle Course. Seniors of every level race together on Open class settings. It has its own trophy, which waits for the trophies brief. The usual trick check still applies.

**Classes.** Beginner, Novice, Open, Expert, and Championship, plus Veteran Cup. A pet always races in its highest class, except in Fun Run, which is one Open field for every level (section 9). At gate open (start − 60 s), neighboring classes merge into the lower class when one race has a single live player and the combined field fits in capacity. The switch defaults on. If withdrawals then leave one player, that player gets NPCs at the start.

**Lifecycle.** `open` → `locked` (start − 10 s) → `countdown` (start − 3 s) → `running` → `finished` or `cancelled`. Each race stores `seed` and `config_version`. The rest is 1 minute per event (`stadium_config.cooldown_seconds`), counted from the race start and set when results are written. It only blocks races of that event that start before the rest ends, so the next 5-minute slot is open. Withdrawals, no-shows, and cancelled races do not start one. A running race that nobody reports within start + 80 s is finalized with those players as DNF, so a closed app never leaves a stale entry. One active sign-up per pet still applies. The ticket does not show a lane.

**Results.** Solo: the phone reports its own finish time and the NPC times it simulated, and the server stores and ranks them. Once the replay Edge Function exists, the server recomputes both from the seed. Live: publish when every live player has reported, or 10 seconds after the first report. Anyone missing is DNF. Phones show provisional standings until the server ranking arrives.

**Rewards.** The server never writes the pet document. It writes placings. The phone applies XP, a ribbon log (`raceId`, event, class, place, date), energy, and badges once per race id. Race XP is capped at 8 races a day and is skipped below level 10. Ribbons are still awarded then. "Race in the Stadium" is a tutorial goal that completes when the pet finishes a race. Badges: First Race (id `off-to-the-races`), Blue Ribbon, Moving Up (a ribbon in a level class above Beginner; Fun Run ribbons don't count), Ribbon Rack (5 / 25 / 100). Furniture waits.

**Modifiers and config.** At lock, the server snapshots energy, mood, and attributes from the pet's last synced document. Config versions are immutable. Each race keeps the version it was created with.

**Live races.** Open sign-ups are for anyone online, guests included (a guest has no handle, so the name tag shows the pet name only). Fun Run, Hurdles, and Obstacle Course stream each pet's state (section 5). Dock Dive keeps its per-jump flags on `race:{raceId}:dives`. Other players' pets show their real coat, age, and outfit from the server copy of the pet. A player who drops mid-race keeps racing on their own phone; other phones freeze that pet and show "Reconnecting", and a missing report is DNF. There is no NPC autoplay.

**Code.** Race rules live in `supabase/functions/_shared/race-sim/`. Live races use the replay Edge Function and Realtime sync. The track scrolls with parallax and uses the shared sky and weather. The running, leap, and stumble poses are the existing pet rig (`docs/boop-boop-race-poses-cursor-brief.md`). Fun Run has no hurdles, so the leap and the stumble are checked from the dev preview on the race screen.

**Build order.** (1) sim and config, (2) race screen and scene, (3) NPCs and solo Fun Run, (4) scene polish, (5) ~~server replay Edge Function~~ (**shipped** — `20261029450000_race_replay.sql` applied; `race_report` deployed), (6) ~~live races~~ (**shipped** — Fun Run, Hurdles, and Obstacle Course stream state on `race:{raceId}:run`; real looks from `20261030100000_race_state_pet_looks.sql`).

**References**
- Design canvas "Boop Boop Stadium", screens 6–8 (Fun Run, Hurdles, Results), for layout.
- `race-demo.html` (attached): a crude browser prototype of Fun Run and Hurdles. Use it to learn the **feel**: speed, tap response, jump timing, countdown, pop-up feedback, results. Don't port its code. It's a single-file prototype and none of its structure is meant for the app.

## Global rules

- **Every number is config, not hardcoded:** per event and per class, plus global values (tap cap, sync rate, timeouts, rewards). One `raceConfig` module, ideally loaded from Supabase so it can be tuned without a release.
- Match the app's existing look: glossy puffy buttons, cotton candy palette, existing fonts and outline weight.
- **No banners, tooltips or modals during a race.** Feedback is short pop-up words near the pet ("Perfect!", "Oops!"), sounds and haptics only.
- Use the existing bark, meow and purr sounds where a pet reacts. No speech balloons.
- Respect the phone's reduce-motion setting: no crowd bobbing or camera shake. Gameplay motion still runs.
- Races need a connection. Everything else in the app keeps working offline.

---

## 1. Events and entry

| Event | Tricks needed to enter | Type | Status |
| --- | --- | --- | --- |
| Fun Run | none | race | playable |
| Dock Dive | none | distance | playable |
| Hurdles | Jump the Hurdle | race | playable |
| Obstacle Course | Jump the Hurdle + Through the Tunnel | race | playable |
| Sniff Out | — | — | cancelled |
| Trick Show | — | — | cancelled |
| Weave | — | — | cancelled |

- All ship events are open to dogs and cats. The cat trick catalog must include Jump the Hurdle and Through the Tunnel so cats can qualify for Hurdles and Obstacle Course.
- The trick check runs server-side at sign-up, as in the Stadium brief.
- The engine supports three event types. **Race:** first to the finish line, ranked by time. **Distance:** best attempt wins. **Rounds:** last pet standing or best score. This brief builds the race type fully. Distance is used by Dock Dive. Rounds were for cancelled events and are not needed for the ship roster.

## 2. Race lifecycle

States: `gate → countdown → running → finishing → results`.

- The server stores `start_at`, the moment of "Go!". The starting gate hands off to the race screen on the clock at `start_at − 5 s` (`countdownMs`), using the latest line-up it has, and never waits on a network reply. The race screen keeps fetching the line-up until the race is running.
- **Screen opens:** every racer stands still with its front toes just short of the start line for about a second.
- **Countdown:** "Get ready!" (start − 4 s), 3, 2, 1, then "Go!" at the start, one second each, with a haptic on 3, 2, 1 and Go!. It runs on every phone against **server time** (using the clock offset from the Stadium brief), so everyone says Go! at the same moment whatever their own phone clock says. The start-beep clip (`assets/sounds/transcendedlifting-race-start-beeps-125125.mp3`, about 4 s) starts when "Get ready!" appears and lands on Go!. A phone that opens mid-countdown seeks into the clip. Playback follows the pet-sounds switch. Every race event uses this countdown (`raceCountdown`, `useRaceCountdown`). The words, the beep, and the haptics are the same. The active button label is per event.
- **Action button:** visibly inactive (grey, dashed, faded, "Wait") until Go!. Taps before Go! are ignored, including a finger already held down (`raceInputOpen`). There are no false starts or disqualifications. The control is shared (`RaceAction`). After Go! it shows that event's label: TAP! for Fun Run, JUMP! for Hurdles.
- **Running:** race time `t = 0` at Go!. The player's taps and every NPC start at the same moment.
- **Finishing:** the player has crossed the line. Show "Finish!", stop input, and keep every pet running. The camera uses that event's distance and stops following before the line so the finish sits left of the right edge. Each pet that crossed keeps the speed it crossed with, at least 4 m/s, and the phone keeps moving it until it is 80 m past the line (`coastRunner`). It gallops off the right side of the screen. A leap still in the air at the line plays through landing and recovery, then the pet gallops (`stepRaceMotion`). Finish time is still the moment of crossing. A pet that never finishes stays where it stopped. No edge arrow after the line.
- **Results:** shown when the server publishes results (section 6), or after a fallback timeout with "Waiting for results…".
- **Max race length** is per event (default 60 s for races). A pet that hasn't finished by then is marked DNF (did not finish).

## 3. Race screen layout

Top to bottom (canvas screens 6–7):
1. **Top bar:** event name, timer (m:ss.t), plus event pills where needed (e.g. hurdle count).
2. **Mini progress track:** a line with a finish flag and one avatar dot per racer, with the player's own dot ringed. It shows everyone, including racers off-camera.
3. **Track scene** (section 4).
4. **Action area:** the event's control(s), large and glossy, plus one hint line. For tap events, **the whole action area responds to touch**, not just the button graphic. Support multi-touch (two thumbs).

The camera follows the player's own pet, which sits about a third of the way from the left, until the finish line would leave the right side of the screen. It then holds so pets can run past the line and off. Other pets move ahead of or behind it.

## 4. Track scene

- Build it as a **scene in the existing scene system** (like the park and living room) so it gets the shared sky, time of day, sun/moon with moon phases, weather, seasonal touches and wind.
- **Each phone uses its own local time and weather**, matching that player's other rooms. Weather and time are **cosmetic only** and never change gameplay, so players in different places race on equal terms.
- Night, dusk and evening: stadium lights on, with soft beams. Rain or snow: particles and the wet/snowy treatment used elsewhere, drawn behind the racers so they never hide the pet, hurdles or jump zones.
- Away events (Paris etc.) use their own location scene with the same rules.
- Scene layers: sky, stands with a crowd bobbing (cheers harder during the race), pink wall band, track with dashed lane lines and pebbles, a white start line with a green flag at 0 m, distance marks every 10 m, and a checkered finish line. World position is the front-paw line. Each pet is drawn back by its own toe reach (standing fore paw plus the toe), so at 0 m every competitor's toes stop 1 px short of the start stroke and none of them cross it. Smaller back-lane pets use their own reach, so their feet meet the same line. Start, distance and finish lines, hurdles, and jump zones are drawn on that paw line, under the pets.
- Parallax: the crowd scrolls slowly, the wall a bit faster, and the track at full speed.
- **Ground speed follows the player's pet:** screen pixels per meter = the pet's drawn leg length × `racePoses.legsPerMeter` (1.5). Fun Run multiplies that by `funRunScroll` (3), so the ground, crowd, wall, and legs move at 4.5 leg lengths per meter and the run reads much faster. Paws stay planted because the gallop uses that same scale. Stride length stays short, and a cadence scale (about 0.65 at a standstill, 1.8 at the 11 m/s cap) makes the gallop quicker when the pet is faster and longer when it is slower. Bounce still uses share = race speed ÷ 11 m/s.
- The track stage has a fixed height (240–320 pt by screen width) so the action area keeps its space.

**Lanes**
- **The player's own pet is always in the front (bottom) lane, drawn largest.** Every phone draws itself this way; lane order is visual only.
- The front lane takes the bottom half of the track. Other racers fill the back lanes in the top half at about 60% of the player's size, drawn far to near. Up to 5 back lanes, compressed to fit. A racer still on the course and off-screen shows as a small arrow at the edge of its lane. After the finish line, a pet that has left the right side is not drawn.
- Each pet shows a small name tag: pink for you, white for others.

**Pets** use the app's procedural pet renderer (real breed, coat colors, current outfit) in a running side-view: leg cycle, body bob, tail wag, a jump pose, and a stumble when an event calls for one.

## 5. Multiplayer: how the race runs

**Each phone runs its own pet.** Taps move the player's pet instantly on their phone, with no waiting for the server.

**Shared race code.** Write the race rules as a pure TypeScript module with no React Native imports (`race/sim`). It takes the event config, class config, pet modifiers (section 7), seed and an input log, and steps the race forward. The same module runs:
- on the phone, for the player's own pet and for NPCs
- in a Supabase Edge Function, to replay and check results

To make replays match exactly:
- **Fixed timestep** (60 steps per second). Draw at whatever frame rate the phone runs, interpolating between steps.
- **No `Math.random` inside the sim.** Use a seeded generator (e.g. mulberry32) with the seed stored on the race.
- **Inputs are timestamped** in ms from GO! and applied on the step they fall in. The live loop can run up to one step past the clock, so a press is stamped no earlier than the player's current sim time (`max(now − start, runner.tMs)`). Otherwise the scene skips a tap that the provisional results and the server replay still count.

**Live sync (Supabase Realtime)**
- Fun Run, Hurdles, and Obstacle Course use one broadcast channel per race: `race:{raceId}:run` (the gate's presence channel on `race:{raceId}` may still be closing). Code: `src/stadium/raceSync.ts`.
- About 10 times a second (`raceSyncConfig.syncHz`), each phone sends its own runner state: `{ entryId, t, x, v, jumpX, airM, duckX, duckUntilX, clipAtMs, outcomes, outcomeMs, finishMs }`. Those are the same fields the renderers read for the local pet, so other lanes leap, duck, tip hurdles, and bonk tunnels from the sender's own outcomes.
- Other humans are drawn only from these updates. Phones never simulate them. Their provisional finish comes from the broadcast `finishMs`.
- Other pets are drawn 120 ms behind (`interpDelayMs`) and interpolated between updates, so they glide instead of jumping. A slow connection only makes *other* pets look slightly behind; it never changes the player's own race or results. Updates older than `staleMs` freeze that pet and show "Reconnecting".
- The stream runs only when the line-up has two or more live players.
- The Supabase client pins Realtime protocol `1.0.0` (`src/compliance/supabase.ts`). Protocol `2.0.0` encodes broadcasts as binary frames that Hermes does not decode reliably, so presence works but position updates never arrive.

**NPCs are never sent over the network.** NPCs only appear in solo races (Stadium brief), so the player's phone simulates them from the race seed.

**Disconnects and backgrounding**
- The phone always finishes its own race locally. If the connection drops, it keeps running and queues its final report, retrying when the connection returns.
- If another racer's updates stop for over 3 s, freeze their pet and dim their name tag ("Reconnecting"). When updates resume, they jump to the new position.
- If the app goes to the background mid-race, the race clock keeps running; the pet just gets no input, slowing in Fun Run or clipping in Hurdles. On return, continue.
- If the server never gets a report by max race length + 20 s, the player is marked DNF.

## 6. Results and server check

**Shipped for solo:** the phone calls the `race_report` Edge Function with `{ raceId, inputLog, claimedFinishMs }` (optional `claimedScoreDm` for Dock Dive). Fun Run sends tap times; Hurdles jump times; Dock Dive hold/release attempts; Obstacle Course button taps. The old `submit_race_report` RPC rejects client calls (`use race_report`).

The server:
1. **Replays the race** with `_shared/race-sim`, using the stored seed, config version, and that pet's lock modifiers. NPC finishes are re-simulated from the race seed (not trusted from the phone).
2. **Applies the tap cap** inside the sim (same as the phone).
3. **Flags bot-like input** into `race_report_flags` (even sustained taps). Log only; no automatic penalty.
4. **Uses the replayed finish time / score**, not the claimed one. Mismatches beyond 100 ms (or 1 score tenth) are flagged.
5. **Writes** via `apply_verified_race_report` (service role) and ranks with `stadium_rank`.
6. **Returns** `race_state` JSON. Live Realtime results broadcast is still later; phones use the invoke return and `race_state` polling.

The function reads `races`, `race_entries`, `competition_events`, and `competition_slots` as `service_role`, which needs `select` on each (`20261029530000_race_report_read_grants.sql`). Without it every report fails with a 500 (`permission denied for table races`), nothing is stored, and the race closes at the DNF deadline with no times. When a report is rejected, the phone keeps the server's status and message (not the generic "non-2xx status code") and sends a `race_report rejected` warning to Sentry with the race id and reason only.

**Rewards** stay on the phone from the published place (`applyRaceRewards`): XP, ribbon log, energy. The server never writes the pet document. Rest still comes from `stadium_finish_cooldown`.

**Results screen** (canvas screen 8):
- event and class
- "[Pet] placed 2nd!" (or "won!")
- podium with ribbons for the top 3
- "[Pet] won" card: ribbon and XP, with progress to the next level
- event stat (e.g. top tap speed)
- full standings with times, live players shown with their handle, NPCs marked as NPC
- "[Pet] can race again at h:mm"
- Back to Stadium

Level-ups show the existing level-up moment after the results screen closes.

## 7. Pet modifiers (attributes, energy, mood)

The pet's stats should matter, but **the player's skill should matter more.**

Computed once at GO! from the pet's current energy and mood (the bars on screen) and fixed for the race. Stamina, agility, and intelligence still come from the lock snapshot when the server has one.

| Input | Effect (Fun Run) | Notes for later events |
| --- | --- | --- |
| Stamina | How much late-race tap power fades | Weave rhythm forgiveness, Dock Dive distance (up to +5%) |
| Agility | (no effect) | Hurdles and Obstacle Course zone width, Weave timing window |
| Intelligence | (no effect) | Trick Show demo pace or one free mistake, Sniff Out shuffle readability |
| Energy | Shifts each tap and the top-speed cap | All races |
| Mood | Shifts each tap and the top-speed cap | All events |

Energy and mood each apply on their own, and they stack. Above 90%: **+5%**. From 80% through 90%: no change. Below 80%: **−5%**. Below 70%: **−10%**. Both above 90% is a 12.1 m/s cap. Both below 70% is 8.8 m/s. The same factor multiplies the push of every tap, so the bonus shows up before the pet is already at the cap.

Send the modifiers with the race start so the server replays with the same values.

## 8. NPC pets

Used only when a solo player races (Stadium brief: 1 live player → fill with NPCs; 2+ live players → no NPCs).

- At line-up lock (start − 10 s), when exactly one live player is checked in to a Fun Run, the server creates the NPCs from the race seed and stores them with the race, so they stand at the start line during the countdown. The start step fills them again if somehow still missing:
  - name and species (mix of dogs and cats)
  - breed and coat
  - a **skill level** (0–1)
  - attributes
- **Skill spread:** across the NPCs in a race, spread skill from weak to strong (e.g. one strong, a few in the middle, one weak, with some randomness). Placing then reflects how well the player raced.
- **Skill → performance** per event and class. For Fun Run: target speed = lerp(class min, class max, skill), with small natural variation during the race (±5%, from the seed).
- **Once launched,** NPC skill comes from real players' results for that event and class (an NPC at skill 0.6 matches the 60th percentile, best at skill 1). The calibration brief owns the curve, the nightly job, and the solo win-rate offset (`docs/boop-boop-npc-calibration-cursor-brief.md`). Before there's data, fill time keeps the config ranges.
- **No rubber-banding:** NPCs never react to the player's position.
- NPCs use the app's NPC pet looks and the same renderer and animations as real pets.
- **Tuning target:** an average solo player wins about 1 race in 3 and places top 3 most of the time. Log solo results per event and class so the spread can be tuned in config.

## 9. Fun Run (first event)

**How it plays:** tap as fast as you can. Each tap pushes the pet forward, and speed drains away when tapping stops.

**Rules (defaults, all config):**
- Distance: 70 m
- Each tap adds 2.8 m/s of speed, up to a top speed of 11 m/s before mood and energy
- Speed fades without taps at 1.3 per second (`v *= e^(−1.3·dt)`)
- Stamina fade: from 60% of the distance onward, tap power falls by up to 15% at the line, reduced by stamina
- Tap cap: 20 taps per rolling second; extra taps are ignored
- Max race length: 60 s

**Open to all.** Fun Run is one Open field for every level: the server enters every pet in the `open` class (`stadium_event_class`), whatever its level. The Veteran Cup Fun Run keeps its own field. XP is unchanged and the same as every other event (section 6).

**NPC target speeds (config `funrun-2`):**

| Field | Who races | NPC speed range |
| --- | --- | --- |
| Open | every level | 8.2–9.6 m/s |
| Veteran Cup | senior pets | 10.0–11.0 m/s |

NPCs run at full speed from Go!. With ordinary mood and energy, about 4.5 taps per second beats the slowest NPC, 5 places about third, and the fastest NPC takes about 8 taps per second, or 6 with mood and energy above 90. Races stamped `funrun-1` keep its level-class ranges (Beginner 8.2–9.4, Novice 9.2–10.2, Open 10.0–11.0, Expert 10.6–11.6, Championship 11.0–12.0 m/s).

**Controls:** a large round pink TAP! button with a paw. The whole action area is the tap target, with multi-touch. Each tap gives a brief press-down animation and a light haptic. Above it, a speed meter of 8 bars fills green → yellow → pink with current speed.

**Feedback:** "Finish!" at the line. If the player stops tapping and the NPCs have finished, the hint changes to "Keep tapping to finish!".

**Event stat for results:** top tap speed (taps per second).

## 10. Build order

See Decisions. Fun Run, Hurdles, Dock Dive, and Obstacle Course are playable. Solo reports go through `race_report`. Live open races are shipped (section 5). Next: friend games (`docs/boop-boop-friend-games-addendum.md`).
