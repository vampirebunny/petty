# Cursor Brief: Pet Cam

## Goal

When the player comes back after being away for a while, an overlay sometimes appears that looks like a video player: **"Check out your Pet Cam while you were away."** The player taps play and watches a short clip of their pet doing something funny at home. Daytime clips play in black and white; clips recorded at night play in green night vision.

Reference demo (look and feel only; the art and poses there are placeholders): [Boop Boop Pet Cam.html](Boop%20Boop%20Pet%20Cam.html).

## Global rules

- **Build on existing systems; don't rebuild them.** Clips are short prescripted, seeded scripts, the same idea as playdates. Reuse the playdate beat schema and seeded RNG, the greeting gesture/pose keyframes, the turning system (yaw / `faceCamera` path, never the dead `faceCam` channel), locomotion, the `drawWorld` camera hook, the room/scene renderer, the sky/time-of-day code in `src/actor/sky/`, and the cosmetics renderer.
- **All numbers are defaults.** Put every number (hours, chance, weights, durations, speeds, pet scale, filter values) in a `petCam` section of the gameplay config, not hardcoded.
- **Home rooms only.** Clips happen in the living room, the bedroom, or the catio (cats with a catio only). Never the park, Stadium, Training School, Pet Shop or any other map location.
- **Real furniture only.** A clip uses the furniture that is actually out in that room, at the player's current positions. A clip that needs a piece of furniture the room doesn't have is not eligible for that room.
- **Sofa and bed are scenery, and stay that way.** The living-room sofa and the bedroom bed are part of the room art, not props, and pets don't collide with them. Don't change that. For Pet Cam only, give each one a **nap spot**: a clip-only anchor on its top surface (position, plus a height `z` that lifts the pet onto the cushion, with draw order so it draws on top). Only the Sofa / bed nap clip uses it.
- **Furniture moved in a clip stays put in the game.** Clips that push the water bowl or pet bed move them only in the recording. The live room keeps its real layout.
- **No camera prop in the room** and nothing for the player to tap to find the clip. The overlay appears on its own.
- **Clips don't change game state.** No needs change, no XP, no Boops, no inventory or outfit changes. A clip is a recording, not an event.
- **No speech balloons or on-scene text** besides the camera HUD described below. Clips are silent. A Pet Cam is a webcam recording with picture only: no barks, meows, purrs, or squeaks.
- **Works offline.** Everything runs on the device.
- **Data-driven clips.** Each clip is a definition (id, species, requirements, weight, duration, beats). Adding a clip later should mean adding a definition and any new poses, with no changes to the trigger, overlay or filter code.

## 1. When it shows

- **Trigger moment:** app open (cold start) or app returning to the foreground. Away time is wall-clock since the app last went to the background. A cold start with no stored background time does not qualify.
- **Away time:** show only if it is at least `petCam.minAwayHours = 5`.
- **Chance:** the first clean return of at least 5 hours always shows a clip, once a clip is eligible and none of the skip rules apply. After the player has seen a Pet Cam, later eligible returns show with `petCam.showChance = 0.15`. A missed roll does nothing, and the normal return flow runs.
- **Never show when:**
  - onboarding/adoption isn't finished;
  - another phone holds the play slot, standby is up, or finish-sign-in or sign-back-in is up;
  - the app was opened from a push notification or a deep link (race call, friend request, invite, QR friend add, or a care reminder). The player came for that. A care reminder is a local notification with no `data.kind`;
  - no clip is eligible for this pet in any room;
  - the only eligible clip is the previous one (`petCam.noRepeatLast = 1`).
- **Order on return:** Pet Cam is last. It waits until coin bursts, the greeting, and badge or trick toasts have finished, then it can cover whatever else is still on screen. The greeting blocks only while the stage is actually playing it. If the player backgrounds again before the overlay appears, that showing is dropped. The first-show guarantee remains until they have actually seen one. If a race call comes due during playback, the race call takes the screen and the clip closes.
- **First long return:** if the Welcome Home badge toast has not been shown yet, skip that toast and show Pet Cam instead. The badge is still saved. Came Back can still toast.

## 2. Picking the clip

1. **Recording time (`recordedAt`):** a seeded random time inside the away window, at least 30 minutes after leaving and at least 15 minutes before returning (both config).
2. **Day or night:** use the existing sky phase for `recordedAt`. If that phase is night (after dusk, before dawn), the clip plays in **night vision**. Otherwise, it plays in **black and white**.
3. **Room:** list the rooms the player has (living room, bedroom, catio for cats with one). Pick one at random among rooms with at least one eligible clip.
4. **Clip:** weighted random among clips eligible for this species, the pet's life stage, and that room's furniture and the player's inventory (see each clip's requirements). Never repeat the previous clip (`petCam.noRepeatLast = 1`).
5. **Seed:** one seed drives every random choice inside the clip, so the same record always plays the same.

