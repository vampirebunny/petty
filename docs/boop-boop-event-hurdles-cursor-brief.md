# Cursor Brief: Hurdles

Builds on: Race Foundation brief + Addendum, Race Poses brief (leap, stumble). Read those first; this brief only adds what's specific to Hurdles.

Visual reference: Stadium canvas, screen 7 (Hurdles). Feel reference: `race-demo.html` (Hurdles mode).

## Entry

- Type: **race** (ranked by finish time).
- Trick needed: **Jump the Hurdle** (dogs and cats; the cat catalog needs this trick). Testing waives this: `waiveHurdleSkill` on the client and `20261029390000_test_hurdles_every_slot.sql` on the server. Restore both before launch.
- `20261029400000_start_hurdle_races.sql` runs Hurdles through the same lock, countdown, and start as Fun Run. The phone opens `HurdlesScreen`; the rules live in `race-sim/hurdles.ts` (`hurdles-3`; `hurdles-1` and `hurdles-2` are kept frozen). Races the server stamped `funrun-1` fall back to the current version. Obstacle Course is the remaining unbuilt ship event and still shows "Race coming soon". Sniff Out, Trick Show, and Weave are cancelled.

## How it plays

The pet runs on its own at the class speed. The player taps **JUMP** when the pet reaches the jump zone just in front of each hurdle. The zone is not drawn; players judge it from the hurdle. A good jump clears it. A miss clips the hurdle: it tips over and the pet stumbles and slows down for a moment. First across the line wins.

## Rules (defaults, all config)

| Class | Run speed | Hurdles | Gaps | Shortest gap | Zone half-width | Perfect share |
| --- | --- | --- | --- | --- | --- | --- |
| Beginner | 6.0 m/s | 6 | even | 15 m (2.5 s) | 1.0 m | inner 35% |
| Novice | 6.75 m/s | 7 | even | 12.5 m (1.85 s) | 0.9 m | inner 35% |
| Open (and Veteran Cup) | 7.5 m/s | 8 | varied, up to 1.5× | 10.7 m (1.43 s) | 0.8 m | inner 35% |
| Expert | 8.25 m/s | 9 | varied, up to 1.5× | 9.4 m (1.14 s) | 0.7 m | inner 35% |
| Championship | 9.0 m/s | 10 | varied, up to 1.5× | 8.3 m (0.93 s) | 0.6 m | inner 35% |

