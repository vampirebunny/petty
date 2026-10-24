# Boop Boop — Accounts, Welcome Screen, Device Handoff, Prompts & Settings (Brief v14)

**Replaces v13.** v14 applies Cursor's review of v13: a device-local clock offset, server-owned active-device columns, the handle learned from the claim, a narrower open path, under-13 deletion, Android Apple tokens, a per-device harness, and the cross-timezone cap as a known limit. Changes from v13 are marked **[v14]**; earlier markers are removed. The structure is the same as v13.

**[v14+] Follow-up.** A later pass folds in the rest of that review: ask before taking the slot, the real earn source strings, reinstall by `is_anonymous`, a dead session only on an invalid refresh token, an atomic claim id, no rewind of `lastUpdatedAt`, a save generation, claim on adoption confirm, guest deletion that survives a crash, and an injected harness. A further pass runs the guest delete before the account delete, stores a device label for the handoff sentence, warns on **Continue** when local play would be dropped, and leaves single-session Auth off. Those edits are marked **[v14+]**.

**Phase A shipped** on `main` (`b371792`). The app rebinds every owner-keyed table in one step, writes the economy as ledger lines with an outbox, and peeks before claiming so only one device plays. Server SQL is `supabase/migrations/20261024200000_ledger_and_active_device.sql`. Apply that yourself; it does not delete users. The next launch of an existing install wipes the on-device database once, because the storage version moved to 3. Sign-in, Welcome, and deletion UI are not built yet.

**Phase B shipped** on `accounts-phase-b`. The app has `expo-apple-authentication` and `@react-native-google-signin/google-signin`, the `boopboop` scheme, a PKCE Supabase client, and the Apple credential helper. Server SQL is `supabase/migrations/20261024210000_profiles_and_health.sql` (`profiles`, `check_handle_available`, `app_health`). Apply that yourself after the Phase A migration; it does not delete users. Edge functions are `apple_store_token`, `delete_account`, and `supersede_guest`. Guest tokens are checked with the project JWKS. The Google Web client ID, iOS client ID, and reversed iOS scheme are in `.env.local`, and that scheme is on the Google plugin in `app.json`. `@react-native-google-signin/google-signin` 16.1.5 has no nonce argument, so turn on Supabase **Skip nonce check** for Google.

**Phase C shipped** on `accounts-phase-b`. The sign-in sheet, guest linking, and the handle screen are in the app. The sheet is not mounted from Home. Saving a handle is `supabase/migrations/20261024220000_claim_handle.sql`. Apply that yourself; it does not delete users.

**Phase D shipped** on `accounts-phase-b`. A guest sign-in that already belongs to an account restores that account, and a killed restore shows Finish signing in. `supabase/migrations/20261024230000_pull_has_handle.sql` makes `pull_account_state` report a saved handle. Apply that yourself; it does not delete users.

**Phase E shipped** on `accounts-phase-b`. Welcome is the first screen when there is no local pet, and a Keychain session is pulled before adoption.

**Phase F shipped** on `accounts-phase-b`. A linked device asks **Continue here** before taking the slot, and standby keeps the sleeping pet until **Play here**.

**Phase G shipped** on `accounts-phase-b`. The day-3 backup prompt shows on idle Home, and a dead linked session asks to sign in again.

The two simplifications still hold:
1. **The ledger has its own table** (`ledger_entries`) and its own append-only sync. `player_state` never carries a ledger, balance, or inventory.
2. **No legacy path.** There are no real players yet. Wipe the test data (A0); every account starts with a ledger.

