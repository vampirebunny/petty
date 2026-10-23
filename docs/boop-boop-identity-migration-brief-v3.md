# Boop Boop — Identity, Ownership & Retirement Migration (Brief v3)

**Supersedes v1, v2, and all addenda.** This is the complete set of instructions for this phase. Where it disagrees with `docs/boop-boop-accounts-friends-brief.md` on anything social (profiles, handles, requests, blocks, playdate tables), the accounts brief wins. Those are out of scope here.

---

## 1. Scope

This phase does five things:
1. Pets get a **UUID `pet_id`**, generated on device at adoption.
2. Every pet and every piece of player data has an **owner**: the Supabase auth user id (anonymous or not). An install id is the placeholder while offline.
3. **Inventory, Boops, and room layout belong to the player**, not the pet.
4. **Pets are never discarded.** `release()` becomes `retire()`, and a retired pet becomes an NPC the player (and later their friends) can visit.
5. **Push-only backup** to Supabase of the active pet, retired pets, and player state.

**Not in this phase:**
- No `public.users` table; no profiles, handles, friend requests, blocks, or playdate tables. These follow the accounts brief.
- No compliance changes. `consent_records` stays the compliance store (append-only; teen / adult / atLeast13; source apple | google | attestation; client event id). SecureStore `boop.ageRecord` / `boop.termsAccepted` are unchanged.
- No NPC playdate sync. Cast, bond map, cooldown, and snapshots stay in AsyncStorage.
- No pull / restore, no multi-device, no conflict resolution beyond what's below.
- No retired-pet visiting UI (data shape only; see §11).
- No IAP receipt validation.

---

## 2. Current state (from the code audit; for reference)

- Active pet: SQLite singleton row in `boop.db` table `pet` (`id`, `json`, `updated_at`). `PetState.ownerId` lives inside the json. Replaced by `DELETE FROM pet` + insert.
- Adoption id today: `${seed}-${archetype}-${now base36}` in `usePet`. Not a UUID. Deterministic generation already uses `attributes.seed` and `attributes.archetype`, so nothing in the old id needs preserving.
- Wallet: SQLite singletons `balances`, `inventory`, `owner_state` (all `id = 1`), not keyed by owner.
- Playdates: AsyncStorage `petty.playdates.${ownerId}` (NPC cast, bond map, cooldown, full snapshot history). Each record inside also carries `ownerId`.
- `petty.wardrobe.${ownerId}` and `petty.economy.${ownerId}`: leftovers, unused. The Closet reads SQLite; `useCloset` has no callers.
- `daily_counters`: keyed by `pet_id`.
- Identity: `resolveOwnerId` returns the auth user id when a session exists, otherwise the SecureStore install id. `useIdentity` publishes the auth id as soon as a session exists. `flushConsentRecords` calls `ensureAnonymousUserId()`.
- `delete_my_guest_data()` already deletes an anonymous auth user.
- `expo-crypto` is not installed. `identity.ts` has a UUID helper with a `crypto.randomUUID` fallback.

---

## 3. Pet IDs

- New adoptions: `pet_id` = UUID from the existing `identity.ts` helper. Don't add expo-crypto.
- Replace the composite id in `usePet`. Don't split it into a seed field; `attributes.seed` / `attributes.archetype` already cover rng.
- `pet_id` never changes for the life of the pet, including after retirement. `daily_counters` keep working because they're keyed by `pet_id`.

---

## 4. Ownership split: player vs pet

**Rule: owning something belongs to the player; using it changes the pet.**

| PLAYER (owner-keyed; survives retirement) | PET (in PetState) |
|---|---|
| Boops (`balances`) | Attributes (current levels + potentials), archetype, current style |
| Treats, food, `second_wind`, other consumables (`inventory`) | Trick progress, training rest timers |
| Toys owned/unlocked (move out of PetState) | Needs: tummy, energy, mood, hydration, care |
| Furniture owned (move out of PetState) | Weight index, life stage / age |
| **Furniture placement / room layout** (`furniturePlaced`, move out of PetState) | Equipped outfit |
| Outfits owned (Closet, SQLite) | Active boost effects (`boosts`, ActiveBoost) |
| Login streak, accrual clock (`owner_state`) | `foodInBowl` / `bowlItemId` |

