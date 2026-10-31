# Cursor Brief — Training School

## Summary

Add **Training School**, a new location the pet can be taken to, like the Pet Shop. It has two jobs:

1. **Trick Shop.** The only place new tricks are acquired. The player previews a trick and buys it with Boops.
2. **Practice area.** The player can practice any trick that isn't fully learned yet, including the free starter tricks. Practicing at the school comes with **free treats**, which is the reason to come back.

A bought trick joins the pet's **In Training** section. That section appears on Home as well, so training can continue anywhere. The training flow itself is unchanged: multiple attempts, a treat offer on success, "try again?" on failure, and the 10-minute rest.

## Decisions

These override anything below that still reads the other way.

- Sit, Speak, and Paw are free starters and are never sold. Paw stays locked until Sit and Speak are mastered. For cats, that starter is still labeled High five.
- The shop list is the real catalog below. Come and Crawl are not shipped. Jump Up is the podium trick for both dogs and cats. There is no Place trick and no stool. `difficulty` is stored and does not change learning speed. Tiers, intelligence, and treat credit stay as they are. Attribute keys only choose how the existing mastery lump is split.
- A trick's progress lives on the pet's `training` data, which already saves, syncs, and is frozen when the pet is retired. The catalog is a local module with the same fields, ready to download later the way the shop catalog does.
- Saying no, leaving, or backgrounding still pays the existing partial credit. At the school, "nothing changes" means the treat count.
- Graduation still pays the current attribute lump, intelligence, XP, and 100 Boops, for every trick that reaches 100%.
- A school "Yes" applies the biscuit reward and skips the inventory debit. There is no ledger pair. This works at 0 treats.
- The first-purchase tooltip is once per player, stored in the local `meta` table under `schoolTrickTip`.
- A learned trick still cuts in, except while the pet is on furniture, where one action waits. While a trick script is playing, another trick tap waits until it finishes.
- The preview pet is an adult golden retriever or an adult domestic shorthair, default coat, no clothes. The preview plays that trick's success script. A furniture trick spawns its prop inside the preview.
- Trick props are not furniture. Buying a furniture trick charges the bundle price and puts one prop in the Prop box. A second purchase of the same type grants a second prop. Placements are for the current scene only and return to the box on a scene change. They are not saved in the room layout.
- While a trick is in training, practice uses one prop. A learned trick uses every prop of that type already on the scene, nearest first. If none are out, the pet lifts the prop that purchase granted, and letting go places it and starts the trick.
- The Learned tricks section has a Prop button. It opens a Prop sheet like the Toy Box. Choosing a prop only places it. A tap on the scene, or on the empty area around the sheet, closes it without placing.
- Holding a placed trick prop offers Put in storage or Move. Put in storage returns it to the box before a scene change. The Prop button still only places. Props still clear when the scene changes.

---

## 1. Rules

### Tricks
- **Starter tricks are free and every pet has them from the start: Sit, Speak, Paw.** They are never sold. Paw stays locked until Sit and Speak are mastered, as it does today. Cats still see that starter as High five.
- **Every other trick is bought at the Training School** with Boops. Once bought, the player can practice it anywhere.
- **Tricks belong to the pet, not the player.**
  - Treats, toys and clothes still belong to the player.
  - A retired pet keeps its tricks, and still has them when it appears as an NPC or playdate partner.
  - A new pet starts with only the three starter tricks, at 0%. Anything else must be bought and trained again.
- **Separate trick lists for dogs and cats.** Each trick is either dog-only or cat-only.
- **Shop lessons open from learned tricks, not age.**
  - The first lesson is for sale on day one.
  - Each trick that moves from In Training to Learned, including Sit, Speak, and Paw, opens the next one.
  - Lessons still waiting show under **"New lessons unlock as [name] learns new skills"** and cannot be bought. The preview says **"Learn more skills first"**.
  - Dogs, in order: Down, Spin, High Five, Bow, Jump Up, Roll Over, Jump the Hurdle, Stand Tall, Catch, Jump Through Hoop, Through the Tunnel, Play Dead, Sing, Weave.
  - Cats, in order: Spin, High Five, Jump Up, Lie Down, Jump the Hurdle, Stand Tall, Fetch, Jump Through Hoop, Through the Tunnel, Roll Over, Sing, Weave.
- **Duplicate purchases are not possible.** A trick the pet already owns, whether in training or learned, shows as "Owned" in the shop.
- **No refunds**, which is consistent with the Pet Shop.
- **All tricks are evergreen for now.** There are no limited-edition or exclusive tricks yet, but the schema leaves room for them later (see §2).

### Training (keep what exists)
- The multi-attempt flow, the treat offer on success, the "try again?" prompt on failure and the 10-minute rest all stay as they are today.
- The number of reps before the rest still depends on the pet's attributes and on whether a treat was given.
- **The rest is per trick, as it is today.** Players may switch to another trick while one is resting. Do not change this.
- **Progress persists.** Tapping a trick's button again resumes from where it left off.
- Each trick raises its own attributes, using the existing system.
- Each catalog row stores a `difficulty` number for later. It does not scale learning. The existing tier, intelligence, and treat credit still do.
- At **100%** the trick graduates the way it does today:
  - It moves out of In Training and into **Learned Tricks**.
  - Its training button disappears.
  - The mastery bundle still pays once: the linked-attribute lump, intelligence, XP, and 100 Boops. Further reps give no progress.

