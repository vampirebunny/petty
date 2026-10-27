# Cursor Brief — Trick Animations

## App rules

These are the rules for trick animations.

- Come and Crawl are not in the app. There is no stool. Dog Place and cat Place are one trick, Jump Up, and it uses a podium for both species.
- In-place tricks keep the facing the pet already has. The head may still turn toward the camera on beats that set `faceCam`.
- A furniture trick runs from the pet's side of the prop. Above or below the prop, the pet runs to the closer of the left or right side first. A tie keeps the side it is already facing. Approaching from the right reverses the path. The prop art stays left-right.
- Trick props are not furniture. A purchase grants one prop into the Prop box. Placements last for the current scene only.
- While a trick is in training, the pet uses one prop. After it is learned, the trick uses every prop of that type on the scene, nearest first. The Learned tricks section has a Prop button that only places props. Holding a placed prop can put it back in the box. Props still clear on a scene change.
- If a learned trick is tapped and none of its props are out, the pet lifts the one prop that purchase granted. Letting go places it and starts the trick.



Shipped scripts live in `src/actor/data/trickScripts.ts`. Each purchasable trick has a success version and three fail versions, played on the app's pose channels, `poseRate` easing, and `jump.ts` physics. `drawActor` renders every channel the scripts use, except the three new ones in §3.

Starter tricks (Sit, Speak, Paw) are unchanged and are not in that script table.

---

## 1. Tricks are step scripts, using the greeting format

`greetings.ts` already runs scripted `GreetStep[]` lists: `dur`, `pose`, `wag`, `sound`, `move` + `untilArrive`, `spin`, `face`, `rate`, `toy`. Tricks use the same shape.

- Trick scripts live in `src/actor/data/trickScripts.ts`.
- Run trick scripts through the same step runner as greetings, extended with the fields below.
- The keys match `catalog_tricks.pet_animation_key`. Map `dog.roll_over` to the `dog_roll_over` script, and so on.

### Step fields (existing fields keep their current meaning)

| field | meaning |
|---|---|
| `label` | Beat name. Not shown to players; useful for debugging and tests. |
| `dur` | Seconds. Optional on `jump` and `sing` steps. With `untilArrive`, it is a maximum. |
| `pose` | Pose targets for this step. Unlisted channels ease back to `defaultPose()`, exactly as greetings do now. |
| `rate` | Per-channel `poseRate` overrides for this step. |
| `wag` | `{ amp, rate }` |
| `sound` | `woof`, `yip`, `whine`, `meow`, `trill`, `howl` (map to the existing clips, as `greetClip` does). |
| `face` | `'flip'`, `1` or `-1` |
| `move` | `{ to, dx, dy, speed, backward, slide, gait, pass }`, described below. |
| **`jump`** | **New.** Calls `jump()`. See §4. |
| **`spin`** | **Changed.** `{ turns }`: a full rotation through the octant ring. See §5. |
| **`toss`** | **New.** Throws the ball toy. See §6. |
| **`carry`** | `'pickup'` or `'drop'`. Reuse the fetch greeting's `toy` pickup and drop. |
| **`clap`** | **New.** A small burst of sparkles at the near front paw (High Five). |
| **`sing`** | **New.** `{ voice, notes: [{ st, d }] }`. See §7. |

### `move` fields
- **Targets:**
  - `to: 'front'`: the existing "front" target (toward the camera, as in the runup greeting).
  - `to: { x }`: a stage x position.
  - `dx`: distance along the facing direction, × pet size.
  - `to: { prop, at }`: one of the prop's derived points (§8).
  - `to: { ball: true }`: the spot where the pet's mouth reaches the ball.
- `dy`: depth offset from the floor line, absolute. Weave uses ±18. Going around a prop uses +30 to +34.
- `speed`: × base walk speed.
- `backward`: keep the current facing (backing out of the tunnel).
- `slide`: move the body without walking the legs (the second half of a roll).
- `gait: 'crawl'`: legs come from the `crawl` channel instead of `walk`.
- `pass`: don't stop at the target; go on to the next step (weave waypoints).

---

## 2. Training flow hookup (training.ts)

1. When the player taps a trick, call `rollTrick` exactly as today.
2. If `ok` is true, play the trick's **success** script. Open the existing "give treat?" reward modal **after the script ends**, not before.
3. If `ok` is false and the trick isn't resting, play a **fail** script chosen by the track's progress:
   - `progress < 34` → `early`
   - `progress < 67` → `mid`
   - otherwise → `almost`