Implementation:
- Move `toys`, owned `furniture`, and `furniturePlaced` out of PetState into owner-keyed SQLite storage.
- Remove `PetState.treats` (empty on adoption; only decremented in tests). The pantry already spends SQLite inventory.
- Key `balances`, `inventory`, `owner_state`, `transactions`, and the new toys/furniture/layout storage by **owner id** instead of `id = 1`.
- `useItem` stays one local transaction: decrement player inventory and apply the effect to the pet.
- **One home per species.** Layout is keyed by `(owner, species)`. Ownership of a piece is per player. The same piece may be placed in both homes at once; placements are independent, and placing it in one home does not remove it from the other.
- **Starter furniture is once per owner per species.** The first dog inserts dog starter pieces only when that id is not already owned, and writes starter placements only into the dog layout. The first cat does the same for the cat layout and adds cat-only catio pieces. Litter boxes are not starter furniture. A later pet of that species moves into the existing home. `createPet` does not copy furniture onto the pet.
- **Toys are once per owner.** The ball is granted when the owner has none. The first cat does not get a second ball.
- The species layout is the only source of positions. `applyFurniture` draws a piece only when that layout has an entry for it. No preset-position fallback. An owned piece with no placement in the current home is not drawn there.
- Equipping never removes Closet ownership (`withStarter` behavior is fine).
- Food in the bowl belongs to the pet and is not returned to inventory on retire.

---

## 5. Retirement (replaces release)

Pets are never discarded. Rename `release()` to `retire()` everywhere, including UI copy hooks (retire-flow UI design comes later).

`retire()`:
1. Stamps `retiredAt`, sets status to `retired`.
2. **Freezes** the pet: no further aging, decay, training, or state changes. The tick loop only loads the active `pet` singleton. Nothing opens `retired_pets`.
3. Unequips outfits. The items stay owned in the player's Closet. The retired doc stores **no inventory and no equipped items**. Playdate logic ignores any equipped items left on a retired doc; retired pets use NPC catalog logic regardless.
4. Does **not** call `clearPetPlaydates`. History, bonds, and the owner's `lastPlaydateCompletedAt` cooldown stay.
5. Leaves player inventory, Boops, Closet, and both species layouts untouched.
6. Cancels that pet's care reminders.
7. Moves the pet's final doc from the active `pet` table into a local **`retired_pets`** table (`id`, `json`, `retired_at`) so retired pets are available offline.
8. Enqueues a server retire (§8) and drops any pending pushes for that pet id.

Debug `reset()` is dev-only. It calls the wipe directly every time (not gated on `storageVersion`), does not mint a pet id, and restarts onboarding. The next adoption mints the id. In production, retire is the only path off a pet.

**The retired doc must be self-contained.** Everything needed to render the pet (breed, Look, life stage, proportions, weight) and to script a playdate (attributes, archetype, personality) lives inside it, with no dependency on the owner's player state, inventory, or layout. Friends' devices will later render and run playdates from this doc alone.

**Items for retired pets:** a retired pet has access to **all catalog items, like any NPC**. At playdate time its outfits, toys, and other items are chosen by the same logic that dresses and equips NPC pets. This never grants items to any player.

The local game still assumes one active pet. Keep the `pet` singleton for the active pet; `retired_pets` holds any number.

---

## 6. One-time reset of test data

There's one test install and no real users. Reset rather than convert.

- Store `storageVersion` in the SQLite **`meta`** table, and exclude that key from the wipe, so the reset runs exactly once.
- **Wipe:** the `pet` row, `retired_pets`, `daily_counters`, `balances`, `inventory`, `owner_state`, `transactions`, `transaction_lines`, toy/furniture/layout storage, all `petty.playdates.*`, **`petty.draft`**, `petty.pet` (so the legacy import cannot restore it), and the unused `petty.wardrobe.*` / `petty.economy.*` keys.
- **In `meta`, keep only the `storageVersion` row.** Drop `legacy_closet`, `pet_imported`, and every other meta key.
- **Keep:** `boop.installId`, `boop.ageRecord`, `boop.termsAccepted`, and the Supabase session.
- Then restart onboarding.
- I'll manually clear my test rows in Supabase. No server-side reset code.

---

## 7. Owner binding (offline-first)

`resolveOwnerId` behavior stays: auth user id if a session exists, otherwise the install id. Offline play writes everything under the install id.

When an anonymous session is first created on a device whose data is owned by the install id, run a one-time **local bind**:

**Ordering (critical):** the bind must finish **before anything observes the new owner id**. Gate `useIdentity`'s publication of the auth id (and any consumer like `HomeScreen` loading playdates from `pet.ownerId`) on bind completion. Otherwise the app creates an empty cast at `petty.playdates.${authUserId}` and a late bind overwrites it. This includes the path where `flushConsentRecords` → `ensureAnonymousUserId()` creates the session.

**Safe to repeat:** never overwrite an existing destination. If the destination key or row already exists, leave it and skip that item. Record bind completion in `meta`.

**Do not create owner-keyed rows for the auth id until the bind has copied or skipped them.** No zero-balance row at sign-in. Each `(owner, species)` layout is its own destination.

**Bind list:**
- Active pet json: `ownerId` install id → auth id.
- `retired_pets` json: `ownerId` install id → auth id.
- AsyncStorage `petty.playdates.${installId}` → `petty.playdates.${authUserId}`, **and rewrite each record's `ownerId`** inside the blob.
- Owner-keyed SQLite rows (`balances`, `inventory`, `owner_state`, `transactions`, toys, furniture, and each species layout): copy install-id rows to the auth id only when that destination is empty.
- Not moved: `daily_counters` (keyed by `pet_id`), `petty.wardrobe` / `petty.economy` (unused).

The first push happens only after the bind. **The install id never reaches Supabase.** This local rewrite is the only allowed owner change; on the server, pets never change owners.

No local `owner_id` column on `pet`; `PetState.ownerId` inside the json is the owner field.

---

## 8. Supabase

Applied on hosted project `unfatkwtzfkqnnbgzuqs` by `supabase/migrations/20261022120000_pets_and_player_state.sql`. Do not re-apply it. `consent_records` was already applied by `20261019120000_consent_records.sql`.

No `public.users`. Reference `auth.users` directly.

```sql
create type public.pet_status as enum ('active', 'retired');

create table public.pets (
  id uuid primary key,                          -- device-generated
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  status public.pet_status not null default 'active',
  doc jsonb not null,                           -- full PetState (frozen when retired)
  doc_schema int not null,                      -- PetState schema version
  local_revision bigint not null,               -- see §9
  client_updated_at timestamptz not null,
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index pets_owner_idx on public.pets(owner_user_id);
create unique index pets_one_active_per_owner
  on public.pets(owner_user_id) where status = 'active';

create table public.player_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  doc jsonb not null,           -- Boops, inventory rows (treats, food, boosts,
                                -- outfits), toys, furniture, layout, owner_state
  doc_schema int not null,      -- separate from PetState's
  local_revision bigint not null,
  client_updated_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

- `doc` is the single source of truth. No duplicated name/breed/species/coat columns; add generated columns or views later if needed.
- Bump PetState `doc_schema`, since toys, furniture, layout, and treats moved out.
- `player_state.doc` has no `ownerId`; ownership is `user_id = auth.uid()`. Until receipt validation exists, this backup is client-authoritative.
- `updated_at` trigger on both tables: **`BEFORE UPDATE`**, setting `new.updated_at = now()`, so a client-supplied value can't stick.

### Access: RPC-only writes
Clients read their own rows directly and write **only** through RPCs. This keeps status, ownership, and retirement rules on the server.

```sql
alter table public.pets enable row level security;
alter table public.player_state enable row level security;

revoke all on public.pets, public.player_state from anon, authenticated;
grant select on public.pets, public.player_state to authenticated;

create policy pets_select_own on public.pets
  for select to authenticated using (owner_user_id = auth.uid());
create policy player_state_select_own on public.player_state
  for select to authenticated using (user_id = auth.uid());
