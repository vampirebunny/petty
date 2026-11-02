# Supabase migrations

Applied on hosted project `unfatkwtzfkqnnbgzuqs`:

- `20261019120000_consent_records.sql` — `consent_records` and `delete_my_guest_data()`
- `20261022120000_pets_and_player_state.sql` — `pets`, `player_state`, and `push_active_pet`, `retire_pet`, `push_player_state`
- `20261023120000_shop_catalog.sql` — `shop_items`, `shop_bundles`, `shop_config`, anon read, and the placeholder seed

Applied by the owner through `20261024250000_ledger_source_ambiguity.sql`, including the accounts migrations:

- `20261024200000_ledger_and_active_device.sql` — ledger, active device, and earn rules
- `20261024210000_profiles_and_health.sql` — `profiles`, `check_handle_available`, `app_health`
- `20261024220000_claim_handle.sql` — `claim_handle`
- `20261024230000_pull_has_handle.sql` — `pull_account_state` reports a saved handle
- `20261024240000_anonymous_cleanup.sql` — `cleanup_empty_anonymous_users()` (creating it does not delete users)
- `20261024250000_ledger_source_ambiguity.sql` — earn lookup no longer aborts the batch

`apple_store_token`, `delete_account`, `supersede_guest`, `revenuecat-webhook`, `race_report`, `notify_friend_game_accept`, and `notify_runway_show` are deployed on that project. `revenuecat-webhook` has `verify_jwt = false` and requires `REVENUECAT_WEBHOOK_SECRET`.

`notify_friend_game_accept` tells the host and the other friends still invited when someone accepts a friend-game invite (`kind: friend_game_accepted`). While the app is open, that push and the other social pushes (`friend_request`, `friend_game`, `friend_game_call`, `race`, `runway_show`, `runway_submitted`, `runway_vote`, `runway_results`) stay in the app instead of a system banner. A closed or backgrounded app still gets the system notification.

`20261101240000_friend_playdates.sql` is applied. It adds `playdates`, `playdate_participants`, `submit_friend_playdate`, `list_friend_playdates`, and `mark_playdate_seen`. `notify_friend_playdate` sends `@handle arranged a playdate!` (`kind: friend_playdate`). A tap does not open a screen. See [the sharing brief](../docs/Friend%20Playdate%20Sharing%20%26%20Notifications%20%E2%80%94%20Cursor%20Brief.md).

`20261102120000_boops_earnings.sql` is applied. It adds `economy_config` (grant amounts, caps, streak grace, and the exclusive and limited multipliers), daily caps and clock checks on `append_ledger_entries` for `time_clock`, `first_open`, `streak`, `activity`, `playdate`, `competition`, and `park_find`, and stores the new Pet Shop prices on `shop_items` and `shop_bundles`. The Golden Crown (`hat:crown`) is `shop = 'hidden'` and `active = false`. Second Wind is 250, described as ending the training break and giving +10 energy. Old earn rules (`time_payout`, `daily_login`, `play_find`, `welcome_back`) stay so already-queued entries can still sync. See [the earnings brief](../docs/Cursor%20Brief%20Boops%20Earnings%20%26%20Pet%20Shop%20Pricing.md).

`20261027120000_colorway_columns.sql` is applied. It adds `theme`, `collection`, `season`, and `rarity` on `shop_items`. The 238 launch colorways were inserted from `tools/colorways/generated/seed.sql`, which is not a migration: 190 `always`/`standard`, 24 `rotation`/`exclusive`, and 24 `featured`/`limited` with cap 500. A later drop is another insert-only file from `npm run colorways:seed`. The app reads `theme`: the `always`/`standard` themes rotate in the shop's collection section every 3 hours instead of sitting on the Clothes shelf (see [the shop brief](../docs/boop-boop-pet-shop-brief.md#5a-collection-rotation)).

`20261028120000_colorway_shape_prices.sql` is applied. It first set each colorway to the handmade price of its shape. `20261102120000_boops_earnings.sql` replaces those numbers: rare colorways stay at the shape price, exclusive is 1.25×, and limited is 1.5×, rounded half-up to the nearest 50. Gold Star Shades are 1,150. Gold High-Tops are 2,500.

