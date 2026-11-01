# Boop Boop Awards — Cursor Brief

Nov 1, 2026 · @A

**Superseded for build steps** by [Trophy Case and Awards — Cursor Implementation Brief](Trophy%20Case%20and%20Awards%20—%20Cursor%20Implementation%20Brief.md). Rules and thresholds live in [awards-design-brief.md](awards-design-brief.md). Migrations `20261101180000_awards.sql`, `20261101190000_race_grant_awards.sql`, and `20261101200000_runway_grant_awards.sql` are applied.

## Overview

Add awards: ribbons and trophies won in Stadium races, and a sash and Cover Stars from runway shows at The Catwalk. Awards are a lasting record of what a pet achieved, shown in a Trophy Case opened from Settings.

- **Ownership:** every award is owned by the player and linked to the pet that won it. Awards never move, disappear or reset when a pet is retired, becomes an NPC, or changes in any way.
- **Separate from badges and levels:** badges and levels stay on the pet and describe its current state. Awards describe history. Don't merge the systems.
- **Two families:** race awards reward winning and skill. Runway awards reward taking part, style range and friends, because runway voting is just for fun.
- **Designed to strive for:** every track has a long ladder, small to large, with the next goal always visible. Nothing is earned by practice runs.
- **All numbers in config:** every threshold in this brief is a starting value to tune once real win rates come in.

## Race ribbons

Ribbons go to 1st, 2nd and 3rd in every ranked race, are unlimited, and stack into counts on display.

| Placing | Ribbon | Look |
| --- | --- | --- |
| 1st | Blue | Rosette with gold center and two tails |
| 2nd | Red | Rosette, two tails |
| 3rd | Yellow | Rosette, two tails |

- **Event icon:** each ribbon's center carries its event's icon (Fun Run, Hurdles, Weave, Obstacle Course, Dock Dive, Sniff Out, Trick Show), so there are 21 distinct race ribbons per class.
- **Class tint:** a thin outer ring shows the class (Beginner to Championship). Veteran Cup ribbons get a silver ring.
- **Every ribbon is stored:** one row per ribbon won, for history and stats.
- **Displayed stacked:** each distinct ribbon (event × class × placing) appears once with a count, e.g. "Hurdles · Novice · 1st ×12".
- **No awards from practice runs,** cancelled races, or races the pet withdrew from or didn't show for.
- **Live races:** same ribbons as solo races, so players without friends online never fall behind.

## Race trophies

Trophies are finite and one-time each, across six tracks that reward climbing, dedication, skill, range, age and timing. Bigger trophies mean harder goals.

### 1. Class trophies (climbing)

One trophy per event per class. Size grows with the class, so the shelf grows up with the pet.

| Class | Requirement | Look |
| --- | --- | --- |
| Beginner | 3 first places | Small cup |
| Novice | 3 first places | Taller cup with handles |
| Open | 3 first places | Cup on a plinth |
| Expert | 3 first places | Large two-handled cup |
| Championship | 3 first places **in a row** | The big cup |

- Championship's streak resets on any race in that event and class where the pet doesn't place 1st.
- 7 events × 5 classes = 35 class trophies.

### 2. Career trophies (dedication)

Per event, counting 1st places in **any** class, so a pet that moves up never loses progress.

| Tier | Wins in the event | Look |
| --- | --- | --- |
| Bronze | 5 | Small cup |
| Silver | 15 | Taller cup |
| Gold | 40 | Cup on a plinth |
| Platinum | 100 | Large two-handled cup |
| Diamond | 250 | Crystal cup, the rarest race trophy |

Each tier is its own award row. On the shelf, an event's career slot shows its highest tier earned.

### 3. Feat trophies (skill)

One-time trophies that only good play earns.

| Feat | How to earn it |
| --- | --- |
| Flawless | Clear every hurdle in a Championship Hurdles race and place 1st |
| Photo Finish | Win by under 0.1 s |
| Comeback | Win after being last at the halfway point |
| Win Streak | 5 first places in a row, any events |
| Perfect Recall | Finish the longest Trick Show sequence without a miss |
| Personal Best | Beat your own best time in an event, once per class (one award per event × class) |

Feat checks run on the server-validated result. Comeback and Photo Finish need the race's halfway order and finish margin saved with the result.

### 4. Range trophies (all-rounder)

- **All-Rounder:** a 1st place in every event within one class. One per class.
- **Grand Champion:** the Championship class trophy in every event. The largest race trophy in the game.

### 5. Veteran Cup

Seniors race the Veteran Cup instead of climbing classes, so it has its own ladder: 1, 5 and 15 Veteran Cup wins, a silver-and-navy cup that grows at each step.

### 6. Seasonal trophies

Each season has a named trophy (e.g. "Fall Classic 2026") for a 1st place in that season's featured event. Once the season ends, it can never be earned again. Season dates and featured events live in config.

## Runway awards

Runway awards celebrate taking part, trying every theme and walking with friends, never winning, because runway voting is just for fun. They use their own award types (magazine covers and a sash) on a separate Runway shelf.

### 1. Cover Stars (shows walked)