4. Then show "try again?".
5. Each fail script is either the first `take` steps of the success script or its own `steps`, followed by a shared tail:
   - `tilt`: confused head tilt. Use the existing `confused` task if it already looks like this.
   - `sniff`: distracted sniffing.
   - `groom`: cats groom instead of looking confused.
   - `none`
6. A learned trick performed on demand always plays the success script.
7. Furniture tricks first bring their prop out, as in the training-school brief, then play.
8. Block user input that would interrupt a trick while it plays, the same way greetings do. Tapping another trick waits for this one to finish.

---

## 3. New pose channels

Add these to `Pose`, `defaultPose()` (default 0) and `poseRate`.

| channel | poseRate | used by |
|---|---|---|
| `pawHigh` | 8 | High Five |
| `crawl` | 6 | Crawl |
| `stand` | 4 | Stand Tall |

### `pawHigh`
In `footAt`, near front leg only, applied after `paw`. The paw goes above the shoulder and holds still, so it never reads as Paw:
```ts
if (nearFore && pose.pawHigh > 0.001) {
  const px = hip.x + 0.38 * geom.L;
  const py = hip.y - 0.5 * geom.L;
  x += (px - x) * pose.pawHigh;
  y += (py - y) * pose.pawHigh;
}
```

### `crawl`
In `footAt`, right after the stand/sit/lie blend. This adds the trot cycle back on top of the lie feet, at half stride with a low lift:
```ts
if (pose.crawl > 0.001) {
  x += gait.x * 0.55 * pose.crawl;
  y += Math.min(0, gait.y) * 0.35 * pose.crawl;
}
```
- Body bob: `dy -= Math.abs(Math.sin(phase)) * 1.2 * pose.crawl`.
- The leg phase advances from ground speed as usual. A `gait: 'crawl'` move just doesn't raise `walk`.

### `stand` (Stand Tall)
This works like the furniture `rig.rear`: rotate about the **hind hip**, then shift the body so that hip stays planted. `pet.ts` already has this `rearShift` logic, so reuse it.
```ts
const STAND_TILT = 1.12; // ~64°
const rise = -STAND_TILT * pose.stand + Math.sin(t * 5.2) * (0.035 + 0.1 * pose.shake) * pose.stand; // gentle balance wobble
// theta += rise, then apply the rearShift so the hind hip stays where it was
```
- **Front feet:** in `footAt`, tuck them in front of the chest:
  ```ts
  if (fore && pose.stand > 0.001) {
    const px = hip.x + 0.24 * L;
    const py = hip.y + 0.42 * L;
    x += (px - x) * pose.stand;
    y += (py - y) * pose.stand;
  }
  ```
- **Head:** carry it with the torso, like the furniture rear does, and add `+ STAND_TILT * 0.78 * pose.stand` to its pitch so the face stays nearly level.
- **"Wobbles hard" fail:** this is just `shake` on top of `stand`. Don't apply the whole-body `shake` rotation while `stand > 0.3`.

---

## 4. Jump changes (jump.ts)

`JumpRequest` gains three fields:
- `landZ?: number`: the height of the surface it lands on (podium or stool top). Default 0.
- **The jump starts from the current `actor.z`**, so hopping down from a podium works.
  - Solve the airborne arc with `z0 = actor.z`, `v0 = sqrt(2·g·heightPx)`, `tUp = v0/g`, `tDown = sqrt(2·(z0 + heightPx − landZ)/g)`, and `airTime = tUp + tDown`.
  - `z(u) = z0 + v0·u − ½·g·u²`. Landing sets `z = landZ`.
- When `landZ > z0`, raise `heightPx` to at least `landZ − z0 + 0.3 × body height`.
- `knock?: boolean`: on landing, the hurdle bar falls down (the "jumps too low" fail).

Other rules:
- An actor standing on a surface keeps `z = landZ` until the next jump.
- Its shadow sits on that surface.
- Idle wandering must not start while the pet is on a prop, except to hop down.

Script `jump` field → `JumpRequest`:

| script | request |
|---|---|
| `inPlace: true` | `targetX = actor.x` |
| `to: {...}` | `targetX` from §1 |
| `landZ: 'top'` | the prop's top height (`top_left.y`, scaled) |
| `clear: 'bar'` | `obstacleHeight = barZ + 6` |
| `heightPx: 'hoop'` | `hoop centre height − body centre height`, i.e. `center.y·PROP_SCALE + geom.bodyY·scale`, so the body centre passes through the ring |
| `height`, `fast`, `wiggle` | as now |

