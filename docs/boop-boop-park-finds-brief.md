# Cursor Brief: Park Finds + Treasure Chest

This replaces the earlier park finds brief. The big change: **the player does not tap find spots.** The pet notices something on its own, at random, and a prompt says "[name] seems to have found something!" The player taps **"Let's see!"** to send the pet after it, watches the find, then adds it to the pet's collection, which lives in a Treasure Chest at home.

Build on existing systems (park scene, pet pose channels in `pet.ts`, scene props and `propKinds` in `scenes.ts`, furniture Move / Put away / Storage, tooltips, modals, scene weather / time of day / moon calendar, Supabase catalog). Do not rebuild them.

## Related paths

| Path | What it is |
| --- | --- |
| `docs/boop-boop-park-finds-brief.md` | This document |
| `src/parkFinds/park-finds-catalog.json` | Bundled catalog rows (also seeded via Supabase migration) |
| `assets/park-finds/finds-2x/`, `finds-3x/` | Runtime color PNGs (no `@2x` in the filename — Metro treats that as a scale suffix) |
| `assets/park-finds/silhouette-2x/`, `silhouette-3x/` | Runtime silhouettes, color `#54467A` |
| `assets/park-finds/chest/`, `cube/` | Chest and cube PNGs (+ SVG sources beside them) |
| `assets/park-finds/svg/` | Find SVG sources for future edits. Don't render these at runtime |
| `docs/park-finds-reference/*.html` | Timing references and early screen mocks. Pets in them are stand-ins: copy **timing and motion**, draw with the real pet rig |

## Global rules

- **Every number is a default.** Put them in a `parkFinds` section of the gameplay config.
- **Finds belong to the pet.** A new pet starts with an empty collection. The Treasure Chest is the **player's** furniture (it stays when a pet is retired) and always shows the current pet's collection.
- **No Boops from finds.** First-find XP is paid from level 10 (common 10, uncommon 25, rare 75, legendary 150). A find before level 10 sets `firstFindRewarded` and pays nothing. Badges still listen later.
- No speech balloons. Use the pet's existing bark, meow and purr sounds.
- Cotton candy style for modals and buttons: glossy, puffy.
- Works fully offline.
- Unlock: finds stay available from level 1. `unlockGated` is false. Do not gate them at level 6.

---

## 1. Catalog

Fields: `id`, `name`, `species` (`dog` | `cat` | `both`), `rarity` (`common` | `uncommon` | `rare` | `legendary`), `condition_type` (`always` | `season` | `weather` | `time` | `moon` | `date_window`), `condition_value`, `sort_order`, `art_key`, `active`. `art_key` matches the file names in `assets/park-finds/finds-2x/` (and the SVG sources in `assets/park-finds/svg/`).