Total shows walked, solo or friends, within the daily cap below.

| Tier | Shows walked | Look |
| --- | --- | --- |
| Bronze Cover | 5 | Propped-up magazine cover |
| Silver Cover | 15 | Cover on an easel |
| Gold Cover | 40 | Framed cover on an easel |
| Platinum Cover | 100 | Framed cover on an easel with a plaque |

A show counts as walked when the pet's 3 looks have walked: at the end of a solo show, or when a friend show's voting opens.

### 2. The Lookbook (theme range)

Each theme has its own page in the pet's Lookbook with 5 stamps to collect, each earned a different way and each with its own design.

| Stamp | How to earn it (in that theme) | Frame |
| --- | --- | --- |
| Debut | Walk a show | Round |
| Encore | Walk 5 shows | Square with notched corners |
| Runway Party | Walk a friend show | Scalloped postage edge |
| Full Rack | Wear every theme-specific costume piece at least once, across shows | Ticket stub |
| Showstopper | Win Crowd Favorite | Gold-foil star (bonus) |

- **Art:** the frame shape and color say which stamp it is; the motif inside is drawn for the theme (e.g. a rocket for space travelers). 12 themes × 5 stamps = 60 distinct stamps at launch.
- **Unearned stamps** show as a faint outline of the frame with the motif hidden, and tapping one shows how to earn it.
- **Full Rack** counts only the theme's own pieces, not versatile pieces shared across themes. Progress shows as "Full Rack: 6 / 8 pieces".
- **Showstopper is a bonus:** it counts on the page but isn't needed for the Lookbook trophies, so completing the Lookbook never depends on winning votes.

**Lookbook trophies** (one-time each):

| Tier | Requirement |
| --- | --- |
| Bronze Lookbook | Debut stamp in every evergreen theme |
| Silver Lookbook | Debut, Encore and Runway Party in every evergreen theme |
| Gold Lookbook | All 4 non-bonus stamps in every evergreen theme |

- New evergreen themes add a page and raise what "every theme" means, but trophies already earned are kept.
- Seasonal themes get a page too, with stamps earnable only while the theme runs. They never count toward Lookbook trophies, so missing a season never blocks completion.

### 3. Friend shows

| Award | How to earn it | Tiers |
| --- | --- | --- |
| Host | Host friend shows that run (at least one other player submits) | 1, 5, 15 |
| Runway Crew | Walk in friend shows with different friends | 3, 10, 25 distinct friends |
| Front Row | Vote in friend shows | 10, 30, 75 shows |

Front Row counts for judge-only viewers too, so friends who watch and vote are rewarded.

### 4. Crowd Favorite

- The friend-show winner gets a **Crowd Favorite sash**. In a tie, every tied player gets one.
- Shown as a count ("Crowd Favorite ×4"). No trophy ladder sits behind it, so winning stays a fun moment, not a grind.
- Solo and NPC shows have no judging, so they give no sash.

### Daily cap