**Hurdle bar height:**
```ts
barZ = Math.min(anchor.bar_height * PROP_SCALE, heightCapPx - obstacleMargin * worldH - 8)
```
- Like real agility jumps, the bar is set to the pet's size. A puppy, a small breed or a senior gets a lower bar, so every pet can clear it under `heightCap`. Draw the bar at that height.
- Use `jumpConfig.hurdleApproach` and `hurdlePast` for the take-off and landing x.

---

## 5. Spin

The current `actor.spin` only turns to the far side and back, which is a look-back. **Spin `{ turns: 1 }` must turn all the way around through the octant ring:**
- Step `aimOctant` around E → SE → S → SW → W → NW → N → NE → E, spreading the step `dur` over the 8 octants.
- That way the 3/4, front and back views all show.
- Do not fake the turn by squashing the side view.
- `turns: 0.5` ends facing the other way.
- While spinning, march the feet in place (`walk ≈ 0.55`, with the phase advancing).

---

## 6. Ball tricks (Catch, Fetch)

Use the existing ball toy item and its physics.
- **Catch:** throw the ball toward the pet. Use `predictCrossing` at the mouth height to time the in-place hop so the mouth meets the ball at the apex. On contact, the item becomes `carried` (`carry = true`).
- **Fetch (cat):**
  - Throw the ball to the floor away from the cat.
  - The cat stalks to it (`stalk`, `pupils`), wiggles and pounces to the ball's x minus its mouth reach.
  - It picks the ball up, carries it to the front and drops it.
- **Fail scripts:**
  - Dog Catch: the ball falls and the dog sniffs it, or the dog jumps too late, or it catches the ball and drops it.
  - Cat Fetch: the cat bats the ball and loses interest, or lies down with it, or keeps it.

---

## 7. Sing

`sing: { voice: 'woof' | 'meow', notes: [{ st, d }] }`
- Each note plays the species clip with `rate = 2 ** (st / 12)`, where `st` is semitones from the clip's natural pitch.
- The note starts at the running sum of the earlier `d` values. The step lasts the sum of all `d`.
- Use the same `SoundEvent` + `rate` path that `greetClip` uses.
- **Jaw:**
  - Each note opens the jaw like a bark (`bark.open = 1`).
  - Notes longer than 0.6 s hold `jawHold ≈ 0.6` for their full length, like a howl.
- **Pose:** sitting, `headUp` 0.45–0.65, eyes half closed.
- **Melodies in the scripts:**
  - Dog: 0, 2, 4, 7, 4, 2, 0, then a long 12.
  - Cat: 0, 3, 7, 3, 10, 7, then a long 0.
- **Fails:**
  - Early: one bark or meow.
  - Mid: three off-key notes, then gives up.
  - Almost: the last note cracks high, then the pet shakes it off.
- If a pitched clip sounds odd above about +12 semitones, clamp `rate` to 0.6–2.2. Keep the melody shape by transposing it down.

---

## 8. Props in trick animations

**Every training prop works for both dogs and cats.** Jump Up, Jump the Hurdle, Weave, Jump Through Hoop, and Through the Tunnel each have a dog script and a cat script that use the same prop type. The species difference comes from `jumpConfig.dog` vs `jumpConfig.cat`: cats jump higher per body length and do a butt wiggle first, so a fitted hurdle bar usually stays higher for a cat.

`src/sim/trickProps.ts` is the geometry both the path and the art read (`TUNNEL`, `HURDLE`, `HOOP`, `CONES`, and the podium constants). Numbers are in stage pixels, already multiplied by `PROP_SCALE` (1.6).

Derived points the scripts use, where `bl` = pet body length × scale. `sign` −1 runs toward +x. Approaching from the right reverses the path. The art stays left-right. The sign is chosen once, when the pet commits to that prop, and held until the prop is finished. It is not recomputed from the pet's current x, or crossing the middle turns the course around. A trick walks straight to those points. Scene obstacles do not steer it.

| prop | `at` points |
|---|---|
| podium | `approach = x − halfTop − 0.62·bl`, `top = x` at `landZ = 30·PROP_SCALE`, `off = x + halfTop + 0.7·bl` |
| tunnel | `approach = x − half − 0.55·bl`, `mid = x`, `out = x + half + mouth + 1.5·bl` |
| hurdle | `approach = x − hurdleApproach − 0.5·bl`, `landing = x + hurdlePast + 0.5·bl` |
| cones | `approach = path[0].x − 0.75·bl` on the line, `c0…c3 = path[i]` offset by `± CONES.weave` on alternating sides, `out` a body length past the last cone |
| hoop | `approach = x − 0.5·bl − 95`, `landing = x + 0.5·bl + 95` |

