# Cursor brief: procedural pets, reference demo v2

This replaces the earlier Rive plan and updates the v1 reference HTML I gave you before. Do not use Rive. Port the attached `pet-demo-v2.html` into the Expo app as a code-drawn pet (React Native Skia). Dogs and cats, offline, no backend.

## How to use the HTML
- Save it in the repo as `reference/pet-demo-v2.html`. It is a **reference to port, not code to embed**. Do not load it in a WebView.
- Open it in a desktop browser to see the intended behavior. Compare your port against it side by side.
- Browser console API for checking behavior: `petDemo.setTask('sit'|'paw'|'speak'|'sleep'|'eat'|'fetch'|'idle')`, `petDemo.idleMode('still'|'pant'|'purr'|'nap'|'walk')`, `petDemo.setBreed('dog'|'cat', key)`, `petDemo.setAge(days)`, `petDemo.setWeight(-1..1)`, `petDemo.setCute(0..1)`, `petDemo.wear(slot, id)`, `petDemo.anchors()`, `petDemo.state()`.
- All tuning numbers are in the first ~60 lines of the script (`WEIGHT`, `IDLE_WEIGHT`, `SPECIES`, `BREEDS`, `WARDROBE`) and in `geomOf`. Move them into data files, not code.

## What changed since v1
1. **Cats added.** `species` is data (`dog` | `cat`). Same engine, different anatomy and behavior set. Five breeds each.
2. **Pant is no longer a user action.** The user-facing actions are now: Idle, Sit, Give paw, Speak, Sleep, Eat, Throw ball. "Stand" became "Idle".
3. **Idle state machine.** With no action running, the pet randomly alternates between standing still, panting (dog) or purring (cat), napping, and wandering. Blinking runs continuously underneath (including occasional double blinks).
4. **Weight index.** A single number from -1 (underweight) to +1 (overweight) drives body thickness. Hunger lowers it, meals raise it, with a floor and a ceiling. It is not a user toggle.
5. **Cuteness knob.** Larger head and eyes, lower eye position, second eye highlight, blush, bigger paws. Stronger on young pets, fades with age.
6. **Cosmetics.** Six slots: collar, bandana, glasses, hat, coat, boots. They attach to anchors the pet exposes each frame.
7. **Speak is per species.** Dog: two barks. Cat: one meow, longer jaw open. Audio is still synthesized in the demo.
8. **Cat ball play.** Cats chase the ball and bat it three times (with a small hop), then purr. Dogs fetch, carry it home, drop it, then sit and pant.
9. **Pet height (`z`).** The pet now has a vertical offset with simple gravity, used for the cat's pounce hop. Build the hurdle jump on top of this later.
10. **Renames.** `dog` is now `pet`, `drawDog` is `drawPet`, `window.dogDemo` is `window.petDemo`, and `setBreed(key)` is `setBreed(species, key)`.
11. **Bug fixed.** A ball picked up during fetch stayed in the mouth after switching actions. It is now dropped when the task changes.

## Architecture requirements
Keep simulation and rendering separate. Plain TypeScript modules with no Skia imports in the logic, so they can be unit tested:

| Module | Port from |
|---|---|
| `data/breeds`, `data/species`, `data/wardrobe` | `SPECIES`, `BREEDS`, `WARDROBE` |
| `weight` | `WEIGHT`, `thickOf`, `weightLabel` |
| `geometry` | `geomOf`, `torsoPt`, `depthScale`, `strideOf`, `speedMax`, `reachOf` |
| `legs` | the `foot()` gait and `legIK` (two-bone IK) |
| `behavior` | task and idle logic in `update`, `nextIdle`, `setIdle`, voice scheduling |
| `sim` | the `update(dt)` loop, ball physics, movement, pose easing |
| `renderer` (Skia) | `drawPet`, `drawEye`, cosmetics, `drawBowl`, `drawBall`, `drawZ` |
| `audio` | `playVoice` (replace, see below) |

**Build around an `Actor` list from the start.** The demo has a single global `pet`. In the app, every pet (the user's, a friend's, an NPC, a cat) is an `Actor` with its own pose, task, idle state, weight, and wardrobe. Retrofitting this later is much harder.

**Expose anchors.** `sim` must output, per actor per frame, the same anchor data the demo returns from `petDemo.anchors()`: head (x, y, pitch, radius), neck point, torso (theta, dy, pivot), and the four paws (x, y, shin angle), plus scale and facing. The renderer draws cosmetics from these only.

