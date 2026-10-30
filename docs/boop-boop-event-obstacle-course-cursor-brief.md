# Cursor Brief: Obstacle Course

Builds on: Race Foundation brief + Addendum, Race Poses brief, and Hurdles brief. Read those first; this brief only adds what's specific to the Obstacle Course.

## Entry

- Type: **race** (ranked by finish time).
- Tricks needed: **Jump the Hurdle** and **Through the Tunnel**. Testing waives both: `waiveObstacleSkill` on the client and `20261029440000_obstacle_course.sql` on the server, which also puts an Obstacle Course card in every open slot next to Hurdles. Restore both before launch and use the launch schedule in `20261029430000_schedule_ship_roster.sql`.
- The hardest event; best suited to Open class and up, but open to every class. Races by level class like Hurdles.
- The phone opens `ObstacleScreen`; the rules live in `race-sim/obstacle.ts`.
  - `20261029440000_obstacle_course.sql` runs Obstacle races through the same lock, countdown, and start as Fun Run and Hurdles.
  - `20261029450000_obstacle_long_course.sql` stamps them `obstacle-2` and waits 140 s (instead of 80 s) before marking unreported racers DNF.
- `obstacle-1` (shorter course with pink sprint stretches) is kept frozen for races already stamped with it.

## How it plays

A long course of hurdles and tunnels, in an order set by the race seed:
- **Hurdle:** tap **JUMP** in the zone before the hurdle (Hurdles rules).
- **Tunnel:** tap **DUCK** in the zone before the tunnel mouth. The pet drops into the tunnel crawl and stays low through the tube.

Between obstacles the pet runs on its own at the class speed. Using the wrong button for an obstacle counts as a miss.

## Start and finish

Exactly like Fun Run and Hurdles: every pet lines up with its toes on the start line, the shared countdown plays (Get ready!, 3, 2, 1, Go!), and taps before Go! are ignored. The finish is the course's `distanceM`. The camera stops before the line and pets use the shared coast to run off the right side.

## Rules (defaults, all config, `obstacle-2`)

| Class | Base speed | Hurdles | Tunnels | Zone half-width | Gap | Course length | Clean run |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Beginner | 6.0 m/s | 10 | 5 | 1.0 m | 9 m | 245 to 262 m | about 42 s |
| Novice | 6.5 m/s | 12 | 6 | 0.9 m | 8 m | 275 to 290 m | about 43 s |
| Open (and Veteran Cup) | 7.0 m/s | 16 | 10 | 0.8 m | 7 m | 361 to 377 m | about 52 s |
| Expert | 7.5 m/s | 19 | 11 | 0.7 m | 6.5 m | 396 to 413 m | about 53 s |
| Championship | 8.0 m/s | 23 | 14 | 0.6 m | 6 m | 463 to 479 m | about 58 s |

- **Layout** (`obstacleCourse(classId, version, raceSeed)` returns `{ sections, obstacles, distanceM }`):
  - The seed shuffles the hurdles and tunnels.
  - The first obstacle's zone starts at 12 m. Each gap of clear ground (from one obstacle's end to the next zone) is drawn from the seed between the class gap and 1.3× it.
  - The finish is 10 m after the last obstacle.
  - Each section has `start` (zone start), `at` (hurdle or tunnel mouth), and `end` (nominal landing or tunnel exit).
- **Zones are hidden**, as in Hurdles. Players judge from the hurdle and the tunnel mouth.
- **Which obstacle a tap is for:** JUMP and DUCK always count toward the next obstacle, but only on open ground. Taps while the front paws are inside an obstacle's body (`at` to `end`: in the air past a bar, or inside a tunnel) are ignored.
- **Hurdle:** Hurdles rules. The zone is centered 2.25 m before the bar, the air distance is 4.5 m, and taps while airborne are ignored. A Perfect (inner 35%) gives +5% speed for 0.5 s. A clip tips the hurdle and gives 50% speed for 0.7 s, then a 0.3 s recovery. An early jump that lands before the bar can be followed by another jump.
- **Tunnel** (4 m long): the zone is centered 1.2 m before the mouth.
  - **DUCK** commits to a low run for 1.2 m + the zone half-width (after agility) + 0.3 m. Any duck started in the zone is still low at the mouth. Taps while ducking are ignored.
  - **Clean** (duck started in the zone): Perfect or Nice by the same 35% rule, and the pet stays low until the exit.
  - **Miss**: no duck, a duck from outside the zone, a duck that stands up before the mouth, or a JUMP. The pet bonks the mouth (stumble visual, the tunnel wobbles), slows to 50% for 0.7 s, crawls through at 60%, and recovers over 0.3 s after the exit.
  - Because an early duck loses the tunnel, mashing DUCK can't clear one.
- **Wrong buttons:** DUCK before a hurdle loses that hurdle (the pet ducks, then clips). JUMP before a tunnel makes a short 1.5 m hop and loses the tunnel.
- Max race length 120 s. A pet that misses everything still finishes in about 50 to 76 s.

## Controls and layout

- Top bar: event name, an obstacle counter pill (cleared so far / total), timer. Mini track as in the other races.
- Two big buttons side by side, in fixed positions so players learn them by feel: **JUMP** (mint, up arrow) under the left thumb and **DUCK** (lavender, down arrow) under the right.
- Each button is its own tap target, with per-touch tracking (as in `RaceAction`), so both thumbs work at once. Both read **Wait** until Go!.
- Cue (no banners): the button for the next obstacle glows.
- Haptics: light on jump and duck, medium on a miss. Sounds: jump boing, clear chime (higher for Perfect), soft thud on a miss.

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
- NPC base speed = class speed × (0.97–1.03 from the seed).

## Sim, input log and server check

- Input log: tap times in ms from Go!, with the button (`jump` or `duck`).
- The sim decides every outcome from the input log, so a replay reproduces it exactly. The phone reports finish times, as in Hurdles.
- The course comes from config, class, and the race seed, so every phone and the replay build the same course.

## Results

- Event stat: "Obstacles 34/37 · Perfect 12".

## Done when

- The course order differs between races but is the same for everyone in one race.
- A player who knows the two buttons can run a clean Beginner course on the first try, and a clean Beginner run beats most NPCs.
- Wrong-button taps count as misses, and mashing DUCK doesn't clear tunnels.
