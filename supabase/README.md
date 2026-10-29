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

`apple_store_token`, `delete_account`, `supersede_guest`, and `revenuecat-webhook` are deployed on that project. `revenuecat-webhook` has `verify_jwt = false` and requires `REVENUECAT_WEBHOOK_SECRET`.

`20261027120000_colorway_columns.sql` is applied. It adds `theme`, `collection`, `season`, and `rarity` on `shop_items`. The 238 launch colorways were inserted from `tools/colorways/generated/seed.sql`, which is not a migration: 190 `always`/`standard`, 24 `rotation`/`exclusive`, and 24 `featured`/`limited` with cap 500. A later drop is another insert-only file from `npm run colorways:seed`. The app reads `theme`: the `always`/`standard` themes rotate in the shop's collection section every 3 hours instead of sitting on the Clothes shelf (see [the shop brief](../docs/boop-boop-pet-shop-brief.md#5a-collection-rotation)).

`20261028120000_colorway_shape_prices.sql` is applied. Colorway rows cost the same Boops as the hand-made item of that shape. Gold Star Shades are 900. Gold High-Tops are 2000.

`20261028153000_background_music_bucket.sql` creates the public `background-music` bucket, or marks the existing one public, and adds `background_music_public_read` so anon and signed-in clients can read objects. Hosted Storage rejects `DELETE` on `storage.objects` and `storage.buckets`, so this migration does not remove the bucket or its files. Upload the scene tracks that are not bundled in the app after it is applied. The app downloads those files by public URL and does not read a table.

`20261028170000_iap_boops.sql` is applied. It adds `webhook_events`, `boops_packs`, `iap_events`, and `apply_iap_webhook`. The RevenueCat webhook credits Boops packs through that function. See [the IAP brief](../docs/boops-iap-brief.md).

`20261028180000_iap_service_grants.sql` is applied. `service_role` can insert and update `webhook_events` and read `boops_packs`. Without that, the webhook returns `{"error":"unavailable"}`. After the grant, a RevenueCat test event returned `{"ok":true}`.

`20261029120000_second_wind_price.sql` is applied. Second Wind costs 500 Boops. The app also pins that price in `priceAdjustments`, so a catalog saved before the download charges 500 too.

`20261029200000_stadium.sql` is applied. It adds the Stadium schedule (`competition_slots`, `competition_events`, `races`, `race_entries`, `pet_race_state`, `stadium_config`, `stadium_classes`) and the RPCs `get_upcoming_slots`, `sign_up`, `withdraw`, `gate_heartbeat`, and `race_state`. Each RPC creates upcoming slots and locks or starts due races first. A pg_cron job running `select public.stadium_tick();` every minute is an optional backstop. See [the Stadium brief](../docs/boop-boop-stadium-cursor-brief.md).

`20261029310000_race_foundation.sql` is applied. It switches the schedule to Fun Run plus the new events and the Veteran Cup, stores a race seed and config version, snapshots pet modifiers at lock, merges neighboring classes at gate open, and adds `submit_race_report`. See [the race foundation brief](../docs/boop-boop-race-foundation-cursor-brief.md).

These race follow-ups are applied:

- `20261029320000_abandon_unreported_races.sql`, `20261029330000_fix_finalize_status.sql`, `20261029340000_fix_cooldown_event_type.sql`: a running race nobody reports by start + 80 s is finalized with DNFs, so a closed app never leaves a stale sign-up. The rest counts from the race start.
- `20261029350000_six_minute_race_rest.sql`: 6-minute rest per event, and each card returns `rest_until`.
- `20261029360000_rest_by_race_start.sql`: a rest only blocks races that start before it ends.
- `20261029370000_test_fast_slots.sql`: **testing only.** 1-minute slots and no rest. Before launch, set `slot_seconds = 300` and `cooldown_seconds = 360` again in a new migration, and restore `slotMs` and `cooldownMs` in `src/sim/gameplayConfig.ts`.
- `20261029380000_fill_npcs_at_lock.sql`: a solo Fun Run gets its NPCs at line-up lock, so they stand at the start line during the countdown.

New files in this folder are applied only by the project owner. Do not run `supabase db push`, the Supabase CLI against the hosted project, or the SQL in the dashboard from an agent or an automated script. After the CLI is linked, the owner applies new migrations with:

```bash
supabase db push
```
