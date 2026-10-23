# Park birds (NPC ambient wildlife)

Ambient birds live in scene data. They hop, peck, and preen. They fly off when a pet, a park visitor, or a thrown toy gets too close, and they come back after a while. Day birds leave at dusk. The park has no owl and no duck, so the park is empty of birds at night and has no swimmers.

Birds are not a pet species. They are not actors. They do not use points of interest, and they never change mood, Boops, or training.

`birds-demo.html` is the look-and-behavior reference.

## Files

- `src/actor/birds.ts`: the simulation. Pure TypeScript. Species table, spawning, the per-bird state machine, threat checks, and the pose the renderer reads. Duck and owl stay in the table so the art still has them. The park never lists them.
- `src/ui/skia/birds.ts`: the renderer. It uses the app's `ink.ts` (`circle`, `ellipse`, `line`, `poly`, `ov`, `stroke`, `darken`, `lighten`) plus `Skia.Path`, `Skia.XYWHRect`, and `canvas.clipRect`. Colors go through `ink.ts`, so the scene tint and night lighting apply.

## Scene data

`Scene.birds` is optional. The schema version stays at 1. A scene with no field has no birds. Only the park lists spots. Indoor scenes have none.

The park is 640 by 680. Fence at (320, 182), bench at (340, 206), trees at (70, 196) scale 1.1 and (590, 228) scale 1.3. Feet are in stage space. `sortY` is the prop baseline, used for depth sorting.

```json
"birds": [
  { "x": 180, "y": 480, "on": "ground", "count": 3, "roam": 55, "roamY": 22, "species": ["sparrow", "robin", "cardinal", "pigeon"] },
  { "x": 420, "y": 560, "on": "ground", "count": 2, "roam": 50, "roamY": 20, "species": ["sparrow", "robin", "cardinal", "pigeon"] },
  { "x": 240, "y": 149, "on": "perch", "sortY": 182, "species": ["sparrow", "robin", "cardinal", "pigeon"] },
  { "x": 340, "y": 154, "on": "perch", "sortY": 206, "species": ["sparrow", "robin", "cardinal", "pigeon"] },
  { "x": 37, "y": 84, "on": "perch", "sortY": 196, "species": ["sparrow", "robin", "cardinal", "pigeon"] }
]
```

The tree perch sits on the bare-tree branch whose local end is (−30, −102), scaled by 1.1 from the left tree.

Spot fields:

| field | meaning |
|---|---|
| `on` | `ground` (roams an ellipse) or `perch` (sits at x/y). `water` exists in the sim and is unused. |
| `species` | allowed species. The park lists sparrow, robin, cardinal, and pigeon. |
| `roam`, `roamY` | half-width and half-height of a ground roam area |
| `sortY` | for perches, the baseline of the thing the bird sits on |
| `count` | ground only: up to this many birds share the spot |
| `chance` | chance the spot is occupied on a visit (default 0.85) |

A ground spot rolls 1 through `count`, so a visit can show one bird, a pair, or a small flock. A failed chance leaves that spot empty. Perches are a single bird. Nothing outside the scene data names the park. Any scene with `birds` gets birds.

## Simulation

Birds are their own list on the world. They are stepped at the end of `update`.

The cast is stable for the hour:

```ts
const visitSeed = Math.floor(Date.now() / 3_600_000) ^ hashString(scene.id);
```

Respawn when the scene becomes the park and when that seed changes. Clear the list on every other scene.

`birdWorld()` uses the same clock and weather as the scenery:

- `dark`: `tod.dark`
- `precip`: the current weather's precipitation (`'rain' | 'snow' | null`)
- `month`: `new Date().getMonth()`. Robins appear from March through October.
- `xMin` and `xMax`: the visible stage edges, including bleed, so birds fly fully off screen
- `yTop`: the top of the visible stage (`-bleed` when there is vertical bleed)

Threats are every actor (the user's pet and the park visitor) plus a free toy that is off the ground:

```ts
threats = [
  ...actors.map(a => ({ x: a.x, y: a.y, speed: a.speed, scare })),
  ...(toyAirborne ? [{ x: toy.x, y: toy.y, speed: 300, scare: 1.3 }] : []),
];
```

`scare` is 0.6 while the player's cat is in the bird stalk and still on the ground. Otherwise it is 1. Running (over 140 px/s) stretches the startle distance by 1.5. A perched bird uses 0.75 of it.

Park visitors are capped at one dog or cat (`maxOnScreen` 1). That visitor scares birds the same way the pet does.

## Cat stalk

Only the player's cat, only in the park, and only from idle when she has no command and no hello. She picks a ground bird within about 280 px. She does not stalk a perch. Dogs and the visitor do not stalk.

She creeps in the stalk pose, at about 0.14 of her speed cap, and stops just outside `startle * 0.6`. Then she pounces with the existing jump, aimed at the bird. Leaving the ground sets `scare` back to 1, so the flock flushes. If the bird is already leaving, or a command or hello takes her, the stalk ends and she returns to a normal idle. The stalk pays no mood.

## Rendering

Grounded birds that are not `away` join the depth-sorted list, keyed by `bird.depth`. The draw calls `drawBirdGround` then `drawBird`, inside the scenery tint. Airborne birds are drawn after that pass and before `drawAmbient`. Skip birds whose state is `away`.

## Sound

One clip: `assets/sounds/loswin23-bird-chirps-568010.mp3`, reencoded to a short mono cut. The original lives in `design/audio-sources/`. Play it only for the sim's `chirp` event (sparrow, robin, cardinal). Coo, flap, land, quack, hoot, and splash stay silent, so a pigeon makes no sound and a scatter has no wing sound.

- Volume 0.4. This does not go through `playVoice`.
- At most one chirp every 1.5 s.
- Pitch 0.92–1.08.
- Respect the mute setting.

## Behavior

- **Sparrow**: hops in a small flock, pecks, preens. Leaves in rain.
- **Pigeon**: walks with a head bob. Boldest bird. Stays in the rain. Silent.
- **Robin**: hops, listens with a tilted head, then pecks. March through October. Leaves in rain.
- **Cardinal**: most skittish. Leaves in rain.
- When one flock member startles, the others follow a beat later.
- Day birds get drowsy at dusk, then leave. They come back in the morning.

## Tuning

- `BIRD_SCALE` and `BIRD_SIZE` in the renderer. Tuned against a pup about 60 px tall.
- `BIRD_SPECIES` in the sim: startle distance, time away, months, gait, wingbeat.

## Don'ts

- No speech bubbles or callouts over birds.
- Birds never affect pet stats, Boops, or training.
- Do not add `bird` to the pet `Species` type.
- Never name anything "zoomies".