Only the first 3 solo shows per pet per day (player's local day) count toward Cover Stars and the Lookbook. Friend shows always count. Show the cap gently after the third solo show: "Today's solo shows are counted. Friend shows always count."

## Hall of Fame and lifetime awards

The Hall of Fame turns retirement into a ceremony and gives players goals that span every pet they raise. Build the data now; the induction moment ships with retirement.

- **Hall of Fame entry:** when retirement exists, a retired pet is inducted with its snapshot avatar, name, breed, active dates, award totals, best trophy and feats. Until then, nothing to build beyond keeping award rows linked to `pet_id`.
- **Lifetime trophies (player-level):** counted across all of the player's pets, past and present.

| Lifetime trophy | Requirement | Tiers |
| --- | --- | --- |
| Lifetime Wins | Race 1st places across all pets | 100, 500, 1,000 |
| Lifetime Shows | Runway shows walked across all pets | 50, 200, 500 |
| Trophy Collector | Trophies earned across all pets | 25, 100, 250 |

Lifetime trophies have no `pet_id`. A new pet starts its own pet awards from zero, but lifetime progress carries on.

## Data model and award writing

All awards live in Supabase, written by the server when a result is confirmed, in one table plus a progress table. Adjust names to existing conventions.

**`award_definitions`** (catalog, in config or a Supabase table): `id` (e.g. `career_hurdles_gold`), `family` (race / runway / lifetime), `kind` (ribbon, trophy, sash, cover, stamp), `track` (class, career, feat, range, veteran, seasonal, covers, lookbook, friends, crowd, lifetime), `event_type` / `class` / `theme_id` (nullable), `tier`, `threshold`, `size` (1–6, drives art scale), `available_from` / `available_until` (seasonal), `art_key`.

**`awards`** (one row per award won):

- `id`, `player_id` (owner), `pet_id` (nullable link; null for lifetime awards)
- `award_definition_id`
- `pet_snapshot`: name, species, breed and coat at the time won, so it displays correctly whatever happens to the pet later
- `source` (race / runway), `race_id` or `show_id` (nullable), `placing` (ribbons)
- `earned_at`, `config_version`

**`award_progress`** (counters, so the server doesn't recount history): `player_id`, `pet_id` (nullable), `counter_key` (e.g. `wins:hurdles`, `class_wins:hurdles:novice`, `champ_streak:hurdles`, `win_streak`, `shows_walked`, `solo_shows_today`, `runway_friends:distinct`), `value`, `updated_at`.

**Rules**

1. **Server writes, once.** When race results or show results are confirmed, one server function writes ribbons, updates counters, and inserts any newly crossed trophies in the same transaction as the result. The phone never inserts awards.
2. **Idempotent.** Unique keys: ribbons on (`race_id`, `pet_id`); one-time awards on (`pet_id`, `award_definition_id`); lifetime on (`player_id`, `award_definition_id`). A retry or duplicate report changes nothing.
3. **Stored, not computed.** A trophy row, once written, is permanent. Raising a threshold later never revokes it.
4. **Pet link for player-level runway awards:** Host, Front Row and Crowd Favorite link to the player's current pet at the time.
5. **Retirement:** never delete pet rows that awards point to. Awards stay on the player whatever the pet becomes.
6. **Account deletion:** delete the player's awards, progress and Hall of Fame entries (unlike saved shows, awards are personal).
7. **Return payload:** the result response lists the awards just earned, so the results screen can celebrate them (see Display).

## Display

A **Trophy Case** row in Settings opens its own page, grouped by pet, with every next goal visible.

**Trophy Case page**

1. **Pet switcher at top:** the current pet first, then retired pets with a small "Retired" tag and their snapshot avatar. A **Hall of Fame** tab sits beside them (lifetime trophies now, retired-pet entries later).
2. **Race shelf:** trophies on wooden shelves, drawn at their `size`, so bigger trophies visibly tower. Rows: Grand Champion and All-Rounder, class trophies by class, career slots by event (highest tier shown), feats, Veteran Cup, seasonal.
3. **Ribbon board:** a grid of distinct ribbons grouped by event, each with its ×count.
4. **Runway shelf:** Cover Stars, the Lookbook (a stamp page per theme), friend-show awards, and the Crowd Favorite sash with its count.
5. **Header totals:** ribbons, trophies, shows walked.

**Striving cues**

- **Silhouettes:** unearned trophies show as shaded silhouettes, like unfound park finds. Expired seasonal trophies that weren't earned are hidden, not silhouetted.
- **Progress:** tapping any trophy or silhouette opens a detail card with its name, requirement and progress ("Hurdles Gold: 28 / 40"), or, if earned, the date, pet and race or show.
- **Next goal on results:** the race and show results screens show newly earned awards with a short celebration (award drops in, Boops-style burst), then one "next up" line for the closest unearned trophy.

**Room furniture**

- A free **ribbon board** and **trophy shelf** are granted with the pet's first ribbon, using the existing furniture, Move and Storage system.
- They show the current pet's best: its 6 highest-tier trophies and its 8 best ribbons. Tapping either opens the Trophy Case.

All award art is SVG, delivered separately.

## Config values

All thresholds live in one awards config, versioned with `config_version`, so tuning needs no code change.

| Key | Starting value |
| --- | --- |
| `ribbonPlacings` | 1, 2, 3 |
| `classTrophyWins` | 3 |
| `championshipStreak` | 3 in a row |
| `careerTiers` | 5, 15, 40, 100, 250 |
| `photoFinishMarginSec` | 0.1 |
| `winStreakFeat` | 5 |
| `veteranTiers` | 1, 5, 15 |
| `coverTiers` | 5, 15, 40, 100 |
| `soloShowsCountedPerDay` | 3 |
| `hostTiers` | 1, 5, 15 |
| `runwayCrewTiers` | 3, 10, 25 |
| `frontRowTiers` | 10, 30, 75 |
| `lifetimeWinsTiers` | 100, 500, 1000 |
| `lifetimeShowsTiers` | 50, 200, 500 |
| `trophyCollectorTiers` | 25, 100, 250 |
| `furnitureTopTrophies` / `furnitureTopRibbons` | 6 / 8 |
| `seasons` | name, start, end, featured event |

Lookbook keys: `lookbookStamps` (the 5 stamp definitions and their rules), `encoreShows` 5, `lookbookTierStamps` (which stamps each Lookbook trophy tier needs).

Log award grants to analytics (award id, days since adoption) so the thresholds can be tuned from real data.

## Open decisions (don't build yet)

These are undecided. The brief uses the default in brackets; leave config values or hooks, but flag before building anything beyond the default.

- [ ] Ribbon colors: US style (blue / red / yellow) \[US style\].
- [ ] NPC calibration: lower the top-3 target from 75% so ribbons feel earned \[lower to about 50%\].
- [ ] XP per race: cap XP to the first few ribbons a day, or keep it per race \[keep per race until data says otherwise\].
- [ ] Season dates and each season's featured event.
- [ ] Hall of Fame induction screen: ships with retirement, design later.
- [ ] Friends viewing each other's Trophy Case: needs a player profile page, which doesn't exist yet.
- [ ] Final award names and art.