```

All three RPCs: `security definer`, `set search_path = public`, every check uses `auth.uid()`, reject if `auth.uid()` is null. `revoke execute ... from public, anon; grant execute ... to authenticated`.

**`push_active_pet(p_id uuid, p_doc jsonb, p_doc_schema int, p_local_revision bigint, p_client_updated_at timestamptz)`**
In one transaction, in this order:
1. Reject if `p_doc->>'ownerId' <> auth.uid()::text`.
2. If a row with `p_id` exists and its owner isn't `auth.uid()` → reject.
3. If a row with `p_id` exists with `status = 'retired'` → reject (retired pets never come back).
4. **Staleness uses `local_revision`, checked before any change.** `client_updated_at` is informational only. Incoming revision **greater** than the stored row: write. **Equal**: already applied, return success, no write. **Lower**: return `stale` (the queue drops it and does not retry). The same comparison applies to a different `active` row for this owner: a lower revision must not displace it.
5. If the owner has a different `active` row (an orphan whose retire never arrived), **retire it**: set `status = 'retired'`, `retired_at = now()`, keep its last doc and its `local_revision`. Never delete it. Leaving the revision unchanged lets a later `retire_pet` replace the doc.
6. Upsert `p_id` with `status = 'active'`.

**`retire_pet(p_id uuid, p_doc jsonb, p_doc_schema int, p_local_revision bigint, p_client_updated_at timestamptz)`**
- Owner must be `auth.uid()`; `p_doc->>'ownerId'` must match.
- Same revision rule: greater writes, equal returns success, lower returns `stale`.
- Upsert the row as `status = 'retired'` with the final frozen doc and `retired_at` (handles a pet that was never pushed while active).
- If the row is already retired, still replace the doc when `p_local_revision` is newer. Status stays `retired`.

**`push_player_state(p_doc jsonb, p_doc_schema int, p_local_revision bigint, p_client_updated_at timestamptz)`**
- Upsert where `user_id = auth.uid()`.
- Same revision rule: greater writes, equal returns success, lower returns `stale`.

**Deletion:** only `delete_my_guest_data()` (and later, account deletion) removes rows, via `on delete cascade` from `auth.users`. Verify it still works end to end.

---

## 9. Push queue

- **One outbound queue, one request in flight at a time.** Persist it in SQLite so it survives an app kill.
- **Coalesce** to the latest snapshot per entity: one pending push per pet id and one for player state.
- When `retire()` enqueues `retire_pet` for an id, **drop any pending `push_active_pet` for that id**.
- Order is preserved: a retire is always sent before a later adoption's first push.
- Push triggers (debounced): adoption, training result, item use, outfit change, furniture change, playdate end, retire, app background.
- **Local revision:** keep one monotonically increasing local revision counter in `meta`. Stamp the same revision on the pet push and the player_state push that come from the same local change (e.g. `useItem`), so a future pull can tell when a pet doc and player_state are from different moments.
- Never block gameplay on the network. Network failures retry with backoff. A `stale` result is done: drop that queue row and do not retry it.

---

## 10. Done when

- After the reset, a fresh install adopts a pet with a UUID `pet_id`, owned by the auth user id once a session exists. The ball is granted once per owner. Starter furniture and that species' layout are granted once per species.
- Adopting in airplane mode works under the install id. Coming back online creates the anonymous session, the bind completes before the auth id is published, then pushes go out. The server row is owned by the auth user; the install id never appears on the server.
- Running the bind twice, or after data already exists under the auth id, changes nothing.
- NPC playdates keep working after the bind (key renamed, inner `ownerId`s rewritten). Daily counters keep working.
- Retire, then adopt: the old pet is `retired` locally (`retired_pets`) and on the server, the new pet is `active`, and inventory, Boops, Closet, and layout are unchanged. No duplicate starter items. Equipped items are back in the Closet, the retired doc has none, and the new pet uses the existing layout.
- A delayed push of a retired or older pet is rejected and doesn't displace the active one.
- Killing the app between retire and the server call still ends correctly (persisted queue, or orphan auto-retire on the next adoption push).
- With a second anonymous session, you can't read or write the first session's rows; direct table writes are denied for everyone.
- `delete_my_guest_data()` removes the auth user, their pets (active and retired), and their player_state.

---

## 11. Record in the accounts brief (do not build now)

- **Retired pets as playdate partners:** the owner and the owner's **friends** can pick retired pets as NPC playdate partners. Retired pets use the full catalog like NPCs.
- Friends read retired pets through a narrow view or RPC that exposes only the render + playdate fields, never the full doc. Access ends immediately on unfriend or block.
- Friends' devices cache fetched retired pets so they work offline.
- Bonds for those playdates are stored per owner, following the accounts brief's per-owner `relationships` table.
- Any new table referencing `pets` or `auth.users` needs explicit `on delete` behavior so deleting a user never fails.
- Pull/restore must treat a pet doc and player_state with different `local_revision` values as a mismatch.
- IAP: purchased Boops get credited server-side to `user_id` after receipt validation; the server becomes the source of truth for purchased currency.
- Account-creation prompts: friends/playdates gate, after a successful IAP purchase, after the 3rd distinct day.
- Open product question: what the owner gets when a friend has a playdate with their retired pet (notification, reward share, replay).
