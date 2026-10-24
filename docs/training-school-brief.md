# Cursor Brief — Training School

## Summary

Add **Training School**, a new location the pet can be taken to, like the Pet Shop. It has two jobs:

1. **Trick Shop.** The only place new tricks are acquired. The player previews a trick and buys it with Boops.
2. **Practice area.** The player can practice any trick that isn't fully learned yet, including the free starter tricks. Practicing at the school comes with **free treats**, which is the reason to come back.

A bought trick joins the pet's **In Training** section. That section appears on Home as well, so training can continue anywhere. The training flow itself is unchanged: multiple attempts, a treat offer on success, "try again?" on failure, and the 10-minute rest.

---

## 1. Rules

### Tricks
- **Starter tricks are free and every pet has them from the start: Sit, Speak, Paw.** They begin in In Training at 0% and are never sold.
- **Every other trick is bought at the Training School** with Boops. Once bought, the player can practice it anywhere.
- **Tricks belong to the pet, not the player.**
  - Treats, toys and clothes still belong to the player.
  - A retired pet keeps its tricks, and still has them when it appears as an NPC or playdate partner.
  - A new pet starts with only the three starter tricks, at 0%. Anything else must be bought and trained again.
- **Separate trick lists for dogs and cats.** Each trick is either dog-only or cat-only.
- **Tricks are gated by age stage.**
  - A trick the pet is too young for still shows in the Trick Shop, locked.
  - It displays **"Unlocks at older age"** and cannot be bought.
- **Duplicate purchases are not possible.** A trick the pet already owns, whether in training or learned, shows as "Owned" in the shop.
- **No refunds**, which is consistent with the Pet Shop.
- **All tricks are evergreen for now.** There are no limited-edition or exclusive tricks yet, but the schema leaves room for them later (see §2).

### Training (keep what exists)
- The multi-attempt flow, the treat offer on success, the "try again?" prompt on failure and the 10-minute rest all stay as they are today.
- The number of reps before the rest still depends on the pet's attributes and on whether a treat was given.
- **The rest is per trick, as it is today.** Players may switch to another trick while one is resting. Do not change this.
- **Progress persists.** Tapping a trick's button again resumes from where it left off.
- Each trick raises its own attributes, using the existing system.
- **New:** each trick has a `difficulty` multiplier that scales its learning rate. Harder tricks take longer, and the pet's intelligence still applies as it does now.
- At **100%** the trick graduates:
  - It moves out of In Training and into **Learned Tricks**.
  - Its training button disappears.
  - Its attribute gains stop.

### Learned Tricks
- Tapping a learned trick makes the pet perform it on demand.
- If the pet is busy, handle it the same way props already work: queue the trick, and the pet performs it when free.
- Performing a learned trick costs nothing and gives no progress.

### Free treats at Training School
- This applies when a training attempt succeeds **while the pet is at the Training School**.
- The treat prompt says the treat is free. Example copy: *"Give a treat? Treats are on the house at Training School!"*
- If the player says **Yes**:
  - The full treat effect applies (more progress, bark or meow, the same rep effect as a treat at home).
  - The **net change to the player's treat inventory is zero**.
  - This must work even when the player owns 0 treats. Never show the "out of treats" message at the school.
- If the player says **No**: nothing changes.
- **Implementation:**
  - Skip the inventory debit when the context is the school.
  - Record a ledger entry pair (debit 1, credit 1) or a single zero-net "school treat" event, whichever fits the existing Boops/items ledger more cleanly.
  - The player-facing result must be that the inventory count does not move.
- Outside the school, treats use inventory exactly as they do today.

---

## 2. Data (Supabase catalog + player data)

Tricks go in the catalog alongside the Pet Shop items. They are downloaded during onboarding in the same payload, so practicing works offline.

### `catalog_tricks`
| column | type | notes |
|---|---|---|
| `id` | text PK | e.g. `dog_roll_over` |
| `species` | enum `dog` \| `cat` | |
| `name` | text | |
| `description` | text | one short line for the preview |
| `is_starter` | bool | true for sit/speak/paw; never shown in the shop |
| `price_boops` | int | 0 for starters |
| `min_age_stage` | enum | uses the existing life-stage enum (puppy/kitten → senior) |
| `difficulty` | numeric | learning-rate multiplier, 1.0 = baseline |
| `attributes_raised` | jsonb | e.g. `{ "agility": 2, "obedience": 1 }`, using the existing attribute keys |
| `pet_animation_key` | text | the animation the player's pet performs |
| `demo_animation_key` | text | the generic preview animation |
| `collection` | text | `evergreen` for now |
| `edition` | text nullable | reserved for future limited/exclusive; null for now |
| `sort_order` | int | |
| `is_active` | bool | keep false until both animations exist |

### `pet_tricks` (per pet)
| column | type | notes |
|---|---|---|
| `pet_id` | FK | |
| `trick_id` | FK → catalog_tricks | |
| `status` | enum `in_training` \| `learned` | |
| `progress` | int 0–100 | |
| `rest_until` | timestamp nullable | keeps the existing per-trick rest behavior |
| `source` | enum `starter` \| `purchase` | |
| `acquired_at`, `learned_at` | timestamps | |

- When a pet is created, seed its three starter tricks at 0%.
- If the current local build stores starter-trick progress somewhere else, move it to `pet_tricks`. There are no real players, so test data can be wiped rather than migrated, as with the ledger.
- **Purchase:**
  - Debit Boops through the existing ledger, then insert into `pet_tricks` with status `in_training` and progress 0.
  - Validate four things: the species matches, the pet meets `min_age_stage`, the pet doesn't already own the trick, and the balance is sufficient.
  - Use the same online/offline purchase path the Pet Shop uses for evergreen items.

