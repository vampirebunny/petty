# Boop Boop Awards — Design Brief (rules and thresholds)

Nov 1, 2026

Reference for award rules, thresholds, data model and config. Read it alongside the **Trophy Case and Awards — Cursor Implementation Brief**. Art and layout live in `docs/Lookbook Mocks.html`; implemented components are in `src/ui/awards/`. Tables and grant functions live in `supabase/migrations/20261101180000_awards.sql` (applied). Race grant wiring is `20261101190000_race_grant_awards.sql` (applied). Runway grant wiring is `20261101200000_runway_grant_awards.sql` (applied). `grant_runway_awards` is called from the show RPCs (`submit_runway_looks`, `cast_runway_vote`, `open_runway_voting_if_due`, `record_solo_runway_walk`). The Trophy Case reads the phone awards cache. Settings shows the Trophy Case card (hex shelf is gone). Where the two disagree, the implementation brief wins.

## Overview

Awards are ribbons and trophies won in Stadium races, and Cover Stars, friend-show awards and the Crowd Favorite sash from runway shows at The Catwalk. Awards are a lasting record of what a pet achieved, shown in the Trophy Case opened from Settings.

- **Ownership:** every award is owned by the player and linked to the pet that won it. Awards never move, disappear or reset when a pet is retired, becomes an NPC, or changes in any way.
- **Separate from badges and levels:** badges and levels stay on the pet (badges keep living in the pet JSON via `syncBadges`) and describe its current state. Awards describe history. Don't merge the systems; the award tables below never hold badges.
- **Two families:** race awards reward winning and skill. Runway awards reward taking part, style range and friends, because runway voting is just for fun.
- **Designed to strive for:** every track has a long ladder, small to large, with the next goal always visible. Nothing is earned by practice runs.
- **All numbers in config:** every threshold is a starting value to tune once real win rates come in.

## Events and classes

Use the race event list from the code's event config, never a hardcoded count. It includes Fun Run, 800 Meters, Hurdles, Weave, Obstacle Course, Dock Dive, Sniff Out and Trick Show.

**Fun Run and 800 Meters have no classes.** They get ribbons, career trophies and feats, but no class trophies, no class-win or Championship streak counters, and they don't count toward All-Rounder or Grand Champion. Their Personal Best is tracked per event only. Every other event is a "classed event".

## Race ribbons

Ribbons go to 1st, 2nd and 3rd in every ranked race, are unlimited, and stack into counts on display.

| Placing | Ribbon | Look |
| --- | --- | --- |
| 1st | Blue | Rosette, `1ST` banner, two tails |
| 2nd | Red | Rosette, `2ND` banner, two tails |
| 3rd | Yellow | Rosette, `3RD` banner, two tails |

- **Event icon:** each ribbon's center carries its event's emblem.
- **Class ring:** the inner ring shows the class (Beginner to Championship). Veteran Cup ribbons get a silver ring. Fun Run and 800 Meters ribbons get a cream ring (`cls = none`).
- **Every ribbon is stored:** one row per ribbon won, for history and stats.
- **Displayed stacked:** each distinct ribbon (event × class × placing) appears once with a count, e.g. "Hurdles · Novice · 1st ×12".
- **No awards from practice runs,** cancelled races, or races the pet withdrew from or didn't show for.
- **Live races:** same ribbons as solo races.

## Race trophies

Trophies are finite and one-time each. Bigger trophies mean harder goals.

### 1. Class trophies (classed events only)

One trophy per classed event per class. Size grows with the class.

| Class | Requirement | Look |
| --- | --- | --- |
| Beginner | 3 first places | Small cup |
| Novice | 3 first places | Cup with handles |
| Open | 3 first places | Cup on a plinth |
| Expert | 3 first places | Large two-handled cup |
| Championship | 3 first places **in a row** | Grand cup with lid |

- Championship's streak resets on any race in that event and class where the pet doesn't place 1st.

### 2. Career trophies (every event)

Per event, counting 1st places in **any** class, so a pet that moves up never loses progress.