**Product decisions:**
- **A. "Play here" handoff.** A device that loses the active slot while open goes to standby. **It stays in standby until the player taps Play here.** Coming to the foreground shows the sleeping pet and the button; it never claims on its own (A6, §9). **[v14+] Both devices stay signed in.** Opening the app reads who is active and does not claim yet. If the other device is active, this one asks **"You're playing on your iPhone. Continue here?"** before taking the slot (A4, §9). The name in that sentence is the other device's `active_device_label`. If this device has unsent play, the question says that play will be replaced and purchases stay.
- **B. Handle timing.** Picked right after sign-in when online, required before any friends feature, never blocks Home (§6).
- **C. Negative balance.** Entries are facts. A negative balance is shown as the real number with a one-line note (A2).
- **D. Already committed locally means accepted.** **This applies to every ledger entry, not just earns.** Once the client has inserted an entry and moved its cursors (`time_paid_through`, `login_last_claimed_day`, a purchase's Boops), the server rejects it only when it's a forge or malformed. Bad clocks, cap misses, and ended deals are **flags** (A2).
- **E. Adoption and goodbye need internet on linked accounts.** They're pet changes, so a stale device would silently undo them. They're rare and deliberate, so they wait for a connection and a claim (A7). **[v14+] The claim runs when the player confirms,** not when the screens open.

**Prerequisite:** the identity/ownership migration is merged.

**Relationship to `docs/boop-boop-accounts-friends-brief.md`:** that brief owns the social schema (`profiles` with `handle` + `handle_lower`, `searchable`, `handle_changed_at`; friend requests; blocks) and the handle rule `^[a-zA-Z0-9]{3,20}$`. Use its schema and rules for handles. This brief supersedes its email OTP, sign-out, and restore-dialog sections; mark them superseded in that doc. Because `profiles` is readable only by its owner, handle search (friends work) will be a security-definer RPC. Friends UI, search, requests, blocking, and handle changes are **out of scope**.

**How to work:** build one phase at a time, in order (§1). After each phase, report what changed and how you tested it before starting the next. **Deploy each phase's server changes (tables, RPCs, edge functions) before the client build that uses them.**

---

## 0. Product decisions

- **Sign-in methods:** Sign in with Apple and Google only. No email. Both buttons on both iOS and Android.
- **Accounts upgrade the existing anonymous user in place:** same `user_id`, same pet, Boops, ledger, and consent records.
- **Returning player on a device with a guest pet:** the account wins, after a clear confirmation. The guest's data is deleted.
- **One active device at a time.** **[v14+] Both devices stay signed in.** Opening the app reads who is active without claiming. If it is this device, or nobody is active, the open claims. If it is the other device, this one asks **"You're playing on your {label}. Continue here?"** The label is that device's `active_device_label` (`iPhone`, `iPad`, or `Android`), or "your other device" when it is missing. **[v14+] If this device has unsent play, the question also says that play will be replaced, purchases stay, and Not now keeps the unsent play until Play here** (A4). **Continue** claims and becomes active. **Not now** shows the sleeping pet and does not claim. A device that loses the slot while open goes to standby and stays there until the player taps **Play here**. Linking and restoring claim immediately and do not ask (they are the sign-in). No simultaneous two-way sync. Both devices stay signed in.
- **Purchases, spends, and refunds are never lost or duplicated.** Earned Boops are paid once per account across devices. Earns from a device that lost the slot are dropped.
- **Adoption and goodbye on a linked account need internet** (A7).
- **No sign-out in v1.**
- **Account deletion is immediate** after confirmation. No grace period. **Deletion always completes**, even if Apple can't be reached (§13).
- **Handle:** picked right after sign-in as the last step of account creation when online. If that's interrupted, it's asked again when Home is next idle and the device is online. It's required before friends features and never blocks Home.

---

## 1. Phases

| Phase | What | Section |
|---|---|---|
| A | Wipe test data; owner rebind and `installState`; ledger table, lines, grants, and outbox; push results; standby; adoption and goodbye; app-open order; dead sessions | §2 |
| B | Native sign-in packages, dev build, URL scheme, edge function scaffold, `profiles` + handle RPC | §3 |
| C | `AccountSheet`, linking a guest, handle creation | §4–§6 |
| D | Restore (returning player) | §7 |
| E | Welcome screen and screen order in `App.tsx` (including reinstall) | §8 |
| F | Device handoff | §9 |
| G | Prompts and lost session | §10 |
| H | Apple token storage, Settings, Delete account, full wipe, anonymous-user cleanup | §11–§13 |
| — | Two-device test harness (build during Phase A, extend every phase) | §14 |

Known from earlier reviews, no need to re-audit: supabase-js 2.118 has `linkIdentity` with an ID token and `signInWithIdToken`; no sign-in packages, no URL scheme, no `supabase/functions`, no `profiles`; `pets`, `player_state`, `consent_records` cascade from `auth.users`; `limited_units.user_id` is intentionally not a foreign key; `TERMS_VERSION` is `2026-10-19`; `owner_state.server_time_offset_ms` exists but is unread (v14 removes it; the offset moves to local `meta`, A2). **Also:** `daily_counters` has no owner column; current earn source strings are `starter_grant`, `time_payout`, `daily_login`, `level_up`, `milestone`, `play_find`, `welcome_back`; `dogHouse` and `catTree` are shop-furniture definitions, not scene props; the Supabase session, `boop.installId`, and `boop.ageRecord` live in the Keychain and survive an iOS reinstall, while SQLite doesn't. **[v14] Also:** the age gate's under-13 path deletes through `delete_my_guest_data`, which rejects non-anonymous users; the app-state handler treats any return to `active` as an open; `getDb()` always opens `boop.db`, and the current owner and install id are process-wide. Flag anything else that conflicts.

---

## 2. Phase A — fix the existing paths first

### A0. Start clean
- No real players exist. Delete all test data in Supabase: every row in `pets`, `player_state`, `consent_records`, and all `auth.users`. Wipe the test devices (full local wipe, §13) or reinstall.
- Remove `boops`, inventory, toys, and furniture from `playerDoc` / `player_state`. Balance and owned items come only from the ledger (A2).
- Don't build any path for documents without a ledger.

### A1. Ownership changes only through explicit operations
Today `useIdentity`'s `onAuthStateChange` listener binds the install to whatever user just signed in. The `App.tsx` effect (`if (petState.ownerId !== identity.ownerId) setOwnerId(...)`) stamps that id onto the loaded pet and queues a push. `SIGNED_OUT` points the owner back at the install id. `bindInstallToAuth` rewrites only the SQLite pet, so the in-memory pet and queued payloads keep the install id, and `queue.ts` retries the resulting owner mismatch forever.

Fix:
- **Remove the `App.tsx` effect.** A pet's owner changes in exactly two explicit functions:
  1. **`rebindOwner(from → to)`**, for **any** `from`. It's used on the first anonymous sign-in (install id → anon user id) and when a dead guest session is replaced (A5b). It runs as **one SQLite transaction** under the lock and rewrites:
     - `owner_id` on **every table that has an `owner_id` column** (transaction lines follow their transaction; `daily_counters` has no owner column and stays as it is);
     - the owner inside the pet JSON (active and retired);
     - `ownerId` inside every queued payload;
     - owner-keyed AsyncStorage keys (`petty.wardrobe.<ownerId>`, `petty.playdates.<ownerId>`, and any others).

     Then it calls `installState` (below). Add a test that lists every table with an `owner_id` column from the SQLite schema and fails if `rebindOwner` doesn't cover it. Treat an owner-mismatch push result as a logged bug, not a retry.
  2. **`applyRestore(serverState)`** when an account replaces a guest (§7).

  Linking (§5) changes nothing local; the `user_id` doesn't change.
- **`installState()`: the one way new state reaches the running app.** Used by `rebindOwner`, `applyRestore`, and `reconcileFromServer`, after their SQLite transaction commits:
  1. **[v14+] Bump a save generation.** `publish` in `usePet` has already captured the pet on `saveQueue`, and that chain also calls `syncReminder`. Cancelling a debounce does not match that path. A pet save or a reminder sync that captured an older generation does not write and does not reschedule.
  2. Swap the in-memory pet, retired pets, balance, items, toys, furniture, closet, layouts, and owner, in one update.
  3. `cancelReminders`, then reschedule them for the installed pet (skip rescheduling while in standby, A6).
  4. **[v14] It never touches `meta.serverTimeOffsetMs`.** The offset belongs to this device's clock (A4). The state being installed may have come from another device.

  **Settle always runs after `installState`, on the installed pet** (A4, §7). If settle ran on a stale in-memory guest pet, it would decay it, save it, and queue it under the account id.
- **Auth-transition lock** `authTransition: 'idle' | 'linking' | 'restoring' | 'reconciling' | 'deleting' | 'reauth'`. While it isn't `idle`:
  - the auth listener records events but doesn't bind, rebind, or publish an owner;
  - the pet/player push queue **and** the ledger outbox are paused;
  - `settleReturn` / `onAppOpen` don't run;
  - **the one-second loop in `usePet` is skipped** (`tickForeground`, `payoutTimeAccrual('live')`, and its pet save);
  - **[v14+] the save generation bumps** when the lock is set, so a save already on `saveQueue` does not write, and no new save is scheduled;
  - `resumeLimitedPurchases` doesn't run (A3 step 8).

  The flow that set the lock publishes the final identity and owner once, then releases it.
- **`SIGNED_OUT` never points the owner back at the install id on a linked device.** `meta.accountLinked` is set after a successful link or restore and cleared only by the full wipe.

### A2. The ledger: its own table, its own sync

**Server table**
```sql
create table public.ledger_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null,
  kind text not null check (kind in ('purchase','spend','earn','consume','reversal')),
  source text not null,              -- the client's existing source strings (see the earn table)
  lines jsonb not null default '[]', -- see "Lines"
  reverses_key text,                 -- reversal only: idempotency_key of the entry it undoes
  local_day text,                    -- client's local calendar day (YYYY-MM-DD), sent on earns
  flags text[] not null default '{}',-- e.g. over_daily_cap, amount_mismatch, day_skew, price_mismatch, time_clamped
  device_id text,
  device_time timestamptz,
  server_time timestamptz not null default now(),
  primary key (user_id, idempotency_key)
);
```
RLS: owner can select own rows. No direct insert/update/delete; writes go only through `append_ledger_entries`.

**Keys.** Dedupe everywhere on the existing `idempotency_key` (`starter`, `home:<species>`, `login:<day>`, `time:<timePaidThrough>`, `welcome:<day>`, `level:<petId>:<level>`, the purchase request id, `<requestId>:lost`, and the rest), never the random `transactions.id`. Entries without a meaningful key keep the one minted at insert. Restore stores the key, so `hasKey` finds restored rows and doesn't grant `starter` or re-run a purchase.

**Lines.** An entry is the whole transaction. **Every line has `asset` and a signed `qty`.** Plus whatever applies: `unit_price`, `deal`, `serial` (limited items), and for grants:
- toys: `{ asset: 'toy', toy_id, qty: 1 }`
- furniture: `{ asset: 'furniture', furniture_id, scene, qty: 1 }`

A reversal uses negative quantities. Owned means a toy's or piece's quantities sum to more than zero.

- **Local line storage.** The `transaction_lines` key is `(transaction_id, line_no)`. A starter home has many furniture lines in one entry.
- **Furniture definitions come from one lookup.** `furnitureDefinition(id)` checks scene props first, then the shop-furniture definitions (`dogHouse`, `catTree`, and any others). It returns kind, species, contents (food vs water bowl), and size. The rebuild uses it for every furniture line. Add a test that every id any grant or the shop can write resolves. If a piece's color is something the player changes, it lives in the layout, not on the ownership line.
- **`furniture_id` is the id the rooms already use.** A starter bed's id is its scene prop id; a bought dog house is `dogHouse`. Layouts store those ids, so a rebuilt piece keeps the same id. When a replayed shop piece isn't in the layout yet, place it with `shopFurnitureSpot`; leave an existing placement alone.

**All grants become lines, in one change**, before the first rebuild runs (otherwise the rebuild deletes the starter ball, bed, and bowls):
- `purchaseCart` records toys and furniture as lines on the purchase entry, instead of writing `owned_toys` / `owned_furniture` afterwards.
- **`starter`** (once ever): 1000 Boops, 10 biscuits, the starter outfits, the starter toy, and the furniture of the **shared rooms only** (scenes with no species: living room, bedroom).
- **`home:<species>`** (once per species, **including the first**): that species' **species-only** scenes and nothing else (cat: catio). `grantSpeciesHome` writes it on every adoption of a species that doesn't have it yet. If a species has no species-only pieces, skip its entry, so the shared bed and bowls are granted once and never sum to 2.
- `grantToyOnce` and `grantSpeciesHome` stop writing `owned_toys` / `owned_furniture` directly.
- **Placements stay a local write.** `grantSpeciesHome` keeps inserting the layout placements (same prop ids as the ledger lines). Only ownership moves onto the ledger.

**Earn rules: one table, keyed on the client's existing source strings.** Don't rename sources and don't add a mapping layer. Create a Supabase table `earn_rules` with one row per **(source, key prefix)** and seed it from the client constants. Add a test that fails if the client constants and the seed disagree. The code is authoritative; confirm every value below against it. **[v14+]** Playdate and the closet import are filled in from the client.

| Source | Key prefix | Amount | Rule |
|---|---|---|---|
| `starter_grant` | `starter` | 1000 Boops, 10 biscuits, starter outfits, toy, shared-room furniture | once ever; pack must match exactly |
| `starter_grant` | `home:<species>` | that species' species-only furniture, no Boops | once per species; pack must match exactly |
| `daily_login` | `login:<day>` | 20, 25, 30, 35, 40, 50, or 100 by streak | once per day; max 100 |
| `level_up` | `level:<petId>:<level>` | 50 | once per key |
| `milestone` | `stage:<petId>:<stage>` | 200 | once per key |
| `milestone` | `milestone:trick:<trickId>:<petId>` | 100 | once per key |
| `playdate` | `playdate:<id>` | 30 | **[v14+]** once per key. Source is `playdate`, from `grantBoops('playdate', ...)` |
| `play_find` | `find:<id>` | 5–10 | cap 150 per local day |
| `time_payout` | `time:<timePaidThrough>` | steps of 15, 60 an hour | max 480 per entry (8 hours); cap 600 per local day |
| `welcome_back` | `welcome:<day>` | 150 | once per day; account away 7+ days |
| `starter_grant` | `closet_import` | one-time outfit copy | **[v14+]** once ever. Same source as `starter`, key `closet_import`, from `insertTransaction('starter_grant', 'closet_import', ...)`. Not the starter pack |

**Derived state.** Balance = sum of `boops` lines. Owned items, toys, and furniture = sum of the non-`boops` lines. Rebuild `owned_toys`, `owned_furniture`, item quantities, and the closet (outfits owned) from the ledger whenever the ledger changes locally. These are caches, not sources of truth; `petty.wardrobe.<ownerId>` becomes a rebuildable cache or is removed. A reversal's lines negate the entry it reverses, so a refunded limited item stays not-owned. Room layouts (where furniture sits, what's equipped) stay in `player_state`.

**Negative balance (decision C).** The counter shows the real number. When it's below zero, show one line under it: **"Synced from your other device. Earn Boops to get back to zero."** The shop disables buying until the balance covers the cart.

**Client outbox.** A local `ledger_outbox` (append-only) holds entries not yet confirmed by the server. Every local ledger insert also goes in the outbox. It flushes through `append_ledger_entries` whenever online, the lock is `idle`, the device isn't in standby, and the device may push (guest, or the active linked device). Confirmed rows (`ok` or `duplicate`) leave the outbox. This is separate from the pet/player push queue.
- **`not_active` during a normal flush:** stop the flush, keep every row, and enter standby (A6). Never drop or confirm the rows.
- **Network failure:** keep the rows and retry on reconnect or the next foreground.

