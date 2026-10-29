# Cursor Brief: Race Poses (Flying Gallop, Leap, Stumble)

## Goal

Give pets three race poses on the **existing rig**: a flying gallop for running, an outstretched leap for hurdles, and a stumble for a clipped hurdle. Don't build a new skeleton. Everything here is expressed in the rig's own terms: foot targets placed relative to each hip and solved with `solveKnee`, the jump module's keyframed `visual`, and `pose` targets.

Visual reference: the "Boop Boop Race Poses" page (animated dog and cat). Its JSON uses joint angles on a stand-in rig. **Use the foot-target tables in this brief, not those angles.** They have already been converted to this rig.

Files involved: `actor/data/locomotion.ts` (gait defs), `actor/locomotion.ts`, `actor/jump.ts`, `ui/skia/pet.ts` (`footAt`, `footTilt`, `posed`), `actor/sim.ts`, plus the race driver from the race foundation brief.

## Conventions used below

- **Foot targets** are `(x, y)` in units of `geom.L`, relative to the hip or shoulder the leg hangs from: **x positive = toward the nose, y positive = down**. That's the same form as the jump module's `visual.fore` / `visual.hind` (`hip.x + spec.x * L`, `hip.y + spec.y * L`). `plant: true` means the foot is on the ground (`y = 0` in actor space).
- Keep every target within **0.96 L** of its hip: `solveKnee` clamps at the bone length, so farther targets just straighten the leg. The near-pair flight pose and a few leap keys sit just past 0.96 L. Leave them. The clamp is the outstretched look.
- **Pitch** values are **radians** (as `JumpVisual.pitch` is; `pitchDeg` 16 ≈ 0.28 rad). They use the torso `theta` sign: **positive = nose down**, negative = nose up. This matches `jump.ts`, where take-off sets `visual.pitch = −pitchPeak` for a nose-up launch.
- **dy** values in the tables are in units of `geom.L`, positive = down. Multiply by `geom.L` when filling `JumpVisual.dy`, which is in body pixels.
- **Squash** uses `JumpVisual.scaleX / scaleY`, as the jump module already does.
- **Ear** adds to `earBack` (positive = flatter or back). **Tail** adds to `tailLift` (positive = higher). Eyes use the existing `eyes` (closed) and `squint` targets.
- All numbers go in config (a `racePoses` block in `actor/data/locomotion.ts`), not inline.

## Implementation notes

- The gallop body stretch (dog 1.05, cat 1.09) is a torso scale while `extend > 0`. It does not go through `JumpVisual`, and `JumpVisual.blend` stays 0, or the jump leg blend replaces the gait.
- `gaitFootFor` is unchanged. Flying offsets are `[0.88, 0.44, 0, 0.32]`. The extension bump rises from 0.42 to 0.46, holds to 0.50, and falls to 0 at 0.54.
- In a race, `share` is race speed divided by the 11 m/s cap. The gait comes from the meters-per-second bands, not from home top speed.

---

## 1. Flying gallop

**What it should look like:** at speed, each stride has a moment where the pet is airborne with **all four legs fully outstretched**, front legs reaching forward and hind legs stretched back. Then it gathers its legs under the body briefly and pushes off again. Cats stretch the spine more than dogs.

**How to build it:**

Today's gallop (`gaitDefs.gallop`: offsets LH/LF/RH/RF `[0.12, 0.5, 0, 0.62]`, duty 0.3) is a rotary gallop, which is right. In `gaitFootFor`, `u = 0` is touchdown and `u = phase + offset`, so a foot lands at cycle `(1 − offset) mod 1` and lifts at `(duty − offset) mod 1`. Today's flight (last hind up at 0.30, first fore down at 0.38) is only about 8% of the stride, and the bounce and spine flex peak near cycle 0.11, when the hind feet are still on the ground. So the pet never visibly flies with its legs outstretched.

1. **Retune `gaitDefs.gallop`.** This changes every fast run (home, park, play), which is intended: zoomies get the same flying look. Put the old values behind a config switch (`gallopStyle: 'classic' | 'flying'`, default `'flying'`) so the two can be compared on device and reverted without a code change.