### Learned Tricks
- Tapping a learned trick makes the pet perform it on demand.
- If the pet is busy, the trick cuts in the way a learned trick does today. A pet on furniture finishes climbing, then performs the one waiting trick.
- Performing a learned trick costs nothing and gives no progress. It raises the trick's linked attributes a little (`learnedPerformanceRaw` in `gameplayConfig`), less as they near potential, and never past potential.

### Free treats at Training School
- This applies when a training attempt succeeds **while the pet is at the Training School**.
- The treat prompt says the treat is free. Example copy: *"Give a treat? Treats are on the house at Training School!"*
- If the player says **Yes**:
  - The full treat effect applies (more progress, bark or meow, the same rep effect as a treat at home).
  - The **net change to the player's treat inventory is zero**.
  - This must work even when the player owns 0 treats. Never show the "out of treats" message at the school.
- If the player says **No**, leaves, or backgrounds the app, the treat count stays put and the rep still pays the existing partial credit.
- **Implementation:**
  - Skip the inventory debit when the context is the school. Do not write a ledger line for the treat.
  - Apply the biscuit reward anyway, including when the player owns 0 treats.
  - The player-facing result is that the inventory count does not move.
- Outside the school, treats use inventory exactly as they do today.

---

## 2. Data

The catalog is a local module (`src/sim/tricks.ts`) so practice and buying work offline. A later download can replace that module with the same fields. Progress is not a remote row written at purchase time. It stays on the pet, in `training`, with `source: 'starter' | 'purchase'`.

The field list below is the shape of a catalog row and of the pet's training entry. Starters are not shop rows.

### `catalog_tricks`
| column | type | notes |
|---|---|---|
| `id` | text PK | e.g. `dog_roll_over` |
| `species` | enum `dog` \| `cat` | |
| `name` | text | |
| `description` | text | one short line for the preview |
| `is_starter` | bool | true for sit/speak/paw; never shown in the shop |
| `price_boops` | int | 0 for starters |
| `min_age_stage` | enum | stored on the row; the shop does not read it. Lessons open from the learned-trick count. |
| `difficulty` | numeric | stored for later; not applied |
| `attributes_raised` | jsonb | e.g. `{ "agility": 2, "obedience": 1 }`, using the existing attribute keys |
| `pet_animation_key` | text | the animation the player's pet performs |
| `demo_animation_key` | text | the generic preview animation |
| `collection` | text | `evergreen` for now |
| `edition` | text nullable | reserved for future limited/exclusive; null for now |
| `sort_order` | int | |
| `is_active` | bool | shipped tricks are active and play their script |

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

- When a pet is created, seed Sit, Speak, and Paw. Paw starts locked.
- **Purchase:**
  - Debit Boops through the existing ledger, then add the trick on that pet at 0%, unlocked, not mastered, `source: 'purchase'`.
  - Validate four things: the species matches, the lesson is open for how many tricks this pet has learned, the pet doesn't already own the trick, and the balance is sufficient.
  - Use the same local ledger path the Pet Shop uses for evergreen items. The new pet state is what gets saved.

---

## 3. UI

### Boop Boop Town
- Training School is a door on the road, with the bell-tower schoolhouse. Tapping it walks the pet there, then opens the training room. Home rooms are not doors.

### Training School scene
- An outdoor field on the same 640 × 680 stage as the park. It uses the park's live sky, weather, seasonal grass, and blowing leaves. Birds perch on the goal and the bench and forage on the grass.
- The painted field has a fence, chalk lines, a goal, trees, bushes, and a bench. Dogs and cats share it.
- The pet wanders the grass. Podiums, tunnels, hurdles, hoops, and cones are not painted into the field. They appear only when the player places them.
- On a phone the field is about a third of the screen, shorter than the other rooms. A wide landscape layout keeps the full scene pane.
- Opening the school from the road shows the field and the school controls together, and the pet walks in from off the left. Reduce Motion skips that walk. There is no previous room underneath. On a phone the field is the shorter stage as soon as it is on screen. Leaving the school walks the pet off to the right and fades the field, then puts them on the road outside Training School. Reduce Motion cuts straight to the road.
- Tummy, Hydration, Energy, and Mood are hidden at the school. Those four values freeze for the visit and start falling again when the pet leaves.
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
  - **Locked**: dimmed, with a lock, under "New lessons unlock as [name] learns new skills".
  - **Owned**: an "In Training" or "Learned ✓" chip.
