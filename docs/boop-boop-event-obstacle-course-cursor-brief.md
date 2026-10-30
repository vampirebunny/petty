# Cursor Brief: Obstacle Course

Builds on: Race Foundation brief + Addendum, Race Poses brief, and Hurdles brief. Read those first; this brief only adds what's specific to the Obstacle Course.

## Entry

- Type: **race** (ranked by finish time).
- Tricks needed: **Jump the Hurdle** and **Through the Tunnel**. Testing waives both: `waiveObstacleSkill` on the client and `20261029440000_obstacle_course.sql` on the server, which also puts an Obstacle Course card in every open slot next to Hurdles. Restore both before launch and use the launch schedule in `20261029430000_schedule_ship_roster.sql`.
- The hardest event; best suited to Open class and up, but open to every class. Races by level class like Hurdles.
- The phone opens `ObstacleScreen`; the rules live in `race-sim/obstacle.ts`.
  - `20261029440000_obstacle_course.sql` runs Obstacle races through the same lock, countdown, and start as Fun Run and Hurdles.
  - `20261029460000_obstacle_long_course.sql` stamps them `obstacle-2` and waits 140 s (instead of 80 s) before marking unreported racers DNF.
  - `20261029470000_obstacle_tap_drive.sql` stamps `obstacle-3`: keep tapping RUN for speed (no pink sprint stretches).
  - `20261029480000_obstacle_tight_gaps.sql` stamps `obstacle-4`: about one in three gaps is a tight pack; NPCs a bit faster.
  - `20261029490000_obstacle_faster_npcs.sql` stamps `obstacle-5`: NPCs at 1.26×–1.40× class speed so they stay close to a tapping player.
  - `20261029500000_obstacle_npc_pace.sql` stamps `obstacle-6`: NPCs cruise near the RUN top speed and misses cost about a second, so mashing RUN through every obstacle finishes last. Deploy `race_report` first.
  - `20261029510000_obstacle_steady_npcs.sql` stamps `obstacle-7`: same miss costs, slower NPCs, so a clean run at about 4 RUN taps a second wins. Deploy `race_report` first.
- Older stamps stay frozen for races already created with them.

## How it plays

A long course of hurdles and tunnels, in an order set by the race seed:
- **RUN:** keep tapping the big pink pad for speed (Fun Run physics for the whole race). There are no pink sprint stretches on the track.
- **Hurdle:** tap **JUMP** in the zone before the hurdle (Hurdles rules).
- **Tunnel:** tap **DUCK** in the zone before the tunnel mouth. The pet drops into the tunnel crawl and stays low through the tube.

Using the wrong button for an obstacle counts as a miss. Without RUN taps the pet crawls.

## Start and finish

Exactly like Fun Run and Hurdles: every pet lines up with its toes on the start line, the shared countdown plays (Get ready!, 3, 2, 1, Go!), and taps before Go! are ignored. The finish is the course's `distanceM`. The camera stops before the line and pets use the shared coast to run off the right side.

## Rules (defaults, all config, `obstacle-7`)

| Class | Base speed | Hurdles | Tunnels | Zone half-width | Gap (class) |
| --- | --- | --- | --- | --- | --- |
| Beginner | 6.0 m/s | 10 | 5 | 1.0 m | 9 m |
| Novice | 6.5 m/s | 12 | 6 | 0.9 m | 8 m |
| Open (and Veteran Cup) | 7.0 m/s | 16 | 10 | 0.8 m | 7 m |
| Expert | 7.5 m/s | 19 | 11 | 0.7 m | 6.5 m |
| Championship | 8.0 m/s | 23 | 14 | 0.6 m | 6 m |

- **Layout** (`obstacleCourse(classId, version, raceSeed)` returns `{ sections, obstacles, distanceM }`):
  - The seed shuffles the hurdles and tunnels. No sprint sections.
  - The first obstacle's zone starts at 12 m. About **one in three** gaps is tight (0.22×–0.48× the class gap); the rest are roomy (0.9×–2.15×).
  - The finish is 10 m after the last obstacle.
  - **Speed:** player RUN taps use Fun Run physics for the whole course (tap cap 20/s, fade without taps toward 20% of class speed). Pace follows tap rate: a clean Beginner run takes about 107 s at 1 tap a second, 58 s at 2, 39 s at 3, 29 s at 4, and 24 s at 6.
  - **NPCs** cruise at a per-class speed: Beginner 6.4–8.2, Novice 6.8–8.6, Open 7.2–9.0, Expert 7.6–9.4, Championship 8.0–9.8 m/s (`obstacle-6` ran 9.2–11). They miss 2%–10% of obstacles (by skill). A clean run at about 4 RUN taps a second beats most of the field; 6 taps a second wins.
  - Each section has `start` (zone start), `at` (hurdle or tunnel mouth), and `end` (nominal landing or tunnel exit).