**Clip record** (keep it so Watch again replays exactly):
`{ clipId, clipVersion, seed, roomId, recordedAt, isNight, petSnapshot (species, breed, coat colors, life stage, age days, outfit worn, attributes as needed), furnitureSnapshot (props in that room, with positions), sweaterItemId if used }`.
Store the most recent 20 locally (config). There is no UI for past clips yet.

## 3. The overlay

Match the demo:

- **Backdrop:** dim the screen (dark plum at about 55%) with a soft blur, over the room. The room underneath is the normal live scene.
- **Card:** dark rounded card (about 26 pt corners), centered.
- **Header row:**
  - a glossy pink rounded-square camera icon;
  - the title **"Check out your Pet Cam"** with a pink subtitle **"while you were away"**;
  - a round **×** close button on the right.
- **Player:** exactly the room's shape (stage width to height), rounded corners, black background.
  - **Before play:** show the clip's first frame, with the filter and HUD, darkened slightly. A big glossy, puffy pink **play** button sits in the center with a gentle pulse.
  - **While playing:** the clip runs. The pink-to-lavender progress bar and the `0:04 / 0:08` time sit below the player.
  - **When it ends:** hold the last frame and show two glossy buttons: **Watch again** (lavender) and **Done** (pink).
- **Closing:** × closes at any time, including mid-clip. Android back does the same. Closing and Done dismiss the overlay. The greeting has already played.
- **Look:** cotton-candy glossy buttons, as on Home. The card should animate in with a small springy rise.
- **Accessibility:** label the play, close, Watch again and Done buttons. With reduce motion on, drop the pulse, camera shake and flash.
- **Audio:** none. The clip is a silent recording.

## 4. The camera look

Render the clip with the existing scene renderer. The player frame has exactly the room's shape (stage width to height), with no margin beyond the room, so a pet that walks past a side wall is cut off. The camera is fixed on the whole room: it never pans or zooms. Then grade the frame with a color matrix (a runtime shader crashed on device), add scanlines, vignette and grain, and draw the HUD on top.

**Black and white (day)**
- Luminance only; contrast about 1.35×.
- Vignette darkening toward the corners (about 60% at the far corners).
- Animated film grain, about ±10 levels per frame.
- Faint scanlines, every other row about 6% darker.

**Night vision**
- Luminance lifted (gain about 1.15, plus a lift); green tint, with highlights near `#d8ffd8` and shadows dark green.
- Stronger grain (about ±17 levels) and stronger scanlines (about 10%).
- Same vignette.
- **Eyeshine:** add a renderer flag that draws the pet's open eyes as bright white with a soft glow, like a real IR camera. Closed eyes stay closed.
- Windows show the night sky as the sky code already draws it.

**HUD** (white in day, pale green in night vision; monospace, e.g. Share Tech Mono, OFL, bundled)
- **Top left:** `CAM 1 · LIVING ROOM` (or `BEDROOM` / `CATIO`).
- **Top right:** `REC` with a red dot blinking once per second. Night shows `IR · REC`. The dot stays red in both modes.
- **Bottom left:** date. **Bottom right:** time, ticking up from `recordedAt` as the clip plays. Use the device locale's date format.
- Thin corner brackets at the four corners.

## 5. Shared clip rules

- **Length:** 7–10 seconds each.
- **Life stage:** the pet looks its current age. Puppies and kittens are a little clumsier (bigger wobbles, more stumbles); seniors are a little slower, except where a clip sets a speed.
- **Outfit:** the pet wears what it is currently wearing, except where a clip overrides a slot.
- **Furniture:** paths go around furniture or use it on purpose. The pet never walks through a prop.
- **Off-frame:** only In and out of the room leaves the frame. Every other clip keeps the pet inside the side walls (`petCam.edgeMargin`). Positions beyond the room are for clip playback only.
- **Seeded variation:** each clip uses its seed for small variations (entry side, depth on the floor, number of passes, which furniture it ends at), so repeats of the same clip don't look identical.
- **Ending:** every clip ends on a calm beat (looking at the camera, napping, or standing proudly) so the hold frame reads well under the Watch again / Done buttons.

## 6. Clips

### 6.1 The Boop
- **Species:** dogs and cats. **Rooms:** any. **Weight:** 0.35 (rare). **Length:** 8 s.

The pet walks toward the camera. The room never zooms: only the pet grows as it moves down the floor to the lens, drawn in front of all furniture.

