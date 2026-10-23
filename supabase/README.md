# Supabase migrations

Applied on hosted project `unfatkwtzfkqnnbgzuqs`:

- `20261019120000_consent_records.sql` — `consent_records` and `delete_my_guest_data()`
- `20261022120000_pets_and_player_state.sql` — `pets`, `player_state`, and `push_active_pet`, `retire_pet`, `push_player_state`

Not applied yet:

- `20261023120000_shop_catalog.sql` — `shop_items`, `shop_bundles`, `shop_config`, anon read, and the placeholder seed

New files in this folder are applied only by the project owner. Do not run `supabase db push`, the Supabase CLI against the hosted project, or the SQL in the dashboard from an agent or an automated script. After the CLI is linked, the owner applies new migrations with:

```bash
supabase db push
```