| Tier | Wins in the event | Look |
| --- | --- | --- |
| Bronze | 5 | Small cup |
| Silver | 15 | Cup with handles |
| Gold | 40 | Cup on a plinth |
| Platinum | 100 | Large two-handled cup |
| Diamond | 250 | Crystal cup, the rarest race trophy |

Each tier is its own award row. On the shelf, an event's career slot shows its highest tier earned.

### 3. Feat trophies (skill)

| Feat | How to earn it |
| --- | --- |
| Flawless | Clear every hurdle in a Championship Hurdles race and place 1st |
| Photo Finish | Win by under 0.1 s |
| Comeback | Win after being last at the halfway point |
| Win Streak | 5 first places in a row, any events |
| Perfect Recall | Finish the longest Trick Show sequence without a miss |
| Personal Best | Beat your own best time in an event and class (per event only for Fun Run and 800 Meters). The first race there only sets the baseline |

Feat checks run on the server-validated result, which must store each entrant's finish time, order at halfway, hurdles missed, and Trick Show sequence length and misses.

### 4. Range trophies

- **All-Rounder:** a 1st place in every classed event within one class. One per class.
- **Grand Champion:** the Championship class trophy in every classed event. The largest race trophy in the game.

### 5. Veteran Cup

Seniors race the Veteran Cup instead of climbing classes: 1, 5 and 15 Veteran Cup wins, a silver-and-navy cup that grows at each step.

### 6. Seasonal trophies

Each season has a named trophy (e.g. "Fall Classic 2026") for a 1st place in that season's featured event during its dates. Once the season ends it can never be earned again. Season dates and featured events live in config.

## Runway awards

Runway awards celebrate taking part, trying every theme and walking with friends, never winning. They use their own art (magazine covers and a sash) on the Runway tab.

### 1. Cover Stars (shows walked)

| Tier | Shows walked | Look |
| --- | --- | --- |
| Bronze | 5 | Propped-up magazine cover |
| Silver | 15 | Cover on an easel |
| Gold | 40 | Framed cover on an easel |
| Platinum | 100 | Framed cover on an easel with a plaque |

A show counts as walked when the pet's 3 looks have walked: at the end of a solo show, or when a friend show's voting opens.

### 2. The Lookbook (theme range)

Each theme has its own page with 5 stamps, each earned a different way and each with its own design.

| Stamp | How to earn it (in that theme) | Frame |
| --- | --- | --- |
| Debut | Walk a show | Round |
| Encore | Walk 5 shows | Square with notched corners |
| Runway Party | Walk a friend show | Scalloped postage edge |
| Full Rack | Wear every theme-specific costume piece at least once, across shows | Ticket stub |
| Showstopper | Win Crowd Favorite | Gold-foil star (bonus) |

- 12 themes × 5 stamps = 60 stamps at launch. Frame shape and color say which stamp; the motif says which theme.
- Full Rack counts only the theme's own pieces, not versatile pieces shared across themes.
- Showstopper is a bonus: it isn't needed for the Lookbook trophies.

**Lookbook trophies** (one-time each):

| Tier | Requirement |
| --- | --- |
| Bronze Lookbook | Debut in every evergreen theme |
| Silver Lookbook | Debut, Encore and Runway Party in every evergreen theme |
| Gold Lookbook | All 4 non-bonus stamps in every evergreen theme |

- New evergreen themes raise what "every theme" means, but trophies already earned are kept.
- Seasonal themes get a page, with stamps earnable only while the theme runs. They never count toward Lookbook trophies.

### 3. Friend shows

| Award | How to earn it | Bronze / Silver / Gold |
| --- | --- | --- |
| Host | Host friend shows that run (at least one other player submits) | 1 / 5 / 15 |
| Runway Crew | Walk in friend shows with different friends | 3 / 10 / 25 distinct friends |
| Front Row | Vote in friend shows (judge-only viewers count) | 10 / 30 / 75 shows |

### 4. Crowd Favorite

- The friend-show winner gets a Crowd Favorite sash. In a tie, every tied player gets one.
- Shown as a count ("Crowd Favorite ×4"), with no ladder behind it.
- Solo and NPC shows have no judging, so they give no sash.