| Time | Beat |
|---|---|
| 0–2.0 s | Trots in from a frame edge to the middle of the floor. |
| 2.0–2.6 s | Stops and turns to face the camera (`faceCamera` yaw). |
| 2.6–5.0 s | Walks to the lens: moves to the front of the floor while growing from 1× to about 3.2× (`petCam.filter.boopScale`). Sniffs: small head bobs, slight drift side to side. |
| 5.0–5.35 s | Final lean in to about 3.7× (`boopPeak`). |
| 5.3 s | **The boop.** Camera shake (about 9 pt, decaying over 0.6 s), white flash at about 50% fading over 0.45 s. Silent. |
| 5.35–6.3 s | Backs off a little to about 2.6× (`boopHold`). |
| 6.3–8.0 s | Head tilts side to side; one blink near the end. |

Check that the pet holds up at 3.7× scale: line widths and outlines must scale cleanly with no gaps.

### 6.2 Head stuck in a sweater
- **Species:** dogs and cats. **Rooms:** any. **Weight:** 1. **Length:** 8.5 s.
- **Requires:** the player owns at least one top (sweater, hoodie or jacket). Prefer a sweater or hoodie. Use that item's colors and pattern.

**New cosmetic state, `stuck`, for tops:** the top is bunched over the head and neck as a soft lump of fabric in the item's colors and pattern, hiding the head completely. The sleeves dangle loose and swing with the existing swing-spring physics. The body behind the shoulders shows normally. The tail and ears stay hidden or visible according to the existing outfit rules.

| Time | Beat |
|---|---|
| 0–1.0 s | Already stuck: stands in the room, the fabric lump turning left and right. |
| 1.0–5.5 s | Runs around blindly in short bursts at normal run speed. It bumps into furniture or the frame edge 3 times (config): it stops short, bounces back a little and turns. One backward shuffle. Head shakes make the fabric jiggle. Silent. |
| 5.5–6.5 s | One big full-body shake, and the head pops out through the neck hole with a small bounce. The top now renders as normally worn. |
| 6.5–8.5 s | Looks at the camera, proud, tail wagging. |

This only happens in the recording: the pet's real outfit doesn't change.

### 6.3 Tail chase
- **Species:** dogs only. **Rooms:** any (needs open floor about 1.5 body lengths wide). **Weight:** 1. **Length:** 8 s.

Use the turning system so the spin turns through the in-between views, never a flat flip.

| Time | Beat |
|---|---|
| 0–4.2 s | Starts chasing its tail in a small circle in place, spinning faster and faster (about 3 turns at the start, about 10 by the end). |
| 4.2–5.4 s | Stops and is dizzy: staggers with uneven steps, body and head wobble, eyes half closed. |
| 5.4–5.8 s | Flops down onto the floor. |
| 5.8–8.0 s | Lies there, tongue out, tail thumping, then looks at the camera. |

### 6.4 In and out of the room
- **Species:** dogs and cats. **Rooms:** any. **Weight:** 1. **Length:** 9–10 s.

| Time | Beat |
|---|---|
| Passes | Sprints across the room at **2× the pet's fastest existing run speed** and runs **fully out of frame**. The empty room holds for 0.6–1.0 s (the empty-room pause is the joke). Then it comes back in, at a different depth on the floor, and runs out again. **4 passes** (config range 3–5, seeded), alternating sides, with paths that avoid furniture. |
| Last pass | Slows from a sprint to a trot as it reaches the bed (or the rug or open floor if no bed is out). |
| End | Circles once and collapses into a nap: lies down, eyes close, slow breathing. Holds to the end. |

Seniors use the same 2× speed; this clip is the exception to "seniors are slower."

### 6.5 Walking on its hind legs
- **Species:** dogs and cats. **Rooms:** any. **Weight:** 1. **Length:** 8 s.

**New pose: `hindStand`.**
- The body pitches up around the hips to about 75° from horizontal.
- Front legs bend with the paws held up near the chest.
- The head stays upright and the tail is used for balance.
- **Walking:** small alternating hind-leg steps, the body swaying, the front paws pedaling a little.
- **Implementation:** extend the existing sit body-pitch so it can go much further, and add a front-leg tuck channel. Use pose channels that actually render.

| Time | Beat |
|---|---|
| 0–1.0 s | Stands normally. |
| 1.0–1.6 s | Rises up onto its hind legs. |
| 1.6–5.0 s | Toddles across about a third of the room, wobbling. |
| About 5.0 s | Nearly tips over and saves itself with quick little steps. |
| 5.8–6.4 s | Drops back onto all four legs. |
| 6.4–8.0 s | Looks at the camera, tail wagging. |

Puppies and kittens wobble more and drop down sooner (about 4.0 s).

