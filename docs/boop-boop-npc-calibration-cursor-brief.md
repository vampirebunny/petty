# Cursor Brief: NPC Calibration

**Shipped.** Migration `20261030120000_npc_calibration.sql` is applied. `race_report` logs eligible finishes, and `npc_calibrate` is deployed. `pg_cron` and `pg_net` are enabled. A daily cron job POSTs `{"action":"run"}` to `npc_calibrate` with the service role key.

Builds on the race foundation (NPC skill, seeds, config versions, results) and the ship event briefs: Fun Run, Dock Dive, Hurdles, and Obstacle Course.

Sniff Out, Trick Show, and Weave are not part of this. Ghost replays are not part of this version.

## Goal

Make NPC pets perform like real players do, per event and class, and keep solo races winnable but not easy. Real results build a performance curve. NPC skill (0–1) is read as a percentile on that curve. The sim already turns a skill into a finish, so calibration only chooses the skill that hits the target. A small offset then nudges solo win rate toward 33%.

Until a cell has enough data, NPCs keep the skill spread written at fill time, which is the event brief's current behavior.

## 1. Results logging

`race_report` already replays the input log. After a verified finish it replays once more with neutral modifiers and inserts one row into `race_results`:

race_id, pet_id, player_id, event, class (the race class, not the pet's level), config_version, is_solo, metric, metric_adj, metric_kind, created_at

| Event | metric | metric_kind | Better is |
| --- | --- | --- | --- |
| Fun Run, Hurdles, Obstacle Course | finish time (ms) | time | lower |
| Dock Dive | best distance (score_dm) | distance | higher |

`metric_adj` is that second replay. The skill grid uses the same neutral baseline. NPC attributes in the sim then apply on top, the same way a real pet's modifiers do.

Logged for stadium races only. Skipped:

- NPCs
- DNFs (no finish)
- friend games (`cup = 'friends'`)
- anonymous users

There is no test-account flag, so dev and test accounts are not excluded. Merged classes stay in the lower class's curve. The bot-like flag stays log-only and does not drop a run. A logging failure does not fail the race report.

## 2. Nightly job

Edge function `npc_calibrate`, action `run`. The daily `pg_cron` job calls it through `pg_net` with the service role key. A signed-in user token cannot start a run.

For each event × class × config version:

1. If the skill grid is missing, build it. Run `replayNpc` at skill 0, 0.05, … 1, average a fixed set of seeds, then force the series monotonic (higher skill is faster, or a longer dive). The default curve is those 21 metrics in that order.
2. Take eligible `metric_adj` rows from the last 14 days. One value per account: the median. A player who races many times counts once.
3. Below 200 runs or 30 accounts, leave the cell on its simulated default. A cell that has already gone active holds its curve through a thin day.
4. Otherwise build 21 percentiles in performance order: index 0 is the worst result, index 20 is the best. For finish times that reverses the raw order, so a higher index is a faster time.
5. Blend toward the cell's own default: `w = min(1, n_players / 100)`, `target = w × data + (1 − w) × default`.
6. Move the active curve toward that target by at most 5% of each point's current value:

`next = current + clamp(target − current, −0.05 × |current|, +0.05 × |current|)`

A new config version starts from its own simulated default. Curves are not copied from the previous version or from a neighboring class. Veteran Cup is its own class (`veteran`). Fun Run's regular field is `open`.

The first runs seed the current stamp versions (every class). Older versions are seeded when a result for them shows up and the sim still knows that version.

## 3. From curve to NPC skill

`stadium_fill_npcs` still writes the weak-to-strong spread, then remaps it when a calibration row exists.

- Default curve and offset 0: the spread skill is left as written. Races match the event briefs.
- Otherwise the spread skill plus the difficulty offset is clamped to 0.10–0.90, read as a percentile on the active curve, and inverted through the grid to a sim skill. That sim skill is what `race_entries.skill` stores. The phone and `replayNpc` already read that column.

Seed variation inside each event (Fun Run wobble, Hurdles speed, Dock Dive flop chance) stays in the sim. Calibration does not add a second wobble.

## 4. Win-rate control

Per event × class × config version, over the last 7 days of solo races (a finished race that has NPCs and one real account):

- Target win rate 33%. A solo DNF counts as a loss.
- At least 100 solos, or the offset holds.
- More than 5 percentage points above target: offset +0.02. More than 5 below: −0.02. Range −0.15 to +0.15.
- The offset starts at 0. Each config version has its own row, so a new version starts at 0. The column is `skill_offset` (`offset` is reserved in Postgres).
- Top-3 rate is not a control. The skill spread from the foundation brief stays as authored.

Frozen cells skip the curve update and the offset step. Manual offset skips the step until it is set back to automatic.

## 5. DEV inspector

A `__DEV__` block in the home debug panel (Expo Go) and, in a development build, on the Stadium screen. It lists each cell: status, sample size, solo win rate, offset, the grid metric at skill 0.2, 0.5, and 0.8, and the 21 curve points.

Freeze, reset, and manual offset call `npc_calibrate`. Those actions refuse unless the function env `NPC_CALIBRATION_ADMIN` is `1`. A production deploy leaves that unset. Reset restores the default curve, offset 0, and automatic mode.

## Done when

- With no calibration row, NPCs keep the spread skill from fill time.
- On a default curve, a skill maps back to itself through the grid.
- A test set that clears the gate moves the curve toward it, and no point moves more than 5% of its value in one run.
- Skill 0.5 on a neutral replay sits on the median of that curve.
- Solo win rate steps the offset toward 33% once 100 solos are in the window.
- The phone and the server replay both use the skill stored on the NPC entry.
