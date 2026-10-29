# Cursor Brief: Race Foundation (+ Fun Run)

## Goal

Build the shared engine every Stadium competition runs on: the race screen, start and finish, multiplayer sync, server checking, NPC pets, rewards, and the race scene. Then build **Fun Run** on top of it as the first working event. Later briefs add one event at a time (Hurdles, Weave, Obstacle Course, Dock Dive, Sniff Out, Trick Show) and should only need event-specific rules, controls and drawing.

This brief picks up where the Stadium brief ends: the starting gate hands off the race id and final line-up (live players plus NPCs, if any).

## Decisions

These override the sections below. The old addendum is folded in here.

**Schedule.** Every 5-minute slot shows three events: Fun Run, plus two from Dock Dive, Sniff Out, Trick Show, Hurdles, Weave, and Obstacle Course. Every slot includes at least one no-trick event besides Fun Run (Dock Dive or Sniff Out). Events that are not built yet still appear and end on the "Race coming soon" screen. Fun Run is the first playable event.

**Veteran Cup.** A fourth card, shown only to senior pets, in every third slot (every 15 minutes, on :00, :15, :30, and :45). It does not replace a regular race. The event rotates through all seven and leans toward Fun Run, Dock Dive, and Sniff Out. Seniors of every level race together on Open class settings. It has its own trophy, which waits for the trophies brief. The usual trick check still applies.

**Classes.** Beginner, Novice, Open, Expert, and Championship, plus Veteran Cup. A pet always races in its highest class. At gate open (start − 60 s), neighboring classes merge into the lower class when one race has a single live player and the combined field fits in capacity. The switch defaults on. If withdrawals then leave one player, that player gets NPCs at the start.

**Lifecycle.** `open` → `locked` (start − 10 s) → `countdown` (start − 3 s) → `running` → `finished` or `cancelled`. Each race stores `seed` and `config_version`. The rest is 6 minutes per event (`stadium_config.cooldown_seconds`), counted from the race start and set when results are written. It only blocks races of that event that start before the rest ends, so the next slot is usually out and the one after is open. Withdrawals, no-shows, and cancelled races do not start one. A running race that nobody reports within start + 80 s is finalized with those players as DNF, so a closed app never leaves a stale entry. One active sign-up per pet still applies. The ticket does not show a lane.

**Results.** Solo: the phone reports its own finish time and the NPC times it simulated, and the server stores and ranks them. Once the replay Edge Function exists, the server recomputes both from the seed. Live: publish when every live player has reported, or 10 seconds after the first report. Anyone missing is DNF. Phones show provisional standings until the server ranking arrives.

**Rewards.** The server never writes the pet document. It writes placings. The phone applies XP, a ribbon log (`raceId`, event, class, place, date), energy, and badges once per race id. Race XP is capped at 8 races a day and is skipped below level 10. Ribbons are still awarded then. "Race in the Stadium" is a tutorial goal that completes when the pet finishes a race. Badges: First Race (id `off-to-the-races`), Blue Ribbon, Moving Up, Ribbon Rack (5 / 25 / 100). Furniture waits.

**Modifiers and config.** At lock, the server snapshots energy, mood, and attributes from the pet's last synced document. Config versions are immutable. Each race keeps the version it was created with.

**Code.** Race rules live in `supabase/functions/_shared/race-sim/`. Solo races ship before the replay Edge Function. Live races need that function and Realtime sync, which are later. The track scrolls with parallax and uses the shared sky and weather. The running, leap, and stumble poses are the existing pet rig (`docs/boop-boop-race-poses-cursor-brief.md`). Fun Run has no hurdles, so the leap and the stumble are checked from the dev preview on the race screen.

**Build order.** (1) sim and config, (2) race screen and scene, (3) NPCs and solo Fun Run, (4) scene polish, (5) server replay Edge Function, an owner deploy, (6) live races.

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

| Event | Tricks needed to enter | Type |
| --- | --- | --- |
| Fun Run | none | race |
| Dock Dive | none | distance |
| Sniff Out | none | rounds |
| Trick Show | Sit, Speak, Spin, Stand | rounds |
| Hurdles | Jump the Hurdle | race |
| Weave | Weave | race |
| Obstacle Course | Jump the Hurdle + Through the Tunnel | race |

- All events are open to dogs and cats. The cat trick catalog in the Training School must get Jump the Hurdle, Weave and Through the Tunnel so cats can qualify.
- The trick check runs server-side at sign-up, as in the Stadium brief.
- The engine supports three event types. **Race:** first to the finish line, ranked by time. **Distance:** best attempt wins. **Rounds:** last pet standing or best score. This brief builds the race type fully. The other two only need the hooks: results ranking by score instead of time, and a round-sync message (section 5).