### 6.6 Sofa / bed nap
- **Species:** dogs and cats. **Rooms:** living room (on the sofa) and bedroom (on the bed). **Weight:** 1. **Length:** 8.5 s.
- The pet is already asleep on the sofa or bed when the clip starts, lying on the nap spot (see Global rules). There's no jump-up or climb animation, so no collision changes are needed.
- If no side-lying pose exists, add one (`sideLie`): the body flat on its side, the legs extended out together. It's also used for the dream paddle below.

| Time | Beat |
|---|---|
| 0–2.0 s | Curled up asleep, slow breathing. |
| 2.0–3.2 s | A long, slow stretch: front legs reach out, back arches, toes spread. |
| 3.2–4.0 s | Rolls onto its side (`sideLie`). |
| 4.0–6.0 s | Dreaming: legs paddle in little bursts, ears twitch. Silent. |
| 6.0–7.0 s | One eye half opens toward the camera, then closes again. |
| 7.0–8.5 s | Sleeps on, slow breathing. |

This clip suits night vision especially well; no change in weighting is needed for that.

### 6.7 Pushing the water bowl around
- **Species:** dogs and cats. **Rooms:** any room where the water bowl is out. **Weight:** 1. **Length:** 9 s.

| Time | Beat |
|---|---|
| 0–1.0 s | Walks up to the water bowl and sniffs it. |
| 1.0–7.0 s | Pushes the bowl across the floor. **Dogs:** with the nose, head low, walking slowly behind it; the bowl slides ahead in short pushes. **Cats:** bats it with a front paw in quick little taps, then follows it. Water sloshes with a few droplets at each push. The path goes around other props (2–3 changes of direction, seeded) and stops at room edges. |
| 7.0–8.0 s | The bowl ends somewhere odd, e.g. in a corner or against a prop. |
| 8.0–9.0 s | The pet sits beside it and looks at the camera. |

The real bowl doesn't move (see Global rules).

### 6.8 Pushing the pet bed around
- **Species:** dogs and cats. **Rooms:** any room with a pet bed out (standard or premium; not cat furniture). **Weight:** 1. **Length:** 9.5 s.

| Time | Beat |
|---|---|
| 0–1.0 s | Walks to the bed and stops at its edge. |
| 1.0–7.0 s | Moves the bed across the room. **Dogs:** grab the rim in their mouth and drag it backward in tugs; the bed scrunches a little with each tug (a squash on the bed's draw). **Cats:** push it with head and shoulders in short shoves, with pauses to sit and look at it. The path avoids other props (seeded) and stops at room edges. |
| 7.0–8.0 s | Stops at a new spot (in front of the window when possible). Circles once. |
| 8.0–9.5 s | Lies down in it, satisfied, eyes closing. |

The real bed doesn't move.

## 7. Dev tools

There is no debug menu entry. The clips were tuned with a temporary one, then it was removed. Check clips through the tests in `src/petCam/__tests__/`, or by lowering `petCam.minAwayHours` locally and backgrounding the app.

## 8. Testing

- **Deterministic:** the same clip record renders the same frames every time. Test each clip by sampling frames at fixed times.
- **Furniture:** for each clip, room and species, render with several furniture layouts (empty room, every prop out, props at the edges) and check that the pet never overlaps a prop where it shouldn't.
- **Eligibility:**
  - The sweater clip never appears without an owned top.
  - The water bowl and pet bed clips never appear in a room where that item is in Storage.
  - The sofa/bed nap appears only in the living room or bedroom.
  - Cat-only and dog-only clips stay with their species, and catio clips appear only for cats who have a catio.
- **Nap spots:** the pet sits on the sofa and bed cushions for every breed and life stage, from the smallest kitten to the biggest adult dog, with nothing floating or sunk in.
- **Live room unchanged:** after the water bowl or pet bed clip, the live room shows those items in their real positions.
- **Trigger:** no overlay under 5 hours, when opened from a notification or deep link (including a care reminder), or when another phone, standby, or sign-in holds the screen. The first clean return of at least 5 hours always shows. Later eligible returns show about 15% of the time. Never the same clip twice in a row. A background before the overlay appears does not use up the first show.
- **Night:** a `recordedAt` at 2 AM is night vision with eyeshine. A `recordedAt` at 2 PM is black and white.
- **Performance:** holds 60 fps with the filter on a mid-range Android phone. If not, render the clip surface at a lower resolution and scale it up; the grain hides it.

## Out of scope

- Sharing or exporting clips. There are no plans to build that.
- A screen of past clips.
- More clips can be added later as definitions.
- Analytics beyond the two events in [Boop Boop Analytics — Cursor Brief.md](./Boop%20Boop%20Analytics%20%E2%80%94%20Cursor%20Brief.md): `pet_cam_shown` and `pet_cam_played`.
