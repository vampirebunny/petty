# Acorn Attack Cursor Brief

Nov 3, 2026 · @A

## Overview and scope

Build Acorn Attack, an endless vertical shooter mini-game: the player's pet runs up a park lawn, fires lasers on its own, and the player steers it by dragging to boop squirrels and dodge acorns, rocks and logs. It levels up automatically as the pet runs; each level is a discrete step up in speed and danger, like Tetris. It sits in the Arcade's 2×2 grid with Cloud Hop, Paddle Paws, and Stay!. The lobby tile is the spotted squirrel in `docs/Acorn Attack Icon.html` (option A): an acorn-cap helmet on a striped lawn, looking up at a red laser dot.

**Reference prototype.** `docs/Acorn Attack.html` is the source of truth for feel, timing and art. Play it in a browser before writing code. Port its behavior and numbers, not its DOM or canvas code. Where this brief and the prototype differ, this brief wins. The differences are listed at the end of this section.

**In scope**

- Start card, run, pause card and results card
- Drag steering, auto-fire lasers, the four squirrel types, obstacles, pickups, power-ups
- Distance-based levels with the step table below
- Rendering the player's real pet (species, breed, coat color) in a back-view run cycle
- A Supabase leaderboard showing friends' best scores
- The game's entry in the Arcade list, with `AcornAttackIcon`

**Out of scope**

- No Boops or treat inventory changes. Points are only for the leaderboard; don't call the Boops ledger or inventory code.
- No cosmetics on the pet in this game.
- No boss. Bandit the raccoon is reserved for a future standalone game; don't port the raccoon code from the prototype.
- No joystick, no speed setting, no keyboard controls.
- No in-run banners, tooltips or coach marks.
- Pet age, attributes and training don't affect gameplay. Every pet plays the same; only its look changes.
- No energy cost, daily cap or IAP hooks.

**Stack.** Build it inside the existing Expo app with the same setup as the other mini-games: react-native-skia for drawing and a Reanimated frame callback for the loop. Keep game state in plain JS objects updated each frame, not React state.

**Differences from the prototype**

- Remove the Joystick and Speed options; drag at 1:1 is the only control.
- Remove the dog/cat picker; use the player's own pet.
- Remove the boss code (`spawnBoss`, `bossDown`, `drawRaccoon`, boss bar).
- Cats collect fish crackers instead of bone biscuits (see Power-ups and pickups).
- Remove the `window.__aaTest` debug hook.

## Screens and flow

The game runs portrait, full screen, with a fixed logical width of 400 units scaled to the device width. Height is whatever the screen gives (H). All numbers in this brief are in those logical units. On wide screens the play area stays a portrait column; see Wide screens and rotation.

