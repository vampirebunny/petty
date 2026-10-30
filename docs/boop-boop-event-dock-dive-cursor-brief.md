# Cursor Brief: Dock Dive

Builds on: Race Foundation brief + Addendum, Race Poses brief (leap). This is the first **distance** event: no race to the line; the longest jump wins.

## Entry

- Type: **distance** (best of 3 attempts).
- Tricks needed: none. Open to every pet.
- Built: rules in `race-sim/dockDive.ts` (`dockdive-1`), screen `DockDiveScreen`, scene `ui/skia/dockDive.ts`. `20261029410000_dock_dive.sql` starts Dock Dive like Hurdles (NPCs at lock for a solo player), stamps new races `dockdive-1`, stores `score_dm` and `detail` on each entry, and ranks by distance. Races stamped `funrun-1` fall back to `dockdive-1`.

## How it plays

At GO, the pet starts running down a dock toward a pool on its own. The player **holds** the big button whenever they choose, and a **power meter** swings up and down while it's held. The player **releases** to jump. Two things decide the distance:
1. **Power:** where the meter is at release (the top of the swing is best).
2. **Take-off spot:** how close to the dock's edge the pet is at release (closer is better). Reaching the edge without having released means the pet tumbles off the end in a belly flop, which scores very little.

The skill is timing the hold so the meter peaks just as the pet reaches the edge.

Each player gets 3 attempts; the best counts.

## Rules (defaults, all config)

| Class | Meter swing period | Edge bonus zone | Dock length |
| --- | --- | --- | --- |
| Beginner | 1.4 s | last 2.0 m | 12 m |
| Novice | 1.25 s | last 1.8 m | 12 m |
| Open (and Veteran Cup) | 1.1 s | last 1.6 m | 12 m |
| Expert | 0.95 s | last 1.4 m | 12 m |
| Championship | 0.8 s | last 1.2 m | 12 m |

- **Run-up (automatic):** from GO, the pet accelerates to 7 m/s over 1.5 s and reaches the dock edge at about 2.5 s, the same every attempt, so players can learn the rhythm.
- **Meter:** swings 0 → 1 → 0 continuously while held (eased, not linear), starting at 0 when the hold starts. It peaks half a period after the hold starts, so a player who starts holding about half a period before the edge peaks right at the edge. The curve is `0.5 − 0.5·cos(2π · held / period)`.
- **Distance (m)** = 2.0 + 6.0 × power^1.3 × spot, where:
  - `power` = meter value at release (0–1)
  - `spot` = 1.0 at the edge, falling linearly to 0.6 at the start of the edge zone. The same slope continues before the zone down to a 0.4 floor (half a zone-width before it), so leaving early costs distance steadily rather than in a step. Full power: 8.0 m at the edge, 5.6 m at the zone's start, 4.4 m on the floor.
- The run-up is identical for every pet: 7 m/s after 1.5 s, the edge on the first 60 Hz step at or past 12 m (about 2.46 s).
- **Belly flop:** reaching the edge without a release (whether holding or not): distance 1.0 m, with a splash and a sheepish shake.
- A release in the first 0.2 s of a hold is ignored (the meter is still near 0), so the pet keeps running; the player can hold again.
- Distances are measured to 0.1 m.

## Attempts and sync (distance-type events)

- 3 attempts. **Everyone attempts at the same moment:** an attempt window opens on server time, with "Attempt 1 of 3" in the top bar and a 3-2-1 countdown.
- Each attempt window is 6 s: up to 4 s of hold plus the flight, splash and swim back. A player who doesn't start holding in the window gets 0 for that attempt. In practice every attempt resolves at the edge: no release by then is a belly flop (1.0 m), held or not.
- Attempt 1 uses the shared race countdown, GO at the race start. Attempts 2 and 3 each get a 3 s 3-2-1 of their own (haptics, no beep clip), so their GOs are at +9 s and +18 s.
- After each attempt, all players' distances appear as flags on the distance ruler along the pool (own flag pink, others white, older attempts faded). Other racers' flags show 4.2 s into the attempt; your own on landing. Live players' jumps are sent as one result event each, not streamed, on the broadcast channel `race:{raceId}:dives` (the gate's presence channel on `race:{raceId}` may still be closing).
- Ranking: best distance; ties broken by second-best, then by who reached it first.

