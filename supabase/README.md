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

`apple_store_token`, `delete_account`, and `supersede_guest` are deployed on that project.

`20261027120000_colorway_columns.sql` is applied. It adds `theme`, `collection`, `season`, and `rarity` on `shop_items`. The 238 launch colorways were inserted from `tools/colorways/generated/seed.sql`, which is not a migration: 190 `always`/`standard`, 24 `rotation`/`exclusive`, and 24 `featured`/`limited` with cap 500. A later drop is another insert-only file from `npm run colorways:seed`.

New files in this folder are applied only by the project owner. Do not run `supabase db push`, the Supabase CLI against the hosted project, or the SQL in the dashboard from an agent or an automated script. After the CLI is linked, the owner applies new migrations with:

```bash
supabase db push
```