`20261028153000_background_music_bucket.sql` creates the public `background-music` bucket, or marks the existing one public, and adds `background_music_public_read` so anon and signed-in clients can read objects. Hosted Storage rejects `DELETE` on `storage.objects` and `storage.buckets`, so this migration does not remove the bucket or its files. Upload the scene tracks that are not bundled in the app after it is applied. The app downloads those files by public URL and does not read a table.

`20261031150000_park_presence.sql` is applied. It adds `park_presence` for friends who are in the park at the same time, friend-only read policies, and enter, heartbeat, outfit, and leave RPCs. Stale rows older than 90 seconds are deleted inside those RPCs. The same migration lets a player read their own `friendships` and `blocks` rows and adds `park_presence`, `friendships`, and `blocks` to the existing `supabase_realtime` publication so one Postgres Changes channel can deliver joins, leaves, outfits, unfriends, and blocks. It does not turn off public Realtime access. `delete_friend_data` also removes that player's presence row. See [the park friends brief](../docs/park-friends-brief.md).

`20261031140000_catwalk_music_bucket.sql` does the same for the public `catwalk-music` bucket (`catwalk_music_public_read`). Upload the re-encoded runway MP3s from `docs/runway music/` (128 kbps stereo) after it is applied. Object names match the filenames and `runway_tracks.audio_path`. Unlike scene music, Catwalk audio is **not** bundled: `prepareRemoteMusic` also runs `syncCatwalkMusic`, which downloads every object into `Documents/catwalk-music/` and skips files that already exist (no hash). Replace a track by uploading a new object name.

`20261031120000_runway_shows.sql` adds Catwalk tables and RPCs (`create_runway_show`, claims, votes). `20261031200000_runway_rack_drip.sql` (owner apply) updates `runway_config` for friend drip tranches (`drip_tranche_sizes` 8/8/7, `drip_tranche_gap_minutes` 2). `20261031220000_runway_show_read.sql` adds `get_runway_show` and `list_my_runway_shows`. `20261031250000_runway_vote_notices.sql` returns `voting_opened` / `results_revealed` and list fields `voted` / `standings`. `20261031280000_runway_declined_invites.sql` keeps a declined invite in the list and lets that player accept later. `20261031290000_runway_list_vote_count.sql` fixes standings to count `contestant_submission_id` (vote rows have no `id`). The host picks 15 minutes, 30 minutes, 1 hour, or 24 hours; `20261031300000_runway_deadline_grace.sql` sets `min_deadline_minutes` to 10 so the shortest choice is never rejected for send time or clock drift. `notify_runway_show` is deployed and sends invite, submit, vote-open, and results pushes. Friend drip unlock counts stay client-side from `invites_sent_at`.

`20261028170000_iap_boops.sql` is applied. It adds `webhook_events`, `boops_packs`, `iap_events`, and `apply_iap_webhook`. The RevenueCat webhook credits Boops packs through that function. See [the IAP brief](../docs/boops-iap-brief.md).

`20261028180000_iap_service_grants.sql` is applied. `service_role` can insert and update `webhook_events` and read `boops_packs`. Without that, the webhook returns `{"error":"unavailable"}`. After the grant, a RevenueCat test event returned `{"ok":true}`.

`20261029120000_second_wind_price.sql` is applied. It set Second Wind to 500. `20261102120000_boops_earnings.sql` sets it to 250 and the app no longer pins catalog prices.

`20261029200000_stadium.sql` is applied. It adds the Stadium schedule (`competition_slots`, `competition_events`, `races`, `race_entries`, `pet_race_state`, `stadium_config`, `stadium_classes`) and the RPCs `get_upcoming_slots`, `sign_up`, `withdraw`, `gate_heartbeat`, and `race_state`. Each RPC creates upcoming slots and locks or starts due races first. A pg_cron job running `select public.stadium_tick();` every minute is an optional backstop. See [the Stadium brief](../docs/boop-boop-stadium-cursor-brief.md).

`20261029310000_race_foundation.sql` is applied. It switches the schedule to Fun Run plus the new events and the Veteran Cup, stores a race seed and config version, snapshots pet modifiers at lock, merges neighboring classes at gate open, and adds `submit_race_report`. See [the race foundation brief](../docs/boop-boop-race-foundation-cursor-brief.md).

These race follow-ups are applied:

- `20261029320000_abandon_unreported_races.sql`, `20261029330000_fix_finalize_status.sql`, `20261029340000_fix_cooldown_event_type.sql`: a running race nobody reports by start + 80 s is finalized with DNFs, so a closed app never leaves a stale sign-up. The rest counts from the race start.
- `20261029350000_six_minute_race_rest.sql`: 6-minute rest per event, and each card returns `rest_until`.
- `20261029360000_rest_by_race_start.sql`: a rest only blocks races that start before it ends.
- `20261029370000_test_fast_slots.sql`: **testing only.** 1-minute slots and no rest. Superseded by `20261030130000_launch_race_schedule.sql`.
- `20261029380000_fill_npcs_at_lock.sql`: a solo Fun Run gets its NPCs at line-up lock, so they stand at the start line during the countdown.
- `20261029420000_fun_run_open_to_all.sql`: Fun Run is one Open field for every level (`stadium_event_class`), and new Fun Run races are stamped `funrun-2`.
- `20261029430000_schedule_ship_roster.sql`: schedule only Fun Run, Dock Dive, Hurdles, and Obstacle Course (Sniff Out, Trick Show, and Weave cancelled). The testing board in that file is superseded by `20261030130000_launch_race_schedule.sql`.
- `20261030130000_launch_race_schedule.sql` is applied. 5-minute slots, 1-minute rest, Fun Run and Dock Dive every slot, Hurdles and Obstacle Course alternating, and the trick gates restored.
- `20261029440000_obstacle_course.sql`: Obstacle Course starts like Hurdles; races are stamped `obstacle-1`.
- `20261029450000_race_replay.sql`: authoritative solo results. Adds `apply_verified_race_report` (service_role), `race_report_flags`, `race_entries.input_log`, and blocks client `submit_race_report`. The `race_report` Edge Function is deployed with it.
- `20261029460000_obstacle_long_course.sql`: Obstacle Course `obstacle-2` (long course, 140 s DNF window).
- `20261029470000_obstacle_tap_drive.sql`: Obstacle Course `obstacle-3` (tap RUN for speed, varied gaps).
- `20261029480000_obstacle_tight_gaps.sql`: Obstacle Course `obstacle-4` (occasional tight gaps, faster NPCs).
- `20261029490000_obstacle_faster_npcs.sql`: Obstacle Course `obstacle-5` (NPCs 1.26×–1.40× class speed).
- `20261029500000_obstacle_npc_pace.sql`: Obstacle Course `obstacle-6` (NPCs near RUN top speed, misses cost about a second).
- `20261029510000_obstacle_steady_npcs.sql`: Obstacle Course `obstacle-7` (slower NPCs: Beginner 6.4–8.2 m/s up to Championship 8.0–9.8).
- `20261101120000_eight_hundred_meters.sql` is applied. Adds 800 Meters (`meters800`) to every slot: Fun Run physics on a 910 m track (13×), one Open field, config `meters800-1`, a 780 s time limit, and an 800 s DNF wait.
- `20261101140000_friend_game_800.sql` is applied. Friend games can be Fun Run, 800 Meters, Hurdles, or Obstacle Course.
- `20261101150000_release_finished_racers.sql` is applied. Leaving a race that has started marks that entry finished, so a missing report no longer blocks later sign-ups until the DNF deadline. A report that arrives afterward can still write the time.
- `20261101160000_one_race_per_slot.sql` is applied. A pet may hold one active entry per start time. A second event in the same slot stays closed.

`20261101210000_pet_restarted_status.sql`, `20261101220000_restart_pet.sql`, and `20261101230000_restart_pet_wins.sql` are applied. `pet_status` includes `restarted`, `pets.restarted_at` is set by `restart_pet`, and a leftover active pet becomes `restarted` instead of `retired` when a new active pet is pushed. `restart_pet` also withdraws an upcoming stadium entry, cancels or leaves a friend competition that has not started, and withdraws a runway invite whose looks are not submitted. The third migration accepts the restart when this phone's revision is behind the server pet, so a signed-in account does not pull the old pet back down. See [Restart Pet](../docs/Restart%20Pet%20%E2%80%94%20Cursor%20Brief.md).

New files in this folder are applied only by the project owner. Do not run `supabase db push`, the Supabase CLI against the hosted project, or the SQL in the dashboard from an agent or an automated script. After the CLI is linked, the owner applies new migrations with:

```bash
supabase db push
```