| Field | Today | New |
| --- | --- | --- |
| offsets (LH, LF, RH, RF), in `gaitFootFor`'s convention | `[0.12, 0.5, 0, 0.62]` | `[0.88, 0.44, 0, 0.32]` |
| duty | 0.30 | 0.28 |
| bounce | 5.6 | 7.5 |
| stride | 1.18 | 1.25 |
| lift | 0.26 | keep |
| stretch / stream | 1 / 1 | keep |
| **new** `flightAt` | — | **0.48** (cycle point of the outstretched flight) |

   With these, the feet land and lift at: RH 0.00 → 0.28, LH 0.12 → 0.40, LF 0.56 → 0.84, RF 0.68 → 0.96. The outstretched flight runs from 0.40 to 0.56 (16% of each stride), and a short gathered flight remains at 0.96–1.0. Don't change `gaitFootFor`: walk, trot and canter were authored against it.
   - Add `flightAt` to `GaitDef` (0 for walk and trot; canter about 0.45).
2. **Line up the lift and spine flex with that flight.**
   - In `bounceOf`, the airborne wave becomes `0.5 + 0.5 × sin(phase + π/2 − 2π × flightAt)`, so the lift peaks at `flightAt` instead of near 0.11. Use the blended `flightAt` across gaits.
   - In `bodyFrame`, the gallop spine-flex term `0.07 × stretch × sin(phase + 0.8)` uses the same shift, `sin(phase + π/2 − 2π × flightAt)`.
   - Make its amplitude species-based (config): dog **0.07** (today), cat **0.11**, so cats arch and stretch more.
   - During extension, stretch the body ellipse along its length (scaleX 1.05 dog, 1.09 cat). This is a torso scale only. Do not set a jump visual's leg blend to get there.
3. **Add an extension overlay in `footAt`** (pet.ts) for the outstretched flight. Measure the cycle position as `uc = ((actor.phase / 2π) mod 1)`, which is RH's frame, offset 0. Then:
   - `extend = gallopWeight × bump(uc)`, where `bump` rises from 0 at 0.42 to 1 at 0.46, holds to 0.50 and falls to 0 at 0.54 (smoothstep edges). It must stay inside the airborne window (0.40–0.56), or it lifts a planted paw off the track
   - `gallopWeight` is how far the gait blend is into gallop (1 when fully galloping, 0 at canter and below)
   - Blend each foot toward its outstretched target by `extend`, after the gait foot and before the furniture and jump overrides:

| Leg | Outstretched target (x, y) | plant |
| --- | --- | --- |
| Fore (near and far) | (+0.90, +0.37) | no |
| Hind (near and far) | (−0.90, +0.37) | no |

   - Far legs use the same targets, shifted 0.04 L inward (fore −0.04, hind +0.04), so the pairs don't overlap exactly.
   - The gathered phase needs no override: the gait's own swing already brings the feet under the body.
4. **Body height in flight comes from `bounceOf` alone.** No paw is planted while `extend > 0`, so nothing should pull the body down toward the ground then.
5. **Feet tilt with the leg:** add `extend` to `footTilt`'s max, so paws and boots point along the shin when outstretched instead of staying flat.
6. **Head:** no change. `bodyFrame` already bobs the head less than the body.

The phase rate keeps coming from `phaseRate`, so planted feet never slide.

**Gait choice in races:** the race driver sets the gait from race speed instead of `chooseGait`, since race speeds don't match a pet's home top speed. Defaults (config): below 1.5 m/s walk, below 3 m/s trot, below 4.5 m/s canter, gallop above. Ignore `maxGait`, stamina drain and the tired trot cap; the race foundation's stamina modifier handles tiring instead. Blending uses `stepGait` as today. Set `share` = race speed ÷ the race top speed (11 m/s cap), so a full-speed gallop has `share` 1. `bounceOf` scales the lift by `share`, and dividing by the home top speed (pixels) would leave the pet barely leaving the ground.

## 2. Leap (hurdles)

**What it should look like:** crouch, push off with the hind legs, then at the peak **front legs reach straight forward and hind legs stretch straight back** (a leap, not a ball). Reach down, land on the front paws, squash, run on. Eyes close happily at the peak; ears flip back at take-off and flop forward on landing.

**How to build it:** today's jump tucks all four feet near the body at the apex (`jumpConfig.legs.apex` is `fore (0.02, 0.2)`, `hind (−0.08, 0.2)`). Add a **leap leg set** and a `style: 'tuck' | 'leap'` field on `JumpRequest` and `JumpState` (default `'tuck'`, so every existing jump is unchanged). `poseLegs` reads `jumpConfig.leapLegs` instead of `jumpConfig.legs` for the airborne keys when `style === 'leap'`:

| Key (existing name) | Fore (x, y, plant) | Hind (x, y, plant) | Change from today |
| --- | --- | --- | --- |
| crouch | keep | keep | — |
| push | (+0.07, 0.69) | (−0.22, 0.93, plant) | front legs fold up as the hind legs push |
| rise | (+0.30, 0.55) | (−0.84, 0.54) | hind legs stretch back right after leaving the ground |
| apex | **(+0.91, 0.31)** | **(−0.91, 0.33)** | **front straight forward, hind straight back** |
| fall | (+0.70, 0.71) | (−0.69, 0.67) | front reaches down for the landing, hind still trailing |
| front | keep | keep | front paws touch first |
| absorb | keep | keep | — |

Everything else in the leap uses what `jump.ts` already does: the nose-up launch, levelling at the apex and nose-down fall from `pitchPeak × vz/v0`; take-off stretch and landing squash (`scaleX/scaleY`); ear and tail lag; dust on landing; puppy wobble and bounce.

Additions for the leap:
- `leap.pitchDeg`: dog **18**, cat **16** (config), slightly more than today's 16 and 14, so the leap reads as a dive.
- **Happy eyes at the peak:** add `eyes: number` to `JumpVisual` (0 by default). For a leap, set it to 1 while air progress `u` is between 0.38 and 0.62, eased in and out. In `pet.ts`, include `posed?.eyes ?? 0` in the `eyeClosed` max. `drawEye` already draws an arc lid once `closed > 0.6`, which is the happy look; no separate eye pose is needed.
- **Ears flat** in the air: add 0.2 to `earLag`'s target while airborne in a leap.
- The idle tuck (`pose.tuck`) never applies during a jump already. Keep it that way.
- Home hurdles (`considerHurdle`) keep `'tuck'` for now. Try `'leap'` there after seeing it in races.

## 3. Stumble (clipped hurdle)

**What it should look like:** front legs buckle under the chest, nose dips, eyes squint, dust puffs from the front paws and two small stars circle the head. Then a little recovery hop back into the gallop. 0.7 s total. **The pet never falls over or lies down**, so it never looks hurt.

**How to build it:** add a short **stumble visual** that returns a `JumpVisual` (same type, so it goes through the same `posed` path). Generalize `posed` in `pet.ts` to `actor.jump?.visual ?? actor.stumble?.visual`, so legs, pitch, dy, squash, ear, tail and eyes come from it with no new drawing code. Add `squint: number` to `JumpVisual` and include it in the squint max the same way as `eyes`. `t` runs 0..1 over 0.7 s. Squash at the buckle: `scaleX 1.06, scaleY 0.92`, eased back by the hop.

| t | blend | pitch | dy | Fore (x, y, plant) | Hind (x, y, plant) | Ear | Tail | Eyes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0.00 | 0 | — | — | gait | gait | 0 | 0 | open |
| 0.15 buckle | 1 | +0.28 | +0.19 | (−0.71, 0.28) | (+0.05, 0.97, plant) | −0.7 | −0.2 | squint |
| 0.35 low | 1 | +0.20 | +0.26 | (−0.59, 0.38) | (+0.34, 0.93, plant) | −0.6 | −0.3 | squint |
| 0.60 hop | 1 | −0.12 | −0.26 | (0.00, 0.83) | (−0.55, 0.72) | +0.2 | +0.3 | open |
| 1.00 | 0 | — | — | gait | gait | 0 | 0 | open |

- Fore paws at 0.15–0.35 are folded back under the chest, not planted: knees near the ground, paws tucked.
- **Dust:** 3 puffs from the fore paws at t = 0.15 (reuse the jump dust).
- **Stars:** a new tiny overlay. Two small yellow stars (existing outline style) circle above the head from t = 0.15 to 0.85, one full lap. Skip them under reduce motion.
- Ground speed during the stumble is the race's slowdown; the gait phase keeps turning from `phaseRate`, so legs stay matched to the slower speed when the gait blends back in.
- Optional sound: the existing yelp-free bark at low volume, or none. No hurt sounds.

## 4. Driving the poses in a race

The race sim (race foundation brief) owns position, speed, jump height and timing. The actor sim's own behaviors must not fire in a race:

- Turn off `considerHurdle`, `jump()` auto-starts, greetings, idle behaviors, furniture and facing turns while an actor is racing. Facing is fixed to the right.
- Each frame the race driver sets on the actor: `speed`, `vx` (scaled from m/s to stage px by the track scale), `share` (race speed ÷ 11 m/s), and the gait from the race speed bands in section 1 (blending through canter on the way up, as today).
- Phase advances by `phaseRate` (so planted feet match the ground).
- **Jumps:** the race owns the arc, so don't call `jump()` in a race. Its turn, crouch and take-off phases would delay the jump by about 130 ms after the tap, and its own gravity arc would disagree with the race's. Instead, export a pure **`raceLeapVisual(actor, airU, afterLandS)`** from `jump.ts`. It builds a `JumpState`-shaped object and runs the same `poseLegs` / `sampleVisual` logic for a leap:
  - **No crouch in races.** The tap is the take-off. Blend the `push` legs into the first 8% of air (`airU` 0–0.08), then rise, apex and fall by `airU`, exactly as `poseLegs` does today.
  - After touchdown, play `landing` then `recovery` by `afterLandS` (seconds since landing), as visuals only. The race keeps moving the pet at full speed, so treat it as a running landing (no `vx = 0`).
  - The race sets `actor.z` from its own arc, with `apex` = the race's jump height, so shadow shrink and fade keep working (`z / apex`).
  - Dust: spawn the existing landing dust at touchdown.
  - The puppy bounce is skipped in races, since it would hold the pet back.
- **Stumble:** the race starts it on a clip; the driver steps `actor.stumble.t` and fills the visual with `stumbleVisualAt(t)`.
- **NPC and remote pets** use the same driver, fed from their own sim or the smoothed network positions.
- **Replace the placeholder blobs in `src/ui/skia/raceTrack.ts` with the real pet renderer** (`drawPet` from `pet.ts`) for every racer: own pet, NPCs and remote players, each with its breed, coat and outfit. Back-lane pets are drawn smaller (lane scale) through the renderer's normal scale.
- **Performance with up to 6 pets:** the outline pass uses a `saveLayer` dilate per pet. Profile on a mid-range Android phone. If 6 outlined pets drop below 60 fps, keep the outline on the player's own pet and turn it off for back-lane pets, then reduce back-lane detail (shading stripes, coat textures). Don't fall back to blobs.

## 5. Outfits

Boots and jacket sleeves already follow `drawLeg`, so they should track the new targets. Check specifically:
- Boots point along the shin when legs are outstretched (`footTilt` change in section 1).
- Jacket sleeves don't stretch oddly at full extension (legs at 0.96 L).
- Hats, glasses and neckwear stay attached through the leap's −0.30 pitch and the stumble's +0.28.

## 6. Ages and breeds

- Targets are in units of `L`, so they scale with leg length: short-legged breeds and puppies work automatically.
- `liftScaleOf` still applies to the gait's swing height. Don't apply it to the extension, leap or stumble targets.
- Seniors: reduce extension to about 70% and leap reach to about 80%. Keep it in config.
- In races, the driver sets the gait from race speed every frame and ignores `maxGait`, stamina drain and the tired trot cap, so a low-vitality senior (home `maxGait` canter) still gallops in a race. The 70% extension applies on top of that.

## 7. Dev pose preview

Fun Run has no jumps or clipped hurdles, so add a **dev-only preview** on the race screen (hidden in release builds) to check the poses before Hurdles exists:
- Buttons: **Leap**, **Stumble**, **Loop** (gallop 1.5 s → leap → gallop 1 s → stumble, repeating)
- Speed: 1×, 0.5×, 0.25×
- Pickers for breed, age (puppy / adult / senior) and an outfit preset (none, boots + jacket, hat + glasses)
- The pet gallops in place on the scrolling track; Leap plays `raceLeapVisual` with a test arc; Stumble plays the stumble visual with the race slowdown

## 8. Done when

- At race speed, the dog and cat each show a clear outstretched flight moment every stride, with no foot sliding and no body dipping toward the ground during flight.
- The leap peaks with front legs straight forward and hind legs straight back, eyes closed, then lands front paws first with a squash.
- The stumble buckles the front legs and recovers in 0.7 s without lying down.
- Boots, jackets and hats look right in all three, across a small dog (Pug or Corgi), a long dog (Dachshund), a large dog and two cats, at puppy and adult ages.