## 2. Race lifecycle

States: `gate → countdown → running → finishing → results`.

- The server stores `start_at`, the moment of "Go!". The starting gate hands off to the race screen on the clock at `start_at − 5 s` (`countdownMs`), using the latest line-up it has, and never waits on a network reply. The race screen keeps fetching the line-up until the race is running.
- **Screen opens:** every racer stands still behind the start line for about a second.
- **Countdown:** "Get ready!" (start − 4 s), 3, 2, 1, then "Go!" at the start, one second each, with a haptic on 3, 2, 1 and Go!. It runs on every phone against **server time** (using the clock offset from the Stadium brief), so everyone says Go! at the same moment whatever their own phone clock says.
- **Tap button:** visibly inactive (grey, dashed, faded, "Wait") until Go!. Taps before Go! are ignored. There are no false starts or disqualifications.
- **Running:** race time `t = 0` at Go!. The player's taps and every NPC start at the same moment.
- **Finishing:** the player has crossed the line. Show "Finish!", stop input, and keep drawing other pets until everyone finishes or a short wait passes (default 3 s).
- **Results:** shown when the server publishes results (section 6), or after a fallback timeout with "Waiting for results…".
- **Max race length** is per event (default 60 s for races). A pet that hasn't finished by then is marked DNF (did not finish).

## 3. Race screen layout

Top to bottom (canvas screens 6–7):
1. **Top bar:** event name, timer (m:ss.t), plus event pills where needed (e.g. hurdle count).
2. **Mini progress track:** a line with a finish flag and one avatar dot per racer, with the player's own dot ringed. It shows everyone, including racers off-camera.
3. **Track scene** (section 4).
4. **Action area:** the event's control(s), large and glossy, plus one hint line. For tap events, **the whole action area responds to touch**, not just the button graphic. Support multi-touch (two thumbs).

The camera follows the player's own pet, which sits about a third of the way from the left. Other pets move ahead of or behind it.

## 4. Track scene

- Build it as a **scene in the existing scene system** (like the park and living room) so it gets the shared sky, time of day, sun/moon with moon phases, weather, seasonal touches and wind.
- **Each phone uses its own local time and weather**, matching that player's other rooms. Weather and time are **cosmetic only** and never change gameplay, so players in different places race on equal terms.
- Night, dusk and evening: stadium lights on, with soft beams. Rain or snow: particles and the wet/snowy treatment used elsewhere, drawn behind the racers so they never hide the pet, hurdles or jump zones.
- Away events (Paris etc.) use their own location scene with the same rules.
- Scene layers: sky, stands with a crowd bobbing (cheers harder during the race), pink wall band, track with dashed lane lines and pebbles, a white start line with a green flag just past the player's nose at 0 m, distance marks every 10 m, and a checkered finish line. Start, distance and finish lines are drawn on the track, under the pets.
- Parallax: the crowd scrolls slowly, the wall a bit faster, and the track at full speed.
- **Ground speed follows the player's pet:** screen pixels per meter = the pet's drawn leg length × `racePoses.legsPerMeter` (1.5). Paws stay planted and every breed gets the same stride rate (about 3.8 Hz trot, 3.3 Hz gallop at top speed). The gallop reads faster than the trot mainly because the ground scrolls over four times faster.
- The track stage has a fixed height (240–320 pt by screen width) so the action area keeps its space.

**Lanes**
- **The player's own pet is always in the front (bottom) lane, drawn largest.** Every phone draws itself this way; lane order is visual only.
- The front lane takes the bottom half of the track. Other racers fill the back lanes in the top half at about 60% of the player's size, drawn far to near. Up to 5 back lanes, compressed to fit. A racer off-screen shows as a small arrow at the edge of its lane.
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
- **Inputs are timestamped** in ms from GO! and applied on the step they fall in.

**Live sync (Supabase Realtime)**
- One broadcast channel per race: `race:{raceId}`.
- About 10 times a second, each phone sends `{ petId, t, x, v, air, ev }`: race time, distance, speed, airborne flag, and any event such as "clipped hurdle 3".
- Other pets are drawn about 120 ms behind and smoothed between updates, so they glide instead of jumping. A slow connection only makes *other* pets look slightly behind; it never changes the player's own race or results.
- **Rounds-type events** (Sniff Out, Trick Show) also use the channel for server-sent round messages: the same pattern or shuffle at the same server time for everyone, with answers sent back with timestamps. The hooks go in now; the details come with those event briefs.

**NPCs are never sent over the network.** NPCs only appear in solo races (Stadium brief), so the player's phone simulates them from the race seed.