**Seeding.** Use the same path the existing Pet Shop / Training School catalog rows use; check the repo for the existing migration or seed. Add park finds as a new item type in that catalog (or a sibling `park_finds` table if the existing table can't hold these fields cleanly). Seed it from `park-finds-catalog.json` in a migration, so it's repeatable.

**Offline.** Bundle `park-finds-catalog.json` and the PNGs in the app as the baseline, so finds work on a fresh install with no network. When online, the app downloads the catalog the same way it already does and uses those rows instead, matched by `id`. A catalog row whose art isn't in the bundle yet is skipped until an app update ships the art.

Adding an item later needs only a catalog row plus its art in the next app update; no code changes.

## 2. How a find happens (pet notices, player says "Let's see!")

Finds only happen **in the park**, only when unlocked, and only when the pet notices something. The player can't start one, but they decide whether the pet goes after it.

**When the pet notices**
- **Not every visit, and at most once per visit.** A visit runs from entering the park scene until leaving it.
- **The pet's first completed find is guaranteed** (`firstVisitFindChance` = 1.0). Track this per pet with a `firstFindVisitDone` flag. Finds are not level-gated, so this is the first park visit that records a find. Set the flag only when an item is actually revealed, so an ignored prompt or an early exit carries the guarantee to the next visit.
- Every later visit: when the player enters the park, roll `visitFindChance` (0.15). If it fails, nothing happens this visit.
- If it succeeds, pick a random notice time `noticeMinSec`–`noticeMaxSec` (20–90) of park time. When that time comes, wait until the pet is **idle** (no task, not carrying a toy, not mid-play, no player input for `idleSec` = 4), then the pet **notices** something.
- After that one notice, whatever happens (found, ignored or left), there are no more finds until the next visit.

**The notice and the prompt**
1. Pick the spot (see "Where").
2. The pet stops, perks its ears, turns its head toward the spot and wags. A dog sniffs the air toward it. For a cat, the grass tuft grows in and rustles, or the bush shakes softly.
3. The pet makes one bark or meow, and the prompt slides down from the top of the scene (see `docs/park-finds-reference/ScreenPrompt.html`):
   - It's a glossy cotton-candy card just under the header. It must never cover the pet.
   - Text: **"[Pet name] seems to have found something!"**
   - One button: **"Let's see!"**
   - No close button.
4. While the prompt is up, the pet stays put, glancing between the player and the spot, and the cue keeps going.
5. **"Let's see!"** closes the prompt, rolls the item, and starts the find animation at the trot or stalk beat (section 3).
6. **Ignored:** the prompt does **not** auto-timeout. It stays until the player taps **"Let's see!"** or uses another action. If ignored via another action, the cue stops and the grass tuft shrinks away. No item is found, and that was this visit's chance.
7. **Another action:** if the player uses any other action while the prompt is up (care button, play, pat, leaving, tapping props, furniture Move, Storage, Collection, scene chrome), treat it as ignored: dismiss the prompt and run the action.

**What** (rolled when the player taps "Let's see!")
- Eligible pool: this species or `both`, `active`, and condition true right now: season (existing seasonal-decor logic), weather (`rain`, `snow`, `rainbow` from the scene), time (`dawn`, `night`), moon (`full`, night only, from the moon calendar), date window (local date, inclusive, may cross new year).
- Roll rarity with `rarityWeights` (common 65, uncommon 25, rare 9, legendary 1). Pick a random eligible item of that rarity; if none, fall back to the next more common rarity. Do not bias toward unfound items.

**Where** (a new place every time)
- A random point on the park floor: `x` in `floor.xMin + 60 … floor.xMax − 60` (inside the visible stage, respecting `stageBleed`), `y` in `floor.yMin + 30 … floor.yMax − 40`.
- At least 140 stage units from the pet, 70 from any prop footprint or POI, and not in the pond.
- **Dogs:** always dig at that point.
- **Cats:** with chance `bushChance` (0.4), if the scene has a `bush` prop, use the bush instead (target point: the bush's base, at `max(bush.y + 18, floor.yMin + 10)`). Otherwise spawn a temporary **tall-grass tuft** at the point.

**Interruptions**
- While a find is running (about 8 seconds), player actions (care buttons, play, pat) are **queued** and run when it finishes. Same as tapping a prop while the pet is busy today.
- **The item is saved the moment it is revealed** (pops out of the hole, grass or bush), not when the button is tapped. If the player leaves the park after the reveal, show the find modal on the **park's exit destination** once that screen is interactive. At most one deferred modal (one find per visit). If they leave before the reveal, cancel the find: nothing is saved.

## 3. Animations

Open the references and match the beats and timing:
- `docs/park-finds-reference/AnimDog.html`: dog digs
- `docs/park-finds-reference/AnimCatGrass.html`: cat pounces into grass
- `docs/park-finds-reference/AnimCatBush.html`: cat bats at a bush

Each reference has a timeline bar with a playhead. Walking and stalking legs run as long as the distance needs (use the existing walk task and gait); the other beats have fixed durations.

The **Notice** and **Cue** beats below happen before the prompt (section 2). After "Let's see!", the animation picks up at **Trot** (dog) or **Stalk** (cat). The references show the whole sequence without the pause for the prompt.

**Both dogs and cats carry the find back.** The cat references end with the cat sniffing the item where it landed; follow the tables below instead, which add the grab, the carry to the front and the drop.

**New pose channels** (add to `Pose`, blended like the others):
- `dig`: the fore paws alternate a reach-forward (+0.45 L ahead of the hip, lifted) and a pull-back (−0.3 L) at 4 Hz. Near and far paws are half a cycle apart.
- `swat`: the near fore paw does fast swipes at about 3 Hz. Low swipes pat the ground when combined with `crouch`; high swipes reach up when combined with `rearUp` and `pawHigh`. This channel will be reused for the Swat competition later.

Existing channels used below: `headUp`, `headDown`, `earBack`, `wagAmp`, `tailLift`, `bow`, `stalk`, `crouch`, `wiggle`, `tuck`, `land`, `rearUp`, `pawHigh`, `jawHold`, `sit`. Carrying uses `toyMouthStage`, same as toys.

### Dog: sniff, dig, fetch

| Beat | Time | What happens |
| --- | --- | --- |
| Notice | 0.6s | Stops, `headUp`, ears perk forward, tail lifts, one bark |
| Trot | as needed | Existing walk to the spot, arrives facing it |
| Sniff | 1.0s | `headDown` with 3 nose-to-ground bobs, fast wag |
| Dig | 2.0s | `bow` ~0.6 (front low, rump up), `dig` 1, `headDown` 0.5, fast wag. Dirt clods fly back under the body; the hole and mound grow (see Particles) |
| Pop! | 0.6s | Item pops out of the hole in an arc (up ~56, forward ~30 units) and lands with a squash. The dog hops (`land`) and looks at it |
| Grab | 0.6s | `headDown` to the item, `jawHold` 1, item attaches at `toyMouthStage` |
| Bring it back | as needed | Trots to the front center (`x` = stage center, `y` = `floor.yMax − 120`), facing the player |
| Drop | 0.4s | Lowers head, releases; item lands in front. `sit` proudly with a wag. The find modal opens 0.3s later |

### Cat: rustling grass → pounce

| Beat | Time | What happens |
| --- | --- | --- |
| Cue | 1.5s | The grass tuft grows in over 0.3s at the spot and rustles (±7° at 4 Hz) |
| Notice | 0.6s | Freezes, ears forward, `headUp`, tail tip twitches. No sound (stalking) |
| Stalk | as needed | `stalk` 1, `crouch` 0.6, slow gait, head low and level, tail low. Stops ~110 units short |
| Wiggle | 0.8s | `wiggle` 1, deeper crouch, fast tail-tip twitch |
| Pounce | 0.6s | Jump arc onto the spot (~45 units high): nose up at launch, `tuck` in the air, fore paws reach forward, `land` nose-down |
| Paw at grass | 1.2s | `swat` low pats on the near paw, far paw pinned forward, `headDown`. Grass blades fly; tuft shakes hard |
| Pop! | 0.6s | Item pops up between the paws; the cat flinches back slightly (`earBack` blip), then leans in |
| Sniff | 0.8s | Nose to item with 2 bobs, tail curls, purr |
| Grab | 0.6s | `headDown` to the item, `jawHold` 1, item attaches at `toyMouthStage` |
| Bring it back | as needed | Trots to the front center (same point as the dog), tail up, facing the player |
| Drop | 0.4s | Lowers head, releases; item lands in front. `sit` proudly. The find modal opens 0.3s later |

### Cat: shaking bush → bat

| Beat | Time | What happens |
| --- | --- | --- |
| Cue | 1.5s | The bush shakes softly (±1.5° at 2 Hz) |
| Notice | 0.6s | As above |
| Stalk | as needed | To the bush base, fore paws ~20 units from the bush edge |
| Wiggle | 0.6s | As above |
| Rear up + bat | 1.8s | `rearUp` 1, near paw `pawHigh` + high `swat` (~3 Hz), far paw raised, `headUp`. Bush shakes hard (±4° at 8 Hz); leaves fall |
| Falls out | 0.7s | The item drops from the bush top. Light items (feather, petal, leaf, dandelion, paper boat, party hat) flutter side to side while falling; everything else drops with one small bounce. The cat drops back to all fours and its head follows the item down |
| Sniff, grab, bring back, drop | as above | Same as the grass version, then the find modal opens |

### Legendary finds
- The dig, paw-at-grass or bat beat runs **0.5s longer**.
- At the reveal, a soft gold glow flashes at the spot (a radial glow that fades over 0.4s, no star or sparkle shapes).
- The pet does a happy spin (two quick turns using the existing in-between turn views) before the modal.

### Particles and decals
- **Dirt clods** (dog): 2.2–3.4 unit circles in `#8A5A2B`, `#6E4422` and `#9A6A3A`. One spawns from the fore paws every 0.125s, arcs up ~38 units and back ~84 units over 0.5s, and fades.
- **Hole:** dark ellipse `#4A2E16`, growing from 0 to 18 × 5 units at the fore paws over the dig.
- **Mound:** half-ellipse `#8A5A2B` (52 × 15) behind the fore paws, growing over the dig.
- Hole and mound stay for the rest of the visit, fade out after 90s, and keep at most 3 at a time.
- **Grass blades** (cat): 4 short green strokes thrown up and out, looping every 0.4s while pawing.
- **Tall-grass tuft:** shrinks away 1s after the modal closes.
- **Leaves** (bush): reuse the scene's existing leaf particle, 3 at a time, falling ~46 units while spinning.
- **Item in the scene:** draw the find PNG about 28 stage units tall, with a small ground shadow.

## 4. The find modal

See `docs/park-finds-reference/ScreenFound.html`.

- **Title:** "[Pet name] found a [Item]!". Use "an" before a vowel sound: "Biscuit found an Old compass!"
- **Item art:** large, on a warm glow disc, floating gently.
- **New! tag:** shown the first time this pet finds the item.
- **Rarity chip:** Common `#CFC3EA` · Uncommon `#9FE6C6` · Rare `#9FD3FF` · Legendary is a gold gradient chip.
- **Next to the chip:**
  - For conditional items, the modal line from the condition copy table below.
  - "Found 4 times" for repeats.
- **Button:** one glossy **"Add to collection"**. Tapping it closes the modal with the item shrinking and fading. The item was already saved at the reveal.
- **Sound:** the pet's bark or meow plays when the modal opens. Rare and legendary finds get an extra happy sound.

## 5. Treasure Chest

**Art:** `art/chest/chest-closed`. The lid always stays closed. Draw it about 110 stage units wide, on the `sorted` layer like other furniture.

### First time home (see `docs/park-finds-reference/ScreenChestIntro.html`)

1. **Trigger:** the player enters any **player-owned room** (`scene.playerOwned`) while:
   - the pet has at least one find,
   - the chest has never been placed,
   - this intro hasn't been shown.
2. Wait for the existing scene open and the pet's run-in greeting to finish.
3. Show a modal with the closed chest art, the message **"Your collection is stored in your Treasure Chest"** and one button, **"Place treasure chest"**.
4. On tap, place the chest automatically near the **back** of the room:
   - `y` = `floor.yMin + 24`.
   - `x` = the first free spot, trying right of center, then left. It must not overlap prop footprints or POIs (use the furniture free-spot logic if there is one).
   - It drops in with a bounce (scale 0.6 → 1.08 → 1) and a small dust puff.
5. Show a tooltip anchored above the chest: **"Tap the treasure chest to view your collection."** It stays until the player taps anywhere on the stage (or the chest). Persist that flag.

### As a prop

- Add `treasureChest` to `propKinds`. It is one chest per player, with id `treasure-chest`. It is free and not sold in the Pet Shop.
- **Tap** opens the Treasure Chest page.
- **Hold** opens the existing Move / Put away modal, the same as every other prop.
- **Put away** sends it to Storage. From Storage the player can take it out into any player-owned room, through the existing flow.
### Collection button on Home

- Add a glossy **"Collection"** button right next to **Storage**, with the small closed-chest art as its icon (see the right phone in `docs/park-finds-reference/ScreenChestIntro.html`).
- It opens the Treasure Chest page from anywhere, even when the chest is in Storage or not placed yet.
- Show it whenever park finds are unlocked.

## 6. Treasure Chest page

`docs/park-finds-reference/ScreenCollection.html` is an early mock (2-column glass cubes). **Ship the layout below**, not the mock.

**Layout**
- Dark background `#1E1630`.
- **Header:**
  - Glossy round back button (top left) that returns to the room or screen the player came from.
  - Title "Treasure Chest", subtitle "[Pet name]'s park finds".
- **Progress:** "X of Y found" (no progress bar fill required).
  - Y counts this species' items plus `both` items.
  - Holiday items count only after their date window has come around once since adoption. **Compute this, don't store it:** a holiday item is shown if the pet has found it, or if any yearly occurrence of its window overlaps the span from the adoption date to today (local dates). No flags to persist or sync.
- **Grid:** **3 columns**, in `sort_order`, scrolling vertically. Cell width ≈ `(listWidth − pad×2 − gap×2) / 3`, capped around 112pt.

**Each cell** (no cube frame):
1. Soft light pool under the item (`#FFF8E6` at ~55%, ellipse, centered under the art).
2. Item art (120 × 150 aspect), filling most of the cell (~0.92 × cell width), floating above the light.
3. Caption centered under the art.

Cube PNG layers (`cube-back` / `cube-front`) stay in the art folder for optional future use; the collection page does not draw them.

**Float:**
- Each item bobs a few points while rotating −1.5° → 1.5°.
- Each cell gets its own random duration (2.8–3.8s) and random start phase, so the grid never moves in sync.
- The light pool shrinks slightly (to 0.9) as its item rises.
- Respect reduce-motion.

If the player switches pets or retires the current pet while the Treasure Chest page is open, **remount** the page to the new pet's collection (or empty). Do not dismiss or navigate away.

**Found item**
- Full color art.
- Name (centered).
- Rarity color + "Found once" or "Found N times".
- **New!** tag until the page has been viewed with it. Clear on leaving the page.

**Not found yet**
- The silhouette PNG.
- The real item **name** (muted), not "???".
- No season / condition second line on the collection page.

**Condition copy.** Keep this in one map keyed by `condition_type` + `condition_value`, so new items reuse it. **The find modal uses the full line.** The collection page does not show condition icons or labels. Holiday lines are keyed by the date window, not the item.

| Condition | Modal line | Collection icon | Collection label |
| --- | --- | --- | --- |
| season `spring` | Found in spring | blossom | Spring |
| season `summer` | Found in summer | sun | Summer |
| season `fall` | Found in fall | leaf | Fall |
| season `winter` | Found in winter | snowflake | Winter |
| weather `rain` | Found in the rain | raindrop | Rain |
| weather `snow` | Found in the snow | snow cloud | Snow |
| weather `rainbow` | Found under a rainbow | rainbow | Rainbow |
| time `dawn` | Found at dawn | sunrise | Dawn |
| time `night` | Found at night | moon | Night |
| moon `full` | Found under a full moon | full moon | Full moon |
| date `02-10..02-14` | Found around Valentine's Day | calendar | Feb 10–14 |
| date `10-25..10-31` | Found around Halloween | calendar | Oct 25–31 |
| date `12-20..12-26` | Found during the holidays | calendar | Dec 20–26 |
| date `12-31..01-01` | Found at New Year's | calendar | Dec 31–Jan 1 |
| `always` | (no line) | (none) | (none) |

**No finds yet:** all silhouettes, plus the line "Take [pet name] to the park to find treasures."

## 6b. Art at runtime and performance

The goal is no lag or stutter, including on mid-range Android phones.

**Art**
- **PNG only at runtime.** Never parse or render the SVGs in the app; gradients, clips and patterns are slow, and Skia's SVG support is partial. The SVGs are source files for future edits.
- **Decode once, cache, load lazily.** Turn each PNG into a Skia image once, cache it by key, and share it across screens. Only load what's about to be on screen; don't decode all 42 up front.
- **Which size where:**
  - @2x for collection cells, the chest prop and items in the park scene.
  - @3x only for the large art in the find modal.
- **Silhouettes:** always the silhouette PNGs. No runtime color filters or tinting.
- **Acorn / golden acorn:** drawn compact (short nut, wider cap). Prefer the SVG sources under `assets/park-finds/svg/` when regenerating PNGs.

**Collection page**
- Use a virtualized list (FlashList or FlatList), so only visible rows render.
- Run the float on the UI thread with Reanimated (`useFrameCallback`). Each cell computes its own offset from its duration and phase. Never use React state per frame.
- With reduce-motion on, everything is static.

**In the park**
- Draw the item, particles and decals in the existing scene canvas. No extra canvases.
- Reuse a small particle pool with at most 12 dirt clods or blades alive at once.
- Draw the hole and mound as plain shapes.

**Test:** hold 60 fps while scrolling a full collection and during a dig on a mid-range Android device.

## 7. Data

**Per pet**, local first and synced where pet data syncs. Not in the Boops/items ledger:
- `item_id`
- `count`
- `first_found_at`
- `last_found_at`
- `first_find_rewarded` (always false for now)
- `seen` (false until viewed on the Treasure Chest page)
- `firstFindVisitDone`

Retiring a pet deletes its park-find rows with the pet. The Treasure Chest furniture and player chest flags stay.

**Per player:**
- The chest as a normal furniture record (room, x, y, or in Storage).
- `chestIntroShown`
- `chestTooltipDone`

**Per park visit (local only):**
- Whether this visit has a find, its notice time, and whether it has been used.
- Decals (holes and mounds).

## 8. Hooks for later phases

Emit once per find, at the reveal:

```
parkFind.found { petId, itemId, rarity, isNew, foundAt }
```

Listeners:
- First-find XP is wired: 10 / 25 / 75 / 150, paid only from level 10.
- During levels 1–10, a recorded find is one tutorial action and can raise the level at any time. A find already in the collection counts.
- Treasure Hunter and Finder are awarded from the collection. Ribbon Rack waits for the Stadium.
- The "find something new" suggested activity is not built yet.

## 9. Debug menu

- Trigger the notice and prompt now (pick species variant: dig / grass / bush)
- Force rarity, or force a specific item
- Override season, weather (rain, snow, rainbow), time (dawn, night), full moon and date
- Reset this pet's collection (also clears `firstFindVisitDone`)
- Reset the chest intro (un-place the chest and clear its flags)

## 10. Acceptance checklist

- Some park visits have no find at all; none have more than one. The notice comes at a random time and place, never while the pet is busy.
- The prompt slides in without covering the pet and stays until "Let's see!" or another action. "Let's see!" starts the find; another action dismisses it, with no item for the rest of the visit.
- The dog notices, trots, sniffs, digs with alternating paws and flying dirt, the item pops out, and the dog brings it to the front and drops it.
- The cat stalks, wiggles and pounces on rustling grass or rears up and bats a shaking bush; the item pops up or falls out, and the cat carries it to the front and drops it.
- Holes and mounds stay for the visit and fade.
- Legendary finds have the longer beat, the gold glow and the spin.
- The find modal shows the right name, article, art, New! tag, rarity and condition line. The item is saved even if the player leaves right after the reveal.
- First visit to a player-owned room after the first find: modal → chest placed near the back → tooltip until tapped.
- Tap on the chest opens the page; hold gives Move / Put away. Put away → Storage → take out into another room works.
- The Collection button next to Storage opens the page from anywhere. The back button returns to where the player was.
- The page shows floating finds over light pools (3 columns), silhouettes with real names, the progress count and New! tags.
- Everything works in airplane mode, and all numbers live in the config.

## Decisions

1. The pet's first park visit always has a find. After that, 15% of visits have one, never more than one per visit.
2. The prompt does not auto-timeout. It stays until "Let's see!" or another action; ignoring via another action spends the visit's find.
3. The chest follows the existing prop pattern: tap opens the collection, hold opens Move / Put away.
4. The chest lid always stays closed.
5. Dogs and cats both carry the find to the front center before the modal.
6. Player actions are queued during a find rather than cancelling it.
7. Holiday slots are hidden until their date has come around once.
8. Deferred find modal opens on the park's exit destination once interactive; at most one per visit.
9. Any other player action while the prompt is up (not only care/play/pat/leave) dismisses it as ignored.
10. Treasure Chest page remounts to the new pet's collection on pet switch or retire while open.
11. Retiring a pet deletes its park-find rows; chest furniture and player chest flags stay.
12. v1 ships as Slice 1 (find loop: catalog, notice, anim, modal, debug) then Slice 2 (chest + collection).
13. Collection page: 3 columns, no cube frames, light pool under large floating art, real names for unfound items (no `???`, no condition labels on the page).
14. Carried find art is gripped at `mouthMark` (lower third of the sprite), same for dog and cat.

## Status

**Slice 1 and Slice 2 are shipped.** First-find XP, the tutorial level-up, Treasure Hunter, and Finder are wired. Still later: race badges and the "find something new" suggestion. Debug still has force-notice / reset collection / reset chest; force-rarity and force-item hooks exist in roll code but are not exposed as dedicated DebugPanel buttons yet.