**RPC `append_ledger_entries(p_device_id, p_entries, p_replay boolean default false)`**
- Inserts each entry; an existing `(user_id, idempotency_key)` is a no-op (`duplicate`, treated as success).
- Returns `not_active` (and writes nothing) if the account has an `active_device_id` that isn't `p_device_id`. A null `active_device_id` (guests) accepts.
- **Never touches `local_revision`** or any `player_state` field.
- Returns the new balance and per-entry results (`ok` / `duplicate` / `invalid`, plus any flags).

**Server validation (decision D: reject forges and malformed entries, flag everything else)**

`invalid` (logged; the client drops the entry) only when:
- **any kind:** the kind is unknown, a line is missing `asset` or `qty`, or a sign is wrong (a purchase or spend with a positive `boops` line, a consume with a positive line or any `boops`);
- **earn:** the source and key prefix aren't in `earn_rules`, the key is malformed for its prefix, the amount is above that rule's per-entry maximum, or a `starter` / `home:<species>` pack doesn't match exactly. **[v14+] The exact pack check applies only to keys `starter` and `home:<species>`.** Key `closet_import` shares the source `starter_grant` and is not that pack;
- **purchase / spend:** the entry's `boops` total is **below the lowest price the granted items have ever had** (catalog or deal, from the price history), which includes granting a dog house for 0 Boops; or a `serial` isn't reserved or confirmed for this user;
- **reversal:** `reverses_key` doesn't name an existing, unreversed entry of this user, or the lines don't exactly negate it.

Accepted **and flagged**:
- **earn:** a daily cap exceeded (`over_daily_cap`, counted per `(user, local_day)`), a streak or step amount that doesn't match exactly but is within the rule's range (`amount_mismatch`), and a `local_day` that's missing or more than a day from the server's UTC date (`day_skew`). **A bad clock is never a rejection.**
- **purchase / spend:** the total doesn't match the catalog price or a deal valid at `device_time` (`price_mismatch`). `device_time` is first clamped to the range [`server_time` − 30 days, `server_time`] (`time_clamped` if it moved), so a backdated forge can reach at most a month-old price. **A deal that ended before the row synced is a flag, never a rejection**, on the normal flush and on replay alike.
- Toys and furniture are looked up by `toy_id` / `furniture_id` for these price checks.

**[v14] Known v1 limit: daily caps across timezones.** Caps are counted per `local_day` as each device labels it. A phone and an iPad in different timezones can each pay a full day (600 time-payout Boops) for the same real day. Neither is over its own cap, so neither entry is flagged. Accept this for v1; the flags are not protection against it.

To make abuse visible, also flag `rolling_time_cap` on any `time_payout` entry that takes the user over 1,200 time-payout Boops in the 24 hours of server time before `server_time`. Flag only; never reject.

Other rules:
- **`p_replay = true`** accepts only `purchase`, `spend`, and `reversal`, and skips daily caps. **The price check is the same as on a normal flush** (forge test plus flag).
- **Balance may go negative.** The client's normal spend path still blocks spending more than the balance.
- **Later, with IAP:** real-money Boops are credited only by the store webhook (RevenueCat), keyed by the store transaction id. The client never appends them.

**Replay apply path.** `setBalance` throws `insufficient_boops` below zero. Replayed entries go through `applyReplayedEntry`, which writes the ledger row (with lines and serial) and rebuilds derived state, even if the balance goes negative. It never calls `reserve_limited` again.