- First hurdle at 15 m. The finish is 10 m after the last hurdle.
- **Beginner and Novice:** hurdles evenly spaced from 15 m to 90 m, so the track is 100 m.
- **Open, Veteran Cup, Expert, Championship (`gapSpread` 1.5):** each gap is drawn from the race seed, between the even gap (the shortest gap in the table) and 1.5× it. Gaps are never shorter than the even course's, so the course grows to fit: 100 to 137.5 m, about 119 m on average. Races run about 20% longer on average.
- `hurdleCourse(classId, version, raceSeed)` returns `{ hurdles, distanceM }`. The sim, NPC plans, camera lock, coast, and mini track all use the course's `distanceM`, not the config's.
- Older versions: `hurdles-1` was 80 m with even hurdles from 12 m to 72 m; `hurdles-2` was the even 100 m course in every class.
- **Jump zone:** centered 2.25 m before each hurdle, measured at the pet's front paws.
- **Air distance** is always 4.5 m, so air time = 4.5 m ÷ run speed, and a jump from the zone center passes the hurdle at mid-air. A jump started anywhere in the zone clears the hurdle.
- **One jump at a time:** taps while airborne are ignored (not queued).
- **Outcomes per hurdle**, decided when the pet's front paws reach the hurdle:
  - **Perfect** (jump started in the zone's inner 35%): clears, plus a small speed boost (+5% for 0.5 s).
  - **Good** (rest of the zone): clears.
  - **Clip** (no jump, or the jump started outside the zone): the hurdle tips over, the stumble pose plays, and speed drops to 50% for 0.7 s, then recovers over 0.3 s.
- A jump started too early still leaves the ground but lands before the hurdle, which counts as a clip.
- Max race length 60 s (the longest course takes about 18 s at Open speed).

## Controls and layout

- Top bar: event name, a hurdle counter pill (cleared so far / total), timer.
- Track: own pet in the front lane; the jump zone is **hidden** to make timing harder (`zones: null`). `drawRaceTrack` can still draw it as a dashed mint band in the player's lane if it comes back, for example for lower classes. Other lanes show their hurdles, which tip over when that racer clips (sent as an `ev` in the position updates).
- Hurdle art is the Training School hurdle (`drawTrickProp`, dog or cat palette), scaled with the lane's pet. The bar height is fitted to each pet the same way the school fits it (`fitBarZ`), and the far half of the pole draws behind the pet, the near half in front. `raceHurdleSize` sets the leap height so the feet clear that bar with the jump margin even from the edge of the zone; the lift is a parabola (`leapLift`, 4u(1 − u)), and the peak is at least 0.3 × the leap's ground length so a long leap reads as a long, high arc.
- The track draws at `racePoses.hurdlesLegsPerMeter` (3 leg lengths per meter), passed to `stepRaceRun` and `drawRaceTrack`. Fun Run's ground is faster (`funRunScroll` 3, so 4.5). Feet still match the ground, and hurdles and leaps spread out with the Hurdles scale.
- A clipped hurdle tumbles: it tips forward about its base to about 86° over 0.32 s, bounces back 9° over 0.22 s, and slides forward a little, then lies there. The sim records when each hurdle was judged (`outcomeMs`), so the tumble starts at the bump. Reduced motion shows it already down.
- Start uses the shared race countdown and input lock (Get ready!, 3, 2, 1, Go!, the same beep and haptics). The button reads **Wait** until Go!, then one large mint **JUMP!** pill with an up arrow. Jumps before Go! are ignored. **The whole action area is the tap target.** Hint line after Go!: "Jump just before [pet] reaches each hurdle".
- The finish line is the course's `distanceM` (100 m, or longer on a varied course), and that distance drives the camera lock. After the line, pets use the shared coast and run off the right side. A jump still in the air at the line finishes (landing and recovery), then the pet gallops off.
- Haptic: light on jump, medium on clip.

## Feedback

- Pop-up words near the pet: "Perfect!" or "Nice!" on a clear, "Oops!" on a clip. No banners.
- Under the track: a row of dots, one per hurdle, filled mint for a clear and an ✕ for a clip.
- Sounds: jump boing, clear chime (higher for Perfect), soft thud on a clip. No hurt sounds.

## Poses

- Jump = **leap** via `raceLeapVisual` (Race Poses brief, section 2). The tap is the take-off; no crouch.
- Clip = **stumble** visual (Race Poses brief, section 3), synced to the 0.7 s slowdown.

## Pet modifiers (inside the ±10% cap)

- **Agility** widens the zone, up to +10% at full agility.
- **Mood** adds up to +3% to run speed.
- **Energy:** low energy shortens the Perfect boost.

## NPCs

From the NPC skill (0–1), per hurdle, drawn from the race seed:
- Clip chance = lerp(clipMax, clipMin, skill): Beginner 35%→10%, Novice 30%→8%, Open 25%→6%, Expert 20%→5%, Championship 15%→3%.
- Perfect chance (when not clipping) = lerp(20%, 60%, skill).
- NPC run speed = class speed × (0.97–1.03 from the seed).

## Sim, input log and server check

- Input log: jump tap times in ms from GO.
- The sim decides every outcome (zone, perfect, clip) from the tap times, so the server replay reproduces them exactly.
- Hurdle positions come from config, class, and the race seed (not each racer's seed), so all racers in a race and the replay see the same course.

## Results

- Event stat: "Clean jumps 7/8 · Perfect 4".
- Badges: none new in this brief.

## Done when

- A Beginner player who taps in the zone every time beats most NPCs; one who never taps finishes last.
- Clipped hurdles tip over in every lane where they were clipped, for live races too.
- Leap and stumble look right on the real pet across breeds and outfits.