1. **Start card** over the idle scene: the lawn scrolls slowly and the player's pet runs in place. The card shows the title, a one-line story ("The squirrels raided the park's treat stash. Chase them down and win it back!"), the four squirrels with the level each first appears, three how-to lines, a Play button and the friends leaderboard.
2. **Run.** HUD top row: pause button, three hearts, a Laser pill with four pips, a score pill. Second row under the hearts: a Level pill and a distance pill ("2,204 m"). Right side under the score: small status chips ("Shield on", "Magnet") while active.
3. **Pause** when the player taps pause or the app goes to the background. The card has Resume, a sound toggle and End run. End run goes straight to the results card.
4. **Game over** when hearts reach 0. The scene slows to a stop and the pet wobbles for 1.1 s, then the results card appears.
5. **Results card:** title ("New best!" if the score beats the player's best, else "Great run!" at level 6 or higher, else "Good run!"), the score, the player's best, a 2×2 stat grid (Level reached, Squirrels booped, Treats, Distance), Play again and Menu. Leave room under the buttons for a future cross-promotion button; don't build it now.

The score pill scales up briefly (about 0.25 s) whenever points are added. The Level pill does the same on level-up.

## Wide screens and rotation

The game never asks the player to rotate. It plays in whatever orientation the app is in: portrait on phones, and portrait or landscape on tablets once the app supports rotation there.

- **The play area is always a portrait column.** Column width = min(screen width, screen height × 0.62), centered horizontally, full height. The 400 logical units map to the column width, and H = column height ÷ scale. On phones in portrait the column is the whole screen.
- **Sides on wide screens:** keep scrolling the lawn (stripes and decoration) across the full screen width at the same speed, dimmed slightly (about 15% darker), with a soft shadow at the column edges. Squirrels, obstacles, pickups and the pet stay inside the column. Nothing playable ever appears in the sides.
- **HUD on wide screens:** when each side is at least 160 points wide, move the HUD out of the column: hearts, Laser pips and Level on the left side, score and distance on the right, with the pause button at the top left. Otherwise keep the normal in-column HUD.
- **Cards** (start, pause, results) center on the full screen at their normal max width.
- **Input:** a drag that starts anywhere on the screen, including the sides, steers the pet. Relative drag makes this work without any mapping.
- **Rotating mid-run** (tablets): pause the run, recompute the column and H, keep all game state (positions are in logical units; clamp the pet and anything below the new bottom edge), and show the pause card so the player resumes when ready.
- Never lock or request an orientation from this screen.

## Controls

Relative drag is the only control: the pet moves by exactly as much as the finger moves, from wherever the finger touches. The finger never needs to be on the pet, and the pet never jumps to the finger.

- Track one pointer at a time. On touch down, record the position. On each move, add (current − previous) to a pending delta and update previous. Ignore other fingers.
- Apply the pending delta once per frame, then clear it. Ratio is 1:1 in logical units; there is no speed setting.
- Split each frame's movement into steps of at most 10 units and resolve obstacle collisions after each step, so a fast swipe can't tunnel through a log.
- Clamp the pet to x in \[16, 384\] and y in \[0.3·H, H − 36\].
- When the pet hits a wall or obstacle it stops; reversing the finger moves it back right away. Lifting and touching elsewhere continues from where the pet is.
- Lean: the pet tilts toward its horizontal movement, up to 0.18 rad, eased at about 12/s.
- Fire is automatic; there is no fire button.

## World and obstacles

The lawn scrolls downward at the current ground speed, so the pet appears to run up the screen. Obstacles, pickups and lawn decoration ride the ground; squirrels and their acorns move on their own.

**Lawn.** Base `#7cc96b` with 96-unit mowed stripes of `#86d374`. Decoration is deterministic per 58-unit row (seeded hash), so it never pops: three grass tufts per row, a flower in about a third of rows (pink `#ff9fc5` or yellow `#ffd35c` petals, orange center), a clover in about a fifth.

**Distance.** 1 m = 10 units of scroll.

**Obstacle spawning.** First obstacle at 2.2 s. After each spawn, the next comes in (level's obstacle minimum + random 0–1.3 s); see the level table. New obstacles enter at y = −60.

| Obstacle | Shape for collision | Size | When |
| --- | --- | --- | --- |
| Rock | circle | r 16–28 | always |
| Tree stump | circle | r 17–25 | always |
| Fallen log | capsule (horizontal segment + radius) | r 13, length 130–200, reaching in from the left or right edge, 12 units past it | level 2+, 30% of spawns |

When a spawn isn't a log, it's one rock or stump (x 50–350) or, 35% of the time, a pair: one at x 45–120 and one at x 280–355. Rocks are 55% of single spawns. Add 0–30 of y jitter to each.

**Rules.** Treat every obstacle as a capsule (a rock is a capsule of length 0), so one distance function covers all three.

- **Solid to the pet.** The pet (collision radius 13) is pushed out along the normal from the nearest point. Obstacles scroll into the pet and push it down.
- **Squished.** If the pet still overlaps an obstacle by more than 3 units after clamping (pinned at the bottom), it loses a heart. While invulnerable, the pet ghosts through obstacles, so it can escape.
- **Can't be shot.** A laser that touches an obstacle stops and shows a small pink spark.
- **Cover.** An acorn that touches an obstacle stops and shows a small puff. Players can hide behind rocks.
- Squirrels ignore obstacles; they hop or glide over them.
- Remove obstacles once they're 80 units below the screen.

## Pet and lasers

**The pet** is the player's real pet, drawn with the app's runner (`drawActor`), with no cosmetics. It runs away from the camera in the back view and turns to a back three-quarter view while it moves sideways, using the app's usual turn. The gallop follows the lawn speed. The drawn pet spans the prototype's height: paws about 18 units below the run point, the top of the head about 27 above it. It wears the prototype's pink headband and red gem, placed on the computed head. Lasers come out of the gem. Start position: x 200, y H − 120.

- The dog's tail wags at 14 rad/s and the cat's at 5 rad/s, on top of the gallop.
- While invulnerable, the pet blinks at 12 Hz (alpha 0.4).
- With a shield, draw a light blue bubble (radius 27) around it. With a magnet, draw a slowly rotating dashed purple ring (radius 36).

**Lasers** fire automatically every 0.14 s from (pet x, pet y − 28) at 820 units/s. Each beam is a line about 23 units long, drawn three times: a soft pink glow (width 8), a red core `#ff2d55` (width 3.6) and a pale pink center (width 1.4).

| Laser level | Beams (x offset, angle from straight up) |
| --- | --- |
| 1 | 1 beam: 0, 0 |
| 2 | 2 parallel beams: −6 and +6, 0 |
| 3 | 3 beams: −5 at −0.16 rad, 0 at 0, +5 at +0.16 rad |
| 4 | 5 beams: −8/−4/0/+4/+8 at −0.28/−0.14/0/+0.14/+0.28 rad |

- Every level above 1 lasts 18 s, then drops one level, and the 18 s timer restarts.
- Getting hurt drops the laser one level.
- Every laser deals 1 damage. Check each laser at its new position and at the midpoint of its last move, so fast beams can't skip thin targets. A laser hits a squirrel within (squirrel radius × 0.9 + 5).
- Lasers only hit squirrels that are on screen (y > −8, x within −10 to 410).
- Remove lasers that leave the screen.

## Enemies: the Squirrel Gang

Four squirrel types, all drawn facing down toward the pet, with mischievous angled eyebrows. `d` is the level's difficulty multiplier from the level table.

| Type | Look | Radius | HP | Points (× level) | From level |
| --- | --- | --- | --- | --- | --- |
| Scout | brown `#b8743f`, acorn-cap helmet | 15 | 1 | 100 | 1 |
| Glider | grey-brown `#9c8466`, gliding membrane | 15 | 1 | 150 | 2 |
| Lobber | dark `#8a5634`, holds an acorn | 17 | 3 (4 from level 9) | 250 | 3 |
| Hoarder | orange `#c27f45`, big stuffed cheeks | 24 | 8 | 400 | 4 |

**Scouts** come in squads of 5 (6 from level 6), using one of four patterns picked at random. `t` is time since the squad spawned; member `i` of `n` often runs on a delayed clock `ti`.

- **Snake:** ti = t − 0.3·i; x = cx + 95·sin(2.1·ti), clamped to 20–380; y = −30 + 120·d·ti. cx random 115–285.
- **V:** x = cx + (i − mid)·42 + 28·sin(1.4·t), clamped to 18–382; y = −40 − |i − mid|·30 + 105·d·t.
- **Sweep:** enters from a random side (dir = ±1). ti = t − 0.28·i; x = (−30 or 430) + dir·175·d·ti; y = 70 + 40·ti + 26·sin(2.2·ti).
- **Line:** x = 50 + i·300/(n − 1) + 22·sin(2.6·t + i); y = −30 + 95·d·t.

A scout escapes (removed, no points) once its own clock passes 1 s and it's beyond 40 below or 50 to either side of the screen.

**Gliders** drop in at their x to a stop at y 50–130, taking 0.8 s, with a small 4-unit wobble. Then they lock onto the pet's current position and dive in a straight line at 330·d units/s (downward speed at least 140·d), rotated to face their direction. They don't re-aim.

**Lobbers** ease in over 1.2 s to a hover point (x 60–340, y 95–185), sway ±18 units, and throw an acorn every 1.8/d s, aimed at the pet at 210·d units/s. After 8 s they walk off the bottom at 75 units/s. First throw 1.1 s after arriving.

**Hoarders** walk down at 42·d units/s, swaying ±30 units. When defeated they burst into 3 treats.

**Acorns** (radius 6) spin as they fly. They're stopped by obstacles and hurt the pet within (6 + 9) of a point 6 units above its center.

**Contact.** A squirrel that touches the pet (within radius × 0.8 + 10 of a point 4 above its center) is booped (counts as defeated, gives points) and the pet takes a hit.

**Hit and defeat.** A hit flashes the squirrel white for 0.08 s. A defeated squirrel doesn't explode: it spins away dazed, flying sideways (away from the screen center) at 120–200 units/s and up at 90, with three small yellow stars circling its head, fading out over 0.9 s.

**Drops.** Hoarder: 3 treats. Lobber: 25% chance of a Laser + pickup if the laser is below level 4. **Squad bonus:** when the player defeats every member of a squad, add 300 × level points (popup "Squad +N" in gold) and drop a treat where the last one fell. Squirrels that escape or are cleared at game over don't count.

## Spawning

Squirrels come from four independent timers that run all the time; there are no waves or pauses between them. Each timer only runs once its squirrel type is unlocked (see the level table). Every interval below is multiplied by a random factor so the rhythm never repeats exactly.

| Timer | First spawn | Interval | Notes |
| --- | --- | --- | --- |
| Squad | 0.8 s | squad interval × 0.85–1.15 | random pattern each time |
| Glider | 3 s after unlock | glider interval × 0.8–1.2 | from level 6, 40% chance of a second glider at once |
| Lobber | 4 s after unlock | 4–6.5 s | only spawns if fewer lobbers are on screen than the level's lobber cap |
| Hoarder | 20 s after unlock | hoarder interval × 0.85–1.15 |  |

Spawn x positions: glider 40–360, lobber 60–340, hoarder 80–320. Scouts per their pattern.

## Levels

The level goes up automatically with distance, and each level is a discrete step: every setting below jumps to its new value on level-up and stays flat for the whole level. Only ground speed eases to its new value, over about a second (approach rate 3/s), so the change doesn't jerk. Levels last about 24–29 s each.

**Level length.** Level L lasts 260 + 40·(L − 1) m. Difficulty stops rising at level 12; past that, levels keep counting (and keep raising the points multiplier) with level 12 settings, and level length keeps following the formula.

The settings come from k = min(L, 12) − 1:

- Ground speed = 110 + 12k units/s
- d (squirrel speed and throw rate multiplier) = 1 + 0.07k
- Squad interval = max(1.5, 3.4 − 0.17k) s
- Glider interval = max(1.1, 4.6 − 0.32k) s, from level 2
- Lobber cap = min(3, 1 + floor((L − 3) / 3)), from level 3
- Hoarder interval = max(12, 24 − 1.2k) s, from level 4
- Obstacle minimum gap = max(0.9, 1.6 − 0.06k) s; fallen logs from level 2

| Level | Starts at (m) | Ground speed | d | Squad every (s) | Glider every (s) | Lobber cap | Hoarder every (s) | Obstacle gap (s) | New this level |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 0 | 110 | 1.00 | 3.40 | — | — | — | 1.60 | Scouts, rocks, stumps |
| 2 | 260 | 122 | 1.07 | 3.23 | 4.28 | — | — | 1.54 | Gliders, fallen logs |
| 3 | 560 | 134 | 1.14 | 3.06 | 3.96 | 1 | — | 1.48 | Lobbers |
| 4 | 900 | 146 | 1.21 | 2.89 | 3.64 | 1 | 20.4 | 1.42 | Hoarders |
| 5 | 1,280 | 158 | 1.28 | 2.72 | 3.32 | 1 | 19.2 | 1.36 |  |
| 6 | 1,700 | 170 | 1.35 | 2.55 | 3.00 | 2 | 18.0 | 1.30 | Squads of 6, glider pairs |
| 7 | 2,160 | 182 | 1.42 | 2.38 | 2.68 | 2 | 16.8 | 1.24 |  |
| 8 | 2,660 | 194 | 1.49 | 2.21 | 2.36 | 2 | 15.6 | 1.18 |  |
| 9 | 3,200 | 206 | 1.56 | 2.04 | 2.04 | 3 | 14.4 | 1.12 | Lobbers take 4 hits |
| 10 | 3,780 | 218 | 1.63 | 1.87 | 1.72 | 3 | 13.2 | 1.06 |  |
| 11 | 4,400 | 230 | 1.70 | 1.70 | 1.40 | 3 | 12.0 | 1.00 |  |
| 12+ | 5,060 | 242 | 1.77 | 1.53 | 1.10 | 3 | 12.0 | 0.94 | Settings stop rising |

Keep these settings in one config object (ideally loaded from the Supabase catalog like other tunables), so they can be retuned without an app update.

**Level-up moment** (no banner):

1. The Level pill updates and pops.
2. A white glow pulses around the screen edge, fading over 0.6 s.
3. "Level N" floats up from the middle of the screen in purple, like a points popup, fading over 0.9 s.
4. A power-up choice rolls in (see Power-ups and pickups).

## Power-ups and pickups

**Treats** are points only, never added to the player's treat inventory. They depend on the pet's species:

- **Dog:** a bone-shaped biscuit (`#e8ad66`, lighter highlight stripe).
- **Cat:** a small fish-shaped cracker (golden orange, a tiny eye and tail fin). Design it to the same size as the biscuit, about 23 × 12 units.

Each treat is worth 50 × level points. Treats bob gently (1.5 units at 5 rad/s).

**Power-up choice.** On every level-up, three bubbles roll in side by side at y −40, centered with 110 units between them (150 when only two are offered), riding the ground. The player can take only one: touching one collects it and the others fade upward over 0.4 s. The choice always includes Laser + while the laser is below level 4; the other slots are drawn from Shield, Magnet and, only when the player has fewer than 3 hearts, Heart.

| Power-up | Bubble color | Icon | Effect |
| --- | --- | --- | --- |
| Laser + | pink-red `#ff4f7a` | beam with a plus | laser up one level (max 4), resets its 18 s timer |
| Shield | blue `#53a8ff` | ring | absorbs the next hit (then 1 s of invulnerability); lasts until hit |
| Magnet | purple `#a57cff` | horseshoe | 12 s; pulls treats within 180 units toward the pet at 430 units/s |
| Heart | pink `#ff6fae` | heart | +1 heart, max 3 |

Bubbles are glossy spheres (radius 20, white highlight at the upper left, white rim) with a white icon and a short white label underneath with a dark outline. They bob 2 units at 4 rad/s. No sparkles. Picking one up shows a colored popup ("Laser up!", "Shield!", "Magnet!", "+1 heart").

**Movement and pickup.** Pickups ride the ground. Dropped pickups start with a small burst velocity that damps quickly (to 3% per second). Collect radius: 24 units for treats, 32 for power-up bubbles, measured from 6 units above the pet's center. Remove them 40 units below the screen.

## Hearts, damage and game over

The pet starts every run with 3 hearts. Something hurts the pet when an acorn hits it, a squirrel touches it, or an obstacle pins it at the bottom of the screen.

When the pet is hurt:

1. If invulnerable, nothing happens.
2. If it has a shield, the shield pops (a blue ring expands and fades over 0.35 s) and the pet is invulnerable for 1 s. No heart is lost.
3. Otherwise it loses a heart, becomes invulnerable for 1.6 s (blinking, ghosting through obstacles), the screen shakes for 0.3 s (up to 5 units), and the laser drops one level.
4. At 0 hearts, the run ends: ground speed eases to 0, squirrels and acorns freeze in place, the pet wobbles, and the results card appears after 1.1 s.

The HUD hearts are filled pink (`#ff4f8f`) for remaining hearts and pale outlines for lost ones.

## Scoring and leaderboard

Points are for the leaderboard only. Like Tetris, most points scale with the current level.

| Source | Points |
| --- | --- |
| Distance | +1 per meter (no popup) |
| Squirrel booped | type's points × level (100 / 150 / 250 / 400) |
| Treat | 50 × level |
| Squad cleared | 300 × level, gold popup "Squad +N" |

Every gain except distance shows a "+N" popup where it happened: Baloo 2 ExtraBold 19, pink `#e94b93` with a white outline, rising 38 units/s and fading over its last 0.4 s (0.9 s total).

**Supabase.** Use the same pattern as the other mini-games' score tables: one `acorn_attack_scores` table, a row per finished run, deduplicated on `run_id` (a UUID generated when the run starts) so retries don't double-post. Columns: `id`, `player_id`, `run_id` (unique), `score`, `level`, `distance_m`, `squirrels`, `treats`, `duration_ms`, `client_version`, `created_at`. Guests post under their anonymous ID like the other games.

- Save the run when the results card appears; queue it and retry if offline.
- The board shows each friend's best score plus the player's own best, sorted high to low. The start card shows the top 4.
- Server-side sanity checks before accepting a row: distance\_m ≤ duration\_ms / 1000 × 25 (top speed is 24.2 m/s); level consistent with distance per the level-length formula; score within a generous cap for that level and duration. Flag rows that fail instead of deleting them.
- Keep the player's best locally too, so the results card can say "New best!" offline.

## Rendering and performance

The game must hold 60 fps on older Android phones with a full screen: at level 12 that's up to about 40 lasers, 20 squirrels, 10 acorns and 8 obstacles at once.

- One Skia canvas for the whole play area; the HUD and cards can be React Native views on top.
- Fixed timestep-friendly loop: cap dt at 33 ms so a hitch never teleports things through each other.
- Pool lasers, acorns, pickups, popups and effects (fixed-size arrays with an alive flag) instead of allocating each frame.
- Draw lasers as one path stroked three times, not one draw call per beam.
- Draw the pet live each frame through `drawActor`, so the gait and the turn stay the app's. Squirrels, obstacles, treats, and power-up bubbles are the prototype's drawings, also drawn each frame.
- Draw order: lawn, pickups, obstacles, lasers, squirrels, acorns, pet (with shield and magnet rings), effects, popups, level-up edge glow.
- Sound, all respecting the pause card's sound toggle. Laser fire plays `freesound_community-laser-104024.mp3` on every shot. A hit that does not finish the squirrel, and a one-hit squirrel going down, play `universfield-cartoon-impact-02-278820.mp3`. A lobber or hoarder going down plays `freesound_gamestudio-explode-408427.mp3`. Collecting a laser, shield, magnet, or heart plays `freesound_community-power_up_grab-88510.mp3`. A treat plays the existing bloop, a level-up plays the badge chime, and a hit on the pet plays its meow or growl.

## Acceptance checklist

- [ ] The player's own pet appears with its species, breed and coat color, running away and turning to a back three-quarter view while steering sideways; no cosmetics; cats collect fish crackers, dogs collect biscuits.
- [ ] Dragging anywhere moves the pet 1:1 from wherever the finger lands; it never jumps to the finger; a fast swipe can't pass through a log.
- [ ] Lasers fire on their own, stop on obstacles, and never hit squirrels that are off screen.
- [ ] Acorns stop on obstacles, so hiding behind a rock works.
- [ ] Being pinned against the bottom by an obstacle costs a heart, then the pet can escape.
- [ ] Level goes up at 260, 560, 900… m; each step changes speed and spawns exactly as in the level table; nothing changes mid-level.
- [ ] Gliders appear from level 2, lobbers from 3, hoarders from 4; squads of 6 from level 6.
- [ ] Every level-up offers a power-up choice and only one can be taken; Heart is only offered when hearts are below 3.
- [ ] Points multiply by level and every gain except distance shows a "+N" popup.
- [ ] No banners, tooltips or coach marks during a run.
- [ ] No Boops or inventory changes anywhere in the game.
- [ ] Backgrounding the app pauses the run.
- [ ] Each finished run posts once to `acorn_attack_scores` (retried if offline), and the start card shows friends' best scores.
- [ ] Holds 60 fps at level 12 on a mid-range Android phone.

## Open questions

- Final name: "Acorn Attack" is a working name and hasn't been trademark-checked. The lobby tile is settled (option A in `docs/Acorn Attack Icon.html`).
- Power-up choice on every level-up may be too generous; every other level is a one-line change.
- Level cadence: levels currently last about 24–29 s each. Using a fixed 300 m per level instead would make levels come faster as speed rises, more like Tetris.
- The space on the results card for the future cross-promotion button: when the full game exists, what does it say and when does it show?