**`player_state`** has two parts:
- **The pushed document** (`p_doc`): layouts, `owner_state` (including `time_paid_through`, `login_last_claimed_day`), daily counters, and shop state (shop day and pick history; add both to `playerDoc`, they aren't pushed today). Its revision moves only on a push.
- **[v14] Server-owned columns:** `active_device_id`, `active_since`, `last_seen`, **[v14+] and `active_device_label`**. These are real columns on `player_state`, not fields in the document.
  - `claim_device` and `touch_last_seen` are the only writers of `active_device_id`, `active_since`, and `last_seen`. **[v14+] `claim_device` is the only writer of `active_device_label`.** `touch_last_seen` leaves the label alone.
  - `push_player_state` replaces the document and bumps the revision. It leaves these columns alone, and ignores them if they appear in `p_doc`.
  - Without this, an older push from the active device could move `last_seen` backward and erase a real seven-day absence. The label is how the handoff sentence knows iPhone from iPad (A4).
- **[v14] Not in `player_state` at all: the server-time offset.** It's `server_now − Date.now()` for one device's clock, so it can't travel to another device. Remove `server_time_offset_ms` from `owner_state` and `playerDoc`. It lives in local `meta` (A4).

### A3. Push results and `reconcileFromServer()`
- `push_active_pet`, `retire_pet`, and `push_player_state` take `p_device_id` and return `ok`, `stale` (revision behind), or `not_active` (the account's `active_device_id` is set and isn't `p_device_id`; null accepts). **[v14] `push_player_state` never writes `active_device_id`, `active_since`, `last_seen`, or `active_device_label` (A2).**
- Only `ok` deletes a queue row and sets `meta.syncedRevision` to the server revision.
- **`not_active`:** stop the queue, keep its rows (they're cleared, never re-sent, by the next reconcile), and enter standby (A6). **Don't claim.**
- **`stale`** (this device is still active but the server is newer): stop the queue, set the lock, `claim_device` once, `reconcileFromServer(claim)`, the A4 settle once, then release the lock.
- Add `pull_account_state()`: active pet, retired pets, `player_state`, all of the user's `ledger_entries`, the pet and player revisions, `active_device_id`, `last_seen`, `server_now`, **[v14] `has_handle`** (whether `profiles` has a handle for this user), **[v14+] and `active_device_label`**.

**`reconcileFromServer(claim)`** is the one path for a linked device taking the server's state. It's used by app open (A4), Play here (A6), `stale`, adoption and goodbye (A7), and reauth (A5). It's not used when an account replaces a guest (§7).

**Reconcile never claims.** Its caller claims once and passes in `{ active_device_id_before, last_seen_before, server_now, server_revision }`.

1. Set lock `reconciling`. **Record whether this device has play that will be discarded:** `meta.localRevision > meta.syncedRevision`, the pet/player queue isn't empty, or the outbox has any `earn` or `consume` row.
2. **Outbox, safely:** delete `earn` and `consume` rows now. Send `purchase`, `spend`, and `reversal` rows with `append_ledger_entries(..., p_replay: true)`. Remove each only when its result is `ok` or `duplicate`. An `invalid` result is logged and dropped.
   - **Network failure:** keep the rows, release the lock, and retry the whole reconcile (claiming again) on reconnect or the next foreground.
   - **`not_active`** (another device claimed in the gap): keep the rows, release the lock, and enter standby (A6).
3. Clear the pet/player push queue. **Never re-push this device's old pet or player document.**
4. `pull_account_state()`.
5. In one local transaction, replace local pet, retired pets, layouts, `owner_state`, daily counters, shop state, and the **whole local ledger** with the server's. Rebuild derived state (balance, items, toys, furniture, closet) from that ledger, placing replayed shop furniture with `shopFurnitureSpot` if the layout doesn't have it. Clear local NPC playdate data (`petty.playdates.<ownerId>`); it isn't on the server and wouldn't match the arriving pet. Set `meta.localRevision` = max(pet revision, player revision) + 1 and `meta.syncedRevision` = max(pet revision, player revision). **Then `installState()`.** **[v14] Then set `meta.serverTimeOffsetMs` from this pull's `server_now`, and set `meta.handleSaved = true` if `has_handle`.**
6. **Copy**, only if `active_device_id_before` was another device:
   - nothing was discarded (step 1): **"All caught up from your other device!"**
   - something was discarded: **"You played on your other device more recently, so {petName} is just how you left them there. Anything you bought here is safe."**
7. Return, **still holding the lock**. Reconcile never calls `resume` or `settleReturn`; its caller settles once and then releases the lock (A4).
8. **Only after a reconcile and settle that both succeeded**, and after the caller releases the lock, run `resumeLimitedPurchases`, first dropping any pending confirm whose request id is already in the server ledger. On any failure path, skip it until the next successful open.

### A4. App open: claim once, settle once
**[v14] What counts as an open:** launch, and a transition from `background` to `active`. Not `inactive` → `active`: that covers Control Center, the notification shade, the Apple or Google sheet, and permission dialogs.

Skip the open path entirely when either of these is true:
- **The auth lock isn't `idle`.** This lets the Android Apple return through `boopboop://` finish sign-in instead of claiming.
- **`suppressOpenPath` is set.** Any flow that sends the app to outside UI sets it before and clears it once the app is back: sign-in sheets, the IAP sheet, the share sheet, the photo picker, opening system Settings for notifications.

A suppressed return never runs later as a delayed open.

On every open:
1. **`meta.standby` set:** show the standby overlay (A6), online or offline. **Don't claim, don't settle, don't tick.** Nothing else in this list runs.
2. **Guest, or offline:** run `settleReturn` as today, with the payout rules in step 4.
3. **Linked, online, not in standby:** **[v14+] Peek first.** Call `peek_active_device()` (read only: `active_device_id`, `active_device_label`, `last_seen`). It does not claim and does not move `last_seen` or the label.
   - **Another device is active:** don't take the lock and don't claim. Keep the peeked label for the sentence (`meta.otherDeviceLabel`). Show **"You're playing on your iPhone. Continue here?"** **Continue** / **Not now**. The name is `active_device_label`. If it is missing, say "your other device." **[v14+] Unsent play uses the longer question.** Same test as A3 step 1 (`meta.localRevision > meta.syncedRevision`, the pet/player queue isn't empty, or the outbox has any `earn` or `consume` row): **"You're playing on your iPhone. Play on this device since then will be replaced. Anything you bought here is safe. If you tap Not now, that play stays on this device until you tap Play here, which replaces it the same way."** No unsent play: keep the short question. **Not now** sets `meta.standby` and shows the standby overlay (A6) without calling `claim_device`. The other device stays active and stays signed in. Unsent play stays local until **Play here**. **Continue** is the player choosing this device; then claim, below.
   - **This device, or nobody active:** claim, below.
   Set lock `reconciling` (the live tick stops), then call **`claim_device(p_device_id, p_claim_id, p_device_label)`** once, with a fresh random `p_claim_id`. **[v14+] Every `claim_device` call sends `p_device_label`:** iOS phone `iPhone`, iOS tablet `iPad`, otherwise `Android`. Not a name the player types. It returns `{ active_device_id_before, last_seen_before, server_now, server_revision, has_handle }`, then sets `active_device_id`, `active_since`, `last_seen`, and `active_device_label`. `server_revision` is the max of the pet and player revisions read **before** the claim writes anything. **[v14] After the claim, and after any reconcile's `installState`:**
   - set `meta.serverTimeOffsetMs = server_now − Date.now()`;
   - if `has_handle` is true, set `meta.handleSaved = true`. Only the full wipe clears it.
   - **[v14+] The insert of `(user_id, p_claim_id)` is the winner.** Store that call's result, including the `last_seen_before` from before it wrote anything, for 10 minutes. A repeated or overlapping call with the same `p_claim_id` that loses the insert returns the stored result and does not move `last_seen`. This lets a timed-out claim be retried without shrinking a real absence to a few seconds.
   - **Timeout: 3 seconds.** On timeout or failure, release the lock and settle as offline (step 2) with the last known server offset. **Ignore the late response to that call.** Retry the claim once in the background with the **same** `p_claim_id`. If the retry succeeds, take the lock and continue from the bullet below with its result, then settle once more under the lock. Pushes stay safe meanwhile: the server rejects them if this device isn't active.
   - If `server_revision` > `meta.syncedRevision`, or `active_device_id_before` was another device: `reconcileFromServer(claim)` with this same result.
   - `meta.syncedRevision` = the server revision after every successful pull and every `ok` push.
4. Then settle **once**, with that same claim result, **still under the lock**, **on the pet `installState` installed**; release the lock when settle finishes.
   - **Decay:** `resume` from the **pet's own `lastUpdatedAt`** through `server_now`. Never rewind `lastUpdatedAt`. **[v14+] If `server_now` is behind `lastUpdatedAt`, leave `lastUpdatedAt` where it is.** `resume` in `src/sim/clock.ts` currently sets `lastUpdatedAt: now`, which moves the pet backward on the timeout retry. Skip that assignment when `now` is behind.
   - **Time payout:** `planTimePayout` always pays from `time_paid_through` to `now`. If `now` is behind `time_paid_through`, it pays nothing and **leaves the cursor where it is**, so the next call pays the gap. Remove the `now < lastTrustedTime` early return. Rules: 60 an hour, steps of 15, at most 8 hours (480) per payout, 600 per local day.
   - **One clock for all payouts.** **[v14] The offset is device-local:** `meta.serverTimeOffsetMs`, written by this device after every successful claim and pull (after `installState`). It's never read from or written to `owner_state`.
     - Use `serverNow() = Date.now() + meta.serverTimeOffsetMs` everywhere time is paid, including `payoutTimeAccrual('live')`, which stores `serverNow()` in `lastTrustedTime` and `time_paid_through`.
     - Guests and offline devices use this device's last offset, or zero if it has never claimed or pulled.
   - **Welcome-back: an account-level absence.** 150 Boops when `last_seen_before` is **at least 7 days** behind `server_now`. `last_seen_before` is the account's last activity on any device, so if the iPad was used yesterday the phone gets no bonus, however long the phone itself was away. Guests and offline devices keep using `owner_state.last_open_at` with the same 7 days. (The "Welcome back!" greeting after 12 hours of decay is a separate check and doesn't change.)
   - **Login:** from the restored `login_last_claimed_day`.
5. On going to background, and after a successful push, call `touch_last_seen(p_device_id)`. The server ignores it unless `p_device_id` is the active device. The client doesn't send it while in standby.

### A5. A dead session doesn't become a new guest
- `ensureAnonymousUserId` never creates an anonymous user when `meta.accountLinked` is true.
- **[v14+] Telling a dead session from a bad network.** When a refresh fails, retry with backoff. Each time, also call a public health endpoint (no auth). If the health call fails, the device is offline: keep playing offline and retry later. If the health call succeeds and Auth returns a server error, keep the session and retry. The session is dead only when refresh reports an invalid or missing refresh token.
- **Linked device, dead session:** enter `reauth` (§10b): keep local data, allow offline play, pause pushes and the outbox, set the lock to `reauth`.
- **Never wipe on a refresh error.** A deleted account is found only at sign-in:
  - **The same identity signs in and returns the same `user_id`:** `claim_device` once. If `active_device_id_before` was this device and the server revision isn't newer, release the lock and **flush** the queue and outbox normally. Otherwise `reconcileFromServer(claim)` with that result. Then the A4 settle once, under the lock; release it after.
  - **It returns a different `user_id`** (the old account was deleted, so Supabase made a new one): show **"This account was deleted on another device. {petName} on this device will be removed."** with one button, **OK**. Then wipe local data except the new session, set `meta.accountLinked`, and go to age → terms → adoption → handle.
- Note in code: a device that never signs in again keeps its local copy of a deleted account. That's acceptable for v1.

### A5b. A dead guest session
A guest can't sign in again, so its local data is the only copy.
- **[v14+]** Guest, dead session (invalid or missing refresh token, per A5): `signInAnonymously`, then `rebindOwner(oldAnonId → newAnonId)`, then push everything: the pet, the player document, and the whole local ledger through the outbox (normal flush, not replay). The server-side data under the old id is gone or orphaned and isn't needed. An Auth server error does not take this path.
- This is why the cleanup job (§13) never deletes a guest with data, and why session inactivity timeouts stay off (§15).

### A6. Standby (another device is playing)
A linked device enters standby when the server answers `not_active` to a push, an outbox flush, or a reconcile replay.
- Set `meta.standby = true` (it survives restarts).
- Pause the push queue, the outbox, and the one-second tick. Keep every outbox row.
- **`cancelReminders`.** A standby device doesn't notify about needs; the other device does.
- Show a full-screen overlay over Home, on-brand, with the pet sleeping: **"You're playing on your iPhone."** Primary button: **Play here**. **[v14+] The name is `meta.otherDeviceLabel`.** On **Not now**, that is the label just peeked. On `not_active`, call `peek_active_device` once for the label only and store it; do not claim. If there is no label, say "your other device."
- **Standby stays until the tap.** Foreground, launch, and coming back online show the overlay and do nothing else. They never call `claim_device`. Otherwise unlocking the phone just to read this message would take the slot from the iPad, and switching back would take it again.
- **[v14+] Not now** on the continue question (A4) enters this overlay without calling `claim_device`. Both devices stay signed in. The other device stays active.
- **Play here:** requires network. Offline: "You'll need internet to play here." Online: set the lock, `claim_device` once (fresh `p_claim_id`), `reconcileFromServer(claim)`, the A4 settle once, release the lock, clear `meta.standby`, reschedule reminders.
- A device that went offline **while active** (not in standby) keeps playing offline. If another device claims meanwhile, this device learns on its next push and enters standby; its purchases survive and its other play is dropped (§9).

### A7. Adoption and goodbye on a linked account
Adopting a pet and saying goodbye (retiring) are pet changes. On a device that turns out to be stale, reconcile would undo them: the new pet gone, or the retired pet back. So on a linked account:
- Both need network. Offline: "You'll need internet to do this." with a close button.
- **[v14+] The screens open without a claim.** When the player confirms the name, or confirms goodbye: set the lock and `claim_device` once (fresh `p_claim_id`). If `active_device_id_before` was another device, or the server revision is newer, `reconcileFromServer`, settle, leave the flow, and show the caught-up copy (A3 step 6). Don't adopt or retire on top of a pet that just changed. If this device was already active and the server isn't newer, finish and push the new pet or `retire_pet` right away.
- Guests are unchanged: they adopt and retire offline as today.

### Phase A done when
(Each item is a scripted scenario in the §14 harness.)
- Test data is gone; a fresh guest builds a ledger from its first grant; the balance equals the sum of `boops` lines.
- After the first anonymous sign-in, every table with an `owner_id` column, the pet JSON, every queued payload, and the owner-keyed AsyncStorage keys carry the anonymous user id; the next earn doesn't grant `starter` again; the schema test covers every `owner_id` table.
- A guest whose anonymous user is gone (deleted on the server) gets a new anonymous user on the next online launch, keeps its pet and ledger, and pushes them without owner-mismatch errors.
- Signing in to a different account with a guest pet loaded never re-stamps or pushes the guest pet under the account id.
- **[v14+]** A pet save already on `saveQueue` when `installState` bumps the generation never writes the old pet, and its reminder sync does not reschedule.
- A push answered `stale` or `not_active` keeps its rows until reconcile and is never re-sent afterwards.
- Phone offline buys a toy and a treat, uses a treat, and earns a level-up; iPad opens and plays; phone returns: **[v14+]** the phone's question names the iPad and warns, before either button, that play since then will be replaced, purchases are safe, and **Not now** keeps that play until **Play here**. The phone does not claim until **Continue**. After **Continue**, the phone's purchase (Boops charged **and** toy granted) appears on both devices once; the treat use, the level-up, and the phone's away payouts don't; the phone's pet and layouts don't come back; balances match; the phone shows the "played on your other device more recently" line. **Not now** leaves the iPad active and leaves the phone's unsent play local.
- A replayed limited purchase keeps its serial and doesn't call `reserve_limited`; a refunded limited item stays not-owned after restore and reconcile.
- A replayed purchase lands even if it passes the daily cap.
- An absence decays once and pays the time payout once, with or without a reconcile.
- No live tick runs during reconcile, or between reconcile and settle; the pet never rewinds.
- `append_ledger_entries` doesn't change `local_revision`; the push after a reconcile returns `ok`, not `stale`.
- Push, then reopen on the same active device: no reconcile, unsent earns kept.
- The server rejects an earn with an unknown source or key prefix, a malformed key, or an amount over the rule's maximum; it **accepts and flags** an earn over a daily cap, a streak amount that's off but within range, and an earn with a `local_day` two days off.
- Every current client source string is accepted, including `playdate` and `starter_grant` with key `closet_import`; the seed-vs-constants test passes. A `closet_import` row is not checked against the starter pack.
- A `time:` payout near local midnight in a non-UTC timezone is accepted (flagged at most), and the Boops are kept.
- The server rejects a `reversal` that doesn't match an entry and a forged purchase that grants a dog house for 0 Boops.
- An offline purchase at a deal price that synced after the deal ended is accepted and flagged, on the normal flush and on replay; a purchase with `device_time` backdated two months is checked against prices from at most 30 days back.
- A replayed limited item whose serial is already confirmed is accepted.
- A fresh adoption writes `starter` (Boops, biscuits, outfits, toy, shared-room furniture) and `home:<first species>`; the first rebuild keeps the starter ball, bed, and both bowls (food and water, correctly) in place with the layout ids.
- Adopting a second species writes `home:<species>` with only that species' pieces; the shared bed and bowls stay at quantity 1; the new pieces appear in that species' room.
- A replayed `dogHouse` and a replayed `catTree` rebuild from the shop-furniture definitions and appear in the room; every grantable furniture id resolves through `furnitureDefinition`.
- Forcing a refresh failure on a linked device keeps the pet and creates no anonymous user; signing back in on the same active device flushes the offline play.
- With the network down, a refresh failure never enters `reauth` or rebinds a guest; the health check reports offline. **[v14+]** An Auth server error while the health check is up does the same: no rebind, no `reauth`.
- Signing back in after the account was deleted elsewhere shows the "deleted on another device" message and starts fresh; a network error never wipes anything.
- Existing guests keep syncing (null `active_device_id`).
- A away 10 days, B unused for those 10 days: A's open pays 150 welcome-back Boops. A away 10 days, B used yesterday: A gets no welcome-back bonus, and A's time payout follows the normal rules.
- An open on a current, still-active device doesn't reconcile and doesn't drop unsent earns.
- If `append_ledger_entries` fails during reconcile, the toy purchase stays in the outbox and lands on the next attempt.
- Another device claiming between this device's claim and its replay leaves the purchase in the outbox and puts this device in standby; **Play here** lands it.
- A `not_active` during a normal outbox flush keeps the rows and enters standby; nothing is dropped.
- A pending limited buy is never resolved as `lost` after a failed reconcile; it resolves on the next successful open without refunding a purchase the server has.
- With the device clock 5 minutes fast and then corrected, and with the clock 5 minutes slow, the next away payout still lands and no gap is skipped.
- A `claim_device` that times out leaves Home playable offline; its late response is ignored; the background retry with the same claim id gets the original `last_seen_before`, so a qualifying welcome-back bonus still pays. **[v14+]** Two overlapping calls with the same claim id move `last_seen` once, and both see that same `last_seen_before`.
- Phone in standby, brought to the foreground (repeatedly): it shows the overlay and never claims; the iPad stays active. **Play here** moves the slot once.
- A standby device has no reminders scheduled; after **Play here** they're rescheduled for the reconciled pet.
- **[v14+]** Adoption or goodbye on a linked account offline shows the internet message. Online, the screens open without a claim. Confirming the name or the goodbye claims; if the other device is newer, the flow stops and the caught-up copy shows, and nothing is adopted or retired. If this device was already current, the new or retired pet survives the other device's next open.
- **[v14]** After the iPad reconciles the iPhone's state, the iPad's `meta.serverTimeOffsetMs` is still its own (from its claim), and each device pays time with its own offset.
- **[v14]** An older `push_player_state` from the active device never moves `last_seen` backward. A `p_doc` containing `last_seen`, `active_device_id`, or `active_device_label` leaves the columns unchanged.
- **[v14]** Control Center, the notification shade, and the Apple or Google sheet don't run the open path; a real background → active does. The Android Apple return through `boopboop://` completes sign-in without a claim. A flow with `suppressOpenPath` set (simulated IAP sheet) returns without a claim or a settle.
- **[v14]** A time payout that takes the user over 1,200 Boops in a rolling 24 hours of server time is accepted and flagged `rolling_time_cap`.

---

## 3. Phase B — packages, build, and scaffolding

- Add `expo-apple-authentication` and `@react-native-google-signin/google-signin` with their config plugins. Both need a **dev build**; Expo Go won't run them.
- Add URL scheme `boopboop` to `app.json`; Android Apple redirect is `boopboop://auth-callback`.
- Supabase client: `flowType: 'pkce'`, `detectSessionInUrl: false`. Android Apple: `signInWithOAuth({ provider: 'apple', options: { redirectTo, skipBrowserRedirect: true } })`, open with `expo-web-browser` `openAuthSessionAsync`, then `exchangeCodeForSession(code)`. Linking a guest on Android Apple uses the OAuth form of `linkIdentity` the same way.
- Create `supabase/functions/` with `apple_store_token`, `delete_account`, **and `supersede_guest`** (§7, §11, §13).
- Add a public, unauthenticated health endpoint for A5's online check (an edge function or a trivial RPC that returns `ok`).
- Create `profiles` as the accounts-friends brief specifies, with `on delete cascade` from `auth.users`. `profiles` is readable **only by its owner**.
- **Handle availability:** RPC `check_handle_available(p_handle)` (security definer) returns available / taken / reserved / invalid. Seed a `reserved_handles` table with: admin, boopboop, support, moderator, plus common profanity. Case-insensitive.
- Edge function secrets already set: `APPLE_PRIVATE_KEY`, `APPLE_KEY_ID`, `APPLE_TEAM_ID`, `APPLE_BUNDLE_ID`, `APPLE_SERVICES_ID`. Use these names. `client_id` = `APPLE_BUNDLE_ID` for native iOS tokens and `APPLE_SERVICES_ID` for Android web-flow tokens. `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically. `supersede_guest` verifies guest access tokens with the project JWKS (`/auth/v1/.well-known/jwks.json`), not the legacy JWT secret. An expired guest token still verifies.
- Ask me for the public IDs you need (Google Web client ID for `webClientId`, iOS client ID and its reversed URL scheme).

---

## 4. Sign-in sheet (`AccountSheet`)

New component. `FunModal` is a two-button dialog; this needs the Apple and Google buttons plus a dismiss. Match `FunModal`'s visual style.

| Reason | Title / body |
|---|---|
| `friends` | "Pick a handle so friends can find you and bring their pets to play." |
| `purchase` | "Keep your Boops safe. Create an account to back them up." |
| `day3` | "Back up {petName} and your progress so you never lose them." |
| `settings` | "Create an account to back up {petName}, or sign in to one you already have." |
| `restore` | "Welcome back! Sign in to bring your pet home." |
| `reauth` | "Sign in again to keep {petName} backed up." |
| `apple_reauth` | "Sign in with Apple once more to finish deleting your account." (Apple button only; **[v14] iOS only**) |

- Buttons: **Sign in with Apple** (Apple's official style, required) and **Continue with Google**, then **Not now** (`restore`, `reauth`, and `apple_reauth` have a close button).
- **Requires network.** Offline: "You'll need internet to sign in" plus close. Never queue sign-in.
- iOS Apple: native sheet; request full name and email (neither required). Keep the `authorizationCode` for §11. Apple sends the name only on the first sign-in; ignore it for now. Google (both): native Google Sign-In → ID token. Android Apple: web flow (§3).
- **Apple nonce (native iOS):** pass the SHA-256 hash of a random raw nonce to `expo-apple-authentication`, and the raw nonce to `signInWithIdToken` / `linkIdentity`. If the Google library supports a nonce, do the same; otherwise tell me and I'll enable Supabase's "skip nonce check" for Google.
- **One sheet, one credential.** The sheet returns a credential object `{ provider, idToken, rawNonce, authorizationCode? }`. **[v14] `authorizationCode` is Apple's code and exists only on native iOS.** On Android Apple, the sheet returns the Supabase PKCE code instead. `exchangeCodeForSession` spends it, it isn't an Apple code, and it never goes to `apple_store_token`. Every call in the flow that follows (link, restore sign-in, Apple token exchange) uses that object. Never open a second Apple sheet in the same flow; it spends a new code.

---

## 5. Linking a guest (new account)

Which call:
- **Device has an anonymous session:** `linkIdentity` with the ID token (OAuth form on Android Apple). The `user_id` doesn't change.
- **No session yet** (Welcome screen): `signInWithIdToken` directly, then §7. Don't create an anonymous user first.

Flow (guest with a session):
1. Set lock `linking`. Get the credential (§4).
2. `linkIdentity`. Nothing local is rewritten.
3. On success: `meta.accountLinked = true`.
   - **iOS Apple: call `apple_store_token` with the credential's `authorizationCode` immediately**, before anything else (the code is single-use and expires after about 5 minutes). Up to 3 tries with short backoff, behind the progress spinner. If it still fails, continue and set `meta.appleTokenMissing = true`.
   - **[v14] Android Apple:** after the OAuth link completes, send the session's `provider_refresh_token` to `apple_store_token` as a refresh token (§11). If the session has none, set `meta.appleTokenMissing = true`.
   - `claim_device` (fresh `p_claim_id`, with this device's label). **[v14+] Linking does not ask Continue here.** Signing this account in on this device is the choice. The other device goes to standby on its next push. Opening an already signed-in app is the path that peeks and asks (A4).
   - Release the lock; go to §6.
4. **Only the specific "identity already linked to another user" error** goes to restore: switch the lock to `restoring` and go to §7 **with the same credential**. Don't exchange the Apple code here: the session is still the guest's, and §7 deletes the guest, which would take the stored token with it.
5. **Any other failure, including network errors:** friendly error plus retry; release the lock. The guest keeps everything and stays a guest.

The `settings` reason uses this same flow.

---

## 6. Handle creation

- **When:** right after a successful link, or after restore if the account has no handle, **when online**. It's the last step of account creation and has no skip button there.
- **If that's interrupted** (app killed, offline): Home loads normally. The handle screen appears the next time Home is idle and the device is online, with a **Later** button. It doesn't count toward the soft-prompt cooldown or caps (§10a). The `friends` hard gate requires a saved handle.
- Rules: `^[a-zA-Z0-9]{3,20}$`, display capitalization kept, uniqueness on `handle_lower`, stored in `profiles`.
- Live check through `check_handle_available` (debounced), plus a final check on save. Handle the unique-violation race with "That handle was just taken."
- Copy: "Pick your handle. This is how friends find you." Show **@handle · with {petName}**.
- On a successful save set **`meta.handleSaved = true`**.
- **[v14] Every linked device learns about an existing handle from `has_handle` on its claim or pull** (A3, A4), not only during restore. A second device that only reconciles sets `meta.handleSaved` and never shows the picker. The picker is only for an account whose profile has no handle.
- Handle changes and the 30-day hold are out of scope (friends work).

---

## 7. Restore (account replaces the device's state)

Happens when someone signs in with an identity that already has an account: from Welcome, Settings, a prompt, or a failed link (with that sheet's credential, §5 step 4).

Nothing destructive happens before `applyRestore` commits. The guest is deleted last.

1. **If the device has a guest pet or any guest progress**, confirm: **"You already have an account. Signing in will bring back your pet from that account and remove the guest pet on this device."** **Sign in** / **Cancel**. No guest progress: skip.
2. Set lock `restoring`. Queue, outbox, and live tick are paused. **[v14+]** Bump the save generation so a save already on `saveQueue` does not write.
3. **If an anonymous session exists:**
   - save the guest's **refresh token** in SecureStore as `boop.guestSession` (for Cancel and failure recovery);
   - **save the guest's access token** in SecureStore as `boop.pendingSupersede` (for step 9);
   - write `meta.restoreInProgress = { startedAt, guestUserId }`.
4. `signInWithIdToken` with the credential (or OAuth on Android Apple).
   - **iOS Apple: call `apple_store_token` with the credential's `authorizationCode` right now**, before the pull, so the refresh token is stored on the account (not the guest) and inside the code's 5-minute life. Same retries as §5; on failure set `meta.appleTokenMissing = true` and continue.
   - **[v14] Android Apple:** after `exchangeCodeForSession`, send the session's `provider_refresh_token` to `apple_store_token` (§11), before the pull. If the session has none, set `meta.appleTokenMissing = true`.
5. `claim_device` (fresh `p_claim_id`, with this device's label), then `pull_account_state`. **[v14+] Restore claims immediately and does not ask Continue here.** Signing this account in here is the choice. The other device goes to standby on its next push. Opening an already signed-in app is the path that peeks and asks (A4).
6. **`applyRestore`, one local transaction:** active pet, retired pets, layouts, `owner_state`, daily counters, shop state, and the full ledger from the server; rebuild derived state (including the closet) from the ledger; `meta.localRevision` = max(pet, player revisions) + 1; `meta.syncedRevision` = max(pet, player revisions); owner = this `user_id`; `meta.accountLinked = true` (this flow signed into an account); `meta.handleSaved` = whether `profiles` has a handle. Clear the guest's local data, queue, outbox, NPC playdates, wardrobe cache, and guest-owned AsyncStorage keys. Clear `meta.restoreInProgress` and `boop.guestSession` in the same step. **Then `installState()`**, so the in-memory pet is the account's before anything else runs, and reminders are rescheduled for it. **[v14] Then set `meta.serverTimeOffsetMs` from the step-5 `server_now`.** **[v14+] The anonymous reinstall path (§8) installs the same server pet and does not set `meta.accountLinked`.**
7. **Consent:** write the account's age, `terms_accepted`, and privacy acceptance events through to SecureStore (`boop.ageRecord`, `boop.termsAccepted`, with their versions).
   - A playable age event **and** a terms acceptance whose `termsVersion` **and** `privacyVersion` both equal the current constants (read them, don't hard-code): set the gate phase to `ready`.
   - Age event missing: show the age screen.
   - Terms or privacy missing or an older version: show the terms screen, then write the new event.
8. **Settle once with the claim from step 5** (A4 step 4 only: decay, payouts, login), **on the installed account pet**. Don't run all of A4; it would claim again. Then release the lock and publish the identity once.
9. **Delete the guest with `supersede_guest`.** Call it with the account session, passing the guest access token from `boop.pendingSupersede`. The function verifies the token's signature (an expired token is fine), checks that the user is anonymous and has no linked identity, and deletes **that guest only** (limited units, then the admin delete, §13). It does not run the account's Apple revoke or the nested guest-token step. On success, remove `boop.pendingSupersede`. On failure, keep it and retry on every later online open until it succeeds.
10. No handle: §6.
11. No active pet (retired one, never adopted): adoption (A7 applies).
12. Local NPC playdate data isn't on the server; after restore it starts empty. Acceptable for v1; note it in the code.

**Failure and interruption:**
- **Failure before step 4:** error, then the `restore` sheet to retry. The guest keeps everything; clear `meta.restoreInProgress`, `boop.guestSession`, and `boop.pendingSupersede`.
- **Failure after step 4, before step 6 commits:** restore the guest session from `boop.guestSession` (`setSession`); clear `meta.restoreInProgress`, `boop.guestSession`, and `boop.pendingSupersede`; show an error and the `restore` sheet to retry. Nothing local was touched. (If the Apple code was already exchanged in step 4, the token is on the account, which is correct.)
- **App killed after step 3, before step 6 commits:** on launch, `meta.restoreInProgress` is set. Don't show the guest pet. Show a sheet: **"Finish signing in?"** **Finish** / **Cancel**.
  - **Finish** (online): if the account session is present, continue from step 5; otherwise start again from step 4 (a new sheet is fine here; it's a new flow).
  - **Cancel:** restore the guest session from `boop.guestSession`; clear `meta.restoreInProgress`, `boop.guestSession`, and `boop.pendingSupersede`; go to Home.
  - If the guest session can't be restored (token invalid), the guest can't sync any more. Offer **Finish** only, with: "We couldn't get your guest pet back. Sign in to bring your account's pet home."

---

## 8. Welcome screen (new first screen)

### Screen order in `App.tsx`
`App.tsx` picks the screen and today checks `gate.phase` first. New order:
1. `meta.restoreInProgress` set → the "Finish signing in?" sheet (§7).
2. **Leftovers from a reinstall:** if `boop.guestSession` exists but `meta.restoreInProgress` doesn't, delete `boop.guestSession`. (`boop.pendingSupersede` is kept; it's still owed a retry.)
3. **[v14+] A session exists but there's no local pet** (an iOS reinstall keeps the Keychain and drops SQLite). Tell guest from account by the session user's `is_anonymous`, not `meta.accountLinked` (that flag was in SQLite). Show a short loading state, then `pull_account_state`. Don't offer **Get started** yet, and never adopt before this check.
   - **Offline:** "Connect to the internet to bring back your pet." with **Try again**.
   - **Linked account** (`is_anonymous` false) **with a server pet** (or retired pets): restore into this device with §7 steps 5–8 and 10 (no guest, so no confirmation, no guest deletion). Set `meta.accountLinked`. Then Home, with the gate only if §7 step 7 says so.
   - **Linked account with no pet:** set `meta.accountLinked`; the gate per §7 step 7, then adoption (A7), then the handle if missing.
   - **Anonymous user with a server pet:** install the pet, ledger, and player state the way `applyRestore` does, owner = that anonymous id. **Do not set `meta.accountLinked`.** Home.
   - **Anonymous user with no server pet:** **Welcome**, and **Get started** reuses this anonymous user; don't create another one.
4. **No session, no local pet, no restore in progress → Welcome. Don't mount the age gate yet.**
5. Welcome → **Get started** → mount the age gate → age → terms → adoption → Home.
6. Welcome → **I already have an account** → `AccountSheet` (`restore`) → §7 → Home (the gate only if §7 step 7 says so).
7. Local pet exists and `meta.standby` set → standby overlay (A6).
8. Local pet exists → Home. (A linked device without `meta.handleSaved` gets the handle screen at the next idle, online moment, per §6.)

### Layout
- **Boop Boop icon** at the top, same artwork as the app icon (logo treatment, not a tiny square).
- A puppy and a kitten idling together: blinks, tail wags, a little bounce, light wandering. Build on the **actor world** (it holds two pets); `PetPreview` draws one pet with wander off. Fixed default breeds and coats.
- Headline: **"Let's adopt your pet!"**
- Primary: **Get started** (big, glossy, cotton candy). Secondary, directly under, lighter but clearly a button: **I already have an account**.

### Behavior
- **Get started** works offline (when step 3 doesn't apply).
- **I already have an account** offline: "You'll need internet to sign in." Get started stays available.
- Cancel or sign-in failure returns to Welcome, never into adoption.
- Shown only when there's no local pet and step 3 doesn't apply.

---

## 9. Device handoff (e.g. phone ↔ iPad)

Linked accounts only. Mechanics are in Phase A; this is the behavior.

- **Active device:** `active_device_id` (the `installId`), `active_since`, `last_seen`, and **[v14+] `active_device_label`** are server-owned columns on `player_state`. **[v14+] A device becomes active when it links, restores, opens the app online while not in standby and the peek says this device or nobody, taps Continue here, confirms an adoption or goodbye (A7), or taps Play here.** Link and restore claim without the Continue question (§5, §7). Both devices stay signed in.
- **[v14+] On open (online, not in standby):** peek, including the label. If the other device is active, ask **Continue here** / **Not now** and don't claim yet. If this device has unsent play, that question says the play will be replaced and that **Not now** keeps it until **Play here** (A4). Otherwise claim; if the server is newer, reconcile; then settle once (A4). Keep it quick: Home's normal loading state, blocking only while a download runs, never more than the 3-second claim timeout. **Not now** shows the sleeping pet and leaves the other device active.
- **The other device, if it's open:** its next push or flush gets `not_active`. It goes to standby (A6): sleeping pet, **"You're playing on your iPhone."** (the stored label, or "your other device"), **Play here**, no reminders. **It stays there through any number of foregrounds until the tap.**
- **What survives on a device that lost the slot:** its purchases, spends, and refunds (with Boops, items, toys, furniture, serials). **What doesn't:** its pet changes, needs, training, layouts, daily counters, shop state, treat uses, and all its earns. With standby, this only happens to play done while the device didn't yet know it had lost the slot (for example, offline). Adoption and goodbye are protected by A7.
- **Copy after a reconcile from another device:** "All caught up from your other device!" when nothing here was discarded; otherwise "You played on your other device more recently, so {petName} is just how you left them there. Anything you bought here is safe." ("Welcome back!" is the away-payout label.)
- A replayed spend can leave the balance negative; it's shown as described in A2 and stays negative until earned back. Report how often the harness produces it.

---

## 10. Prompts and lost session

### 10a. The three prompts
| Prompt | Trigger | Type | Ships |
|---|---|---|---|
| `friends` | "Add friends" / "Play with a friend" on the playdate screen | **Hard gate** (account **and** saved handle) | Behind `ACCOUNT_PROMPT_FRIENDS`, **off** until friends UI ships |
| `purchase` | Success screen after a successful IAP purchase, never before checkout | Soft | Behind `ACCOUNT_PROMPT_PURCHASE`, **off** until IAP ships |
| `day3` | App opened on the user's **3rd distinct local calendar day** | Soft | **On** |

Rules:
- Never show an account prompt once the user has an account.
- Soft prompts appear **only when Home is idle**: after the greeting animation, never during onboarding, adoption, training, mini-games, a playdate, the Closet, the Pet Shop, standby, or any open modal. Hold a trigger that fires at a bad moment until Home is next idle in that session.
- **Cooldown:** after any soft prompt is dismissed, no soft prompt for **3 days**.
- **Each soft prompt shows at most twice**, ever. The hard gate ignores cooldown and caps.
- Prompt state lives in SQLite `meta` (distinct-day count, last dismissal, per-prompt show counts). Distinct days: local calendar days the app was foregrounded.
- The interrupted-handle screen (§6) uses the same idle rule but isn't an account prompt and doesn't count toward cooldown or caps.

### 10b. Lost session (`reauth`)
- A linked device's refresh fails: **retry first**, with backoff and the health check (A5). Never create a new anonymous user.
- Dead session (refresh reports an invalid or missing token, per A5): keep local data, allow offline play, pause pushes and the outbox, and show `AccountSheet` (`reauth`) when Home is next idle. Signing back in follows A5. An Auth server error is not a dead session.
- Never wipe on a refresh error. A deleted account is found only at sign-in (A5).

---

## 11. Apple token storage (required for deletion)

Apple requires apps with Sign in with Apple to revoke the user's tokens on account deletion.

- Edge function `apple_store_token` (auth required): receives `authorizationCode`, exchanges it at `https://appleid.apple.com/auth/token` with a client secret JWT signed by the `.p8` (`client_id` = `APPLE_BUNDLE_ID` for native iOS), and stores the refresh token:
  ```sql
  create table private.apple_tokens (
    user_id uuid primary key references auth.users(id) on delete cascade,
    refresh_token text not null,
    created_at timestamptz not null default now()
  );
  ```
  The `private` schema isn't exposed to the API; only edge functions with the service role read it.
- **When it's called:** right after the session is the account's, before any pull: after `linkIdentity` succeeds (§5 step 3), or after `signInWithIdToken` in restore (§7 step 4). Never while the session is still a guest that's about to be deleted. Always awaited, with retries; on failure, `meta.appleTokenMissing = true`.
- **[v14] Android Apple (web flow):** the code the redirect returns is Supabase's PKCE code, spent by `exchangeCodeForSession`. It isn't an Apple authorization code.
  - After the exchange, send the session's `provider_refresh_token` to `apple_store_token` (`client_id` = `APPLE_SERVICES_ID`). `apple_store_token` accepts either an `authorizationCode` (iOS) or a `refresh_token` (Android).
  - Supabase often doesn't include a provider token for Apple. Then set `meta.appleTokenMissing = true`.
  - Native `authorizationCode` handling is iOS only.
- If no token is stored at deletion time, deletion asks for Apple once more, and completes either way (§13).

---

## 12. Settings page

- **Entry:** a gear icon (lucide `Settings`) in the Home header **between the logo and the pet's name**, in a small glossy, puffy cotton candy button with a tap target of at least 44×44pt. The name truncates with an ellipsis to make room; the logo and the Boop counter keep their size. Not a paw print (that's the Boops coin). Opens Settings as a full screen with a back button.
- **Leave the existing Style & sound controls in `HomeActionPanel` exactly as they are.**
- **Rows:**
  - **Guests:** **Sign in or create account** (top) → `AccountSheet` (`settings`).
  - **Linked accounts:** in its place, a non-tappable line: **"Signed in as @handle · Apple"** (or **· Google**, or **· Apple & Google**). No handle saved yet: **"Signed in with Apple · Pick your handle"**, tappable, opening the handle screen.
  - **Guests:** **Delete my progress.** **Linked accounts:** **Delete account**.
- Nothing else for now (no sign-out).

---

## 13. Delete account

### Flow
1. Tap **Delete account** / **Delete my progress** → confirmation modal (serious, still on-brand):
   - **Account:** "Delete your account? This permanently deletes your account, {petName}, your retired pets, your Boops (including any you bought), and everything you own. This can't be undone."
   - **Guest:** "Delete your progress? This permanently deletes {petName} and everything you've done. This can't be undone."
   - Text field: **"Type DELETE to confirm."** **Delete** stays disabled until it reads exactly `DELETE` (case-sensitive, trimmed).
   - **Delete** (destructive) / **Cancel**.
2. **Network:**
   - A guest that never reached the server (no anonymous user id): delete locally, offline included. Full wipe, then Welcome.
   - Everyone else needs network. Offline: "You'll need internet to delete your account."
3. Set lock `deleting`, show progress, call `delete_account`.
4. **If it returns `needs_apple_reauth`:**
   - **[v14] Android:** call `delete_account` again right away with `p_skip_apple_revoke: true`. A second web-flow sign-in only yields another PKCE code, so there would still be nothing to revoke.
   - **iOS:** show `AccountSheet` (`apple_reauth`) once.
   - Apple succeeds: call `delete_account` again with the fresh `authorizationCode`.
   - Apple is cancelled or fails: show **"We couldn't reach Apple. Delete anyway?"** with **Delete anyway** / **Cancel**. **Delete anyway** calls `delete_account` with `p_skip_apple_revoke: true`. **Cancel** releases the lock; nothing is deleted.
5. Success: if this call included the guest token, clear `boop.pendingSupersede`, then the full local wipe, then Welcome. The token is cleared only because the server deletion succeeded.
6. Failure: error plus retry; release the lock. Nothing is wiped locally unless the server deletion succeeded.

### Edge function `delete_account` (auth required; guests and accounts)
1. Identify the caller from the JWT.
2. **Apple identity:**
   - If the request includes an `authorizationCode`, exchange it and use that refresh token; otherwise use the stored one from `private.apple_tokens`.
   - Revoke at `https://appleid.apple.com/auth/revoke`. On a revoke error, log it and continue.
   - **No token available:** if `p_skip_apple_revoke` is true, log it and continue; otherwise return `needs_apple_reauth` and delete nothing. A missing token never makes an account undeletable.
3. Google: revoke best effort.
4. **Limited items first:** run the existing logic from `delete_my_guest_data` for `limited_units`: mark the caller's owned units `retired` and reserved units `released`. Serials are never freed for resale. `limited_units` is **not** in the cascade.
5. **[v14+] If the request includes the guest access token from `boop.pendingSupersede`, delete that guest now, before the caller.** Insert the guest id into `pending_guest_deletes`, retire that guest's limited units, then admin-delete that guest. Do not run Apple revoke, Google revoke, or this same guest-token step for the guest, so `delete_account` and `supersede_guest` do not call each other in a loop. If this fails, return an error and do not delete the caller. The client keeps the token and retries.
6. Delete the caller with the admin API. Everything else cascades: `pets`, `player_state`, `ledger_entries`, `profiles`, `consent_records`, `apple_tokens`, claim results, any social tables. Verify every table referencing `auth.users` has `on delete cascade`, except `limited_units`, which has no foreign key on purpose.
7. Replaces `delete_my_guest_data()` as the single deletion path for accounts. **[v14] `delete_my_guest_data` stays, for anonymous users only.** The client clears `boop.pendingSupersede` only after this whole call succeeds.

### [v14] Under-13 deletion (age gate)
Today the age gate's under-13 path calls `delete_my_guest_data`, which rejects non-anonymous users, so a linked account flagged as under 13 (by the gate or a later store age signal) would stay. New rule:
- **Linked account:** call `delete_account`. If no Apple token is stored, pass `p_skip_apple_revoke: true`. **Never show `apple_reauth` to a child.** Revoke whenever a token exists.
- **Guest with server data:** `delete_my_guest_data`.
- **Never-synced guest:** local only.
- Then the full local wipe, and Welcome.
- **Offline:** keep the gate's blocking screen up. On the next online open, retry the server deletion before anything else runs. The account never goes back to playing.

### Edge function `supersede_guest` (account session required)
Deletes a guest the caller replaced on this device (§7 step 9).
1. Verify the guest access token in the body: valid signature (expired is fine), `is_anonymous` true, no linked identity, and not the caller's own id.
2. **[v14+] Insert the guest user id into `pending_guest_deletes` before deleting anything.**
3. Retire that guest's limited units, then admin-delete **that guest only**. Do not run Apple revoke, Google revoke, or the nested guest-token branch.
4. A guest that's already gone counts as success. Remove the pending row once the user is gone.

### Anonymous-user cleanup (part of v1)
A scheduled job (pg_cron) deletes anonymous users created more than 30 days ago that have **no pet, no `player_state` row, and no ledger entries**, by retiring limited units and then the admin delete. It does not run the guest-token branch. **It never deletes a guest with data**, however long it's been offline: that guest's next launch would hit a dead session (A5b). **[v14+] It does delete a guest id still in `pending_guest_deletes`, even if that guest has a pet,** so a `supersede_guest` that recorded the id and then crashed still finishes. Other orphans left by a restore are removed by `supersede_guest` retries, not by age alone.

### Full local wipe (extend `wipeLocalData`)
- **[v14+] First,** if `boop.pendingSupersede` exists, call `supersede_guest` (or pass the token to `delete_account`, which deletes that guest before the caller). Clear the token only after that call succeeds. If the call fails, stop the wipe and retry later. A recorded id in `pending_guest_deletes` is enough for the cleanup job to finish the guest even if this device never comes back.
- pet, retired pets, all owner-keyed SQLite tables, **`daily_counters` (no owner column, so clear it explicitly)**, ledger, ledger outbox, push queue, prompt state, `meta.accountLinked`, `meta.handleSaved`, `meta.standby`, `meta.restoreInProgress`, `meta.appleTokenMissing`;
- **all** AsyncStorage `petty.*` keys, including `petty.draft`, `petty.sound`, `petty.music`, `petty.reminders`, `petty.wardrobe.*`, `petty.playdates.*`;
- SecureStore `boop.ageRecord`, `boop.termsAccepted`, `boop.guestSession`, **`boop.pendingSupersede`**;
- the Supabase session;
- **rotate `boop.installId`**, and clear the in-memory install-id caches in `getOrCreateInstallId` and `bootstrapLocal`; reset in-memory identity, pet, and age-gate state so Welcome starts clean without a restart;
- `cancelReminders`;
- keep only `storageVersion` in `meta`.
Then Welcome.

---

## 14. Two-device test harness

These bugs only show up when two devices interleave, so test them in code, not by hand.

- Build a harness that runs **two simulated clients** (separate SQLite databases, separate `installId`s, one shared account) against a **local Supabase** (`supabase start`), driving the real sync modules (queue, outbox, `reconcileFromServer`, `installState`, settle, standby) with a controllable clock and timezone per client.
- **[v14+] Inject a database, a current owner, and an install id per client.** The sync modules import Expo SQLite, app state, and SecureStore, so a Node worker cannot load them, and refactoring those singletons only inside a worker does not help. Two clients in one process that share `getDb()` (`boop.db`), the current owner, or the install id are the same device, and the harness would pass while testing one device.
  - Each client still gets its own temp directory and its own AsyncStorage, SecureStore, and Keychain mocks.
  - Assert at startup that the two clients' install ids, owners, and database paths differ, so a misconfigured harness fails instead of passing.
- Script every Phase A "done when" item and every handoff case as a scenario, e.g. "A offline: buy toy, use treat, level up → B opens, plays → A opens," and assert both clients' balance, items, pet, and the server rows.
- Include clock skew (ahead and behind), different timezones across local midnight, and kill-mid-flow cases: app killed during reconcile, at each step of restore (after 3, after 4, after 5, after 6), and before the handle save.
- Include: both clients in the foreground pushing every second (one standby, no reconcile loop); **the standby client foregrounded repeatedly (never claims)**; `claim_device` delayed past the timeout **(late response ignored, retry gets the original values)**; an offline deal purchase flushed after the deal ended; deleting an account while the other client is open (the other client's sign-in shows the deleted-elsewhere message).
- **Also:** a save already on `saveQueue` racing a reconcile; a guest whose anonymous user is deleted server-side; a simulated iOS reinstall (keep the Keychain store, drop SQLite) for a linked account, an anonymous user with a pet, and an anonymous user without one; adoption and goodbye confirmed on a stale device.
- **Single-device simulations** cover the reinstall cases and A5b; the harness supports one client as well as two.
- Report the negative-balance rate across the scenarios.
- Run the suite after every phase.

---

## 15. Manual setup (me, not code)

- Supabase Auth: Apple and Google providers on; **manual linking** on; add `boopboop://auth-callback` to the redirect URL allow list.
- Supabase Auth sessions: make sure the **inactivity timeout** and **time-box** are off (or very long), so guest sessions don't die on their own (A5b). **[v14+] Leave Single session per user off.** A second sign-in must not revoke the other device's session. Both devices stay signed in (§0, A5).
- Apple provider Client IDs: bundle ID, then Services ID. Secret key: JWT from the `.p8` (needed for the Android web flow; regenerate within 6 months).
- Google: OAuth clients for Web (redirect `https://<project-ref>.supabase.co/auth/v1/callback`), iOS, and Android (one per SHA-1: EAS key, Play app signing key, debug if used). Supabase Google Client IDs: Web first, then iOS and Android. Client secret: the Web client's.
- Edge function secrets: done (§3). **`supersede_guest` verifies guest access tokens with the project JWKS** (`/auth/v1/.well-known/jwks.json`), not the legacy JWT secret.
- Google public IDs are in `.env.local`: `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, and `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME`. The Google config plugin is in `app.json` with that reversed iOS scheme. The Web client secret stays in the Supabase Google provider. Set the same `EXPO_PUBLIC_` names on the EAS development, preview, and production environments before a cloud build. `.env.local` is not uploaded.
- Enable `pg_cron` for the anonymous-user cleanup.
- Wipe test data in Supabase when Phase A says so (A0).
- Before resubmitting: update the privacy policy and App Store privacy label (user ID, plus email if Apple/Google provides one).
- Mark the superseded sections in `docs/boop-boop-accounts-friends-brief.md` (or ask Cursor to).

Cursor: list any values you still need from me, as a checklist.

---

## 16. Done when

**Phase A** (§2) plus:
- Welcome shows with the Boop Boop icon, the puppy and kitten idling together, **Get started**, and **I already have an account**; the age gate isn't mounted behind it; a device with a pet skips it.
- **I already have an account** on a fresh install signs in with `signInWithIdToken` (no anonymous user), restores pet, ledger, and state, writes the consent keys, and skips age/terms only when the age event exists and both terms and privacy are the current versions; an older terms or privacy version shows the terms screen; offline shows the internet message; cancel returns to Welcome.
- **[v14+]** An iOS reinstall tells guest from account by `is_anonymous`. A linked session restores that account's pet without offering **Get started**. An anonymous session with a server pet restores it and does not set `meta.accountLinked`. An anonymous session with no pet: **Get started** reuses that anonymous user. Offline shows "Connect to the internet to bring back your pet."
- Native Apple sign-in succeeds with the hashed/raw nonce pair.
- Guest → Sign in with Apple (iOS), Google (iOS + Android), Apple on Android: same `user_id`; pet, ledger, layouts, consent unchanged; handle saved through the RPC check; `meta.handleSaved` set; on Apple, the token is stored on the account before the handle screen.
- A link that fails with "identity already exists" goes to restore without a second Apple sheet, and the Apple token ends up stored on the account, not the deleted guest. A link that fails on the network stays a guest.
- Killing the app before saving the handle lands on Home on next launch, offline included; the handle screen appears at the next idle, online moment with **Later**.
- Guest with a pet signs in to an existing account: confirmation shown; account restored; **the first settle runs on the account's pet, and the guest pet is never saved or pushed under the account id;** `starter` isn't granted again; the guest user is deleted by `supersede_guest` after the restore commits, and a failed supersede is retried on later opens.
- Killing the app at any step of restore never leaves the player with a deleted guest and no pet: launch shows "Finish signing in?", and both **Finish** and **Cancel** end in a working state.
- After restore and after reconcile, no reminder mentions the old pet's name or rolled-back needs.
- Phone → iPad → phone works as §9 describes, verified in the harness; two open devices settle into one active and one standby; **the standby device stays in standby through foregrounds until Play here.**
- Lost session: local data kept, no new anonymous user, `reauth` sheet shown; an account deleted elsewhere is detected at sign-in and starts fresh; a network error never wipes.
- Day-3 prompt follows the idle, cooldown, and cap rules and never shows after account creation; friends and purchase prompts exist behind flags that default to off.
- Settings: **gear between the logo and the pet name, name truncating, logo and Boop counter unchanged**; guest sees **Sign in or create account** and **Delete my progress**; linked account sees "Signed in as @handle · provider" and **Delete account**; Style & sound on Home unchanged.
- Delete stays disabled until `DELETE` is typed; deleting an Apple account revokes the token (asking for Apple once more if none is stored), **and still completes through **Delete anyway** if that second Apple sign-in is cancelled or fails;** retires the user's limited units without freeing their serials; deletes the auth user and all cascaded data (ledger included); runs the full wipe (new install id, no restart needed); returns to Welcome. A never-synced guest deletes offline; any other offline deletion is blocked; a failed server deletion wipes nothing locally.
- The anonymous-user cleanup job deletes an empty 30-day-old guest, and leaves alone a guest with a pet (even one offline for months), linked accounts, and recent guests.
- **[v14]** A second device that signs in or reconciles into an account that already has a handle never shows the picker.
- **[v14]** Android Apple: no PKCE code is ever sent to `apple_store_token`; the provider refresh token is stored when the session has one; deleting an Android Apple account without a stored token skips the second sign-in and completes.
- **[v14]** A linked account that the age gate flags as under 13 is deleted through `delete_account` with no Apple prompt, wiped, and returned to Welcome; offline, the gate stays up and the deletion runs on the next online open.