## Controls and layout

- **Scene:** a new location in the stadium, an outdoor pool with a wooden dock at the left, the water to the right, and a distance ruler along the far pool wall (0–10 m marks). The camera follows the pet from the dock out over the water. Same shared time and weather as the other scenes; rain falls on the water.
- **Scale:** the screen spans 9 m, and the pet's body is drawn 1.3 m long on the ruler (capped at 30% of the stage height), so a 6 m jump reads as several body lengths. Gait speed follows that scale, so paws stay planted.
- **Action area:** one large round button, "HOLD", with a paw. While held it reads "Let go!". The whole action area is the hold target.
- **Power meter:** a vertical gauge beside the button, with the top section marked as the sweet spot (butter yellow). The edge zone shows on the dock as a mint band.
- Top bar: event name, "Attempt 2 of 3", best so far.

## Poses

- Run-up: gallop (Race Poses brief), with the gait from speed.
- Jump: the **leap** visual, with a longer, flatter arc: air time from distance (about 0.8–1.3 s), a peak height of 1.2 body heights.
- Splash: water burst particles and ripples at the landing point, then the existing **swim** pose (`pose.swim`) back to the dock edge, where the pet hops out and shakes (`pose.shake`).
- Belly flop: a short low arc, a body-flat splash, the swim back, then a shake.

## Feedback

- On landing, the distance pops up over the splash ("6.4 m!"), larger on a new personal best.
- Sounds: footsteps on wood, a whoosh at take-off, a splash scaled to distance. Until those clips exist, the shared race clips stand in: the boing at take-off, the chime on landing (higher on a new best), the thud on a belly flop.
- Haptics: light on release, medium on landing, heavy on a belly flop.

## Pet modifiers (inside the ±10% cap)

- **Stamina** adds up to +5% to the distance at a full bar. It does not change the run-up: a faster run would move the edge and break the shared rhythm.
- **Mood** adds up to +5% to the distance, from mood 50 (none) to 100 (full).
- A belly flop is always 1.0 m.

## NPCs

- Each NPC's three distances are drawn from the seed: mean = lerp(class low, class high, skill), with ±0.6 m spread and a 10% chance of a belly flop per attempt.
- Class ranges for the mean: Beginner 3.5–5.5 m, Novice 4.0–6.0, Open and Veteran 4.5–6.5, Expert 5.0–7.0, Championship 5.5–7.5 m.
- NPCs are not drawn as pets. Only their flags show on the ruler. The phone computes all three jumps from the seed (`npcDives`) for the standings and reports them with its own result.

## Sim, input log and server check

- Input log per attempt: each hold start and release time (ms from the attempt's GO).
- The run-up is fixed, so the sim computes position, meter value and distance from those times, and the replay is exact. Inputs apply at the start of the 60 Hz step they fall in, and the live screen only runs steps that have finished, so live play matches the replay.
- Report: `finish_ms` is when the best jump left the dock (ms from the race start), `score_dm` the best distance in tenths, and `detail` holds `second_dm`, `best_attempt`, `attempts_m`, and `flops`. Ranking: `score_dm`, then `second_dm`, then `finish_ms`.

## Results

- Ranking by best distance. The event stat is "Best 6.4 m (attempt 2)".
- The results screen shows each racer's best jump.

## Done when

- Holding to the meter's top just before the edge gives the longest jumps; holding too long flops every time.
- All players' flags appear on the ruler after each attempt.
- Water, splash and swim back look right for dogs and cats.