- Tapping a card opens the **Preview modal**:
  - A looping demo of an adult golden retriever or adult domestic shorthair, default coat, no clothes, playing that trick's success script. Not the player's pet. A furniture trick shows its prop in the preview and says which prop the purchase includes.
  - The trick's name and its one-line description.
  - The attributes it raises, shown with the existing attribute icons.
  - A **"Learn for X Boops"** button.
  - If the player can't afford it, the button shows *"Not enough Boops"* and a disabled state.
  - If the trick is locked, the button is replaced by "Learn more skills first".
  - No cart: buying a trick is a single purchase with a one-tap confirm.
- Modals must match the game's fun aesthetic, not system dialogs.

### After the first purchase (tooltip)
- Shown **once per player**, the first time they buy any trick. Persist `schoolTrickTip` in the local `meta` table, which survives adopting a new pet.
- When the preview closes, highlight the new button in the Practice section and anchor a tooltip to it.
- Example copy: *"Roll Over was added to your In Training section! Practice it here — or anywhere from Home."*
- Use the existing tooltip style, restyled to match the cuddle tooltip redesign.

### Home
- **In Training section:** every not-yet-mastered trick on the pet, starter and bought, with the existing buttons and rest countdowns.
- **Learned Tricks section:** every mastered trick on the pet. Tapping a trick performs it. A Prop button on this section opens the Prop sheet.
- Treats at Home use inventory as before.

---

## 4. Catalog

Players start with 1,000 Boops and accrue about 60 per hour. Prices below are the amount charged. A furniture row's price is the bundle price, and the purchase grants the one prop named in the last column. Come and Crawl are not in the app.

**Dogs**
| Trick | Price | Opens after learned | Raises | Prop |
|---|---|---|---|---|
| Down | 150 | 0 | obedience | |
| Spin | 150 | 1 | agility | |
| High Five | 200 | 2 | obedience, affection | |
| Bow | 250 | 3 | obedience | |
| Jump Up | 400 | 4 | obedience | podium |
| Roll Over | 300 | 5 | agility, obedience | |
| Jump the Hurdle | 500 | 6 | agility, boldness | hurdle |
| Stand Tall | 350 | 7 | stamina, agility | |
| Catch | 300 | 8 | agility | |
| Jump Through Hoop | 550 | 9 | agility, boldness | hoop |
| Through the Tunnel | 450 | 10 | boldness | pink tunnel |
| Play Dead | 500 | 11 | intelligence, obedience | |
| Sing | 450 | 12 | boldness, affection | |
| Weave | 650 | 13 | agility, intelligence | cone set |

**Cats**
| Trick | Price | Opens after learned | Raises | Prop |
|---|---|---|---|---|
| Spin | 150 | 0 | agility | |
| High Five | 200 | 1 | affection | |
| Jump Up | 400 | 2 | obedience | podium |
| Lie Down | 200 | 3 | obedience | |
| Jump the Hurdle | 500 | 4 | agility, boldness | hurdle |
| Stand Tall | 350 | 5 | stamina | |
| Fetch | 500 | 6 | intelligence, boldness | |
| Jump Through Hoop | 550 | 7 | agility, boldness | hoop |
| Through the Tunnel | 400 | 8 | boldness | blue tunnel |
| Roll Over | 400 | 9 | agility | |
| Sing | 450 | 10 | boldness, affection | |
| Weave | 650 | 11 | agility, intelligence | cone set |

- "Opens after learned" is how many tricks are already Learned before that lesson is for sale. Zero is the one lesson for sale on day one. Each learned trick opens one more. Sit, Speak, and Paw count. The shop does not use life stage.
- Either species can use a prop the other species' purchase granted. A pink tunnel and a blue tunnel are the same trick type.

---

## 5. Out of scope (do not build)
- Performing tricks during playdates. Learned tricks stay on the pet so playdates can read them later.
- Limited or exclusive tricks.
- IAP or boosts that speed up trick training.
- Final trick art and icons.

---

## 6. Acceptance checklist
- [x] Training School is a door on Boop Boop Town. Taking the pet there opens the training room, and the school controls and the shorter phone stage are on screen with the field.
- [ ] A new pet has Sit, Speak and Paw in In Training at 0%, and no other tricks.
- [ ] The Trick Shop shows only tricks for the pet's species. The first lesson is for sale immediately. Each learned trick opens the next one. Locked tricks say they unlock as the pet learns new skills and can't be bought. Owned tricks show their status.
- [ ] The preview plays the generic demo. Buying debits Boops through the ledger and adds the trick to In Training on both the school and Home.
- [ ] The first-purchase tooltip appears once, anchored to the new button, then never again.
- [ ] At the school, a successful attempt with "Yes" to a treat gives the full treat effect, leaves the treat count unchanged, works with 0 treats, and the prompt says the treat is free.
- [ ] At Home, treats still use inventory, and "out of treats" still appears when the player has none.
- [ ] The rest countdown is per trick, and switching tricks during a rest still works.
- [ ] Progress resumes across sessions and app restarts, and practicing works offline.
- [ ] At 100%, the trick moves to Learned Tricks and can be performed on demand; if the pet is busy, it performs when free.
- [ ] After retiring a pet, the new pet has only starter tricks, and the retired pet keeps its tricks as an NPC.