Cone side offset comes only from `propPoint`. The `c0`–`c3` steps do not set `move.dy`. Approach may still use `dy`.

### Fitted heights

When a trick starts, `startTrick` fits each of its props once and leaves the height for the rest of the scene:

- A hurdle writes `barZ`: 85% of the pet's jump ceiling, after the obstacle margin, clamped between `barMin` and `barMax`.
- A hoop writes `hoopZ`: the ring center that puts the torso in the lower part of the ring, so the ears clear the top. It is clamped between the lowest ring that still clears the stand and `zMax`.
- The jump then clears `barTop` (hurdle) or uses `hoopApex` (hoop). Unfitted props use the default bar and ring heights.
- If another pet is already mid-trick on that prop, it is not resized or un-knocked. The second pet jumps the height that is already set.

A knocked hurdle does not fall on takeoff. The bar drops when the pet crosses it, or when the jump ends without a crossing.

### Layering

Tunnel, hurdle, hoop, and podium draw in two passes, with the pet between them. `splitsAroundActors` is false for cones: the whole line is one depth-sorted item at `prop.y`, and every pet sorts against that line by its own `y`. Storage glyphs draw every prop in one `'whole'` pass. The pet-only preview does too for cones, and splits the other props so the pet passes through them. The school preview places the pet a short walk before the approach, and keeps the exit inside the distance the pet can actually walk.

- **Tunnel:** openings behind the pet, tube wall in front. The opening sits on the ground line (`TUNNEL.foot` is 0), and a short skirt below that line covers the paws. While the pet is inside the tube, the crawl pose is snapped on, ears flat, and the run through the exit is a fast dash. The exit is a body length past the mouth, so the pet is clear of the tube when the dash ends.
- **Hurdle:** the bar runs across the path. Its far half and the far post draw behind the pet. Its near half and the near post draw in front. The drawn bar height is `barZ`.
- **Hoop:** the back arc is behind the pet and the front arc is in front, so the pet threads the ring. The ring center is `hoopZ`.
- **Cones:** one depth plane at `prop.y`. Weave stops sit about `CONES.weave` to either side, past the 8px "pet in front" threshold.
- **Pet in front of a split prop:** when any pet is more than 8px in front of the prop, that pet draws after both passes.

---

## 9. Ages
The scripts are written for an adult. Apply these on top:
- Jumps already scale by age through `ageJumpMods`. Puppies keep their extra bounce.
- Multiply step `dur` by `motionMods(age).pace` (from greetings) so seniors perform more slowly.
- For seniors, cap Stand Tall at `stand ≤ 0.8` and Crawl speed at 0.8×.

---

## 10. Acceptance checklist
- [ ] All 30 non-starter tricks play their success script with the same beats as Trick Lab:
  - Dogs: 9 plain, Stand Tall, Sing, and 5 furniture tricks (Jump Up, Through the Tunnel, Jump the Hurdle, Weave, Jump Through Hoop).
  - Cats: 6 plain, Stand Tall, Sing, and 5 furniture tricks (Jump Up, Through the Tunnel, Jump the Hurdle, Weave, Jump Through Hoop).
- [ ] Training furniture is shared by species. A cat can train on the podium, hurdle or cones a dog's bundle brought in, and the reverse.
- [ ] A failed roll plays the band's fail script by progress, then "try again?". A success plays the full script, then "give treat?".
- [ ] High Five reads clearly differently from Paw.
- [ ] Spin passes through front and back views.
- [ ] Stand Tall keeps the hind feet planted and the face level.
- [ ] Jump Up lands on top of the podium. The pet sits there, then hops down from that height.
- [ ] The hurdle bar and hoop are fitted to the pet when the trick starts. A small pet or a puppy gets a lower bar, and that pet clears it. A second pet already sharing the prop jumps the height that is already set.
- [ ] The pet is hidden inside the tunnel, passes through the hoop with the ring around its body, and weaves to alternating sides of the cones.
- [ ] Catch meets the ball at the jump apex. Fetch brings the ball to the front and drops it.
- [ ] Sing plays a pitched melody from the existing clips, with the jaw opening on each note.
- [ ] Changing a prop's size or colour (different anchors) still lines up every furniture trick.