**Disconnects and backgrounding**
- The phone always finishes its own race locally. If the connection drops, it keeps running and queues its final report, retrying when the connection returns.
- If another racer's updates stop for over 3 s, freeze their pet and dim their name tag ("Reconnecting"). When updates resume, they jump to the new position.
- If the app goes to the background mid-race, the race clock keeps running; the pet just gets no input, slowing in Fun Run or clipping in Hurdles. On return, continue.
- If the server never gets a report by max race length + 20 s, the player is marked DNF.

## 6. Results and server check

When a player finishes (or hits max length), the phone sends one report to an Edge Function: `{ raceId, petId, inputLog, claimedFinishMs }`. Inputs are tap times for Fun Run; later events add jump, duck, hold and release times.

The server:
1. **Replays the race** with `race/sim`, using the stored seed, config and that pet's modifiers.
2. **Applies the tap cap:** taps beyond 20 in any rolling second are dropped (the phone drops them too, so honest players never notice).
3. **Flags bot-like input:** e.g. very evenly spaced taps (low variation over long runs) or impossible patterns. Flagged runs are kept for review. Start by logging only, with no automatic penalty.
4. **Uses the replayed finish time,** not the claimed one. Log differences larger than a small tolerance.
5. **Ranks** by finish time (race type), with DNFs last. Ties are broken by the earlier-replayed exact ms.
6. **Writes the results** and broadcasts them on the race channel. Each phone shows the results screen.

**Rewards** (server-side, on results):
- **XP to the pet:** entered 20, 3rd 40, 2nd 60, 1st 100 (existing values). In a race with fewer than 3 live players plus no NPCs, places still pay normally.
- **Ribbons to the pet:** 1st blue, 2nd red, 3rd yellow. Store them as the pet's items for the ribbons and trophies display (trophies are a later brief).
- **Energy:** lowers like normal play (default −8, config).
- **Rest:** 6 minutes per event from the race start. Only that event's races starting before the rest ends are blocked.

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

The pet's stats should matter, but **the player's skill should matter more.** All pet-based modifiers combined stay within **±10%** of the event's base performance (config).

Computed once at GO! from the pet's current values, then fixed for the race:

| Input | Effect (Fun Run) | Notes for later events |
| --- | --- | --- |
| Stamina | How much late-race tap power fades | Weave rhythm forgiveness, Dock Dive charge hold |
| Agility | (no effect) | Hurdles and Obstacle Course zone width, Weave timing window |
| Intelligence | (no effect) | Trick Show demo pace or one free mistake, Sniff Out shuffle readability |
| Energy | Low energy adds extra late-race fade | All races, small |
| Mood | Top speed up to +5% at high mood | All events, small |

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
- **Once launched,** NPC skill should come from real players' finish times for that event and class (an NPC at skill 0.6 is as fast as the 60th-percentile real player). Before there's data, use the config ranges.
- **No rubber-banding:** NPCs never react to the player's position.
- NPCs use the app's NPC pet looks and the same renderer and animations as real pets.
- **Tuning target:** an average solo player wins about 1 race in 3 and places top 3 most of the time. Log solo results per event and class so the spread can be tuned in config.

## 9. Fun Run (first event)

**How it plays:** tap as fast as you can. Each tap pushes the pet forward, and speed drains away when tapping stops.

**Rules (defaults, all config):**
- Distance: 70 m
- Each tap adds 2.1 m/s of speed, up to a top speed of 11 m/s
- Speed fades without taps at 1.3 per second (`v *= e^(−1.3·dt)`)
- Stamina fade: from 60% of the distance onward, tap power falls by up to 15% at the line, reduced by stamina and increased by low energy
- Tap cap: 20 taps per rolling second; extra taps are ignored
- Max race length: 60 s

**Class ranges (NPC target speeds; the player's limit is the same everywhere):**

| Class | Opens at | NPC speed range |
| --- | --- | --- |
| Beginner | level 1 | 5.3–6.1 m/s |
| Novice | level 10 | 6.1–6.9 m/s |
| Open | level 20 | 6.9–7.6 m/s |
| Expert | level 35 | 7.6–8.4 m/s |
| Championship | level 50 | 8.4–9.1 m/s |
| Veteran Cup | senior pets | Open settings |

About 4 taps per second keeps pace with a Beginner NPC. About 8 taps per second holds top speed. The player's top speed is the same in every class.

**Controls:** a large round pink TAP! button with a paw. The whole action area is the tap target, with multi-touch. Each tap gives a brief press-down animation and a light haptic. Above it, a speed meter of 8 bars fills green → yellow → pink with current speed.

**Feedback:** "Finish!" at the line. If the player stops tapping and the NPCs have finished, the hint changes to "Keep tapping to finish!".

**Event stat for results:** top tap speed (taps per second).

## 10. Build order

See Decisions. The next brief is Hurdles, which adds obstacles, jump zones, and the Hurdles results stat on this foundation.
