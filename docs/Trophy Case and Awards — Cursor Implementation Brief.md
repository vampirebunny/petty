# Trophy Case and Awards — Cursor Implementation Brief

Nov 1, 2026 · @A

## Overview

Build the Trophy Case: a new screen opened from Settings where each pet's ribbons, trophies, Lookbook stamps and badges live, and wire races and runway shows so they grant awards automatically.

**Sources (in priority order):**

1. **This brief** for build steps and wiring.
2. **[Awards design brief](https://claude.ai/artifact/FFrq54pwjY9AsSAYvvRQ4L)** (also attached as awards-design-brief.md) for every rule and threshold: award tracks, tiers, data model, config keys. Where the two disagree, this brief wins.
3. **[Lookbook Mocks.html](Lookbook%20Mocks.html)** for layout and art (the packed awards canvas: Trophy, Ribbon, Stamp, Badge, Cover, Sash, and the Trophy Case / Settings pages). Match it. The art components are the source of truth for shapes and colors.

**Build order** (each step ships on its own):

1. Art components (Trophy, Ribbon, Stamp, Badge, Cover, Sash). **Shipped** — parametric `react-native-svg` in [`src/ui/awards/`](../src/ui/awards/). Hex pins are on the Settings shelf and both celebration overlays. `blue-ribbon` migrates to `first-win` on load.
2. Data tables and the award-granting server functions. **Shipped** — [`supabase/migrations/20261101180000_awards.sql`](../supabase/migrations/20261101180000_awards.sql) (applied): `award_definitions`, `awards`, `award_progress`, `runway_pieces_worn`, `awards_config`, `grant_race_awards` / `grant_runway_awards` (service_role only). Phone cache in [`src/awards/cache.ts`](../src/awards/cache.ts).
3. Race wiring: ribbons and trophies granted on race results. **Shipped** — [`supabase/migrations/20261101190000_race_grant_awards.sql`](../supabase/migrations/20261101190000_race_grant_awards.sql) (applied): `stadium_rank` calls `grant_race_awards`; `race_state_for` returns this viewer's awards; the phone merges the cache, stops writing `state.ribbons`, and ribbon badges read `ribbonFacts`. Modest results strip on the four race result panels. Title and ribbon wait for `status === 'finished'` so a local 2nd does not flip to 3rd.
4. Runway wiring: stamps and runway awards granted on shows. **Shipped** — [`supabase/migrations/20261101200000_runway_grant_awards.sql`](../supabase/migrations/20261101200000_runway_grant_awards.sql) (applied): `submit_runway_looks` / `cast_runway_vote` / `open_runway_voting_if_due` call `grant_runway_awards`; `record_solo_runway_walk` persists a solo row then grants (after `pushPetBeforeRead`); the phone merges the cache and celebrates stamps. **See Awards** opens the Trophy Case on the Runway tab; **Close** returns to the Catwalk lobby.
5. Trophy Case screen with Races, Runway and Badges tabs, including the empty state. **Shipped** — [`src/screens/TrophyCaseScreen.tsx`](../src/screens/TrophyCaseScreen.tsx) opens from Settings. Tabs Races | Runway | Badges, empty Races state, and the phone awards cache (including `runway_pieces_worn`). Landscape uses `trophyCaseMaxWidth` (880), not the 400pt phone column.
6. Badges redesign and move into the Trophy Case. **Shipped** — Badges tab is One-time + Tiered. Settings no longer has a Badges row or `BadgeShelf`.
7. Settings page update. **Shipped** — Trophy Case card (filled and empty) sits in the Badges slot. Phone order and the landscape three-column layout stay as shipped. The card reads `readAwardsCache` first so Settings works offline. A stamp-only pet fills the shelf with stamps.

All four award migrations are applied (`20261101180000`, `20261101190000`, `20261101195000` race condition stamps, `20261101200000`).

**Out of scope now:** Hall of Fame screen, retirement itself, friends viewing each other's case.

## Shared art components

Shipped in [`src/ui/awards/`](../src/ui/awards/) (`Trophy`, `Ribbon`, `Stamp`, `Badge`, `Cover`, `Sash`, `eventEmblems`, `svgId`). Ported from the canvas as parametric `react-native-svg` components, copying paths, gradients and colors. Don't redraw them and don't ship one image per variant.

| Component | Canvas file | Props |
| --- | --- | --- |
| `Trophy` | `Trophy.dc.html` | `shape` (cup, handles, plinth, big, grand, star), `material` (bronze, silver, gold, platinum, diamond, veteran, seasonal), `event` (run, meters, hurdle, weave, obstacle, dock, sniff, trick, none), `earned`, `size` (height px) |
| `Ribbon` | `Ribbon.dc.html` | `placing` (1, 2, 3), `cls` (none, beginner, novice, open, expert, championship, veteran), `event`, `size` |
| `Stamp` | `Stamp.dc.html` | `kind` (debut, encore, party, rack, star), `motif` (12 theme ids), `earned`, `size`, `paper` (background color, used for the postage perforations) |
| `Badge` | `Badge.dc.html` | `icon`, `color`, `tier` (none, bronze, silver, gold), `earned`, `size` |
| `Cover` | `Cover.dc.html` | `kind` (ladder for Cover Stars, friend for friend-show awards), `level` (1–4: propped-up issue, + easel, + frame, + plaque; ladder only), `icon` (host, crew, front; friend only), `material` (bronze, silver, gold, platinum), `earned`, `size` |
| `Sash` | `Sash.dc.html` | `earned`, `size` |

- **Unearned state:** every component has one, a pale dashed silhouette. Trophies and badges hide the emblem; stamps and badges show a "?".
- **Gradient ids:** each instance needs unique gradient ids (the mocks generate one per instance). Shared ids make every instance on screen take the first one's colors.
- **Size:** trophies render at `size` × 5/6 wide; ribbons at `size` × 100/132 wide; stamps and badges are square.
- **Event emblems** are shared between Trophy and Ribbon: keep one icon map.

**Glossy style, as used across the mocks:**

- Page background `#FFF3F8`, title text `#1F2440`, secondary text `#5E6280`.
- Headings and buttons in the app's existing rounded display font; small text in the existing body font.
- Cards: white, 28 px radius, 3 px colored border (Traits purple `#A98BE0`, Trophy Case gold `#F2C14E`, Lookbook pink `#F2A0BF`).
- Buttons: the app's existing glossy pill buttons. New gold variant for Trophy Case: top `#FFE7A3`, base `#FFCB52`, lip `#E3A82A`, text `#5A3A00`.
- Shelves: wood plank `#C98A5A` with a `#9A5F36` lip under the trophies; warm panel `#FFF7E6`→`#FFEFD2` behind them.

The Races tab, Trophy detail and Race results mocks show the right layout, but their page chrome is in an older flat style. Build them with the glossy style above, like the Settings and Lookbook mocks.

## 1. Settings page

Replace the Badges row with a Trophy Case card. Mocks: `Settings.dc.html` (with awards) and `CaseCardEmpty.dc.html` (none yet). Use those mocks for the **card** (shelf, counts, empty state, gold Open). Do not rebuild Settings to match the mock's page order or chrome.

**Keep the shipped Settings layout.** The Trophy Case card sits in the Badges slot; nothing else moves.

- **Phone:** Sounds → Music → Account → Traits → Friends → **Trophy Case card** → Log out → Delete.
- **Landscape:** three columns (Traits | account + Friends + delete | Sounds and Music). The card is full width under them, same slot as today's badge shelf.

Remove the Badges section; badges move into the Trophy Case (step 2).

**Trophy Case card (current pet only):**

- Title "Trophy Case" with "Maple's best" (pet's name) on the right.
- A shelf showing the pet's top 3 pieces, tallest in the middle. Pick by highest trophy `size` earned, newest first on ties. If the pet has fewer than 3 trophies, fill with its best ribbons (1st before 2nd, higher class first), then newest stamps.
- Three count chips: trophies, ribbons, stamps for the current pet. Ribbons count every ribbon won, not distinct ones.
- Gold glossy **Open Trophy Case** button. Tapping the shelf also opens it.

**Empty state** (no ribbons, trophies or stamps yet):

- Shelf of three unearned trophy silhouettes.
- Right label "Nothing yet", line "Win a race or walk a runway show to start filling \[name\]'s shelf." and no count chips.
- Same button, opening the Trophy Case empty state.

The card reads from the awards tables (step 5), cached locally so Settings opens instantly and works offline with the last known values.

## 2. Badges redesign

Badges become glossy hexagon pins with no tails, so a rosette with tails always means a competition ribbon. Mocks: `Badge.dc.html` and `BadgesTab.dc.html`.

- **Replace all badge art** with the `Badge` component. **Shipped** — Settings shelf and both celebration overlays use hex pins (`badgeArt.ts`). Keep the existing badge logic and storage (pet JSON, syncBadges); only the art and display change: 25 badges (10 one-time, 5 series × 3 tiers), still belonging to the pet, still awarded when the action happens even if done before the prompt.
- **Rename** "Blue Ribbon" to **First Win**. **Shipped** — `syncBadges` rewrites a saved `blue-ribbon` to `first-win` once and does not grant it again.
- **Where they show:** only in the Trophy Case Badges tab, in two sections, One-time and Tiered. Settings no longer has a Badges row.

**One-time badges** (3-column grid, in this order):

| Badge | Icon | Color | Card line |
| --- | --- | --- | --- |
| Welcome Home | home | pink | Bring your pet home |
| Came Back | calendar | blue | Visit the day after adopting |
| Good Listener | trick | purple | Master any trick |
| Prop Pro | prop | green | Master an advanced trick |
| Treasure Hunter | chest | orange | Make a park find |
| Dressed Up | outfit | pink | Wear something from the Closet |
| Playmate | paws | yellow | Have a playdate |
| First Race | flag | blue | Enter a race |
| First Win (was Blue Ribbon) | first | purple | Finish 1st in any race |
| Moving Up | up | green | Earn a ribbon above Beginner |

**Tiered badges:** one row per series, with its bronze, silver and gold badges side by side (same icon and color, `tier` set). Higher tiers don't replace lower ones. Beside them, "Next: Silver · 12 / 25" and a progress bar.

| Series | Icon | Color | Bronze / Silver / Gold |
| --- | --- | --- | --- |
| Ribbon Rack | podium | yellow | 5 / 25 / 100 top-3 finishes |
| Best Friend Streak | flame | orange | 3 / 7 / 30 days in a row |
| Devoted | heart | pink | 10 / 50 / 100 different days |
| Trick Collector | stars | purple | 5 / 10 / 20 tricks mastered |
| Finder | acorn | green | 10 / 25 / 50 park finds |

Header count: "7 of 10" for one-time, plus the total across all 25. All icons listed are already drawn in `Badge.dc.html`.

**No tailed rosettes outside competitions.** **Shipped.** The "Badge earned!" modal shows the hex pin for that badge. The trick-learned overlay shows a purple hex pin with the `stars` icon (`tier: none`).

**Renaming blue-ribbon:** **Shipped.** `syncBadges` replaces a saved `blue-ribbon` with `first-win` once and saves. Don't keep the old id with a new label.

**Ribbon-based badges:** the server grants ribbons. The phone does not append `state.ribbons`. Ribbon Rack, First Win and Moving Up read from the local awards cache (plus any leftover historical `state.ribbons`, deduped by race id). The cache is filled from each race state's award payload and refreshed from the `awards` table. Friend games, practice, cancelled races and NPCs grant nothing.

## 3. Trophy Case

A new full-screen page opened from Settings, with three tabs: **Races | Runway | Badges**. It always shows one pet's awards, the current pet by default.

**Header:** glossy back button to Settings, title "Trophy Case", then the tab switch. A pet switcher row appears above the tabs only when the player has more than one pet (see Pet retirement).

**Races tab** (mock `RaceCase.dc.html`, restyled):

1. Totals: trophies, ribbons, wins.
2. **Showcase shelf:** Grand Champion in the middle (silhouette until earned), flanked by the best All-Rounder and the latest seasonal trophy.
3. **Career:** a horizontal row with one card per event. Each shows the highest tier earned (or a bronze silhouette), the tier name, and a progress bar to the next tier ("28 / 40 to Gold").
4. **Class trophies:** class pills (Beginner to Championship), with the pet's current class preselected. A grid of the classed events' trophies at that class's size (Fun Run and 800 Meters have none); earned shows "Won", otherwise wins so far "2 / 3". Classes above the pet's current one show silhouettes with "Unlocks when \[name\] reaches Open". Championship shows "3 in a row".
5. **Feats:** 3-column grid of star trophies, earned or silhouette, with the requirement or detail ("Won by 0.06 s"). Personal Best shows its count.
6. **Ribbons:** grouped by event, each distinct ribbon (event × class × placing) once with a ×count badge. Show the 2 most recent events, then **See all ribbons** for the full list.

**Trophy detail sheet** (mock `TrophyDetail.dc.html`): opens from any career card, class trophy or feat. Shows the whole ladder on a shelf (earned in color, rest as silhouettes), progress to the next tier, and when each earned tier was won and in which class.

**Runway tab** = the Lookbook (mocks `Main.dc.html`, `ThemePage.dc.html`):

- Lookbook trophies shelf (Bronze, Silver, Gold) with progress bars.
- Grid of theme tiles (venue thumbnail, name, "3 / 4 + bonus", 5 mini stamps). Tapping opens the theme page.
- Theme page: venue header, 4 main stamps on an album card, Showstopper bonus row. Tapping a stamp opens a sheet with how to earn it; Full Rack shows pieces worn ("6 / 8").
- Below the Lookbook (mock RunwayAwards.dc.html): a Cover Stars shelf of magazine covers (Bronze, Silver, Gold, Platinum, growing in size) with progress to the next and the daily-cap note; a Crowd Favorite card with the sash and its ×count; and a Friend shows card with one row each for Host, Runway Crew and Front Row, showing bronze, silver and gold friend covers plus progress.

**Badges tab** (mock `BadgesTab.dc.html`): Firsts grid and Streaks section, as in step 2.

**Empty state** (mock `TrophyCaseEmpty.dc.html`), for a pet with no awards: Races tab shows a silhouette shelf, "\[name\]'s shelf is ready", a line on winning a first ribbon, a gold **Go to the Stadium** button, and a First goals list (first ribbon, Beginner trophy, Bronze career cup, first Lookbook stamp). The Runway tab shows the Lookbook with every stamp unearned; the Badges tab shows its normal locked state.

**Celebrations** on results screens:

- **Race results** (mock `RaceResults.dc.html`): the ribbon drops in large; any new trophy gets a "New trophy" card; then one "Next up" line with the closest unearned goal.
- **Runway show end** (mock `StampEarned.dc.html`): a "New stamp!" modal over the dimmed venue, the stamp hanging over the top of the card at a slight angle. The last buttons are **See Awards** (Trophy Case, Runway tab) and **Close** (dismisses and returns to the Catwalk lobby). Several new awards at once show one after another, biggest last.

## Data model and granting

Awards are owned by the player and linked to the pet that won them, and only the server writes them. Badges are not awards here: the 25 badges stay on the pet JSON and keep using syncBadges on the phone. These tables hold only competition awards: ribbons, trophies, stamps, Cover Stars, friend-show awards, the Crowd Favorite sash and lifetime trophies. Tables and rules follow the [Awards design brief](https://claude.ai/artifact/FFrq54pwjY9AsSAYvvRQ4L) (Data model section): `award_definitions`, `awards`, `award_progress`.

**Every `awards` row stores:** `player_id`, `pet_id`, a `pet_snapshot` (name, species, breed, coat, avatar seed at the time won), `award_definition_id`, `source` (race or runway), `race_id` or `show_id`, `placing` for ribbons, `earned_at`, `config_version`.

**Two server functions** (Postgres functions or Edge Functions, matching the race foundation's choice):

- `grant_race_awards(race_id)`: called once when a race's results are confirmed.
- `grant_runway_awards(show_id, event)`: called on runway events (show walked, vote cast, results published).

Each function, in one transaction with the result it reacts to:

1. Updates the `award_progress` counters it touches.
2. Inserts the ribbon and every award whose threshold was just crossed.
3. Returns the list of newly granted awards, which the results screen celebrates.

**Rules:**

- The phone never inserts awards. It only reads them, and caches the current pet's for offline display.
- Unique keys make retries harmless: ribbons on (`race_id`, `pet_id`); one-time awards on (`pet_id`, `award_definition_id`); lifetime awards on (`player_id`, `award_definition_id`).
- Stored, never recomputed: raising a threshold later never takes an award away.
- All thresholds come from the awards config (Config values section of the design brief), versioned with `config_version`.
- Seed `award_definitions` from config: class trophies (classed events × 5 classes), career tiers (every event × 5 tiers), feats, range, Veteran Cup, seasonal, 60 stamps, Lookbook tiers, Cover Stars, friend-show awards, lifetime.
- Log each grant to analytics (award id, days since adoption).

## 4. Runway shows → stamps and runway awards

Runway awards go to the pet that walked the show, triggered by four show events. Stamp rules are in the Lookbook section of the design brief; this is when to grant them.

| Event | When | Who | Grants |
| --- | --- | --- | --- |
| `solo_walked` | A solo show finishes (all models walked) | The player's pet | Shows-walked counters, Debut, Encore, Cover Stars, Lookbook tiers, Full Rack check. Subject to the daily cap |
| `friend_walked` | A friend show's voting opens | Every player who submitted | Same as solo plus Runway Party, Runway Crew. No daily cap |
| `vote_cast` | A player casts their vote | The voter (judge-only viewers too) | Front Row counter, once per show |
| `results_published` | Friend show results are revealed | Winner(s), ties share | Crowd Favorite sash, Showstopper stamp for that theme |

When a friend show's voting opens, also grant **Host** to the creator if at least one other player submitted.

**Counters** (`award_progress`, per pet):

- `shows_walked`
- `shows_walked:<theme>`, for Encore at 5
- `solo_shows_on:<local date>`, for the daily cap
- `runway_friends` (distinct player ids walked with), for Runway Crew
- `front_row`
- `hosted` (per player)

**Daily cap:** only the first 3 solo shows per pet per local day count toward shows walked, Encore and Cover Stars. Debut still counts on any show. Use the player's stored time zone, else the device's. After the third, show the line "Today's solo shows are counted. Friend shows always count."

**Full Rack:**

- When a show is walked, record every costume piece in the pet's 3 looks in a new `runway_pieces_worn` table: `pet_id`, `theme_id`, `piece_id`, unique on all three.
- Grant Full Rack when the pet has worn every **theme-specific** piece in that theme's rack. Versatile pieces shared across themes don't count.
- The theme page's "6 / 8 pieces" comes from this table.

**Lookbook tiers:** after any stamp grant, check Bronze, Silver and Gold against the current evergreen theme list. Seasonal themes grant stamps only while they run and never count toward the tiers.

**Not awarded:**

- NPC models in a show.
- Retired pets walking as NPC models.
- Invitees who missed the submission deadline. They can still earn Front Row by voting.

**Cover Stars and friend-show awards:** Cover Stars (renamed from Golden Hangers in the design brief; same 5, 15, 40, 100 thresholds) use the `Cover` component with `kind` ladder, `level` 1–4 for Bronze to Platinum. Host, Runway Crew and Front Row use `kind` friend with their icon and bronze, silver or gold. Crowd Favorite uses the `Sash` component with a ×count.

## 5. Races → ribbons and trophies

Call `grant_race_awards(race_id)` once per race, at the moment results are confirmed. Solo races: when the phone's report is stored and ranked. Live races: when results publish (all reported, or 10 s after the first). It runs for every real player's pet in the race, never for NPCs.

**Skip entirely:** practice runs, cancelled races, withdrawn or no-show entries.

**Events:** use the race event list in code, not a hardcoded count. It includes **800 Meters** (stopwatch emblem, `meters`, already in the Trophy and Ribbon components).

**Fun Run and 800 Meters have no classes.** For those two:

- Ribbons use `cls = none`: a cream inner ring instead of a class color.
- They get career trophies, feats and ribbons, but **no class trophies** and no `class_wins` or Championship streak counters.
- They don't count toward All-Rounder or Grand Champion, which use only the classed events.
- Personal Best is tracked per event, not per event and class.
- Moving Up already ignores them; keep it that way.

**For each pet, in this order:**

1. **Ribbon** if it placed 1st, 2nd or 3rd. Class = the race's class, `veteran` for Veteran Cup races, or `none` for Fun Run and 800 Meters.
2. **Counters.** On a 1st place:
   - `wins:<event>` (career, any class)
   - `class_wins:<event>:<class>`
   - `veteran_wins`
   - player-level `lifetime_wins`

   On every finish:
   - `win_streak`: +1 on a 1st, reset to 0 on anything else
   - `champ_streak:<event>`: Championship class only, same rule
3. **Threshold awards**, anything just crossed:
   - Career tier: 5, 15, 40, 100, 250.
   - Class trophy: 3 class wins, or a Championship streak of 3.
   - All-Rounder: at least one class win in every classed event of that class.
   - Grand Champion: the Championship trophy in every classed event.
   - Veteran Cup tiers: 1, 5, 15.
   - Win Streak feat at 5.
   - Lifetime and Trophy Collector tiers.
4. **Seasonal:** a 1st place in the current season's featured event during its dates.
5. **Result feats**, from the result data:

| Feat | Condition |
| --- | --- |
| Flawless | 1st in a Championship Hurdles race with zero hurdles missed |
| Photo Finish | 1st with a margin under 0.1 s to 2nd |
| Comeback | 1st after being last at the halfway point |
| Perfect Recall | Trick Show finished at the maximum sequence length with no misses |
| Personal Best | Time beats the pet's previous best in that event and class. The first race there only sets the baseline |

**Result data needed:** the stored race result must include each entrant's finish time, order at halfway, hurdles missed (Hurdles and Obstacle Course) and Trick Show sequence length and misses. Add any that the result report doesn't already carry. Keep `personal_best:<event>:<class>` in `award_progress`.

XP and the existing race rewards stay as they are; awards are added on top. The results screen shows the ribbon and any new trophies from the function's return value (see Celebrations).

## Pet retirement

Retirement isn't built yet, but awards must be ready for it now: every award stays with the player, filed under the pet that earned it, and each pet keeps its own separate case.

**Build now:**

- Every award row carries `player_id`, `pet_id` and `pet_snapshot`. Never delete a pet row that awards point to. Retiring changes the pet's status, not its id.
- All Trophy Case queries filter by one `pet_id`. Nothing in the UI mixes two pets' awards, except lifetime trophies (`pet_id` null).
- Badges, Lookbook stamps, ribbons and trophies all live per pet. A new pet starts with the empty state.

**How pets are told apart (ships with retirement):**

- **Pet switcher** above the Trophy Case tabs, shown only when the player has more than one pet. The current pet comes first. Retired pets follow, newest first, each a chip with its snapshot avatar and name. Don't show a "Retired" label anywhere in the UI; the order and the pet's name are enough.
- Switching pets changes all three tabs to that pet's awards. Retired pets' awards keep full color, since they're a record, not locked items. The header reads "\[name\]'s Trophy Case".
- Every detail sheet and award card names the pet and date: "Won by Maple · Oct 30 · Novice". It uses the snapshot, so it stays right if the pet changes later.
- The Settings card always shows only the current pet.
- **Hall of Fame** (later) gets a fourth chip in the switcher: lifetime trophies, plus one tile per retired pet with its best trophy and totals.

**Runway shows:**

- Saved shows already store each model's pet snapshot. Past Shows lists every show the player was in, with the pet that walked shown on each row (avatar + name).
- Retired pets' shows stay watchable, as already decided.
- Stamps earned in a show belong to the pet that walked it. A retired pet walking later as an NPC model earns nothing.

**Races:** past race results keep the entrant's pet snapshot. A retired pet entered as an NPC opponent earns nothing.

**Account deletion:** delete the player's awards, progress, `runway_pieces_worn` rows and pet snapshots in awards. Saved shows keep their anonymized "Former player" treatment.

## Acceptance checklist

- [x] Trophy, Ribbon, Stamp, Badge, Cover and Sash render like the canvas at every size, earned and unearned, with several instances on screen keeping their own colors.
- [x] Badge art is hex pins (shelf + both celebration overlays). `blue-ribbon` migrates to `first-win` on load.
- [x] Settings shows the Trophy Case card (filled and empty) in the Badges slot; the Badges row is gone. Phone order and the landscape three-column layout stay as shipped.
- [x] Trophy Case opens from Settings with Races, Runway and Badges tabs; a new pet sees the empty state.
- [x] A 1st-place solo race grants exactly one ribbon (`place` 1), even when the report is retried. Unique on `(race_id, pet_id)`.
- [x] Fun Run and 800 Meters never get class trophies. Friend games, cancelled races and NPCs grant nothing. `grant_race_awards` runs from `stadium_rank`.
- [x] Ribbon Rack, First Win and Moving Up read the awards cache (plus leftover `state.ribbons`, deduped by race id). The phone no longer appends `state.ribbons`.
- [ ] The third Novice Weave win grants the Novice Weave trophy, and the results screen celebrates it.
- [ ] A loss resets the Championship streak and the Win Streak count.
- [x] A first solo show in a theme grants Debut; the fifth counted show grants Encore; a fourth solo show in a day doesn't count toward Encore. `record_solo_runway_walk` persists `mode=solo` then `grant_runway_awards(..., 'solo_walked')`.
- [x] A friend show grants Runway Party to every submitter when voting opens, and Crowd Favorite plus Showstopper to the winner(s) when results publish. `submit_runway_looks` / `cast_runway_vote` / `open_runway_voting_if_due` call `grant_runway_awards`.
- [x] Full Rack is granted once every theme-specific piece has been worn; the theme page shows pieces worn.
- [ ] The Lookbook Bronze, Silver and Gold trophies are granted when their stamp sets are complete across evergreen themes.
- [ ] Raising a threshold in config never removes an earned award.
- [x] Settings and the Trophy Case show cached awards offline.
- [ ] Deleting the account removes the player's awards and progress.

## Open decisions (don't build yet)

- [ ] NPC calibration: lower the top-3 target from 75% so ribbons feel earned.
- [ ] Season dates and each season's featured event.
- [ ] Friends viewing each other's Trophy Case (needs a profile page).
- [ ] Hall of Fame screen and the retirement flow: not part of this build.