### Daily cap

Only the first 3 solo shows per pet per local day count toward shows walked, Encore and Cover Stars. Debut counts on any show. Friend shows always count. After the third, show: "Today's solo shows are counted. Friend shows always count."

## Lifetime awards (player-level)

Counted across all of the player's pets. They have no `pet_id`.

| Lifetime trophy | Requirement | Tiers |
| --- | --- | --- |
| Lifetime Wins | Race 1st places across all pets | 100, 500, 1,000 |
| Lifetime Shows | Runway shows walked across all pets | 50, 200, 500 |
| Trophy Collector | Trophies earned across all pets | 25, 100, 250 |

The Hall of Fame screen is not part of this build.

## Data model

All awards live in Supabase and are written only by the server, when a race or show result is confirmed. Badges are not stored here.

**`award_definitions`** (seeded from config): `id` (e.g. `career_hurdles_gold`), `family` (race / runway / lifetime), `kind` (ribbon, trophy, sash, cover, stamp), `track` (class, career, feat, range, veteran, seasonal, covers, lookbook, friends, crowd, lifetime), `event_type` / `class` / `theme_id` (nullable), `tier`, `threshold`, `size` (drives art scale), `available_from` / `available_until` (seasonal), `art_key`.

**`awards`** (one row per award won):

- `id`, `player_id` (owner), `pet_id` (nullable; null for lifetime awards)
- `award_definition_id`
- `pet_snapshot`: name, species, breed, coat and avatar seed at the time won
- `source` (race / runway), `race_id` or `show_id` (nullable), `placing` (ribbons)
- `earned_at`, `config_version`

**`award_progress`** (counters): `player_id`, `pet_id` (nullable), `counter_key` (e.g. `wins:hurdles`, `class_wins:hurdles:novice`, `champ_streak:hurdles`, `win_streak`, `personal_best:hurdles:novice`, `shows_walked`, `shows_walked:space`, `solo_shows_on:2026-11-01`, `runway_friends`, `front_row`, `hosted`, `veteran_wins`, `lifetime_wins`), `value`, `updated_at`.

**`runway_pieces_worn`**: `pet_id`, `theme_id`, `piece_id`, unique on all three (for Full Rack).

**Rules**

1. **Server writes, once.** One server function per result writes ribbons, updates counters and inserts newly crossed awards in the same transaction as the result. The phone never inserts awards.
2. **Idempotent.** Unique keys: ribbons on (`race_id`, `pet_id`); one-time awards on (`pet_id`, `award_definition_id`); lifetime on (`player_id`, `award_definition_id`).
3. **Stored, not computed.** Raising a threshold later never revokes an award.
4. **Player-level runway awards** (Host, Front Row, Crowd Favorite) link to the player's current pet at the time.
5. **Retirement:** never delete pet rows that awards point to.
6. **Account deletion:** delete the player's awards, progress and `runway_pieces_worn` rows.
7. **Return payload:** each granting function returns the awards just earned, for the results screen.

## Config values

All thresholds live in one awards config, versioned with `config_version`.

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
| `encoreShows` | 5 |
| `hostTiers` | 1, 5, 15 |
| `runwayCrewTiers` | 3, 10, 25 |
| `frontRowTiers` | 10, 30, 75 |
| `lifetimeWinsTiers` | 100, 500, 1000 |
| `lifetimeShowsTiers` | 50, 200, 500 |
| `trophyCollectorTiers` | 25, 100, 250 |
| `lookbookStamps` | the 5 stamp definitions and their rules |
| `lookbookTierStamps` | which stamps each Lookbook tier needs |
| `furnitureTopTrophies` / `furnitureTopRibbons` | 6 / 8 |
| `seasons` | name, start, end, featured event |

Log each award grant to analytics (award id, days since adoption) so the thresholds can be tuned from real data.

## Open decisions (don't build yet)

- NPC calibration: lower the top-3 target from 75% so ribbons feel earned (default: about 50%).
- XP per race: keep per race until data says otherwise.
- Season dates and each season's featured event.
- Friends viewing each other's Trophy Case (needs a profile page).