---

## 3. UI

### "Where to?"
- Add a **Training School** icon button to the existing grid. Show the name only, in the same style as the other locations.

### Training School scene
- A new room in the existing swappable scene system: a training room, with lighting that follows the time of day like other indoor rooms.
- Pet-centric props only, for example training cones, a small hurdle, a training mat and a treat jar on a shelf.
- Dogs and cats can share the room, or have species variants if the scene system makes that easy.
- The pet wanders and idles in the scene as usual.
- The tall scene sits on top, and the two sections below it scroll vertically:

**a) Practice section (shown first)**
- One button for every trick in the pet's `in_training` set, both starter and bought.
- Each button shows its rest countdown, the same as today.
- Use the same glossy, puffy cotton-candy button style as the Home trick buttons.
- A small "Free treats here!" badge or ribbon on the section header, so players know about the perk.

**b) Trick Shop section**
- Laid out like the Pet Shop: cards that scroll horizontally, all of this pet's species only.
- Each card shows the trick's icon or illustration, its name, and its price with the gold paw-print coin.
- Card states:
  - **Available**: shows the price.
  - **Locked**: dimmed, with a lock and "Unlocks at older age".
  - **Owned**: an "In Training" or "Learned ✓" chip.
- Tapping a card opens the **Preview modal**:
  - A looping **generic** demo animation: a standard placeholder dog or cat doing the trick, not the player's pet.
  - The trick's name and its one-line description.
  - The attributes it raises, shown with the existing attribute icons.
  - A **"Learn for X Boops"** button.
  - If the player can't afford it, the button shows *"Not enough Boops"* and a disabled state.
  - If the trick is locked, the button is replaced by "Unlocks at older age".
  - No cart: buying a trick is a single purchase with a one-tap confirm.
- Modals must match the game's fun aesthetic, not system dialogs.

### After the first purchase (tooltip)
- Shown **once per player**, the first time they buy any trick. Persist the flag.
- When the preview closes, highlight the new button in the Practice section and anchor a tooltip to it.
- Example copy: *"Roll Over was added to your In Training section! Practice it here — or anywhere from Home."*
- Use the existing tooltip style, restyled to match the cuddle tooltip redesign.

### Home
- **In Training section:** every `in_training` trick, starter and bought, with the existing buttons and rest countdowns, now driven by `pet_tricks`.
- **Learned Tricks section:** the existing section, also driven by `pet_tricks`. Tapping a trick performs it.
- Treats at Home use inventory as before.

---

## 4. Placeholder catalog (prices, ages and attributes all placeholder)

Players start with 1,000 Boops and accrue about 60 per hour.

**Dogs**
| Trick | Price | Min age | Difficulty | Raises |
|---|---|---|---|---|
| Spin | 150 | puppy | 0.9 | agility |
| High Five | 200 | older puppy | 1.0 | obedience, affection |
| Bow | 250 | older puppy | 1.0 | obedience |
| Roll Over | 300 | adolescent | 1.2 | agility, obedience |
| Sit Pretty | 350 | adolescent | 1.3 | stamina, obedience |
| Play Dead | 500 | adult | 1.5 | intelligence, obedience |

**Cats**
| Trick | Price | Min age | Difficulty | Raises |
|---|---|---|---|---|
| Spin | 150 | kitten | 0.9 | agility |
| High Five | 200 | older kitten | 1.0 | affection |
| Sit Pretty | 300 | adolescent | 1.2 | obedience |
| Jump Up (onto a stool) | 350 | adolescent | 1.2 | agility, boldness |
| Roll Over | 400 | adolescent | 1.4 | agility |
| Fetch (ball) | 500 | adult | 1.5 | intelligence, boldness |

- Match the life-stage names to the enum already in the code.
- Each trick needs two animations: the procedural pet animation and the generic demo animation.
- Keep `is_active = false` on any trick that is missing either animation. A temporary placeholder animation is fine for testing.

---

## 5. Out of scope (do not build)
- Performing tricks during playdates. Learned tricks should simply be readable from `pet_tricks` so playdates can use them later.
- Limited or exclusive tricks.
- IAP or boosts that speed up trick training.
- Final trick art and icons.

---

## 6. Acceptance checklist
- [ ] Training School appears in "Where to?"; taking the pet there opens the training room scene.
- [ ] A new pet has Sit, Speak and Paw in In Training at 0%, and no other tricks.
- [ ] The Trick Shop shows only tricks for the pet's species. Locked tricks say "Unlocks at older age" and can't be bought. Owned tricks show their status.
- [ ] The preview plays the generic demo. Buying debits Boops through the ledger and adds the trick to In Training on both the school and Home.
- [ ] The first-purchase tooltip appears once, anchored to the new button, then never again.
- [ ] At the school, a successful attempt with "Yes" to a treat gives the full treat effect, leaves the treat count unchanged, works with 0 treats, and the prompt says the treat is free.
- [ ] At Home, treats still use inventory, and "out of treats" still appears when the player has none.
- [ ] The rest countdown is per trick, and switching tricks during a rest still works.
- [ ] Progress resumes across sessions and app restarts, and practicing works offline.
- [ ] At 100%, the trick moves to Learned Tricks and can be performed on demand; if the pet is busy, it performs when free.
- [ ] After retiring a pet, the new pet has only starter tricks, and the retired pet keeps its tricks as an NPC.