- **Zones are hidden**, as in Hurdles. Players judge from the hurdle and the tunnel mouth.
- **Which obstacle a tap is for:** JUMP and DUCK always count toward the next obstacle, but only on open ground. Taps while the front paws are inside an obstacle's body (`at` to `end`: in the air past a bar, or inside a tunnel) are ignored.
- **Hurdle:** Hurdles rules. The zone is centered 2.25 m before the bar, the air distance is 4.5 m, and taps while airborne are ignored. A Perfect (inner 35%) gives +5% speed for 0.5 s. A clip tips the hurdle and gives 15% speed for 1.1 s, then a 0.4 s recovery. An early jump that lands before the bar can be followed by another jump.
- **Tunnel** (4 m long): the zone is centered 1.2 m before the mouth.
  - **DUCK** commits to a low run for 1.2 m + the zone half-width (after agility) + 0.3 m. Any duck started in the zone is still low at the mouth. Taps while ducking are ignored.
  - **Clean** (duck started in the zone): Perfect or Nice by the same 35% rule, and the pet stays low until the exit.
  - **Miss**: no duck, a duck from outside the zone, a duck that stands up before the mouth, or a JUMP. The pet bonks the mouth (stumble visual, the tunnel wobbles), slows to 15% for 1.1 s, crawls through at 30%, and recovers over 0.4 s after the exit.
  - Because an early duck loses the tunnel, mashing DUCK can't clear one.
- **Wrong buttons:** DUCK before a hurdle loses that hurdle (the pet ducks, then clips). JUMP before a tunnel makes a short 1.5 m hop and loses the tunnel.
- Max race length 120 s (the server waits 140 s before marking a racer DNF). Mashing RUN at 12 taps a second while missing every obstacle takes about 42 s on Beginner and 92 s on Championship, behind the whole field. A pet with very few RUN taps can run out of time.

## Controls and layout

- Top bar: event name, an obstacle counter pill (cleared so far / total), timer. Mini track as in the other races.
- **Left, stacked:** **JUMP** (mint, up arrow) on top, **DUCK** (lavender, down arrow) below.
- **Right:** a large round **RUN** pad (pink, paw). Keep tapping it for speed.
- Each button is its own tap target, with per-touch tracking, so both thumbs work at once. All read **Wait** until Go!.
- Cue (no banners): JUMP or DUCK for the next obstacle glows. RUN does not cue.
- The track draws at the Hurdles scale (`racePoses.hurdlesLegsPerMeter`, 3 leg lengths per meter), passed to `stepRaceRun`, `raceAirPx`, and `drawRaceTrack`, with the default background parallax. The ground, legs, crowd, and wall all move together, as in Hurdles. A retriever sees about 4 m ahead. A slower zoom (1.5) gave about 8 m of look-ahead, but the ground and legs looked too slow.
- Haptics: light on jump and duck, medium on a miss. Sounds: clear chime (higher for Perfect), soft thud on a miss. No sound on the jump or duck tap.

## Tunnel look

- The tunnel is the Training School fabric tunnel (`drawTrickProp`, type `tunnel`, dog or cat palette), scaled with the lane's pet and stretched along the track to 4 m. The back pass draws behind the pet and the front pass over it, so the pet shows only at the mouths.
- **Duck pose** reuses the Through the Tunnel trick's crawl: `applyRaceDuck` blends the same pose channels `trickPlay` sets inside the tube (`stalk`, `crouch`, `headDown` 0.9, `earBack`). It eases in over 0.1 s at the tap and out over 0.15 s after standing up.
- Bonk: the stumble visual, with the tunnel mouth wobbling. The pet crawls low through the tube afterwards.

## Feedback

- Pop-up words as in Hurdles ("Perfect!", "Nice!", "Oops!").
- Under the track: one marker per obstacle, by type (hurdle bar or tunnel arch), filled when cleared, ✕ when missed. Past 12 obstacles the markers shrink and wrap onto a second row.

## Pet modifiers (inside the ±10% cap)

- **Agility** widens hurdle and tunnel zones, up to +10%.
- **Mood** up to +3% base speed.
- **Energy:** low energy shortens the Perfect boost (Hurdles rule).

## NPCs

- Per-obstacle miss and Perfect chances from skill, as Hurdles (tunnels use the same numbers). A missing NPC jumps or ducks too early.
- NPC base speed is drawn from the class band above with the NPC's seed (`obstacle-5` used class speed × 1.26–1.40).

## Sim, input log and server check

- Input log: tap times in ms from Go!, with the button (`jump`, `duck`, or `run`).
- The sim decides every outcome from the input log, so a replay reproduces it exactly. The phone reports finish times, as in Hurdles.
- The course comes from config, class, and the race seed, so every phone and the replay build the same course.
- RUN is tapped for the whole race, so the server accepts up to 6,000 inputs and 200 KB per log (`MAX_INPUTS`, `REPLAY_MAX_INPUT_BYTES` in `replay.ts`).
- `race_report` refuses (409) an Obstacle race whose config version its bundle doesn't know (`isObstacleVersion`). Otherwise it would replay with the default rules and write times that don't match the phone. **Every new `obstacle-N` needs `race_report` redeployed before the stamp migration is applied.**

## Results

- Event stat: "Obstacles 34/37 · Perfect 12".

## Done when

- The course order differs between races but is the same for everyone in one race.
- A player who keeps tapping RUN and hits JUMP/DUCK on time can run a clean Beginner course on the first try, and that run beats most NPCs.
- Wrong-button taps count as misses, and mashing DUCK doesn't clear tunnels.
