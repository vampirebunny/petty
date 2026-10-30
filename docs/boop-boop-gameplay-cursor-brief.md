# Cursor Brief: Gameplay Progression (Levels, XP, Badges, Suggested Activities, Park Finds, Stadium)

## Goal

Turn Boop Boop from a toy into a game. Add pet levels driven by XP, badges, suggested activities, park finds, and a Stadium with scheduled competitions. Build on existing systems (attributes and potential, Training School, tricks catalog in Supabase, map, Pet Shop, care stats, NPC pets). Do not rebuild them.

## Global rules

- **All numbers in this brief are defaults.** Put every number (XP amounts, caps, level curve, class levels, pace multipliers, slot rotation, race size) in a single gameplay config, not hardcoded.
- **Boops:** keep the existing 50-Boop level-up payout (`payLevelsAndStages` and the server's `level_up` earn rule), now following the new level curve instead of age ceilings. Nothing else in this brief awards Boops: not badges, races, park finds or suggested activities. All other existing Boop sources stay as they are.
- **Levels, XP, badges, ribbons and trophies belong to the pet**, not the player. Treats, toys and other purchases stay with the player as they do today.
- No speech balloons over the pet. Use the existing bark, meow and purr sounds for cues.
- No tooltips or banners during competition gameplay; they block the view.
- Keep the existing cotton candy visual style: glossy, puffy buttons; fun modals.
- Works offline for everything except live races and anything that already needs the server.

## Codebase notes (answers to your phase 1 questions)

- **Follow the code, not AGENTS.md.** Keep using App.tsx, src/screens/ and the town map (src/ui/town/map.ts). The Stadium is a new RoadSpot and building; the collection book is a new screen in the current style.
- **No migration.** All current players are test users. Wipe test pets and test badge data; don't write migration code for old levels or XP.
- **Trick catalog stays in code** (src/sim/tricks.ts, src/sim/tracks.ts). Moving it to Supabase is separate work.
- **Name clashes:** use `parkFinds` in code for the new feature, separate from the existing `playFinds` Boop payouts (which stay as they are). The badge formerly called "Welcome Back" is renamed **Came Back** so it doesn't clash with the existing 150-Boop Welcome Back reward.
- **Season naming:** the sky code calls fall "autumn"; use that.
- **Notifications:** reuse the existing permission flow (reminders/notifications.ts, friends/push.ts). Don't add a third prompt.

## Build order

1. Levels and XP
2. Badges
3. Suggested activities
4. Map lock state for the Training School
5. ~~Park finds~~ (**shipped** — see `docs/boop-boop-park-finds-brief.md`)
6. Stadium (now specified in `docs/boop-boop-stadium-cursor-brief.md`, which supersedes sections 8 and 9 below)
7. Live races with friends (also in the stadium brief)

Each phase should ship working on its own. Park finds landed ahead of levels. Levels, the tutorial, first-find XP, non-race badges and suggested activities are shipped. The Stadium lobby through the starting gate is shipped. Fun Run, Hurdles, Dock Dive, and Obstacle Course are playable solo races (`docs/boop-boop-race-foundation-cursor-brief.md`). Solo results go through the `race_report` Edge Function. Sniff Out, Trick Show, and Weave are cancelled and are not scheduled. Finds stay available from level 1. The Training School stays open from level 1.

---

## 1. Levels and XP

**Replace the old level system entirely.** Remove `xpPerLevel`, `levelCeilingByStage`, `feedXp`, `petXp`, `careConfig.masteryXp`, the flat 25 XP per level and the age-based level ceilings (including their use in `shownLevel()`, `levelsToPay()` and `sqlitePetStorage.ts`). Feeding, patting and training reps become "everyday actions" below; trick mastery XP becomes the trick-learned XP below. Update attributes-test.ts accordingly.

**Data (per pet):** `level`, `xp_total`, `xp_into_level`, `xp_daily_everyday` with a reset date, and a log of first-time park finds already rewarded.

**Leveling**
- Levels 1–100.
- `level` becomes stored state. `withDerived()` must no longer recompute level from total XP.
- **Levels 1–10 (tutorial):** each tutorial action raises the level by one, in any order (see section 3). There are more actions than the nine steps from level 1 to level 10. Repeating an action does not level again. Each of those level-ups is worth 10 XP, and the bar fills by that much each time, across the 90 XP from level 1 to level 10. No other source pays XP during the tutorial. That includes everyday actions, suggested activities, badges, races, tricks, and first park finds. Badges themselves are still awarded; only their XP is skipped. Skipped one-time XP is not paid at level 10. A find recorded before level 10 sets `firstFindRewarded` so it cannot pay later.
- During the tutorial, the XP bar shows those steps as one fill from empty at level 1 to full at level 10 (0 of 90, then 10, 20, and so on, full at 90). The goal name is not shown next to the level. The pet hops. The level and Boop amount float up from the bottom of the scene (see Level-up moment).
- **From level 10:** the bar stays full until the next XP. That XP counts toward level 11 using the curve below, and the bar then shows progress into the next level. Tutorial XP stays in the total; it is not cleared. Level 11+ advances by XP only. No milestone gates.
- Show the level and an XP bar under the pet's name on Home.
- Each XP grant plays its own "+N XP" burst over the scene, one burst per grant. A feed that pays both the everyday 2 and a suggested 30 plays two bursts. Bursts are not saved with the pet.

**Default XP per level**

| Levels | XP per level |
| --- | --- |
| 1–10 | 10 |
| 11–25 | 120 rising linearly to 250 |
| 26–40 | 250 rising linearly to 300 |
| 41–60 | 300 rising linearly to 1,000 |
| 61–100 | 1,000 rising linearly to 4,000 |

All bands ramp linearly within the band (no flat bands, no jumps between bands). Approximate cumulative XP: level 40 ≈ 6,900; level 50 ≈ 11,700; level 60 ≈ 19,900; level 100 ≈ 120,000. At a typical 400–700 XP per day, that's level 50 around day 20–30 and level 100 after 6–8 months. This pace is intended: pets live on as seniors indefinitely, so levels past senior are the long-term goal.

**XP sources**

| Source | XP |
| --- | --- |
| Suggested activity completed | 30, max 10 per day |
| Everyday action (feed, water, pat/scratch, play, training attempt, park visit) | 2 each, max 100 per day |
| Basic trick learned | 50 |
| Advanced trick learned | 200 |
| One-time badge | 50 |
| Tiered badge bronze / silver / gold | 50 / 100 / 200 |
| Race entered / 3rd / 2nd / 1st | 20 / 40 / 60 / 100, first 8 races per day only |
| First time finding a park item: common / uncommon / rare / legendary | 10 / 25 / 75 / 150 |

No XP from mini-games, repeat park finds, or time passing. Race XP is skipped below level 10. Daily caps reset at local midnight.

**Level-up:** the pet does a happy hop with its bark or meow, and the level display under its name updates. No confetti overlay. Several level-ups at once play one after another.

**Level-up moment:** the new level and its 50-Boop payout float up from the bottom of the scene to the top, then fade out. No modal. The existing Boops coin animation still plays, once per level. A jump plays every level in order, each with its own float and coin burst.

## 2. Badges

Badges are achievements, separate from ribbons and trophies. Earned medals show on Settings, under Friends and above Log out. The trick-learned popup stays separate from achievement badges. It plays when a trick is fully mastered, with the caption "New skill learned!", and does not play when a trick unlocks for training. The unlocked ring still shows a New! sticker until it is practiced. There is no `badgeLabels` map. Badge names live next to the art in `src/sim/badges.ts`.

**Shipped.** Day counts start the first time the check runs, not from the adoption date. Badge XP is skipped before level 10 and is not paid later.

**Retroactive awards:** when a badge's condition is already met by stored state (e.g. tricks learned, current outfit), award it on the next check. Don't backfill badges that need history the app never stored (total days opened, a past next-day visit, first item ever worn); start tracking those now.

**Day counting is per pet**, starting at adoption. A new pet after retirement starts its streak and day counts at zero. This is separate from the player's existing daily-login Boop streak, which stays as is.

**One-time**

| Badge | Earned by |
| --- | --- |
| Welcome Home | Adopting the pet |
| Came Back | Opening the app on the day after adoption |
| Good Listener | First trick learned |
| Prop Pro | First advanced trick learned |
| Treasure Hunter | First park find |
| Dressed Up | First item worn from the Closet |
| First Race | First race finished (id stays `off-to-the-races`) |
| Blue Ribbon | First 1st place |
| Moving Up | First race in any class above Beginner |
| Playmate | First playdate |

**Tiered (bronze / silver / gold)**

| Badge | Measures | Tiers |
| --- | --- | --- |
| Best Friend Streak | Days in a row with the app opened | 3 / 7 / 30 |
| Devoted | Total days opened | 10 / 50 / 100 |
| Trick Collector | Tricks learned | 5 / 10 / 20 |
| Finder | Unique park finds | 10 / 25 / 50 |
| Ribbon Rack | Ribbons won | 5 / 25 / 100 |

Ribbons are a log on the pet (race, event, class, place, date). Counts come from that log. The ribbon board and trophy shelf wait for the trophies brief.

A missed day resets the streak count but never removes a badge. Use the device's local date for day counting.

## 3. Tutorial goals and unlocks

**Tutorial (levels 1–10).** These actions each raise the level by one, in any order. Reaching level 10 takes nine of them, so a pet does not need every action. Doing one again does not level again. A park find counts whenever it happens, including before the other actions. A find already in the collection counts as that action. A tutorial prompt is not shown for an action the player has already done.

| Action | What counts |
| --- | --- |
| Feed | Tap the food bowl |
| Fill the water bowl | Refill water |
| Visit the Training School | Enter the school |
| Play ball | Play fetch |
| Nap in the bed | Fall asleep in the bed |
| Make a park find | Record a park find |
| Pat/Scratch | Pat the pet |
| Cuddle | Finish a cuddle with real petting |
| Closet | Put on any item |
| Learn Sit | Master Sit |
| Race in the Stadium | Finish a Stadium race |

**What's open:** everything is available from the start (Home, Closet, Park, Pet Shop, Mini-games, Playdates, Training School, Stadium), including park finds. The Training School is not locked.

## 4. Suggested activities

**Shipped.** The Training School is open from level 1; training suggestions still start at level 3. "Race in the Stadium" is in the pool; it completes when the pet finishes a race.

Small goals the game offers, not things the pet asks for. Ignoring one costs nothing.

**UI**
- A pill in the top left of the scene, labeled "Try this," showing the current tip (e.g. "Fill the water bowl").
- One tip shows at a time. Tapping the pill dismisses it until the next tip. When more than one slot is filled, dismissing one reveals the next.
- A new suggestion is announced with the pet's sound.

**Rules**
- Slots: 1 until level 10, 2 until level 20, then 3.
- **During the tutorial (levels 1–10), the single slot shows one tutorial action the player has not done yet**, in the same pill. Those actions don't count toward the 10-per-day cap and award no suggestion XP (they award the 10 XP level instead).
- 30 XP each, max 10 completions per day. After the cap, hide the pill until the next day.
- Only suggest what makes sense now (no "Feed" when tummy is full) and what's available at the pet's level.
- Persist current suggestions across app restarts.

**Pool**

| Type | Examples | From level |
| --- | --- | --- |
| Care | Feed, fill the water bowl, pat/scratch, nap in the bed | 1 |
| Play | Play ball, play with a specific owned toy | 1 |
| Style | Wear a hat, try something new from the Closet | 1 |
| Outing | Visit the park | 1 |
| Competition | Race in the Stadium | 1 |
| Training | Practice a trick 5 times, make progress on the trick in training | 3 |
| Finds | Find something new at the park | 6 |

## 5. Map

- The **Stadium** is on the map, in the bottom right. Races are entered through its lobby (see the stadium brief).
- The Training School stays open from level 1. It is not dimmed and does not wait for a level.
- Future places can use a locked state with "Coming soon."

## 6. Park finds (shipped)

**Source of truth:** [`docs/boop-boop-park-finds-brief.md`](boop-boop-park-finds-brief.md). The older tap-the-sparkle sketch in this doc was replaced by the pet-notice / "Let's see!" loop.

**Shipped behavior (summary)**
- At most one find chance per park visit. The first completed find is guaranteed (`firstFindVisitDone` stays false until a find is recorded, so leaving early does not spend it). Later visits roll at 25%.
- The pet notices on its own; the player taps **"Let's see!"** (or dismisses by doing something else).
- Dogs dig; cats rustle grass or bat a bush. Both carry the find to the front, then the reveal modal.
- Collection lives in the player's **Treasure Chest** furniture + Home **Collection** button. Page: 3-column floating art over light pools (no glass cubes).
- Park finds are not level-gated. During levels 1–10, a park find is one tutorial action and can be the level-up at any time (see section 3).
- First-find XP is paid only from level 10, by rarity (common 10, uncommon 25, rare 75, legendary 150). A find before level 10 sets `firstFindRewarded` and pays nothing, then or later.

## 7. Tricks

- Add a `category` field (`basic` | `advanced`) to each trick. Don't reuse `tier`, which is already the numeric difficulty (`TrackDef.tier`).
- **Basic:** every trick that doesn't need a prop, including the free starters Sit, Speak and Paw, plus Down, Spin, High Five, Bow, Roll Over, Catch, Stand Tall, Play Dead, Sing, and the cat's Lie Down and Fetch.
- **Advanced:** every trick that needs a prop: Jump the Hurdle, Through the Tunnel, Jump Through Hoop, Jump Up (dogs and cats, podium), Weave. Place is not a trick (Jump Up replaced it); don't add it.
- Keep the catalog's existing age gates (e.g. Weave at adult). Open-class Agility therefore needs an adult pet; that's intended.
- **Cat Paw naming:** rename the cat's starter trick from "High five" to "Paw" so it doesn't clash with the purchasable cat_high_five in the Trick Show.
- Come stays removed.
- Keep the existing trick-to-attribute mappings in code.
- Performing an already-learned trick raises its attributes slightly, shrinking as the attribute nears the pet's potential. Never past potential.
- At home, learned tricks always succeed (no change).

## 8. Stadium and competitions

The lobby, sign-up, race call, and starting gate are in `docs/boop-boop-stadium-cursor-brief.md`. The races themselves are in `docs/boop-boop-race-foundation-cursor-brief.md`. Fun Run, Hurdles, Dock Dive, and Obstacle Course are playable for solo races. Solo server replay is shipped (`race_report`). Sniff Out, Trick Show, and Weave are cancelled. Live races with friends come next. Trophies and the ribbon furniture wait for their own brief.

## 9. Live races (phase 7)

- Friends only (mutual friends). Friends who sign up for the same slot and class are placed in the same race.
- Within a class, fill races in sign-up order. When a race fills, open another.
- The server sends one synchronized countdown start (Supabase Realtime).
- Each phone simulates its own pet from its own player's input and broadcasts position for others to display.
- The server confirms final times and rejects impossible input (e.g. sustained tap rates no human can hit).
- A player who disconnects mid-race finishes on NPC autoplay.

## Out of scope for now

- Best Dressed contest with player voting
- Heats, finals and weekly championships
- Away competitions (later, entered through the Stadium)
- Sniff Out, Trick Show, and Weave (cancelled; not scheduled)
- Final badge names and item art