## Behavior specs

**Pose easing.** Every action sets targets; every frame `pose[k] += (target[k] - pose[k]) * (1 - exp(-dt * rate[k]))`. Never set pose values directly, or transitions will pop.

**Idle machine** (runs only when no user action is active):

| Mode | Duration | Notes |
|---|---|---|
| still | 3 to 6.5 s | standing, blinking |
| pant (dogs) | 4 to 6.5 s | 50% chance sitting |
| purr (cats) | 4 to 6.5 s | sitting, eyes squinted, slow breathing |
| nap | 9 to 15 s | lie down, head rests, eyes closed, "Zzz" |
| walk | until arrival, 9 s max | random target on the floor band |

Pick the next mode by weighted random, excluding the current one. Weights: still 3, pant or purr 2, nap 1.5, walk 2.5. With reduced motion enabled, skip walk.

**Weight index** (stored per pet, persisted):
- `w` in [-1, +1], clamped. -0.25 to +0.25 is "healthy".
- Hunger: `w -= DECAY_PER_DAY * gameDays` (0.12/day in the demo). Meals: `w += MEAL_GAIN` (0.12 per meal). Running burns a little (0.003 per second above speed 80). Also apply the decay for time the app was closed when it next opens, since the app is offline-first.
- Display value eases toward `w` so changes never pop.
- Thickness: `m = |w|^1.5`, `thick = w >= 0 ? 1 + 0.5*m : 1 - 0.3*m`. Body height scales by `thick`. The belly sags when fat and tucks up when thin, legs thicken slightly, ribs fade in below `w = -0.35`, and heavy pets move up to 22% slower.
- Labels: Underweight, Lean, Healthy, Plump, Overweight.
- The demo's "Weight index" slider and "Demo clock" are test controls only. Do not ship them.

**Cuteness.** `cf = cuteness * (0.55 + 0.45 * (1 - growth))`. Head radius `* (1 + 0.28*cf)`, eye radius `+ 0.12*cf`, eyes sit lower, blush alpha `0.3*cf`, paws `* (1 + 0.25*cf)`. Keep it a data value per breed and life stage so the art style can change without touching behavior.

**Cosmetics.** One item per slot. Draw order: far-leg boots, torso (coat inside the torso transform), near-leg boots, neck, bandana, collar, head, ear, glasses, hat. Each item is a draw function that takes the pet's geometry, so it fits every breed and age. Item colors and patterns are data. Boots follow the paw position and shin angle from IK.

## Replace these demo shortcuts
- **Age:** the demo maps 56 to 365 days linearly. Use a stored birth date and the 1000-day lifespan, with a separate curve per feature (leg length on an S-curve, under-eye bags from about day 600 to 800, reversible by rejuvenation). Keep curves in a data file.
- **Sound:** replace the synthesized bark and meow with recorded sounds. Pitch varies by breed and age.
- **Input:** taps instead of mouse clicks.
- **Time:** use a capped timestep and pause when the app is backgrounded.
- **Needs:** connect Eat to the existing feeding system, petting to the existing mood reactions. Keep the blob prototype's architecture and swap the pet in.

## Acceptance criteria
- All seven user actions work with smooth transitions, for both species.
- Idle cycles through still, pant or purr, nap, and walk on its own, with continuous blinking.
- Weight index changes the body visibly (subtle near 0, obvious at the ends) and respects the floor and ceiling, including after time away from the app.
- Five breeds per species render, with age scaling.
- All six cosmetic slots render and follow sit, sleep, bark, walk, and growth.
- Holds a steady frame rate on a mid-range Android phone, fully offline, no Rive dependency.
- Unit tests cover the weight model, idle machine, geometry, and task transitions.

## Known gaps (not v1 goals)
- Flat vector look. It is not Pixar or anime style yet. Keep drawing code isolated so the look can be upgraded.
- The cat sit pose reuses the dog's, so it looks less upright than a real cat sit. Needs tuning on device.
- Hat and ear overlap is not tuned per breed. Pointy and cat ears are covered by the hat.
- No laser pointer for cats, no hurdle jumps, no pet-to-pet interaction, no cat grooming yet.
- Verified only in desktop Chromium. Poses and timing need tuning on a real phone, so keep tuning values as constants.
