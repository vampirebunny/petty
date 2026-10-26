# Boop Boop — Currency System Architecture

Oct 21, 2026 · @A

## Overview and principles

Boops are one fungible currency, recorded in an append-only ledger that works offline and syncs to Supabase. Every earn, purchase and item use is one atomic transaction. Balance and inventory are derived from the ledger, never edited directly.

1. **One pool.** Earned and (later) purchased Boops are the same Boops. No second currency.
2. **Ledger is the truth.** Balance and inventory are cached totals of the ledger. Fixes happen by adding a correcting transaction, never by editing a row.
3. **Atomic and idempotent.** A purchase removes Boops and adds the item in one transaction. Each transaction has a unique key, so a retry or double tap never pays twice.
4. **Offline-first.** Everything works with no network. Sync happens in the background when online.
5. **Config, not code.** Every rate, cap and limit lives in the economy config, and every price and effect lives in the catalog. Each number has one home, and both can change without a new build.
6. **One door.** All reads and writes go through a single `CurrencyService`. UI code never touches storage directly.
7. **Server-ready.** Earned Boops are trusted on the client for now. The design lets the server take over when IAP ships, without a data migration.

## Core concepts

Seven concepts make up the system. The ledger is the only one that stores history; everything else is definitions, derived totals, or rules.

| Concept | What it is | Stored where |
| --- | --- | --- |
| Wallet | The user's Boops balance | Derived from ledger, cached locally |
| Inventory | Items owned: consumables with a quantity, permanent items owned once | Derived from ledger, cached locally |
| Item catalog | Every buyable or usable item: kind, price, effects, availability, species. The only source for prices and effects | Bundled JSON, remote override |
| Ledger | Append-only list of transactions, each with one or more lines | Local SQLite, synced to Supabase |
| Faucets | Ways to earn Boops or items (time accrual, play finds, login, mini-games, playdates, milestones) | Rules in config, state in timers table |
| Sinks | Ways to spend (purchases) or consume (using an item) | Rules in catalog and config |
| Economy config | All rates, caps and limits (no prices) | Bundled JSON, remote override |

&#91;embedded content: currency architecture · 6 parts\]

Screens never touch storage; the service checks the catalog and config rules, then writes to the local ledger, which syncs to Supabase when online.

## Data model

A transaction is the unit of change; its lines say what moved. A purchase of 2 treats is one transaction with two lines: −30 Boops and +2 treats. Local SQLite keys the ledger, balances, inventory, and owner state by owner id. Supabase does not store those ledger tables. The applied backup is `player_state`: one snapshot per user of Boops, inventory, toys, furniture, and layouts. The Supabase ledger below is the later accounts sync, not a table on the project.

```sql
-- LOCAL (expo-sqlite). Keyed by owner id (auth user id, or the install id until bind).
transactions (
  id               text primary key,      -- uuid generated on device
  owner_id         text not null,
  idempotency_key  text not null,         -- e.g. 'starter', 'login:2026-10-22', 'level:<pet>:12'
  source           text not null,         -- see Sources below
  source_ref       text,                  -- trick id, item id, playdate id, etc.
  device_time      text not null,         -- ISO timestamp
  server_time      text,                  -- null until synced
  device_id        text,
  app_version      text,
  config_version   integer,
  unique (owner_id, idempotency_key)
);
-- What moved in a transaction. asset = 'boops' or a catalog item id
transaction_lines (transaction_id, asset, delta, primary key (transaction_id, asset));

-- Derived caches, rebuilt from the ledger at any time
balances  (owner_id primary key, boops, updated_at);
inventory (owner_id, item_id, quantity, first_acquired_at, primary key (owner_id, item_id));

-- Timers and counters that faucets and limits need
owner_state (                                               -- one row per owner
  owner_id primary key,
  time_paid_through,
  time_capped_day,           -- local day the time cap was hit
  last_trusted_time,         -- highest time ever seen (clock guard)
  server_time_offset_ms,     -- device vs server, from last sync
  login_streak, login_last_claimed_day,
  last_open_at
);
daily_counters (day, pet_id, key, count, primary key (day, pet_id, key));
  -- pet_id '' for owner-level counters; e.g. 'time_boops', 'minigame_boops', 'second_wind'

-- SUPABASE LEDGER (not applied; ships with accounts). Same columns plus owner_id; every key is unique per owner.
transactions      (owner_id uuid not null references auth.users, ...local columns,
                   lease_generation int not null, unique (owner_id, idempotency_key))
transaction_lines (same as local)
balances          (owner_id primary key, boops, updated_at)
inventory         (owner_id, item_id, quantity, first_acquired_at, primary key (owner_id, item_id))
owner_state       (owner_id primary key, ...local columns, lease_device_id, lease_generation)
daily_counters    (owner_id, day, pet_id, key, count, primary key (owner_id, day, pet_id, key))
```

**Sources:** `starter_grant`, `time_payout`, `daily_login`, `welcome_back`, `minigame`, `playdate`, `milestone`, `level_up`, `quest`, `purchase`, `consume`, `admin_adjust`, and later `iap`.

**Invariants**

- The Boops balance and every item quantity are never negative, with one exception: an IAP refund (later) can push the balance below zero, and spending is blocked until it's positive again. Any other transaction that would go negative is rejected before it's written.
- Transactions are never updated or deleted to fix anything; a correction is a new `admin_adjust` transaction. The one exception is account deletion, which deletes every ledger row for that owner.
- The cached `balances` and `inventory`, and any effect on the pet, are updated in the same SQLite transaction as the ledger write.
- Permanent items (cosmetics, furniture) have a max quantity of 1; buying one twice is rejected.

## Faucets (earning)

Every faucet is capped by time, by count, or by being one-time, so no single action can be farmed. Amounts are in the economy config below.

| Faucet | Trigger | Limit | Idempotency key |
| --- | --- | --- | --- |
| Starter grant | First launch: 1,000 Boops, 10 basic treats, and every catalog outfit with `starter: true` | Once per owner | `starter` |
| Time accrual | Boops accrue as time passes, app open or closed; paid automatically with a burst | Away time counts up to 8 h; daily cap | `time:<paid_through>` |
| Play finds | A finished fetch, frisbee, laser or toy round (15%), or a completed Cuddle session (5%). Not single strokes, not training reps | Daily cap; actions only, never idle time | `find:<action_id>` |
| Daily login | Paid on open with the other grants; 7-day ladder | Once per day | `login:<yyyy-mm-dd>` |
| Welcome back | Open after 7+ days away; fixed gift | Once per absence | `welcome:<yyyy-mm-dd>` |
| Mini-games | A finished run can pay Boops from score and pickups. Cloud Hop and Paddle Paws do not. Their scores are only leaderboard results and never change Boops or inventory. | Daily Boops cap | `minigame:<run_id>` |
| Playdates | Fixed reward per completed playdate | Existing cooldown | `playdate:<playdate_id>` |
| Level-ups | Every level above the pet's `lastPaidLevel`, found by `checkLevelUp` | Once per level per pet; skipped levels all pay | `level:<pet>:<n>` |
| Trick mastered | Each trick mastered (sit, speak, paw, and later tricks); 100 Boops, no treats | Once per trick per pet | `milestone:trick:<trickId>:<pet>` |
| New life stage | Pet enters a stage after the one it was adopted in; 200 Boops | Once per stage per pet | `stage:<pet>:<stage>` |
| Quests (later) | Daily and weekly tasks | Per quest | `quest:<id>:<period>` |

**Level-ups and life stages**

- Level is derived, not stored: `1 + floor(xp / 25)`, clamped by the life-stage ceiling (6, 12, 20, 32, 45). There is no level-up event, so the game has to check for one.
- **Starting state is already paid.** At adoption, `lastPaidLevel` = 1 and `lastPaidStage` = the adoption stage. The first check never pays level 1 or 200 Boops for being a puppy.
- **When it runs:** one `checkLevelUp(pet)` runs after anything that adds XP (a finished meal, a pet, a finished cuddle, a training rep, a mastery), after a life-stage change, and on app open. Tapping Feed and playdates add no XP.
- If the current level is above `lastPaidLevel`, every level in between pays, each with its own `level:<pet>:<n>` key, then `lastPaidLevel` is set to the current level. Entering a new stage can skip several levels; all of them pay.
- If the current stage is past `lastPaidStage`, every stage after `lastPaidStage` up to the current one pays its own grant (`stage:<pet>:<stage>`), the same walk as levels, then `lastPaidStage` is set to the current stage. A pet that goes from puppy to adult with no open in between gets the older-puppy, adolescent and adult grants. Reversible senior sub-stages don't pay again.
- **One celebration per jump**, not one per level; a stage grant from the same jump folds into it. The payout is five paw coins and a `+N` for the combined Boops. It does not name the stage, and there is no separate level modal.
- The ledger rows, `lastPaidLevel` and `lastPaidStage` commit in one SQLite transaction.

**Time accrual algorithm**

```ts
// mode 'live' = app open and playing (pays in steps of 15); 'return' = app open after time away (pays the exact amount)
// Called with 'return' from onAppOpen, and with 'live' by a timer set for the next threshold while playing
function payoutTimeAccrual(now: number, s: OwnerState, cfg: Economy, mode: 'live' | 'return') {
  const t = cfg.timeAccrual, hourMs = 3_600_000, msPerBoop = hourMs / t.boopsPerHour;

  // Clock behind: pay nothing, move nothing, write nothing
  if (now <= s.timePaidThrough || now < s.lastTrustedTime) return 0;

  // From here on, now is accepted. Every exit saves owner_state in one SQLite transaction,
  // so lastTrustedTime (and timeCappedDay when it changes) are never left in memory only.
  // withTransactionAsync does not return the callback's value, so the amount is kept outside
  // and returned after the transaction commits. The payout animation counts this amount up on the pill.
  let amount = 0;
  await db.withTransactionAsync(() => {
    s.lastTrustedTime = now;
    const today = localDay(now);

    // Once the daily cap is hit, nothing accrues until the next local midnight
    let start = s.timePaidThrough;
    if (s.timeCappedDay && localDay(start) === s.timeCappedDay) start = nextLocalMidnight(s.timeCappedDay);
    if (now <= start) { saveOwnerState(s); return; }            // waiting for midnight

    const room = t.dailyCap - dailyCount(today, 'time_boops');
    if (room <= 0) { s.timeCappedDay = today; saveOwnerState(s); return; }  // cap already full

    const elapsed = now - start;
    const awayCapped = elapsed > t.awayCapHours * hourMs;
    const counted = Math.min(elapsed, t.awayCapHours * hourMs);  // long absences capped
    const earned = Math.min(Math.floor(counted / msPerBoop), room);
    const payout = mode === 'return' ? earned : Math.floor(earned / t.payoutStep) * t.payoutStep;
    if (payout === 0) { saveOwnerState(s); return; }            // under one live step so far

    // Payout: ledger row, daily counter, timeCappedDay, timePaidThrough, lastTrustedTime
    writeLedger({ source: 'time_payout', lines: [{ asset: 'boops', delta: payout }] });
    addDailyCount(today, 'time_boops', payout);
    if (payout >= room) s.timeCappedDay = today;
    // Advance only by the time paid, so the remainder keeps counting.
    // If the away cap cut time off, drop it by jumping to now.
    s.timePaidThrough = awayCapped ? now : start + payout * msPerBoop;
    saveOwnerState(s);
    amount = payout;
  });
  return amount;  // the open payout (return) or the live payout counts the pill up by this amount
}
```

- No on-screen pile. Accrual is continuous but only as math, computed from `timePaidThrough`; nothing shows until a payout.
- While the user is playing, payouts are automatic at round numbers: every `payoutStep` (15 Boops, every 15 minutes at 1 Boop per minute). While the app is open, a timer is set for the next threshold.
- Each payout plays paw coins into the top-right pill, one coin for a live payout, and shows a `+N` for that burst's total just under the pill. The `+N` is Nunito Black in coin gold with a white edge. The balance in the pill is the same face in mango. Each coin bloops when it lands and again when it reaches the pill. When the last coin arrives, the pill counts up by that payout's amount. The wallet was already written. On open the pill shows the ledger minus grants still waiting to play, and each payout adds to that number. It does not follow the balance on its own. The total never ticks on its own.
- On return, everything accrued (up to 8 hours) pays as the exact amount, usually not a round number (e.g. +347), as five coins. Welcome-back, level, and milestone grants queued with it also play as five coins each. The whole queue plays before the greeting. Each arrival counts only its own amount, clamped at the ledger balance. If the app is backgrounded mid-payout, the remaining sounds are skipped and the pill snaps to the ledger.
- **Daily cap:** 600 time Boops per local calendar day (local midnight on the device, stored as a local date key). Once the cap is hit, time accrual stops until the next local midnight; the rest of that day earns no time Boops by design. `timeCappedDay` records it, and `timePaidThrough` is not jumped to now. A return payout counts toward the cap of the day it's paid.
- **Backward clock:** if the device clock is behind `timePaidThrough` or last\_trusted\_time, pay nothing and move no timer. Accrual resumes once the clock is past both. last\_trusted\_time advances only after the check accepts the current time.
- A month away pays the same as 8 hours, plus the one-time welcome-back gift.

**Daily login**

- "Day" means the user's local calendar day.
- **Grace day:** a missed day pays nothing, and the ladder continues where it was. Claim day 3, miss a day, and the next open offers day 4 (not day 5). Missing two or more days in a row resets to day 1.
- Day 7 pays the most, then the calendar loops.
- **Claim:** `onAppOpen` reports the waiting reward, and the home screen claims it immediately (`claimDailyLogin`) so it plays as paw coins with the other open grants, before the greeting.

## Sinks and item use

Buying and using are separate steps: a purchase turns Boops into inventory, and using an item removes it from inventory and applies its effect. Both are ledger transactions.

**Purchase flow**

1. `canAfford(itemId, qty)` checks balance, max quantity, species, and the catalog's `available` flag.
2. `purchase(itemId, qty, requestId)`: `requestId` is generated once per button press and used as the idempotency key. The button is disabled while the request is pending.
3. In one SQLite transaction (`BEGIN IMMEDIATE`), the checks run again, then `−price × qty` Boops and `+qty` of the item are written and the caches updated. Two taps can't both pass the check.

**Use flow**

1. `canUse(itemId, petId, opts)` checks quantity > 0 plus the item's own rules (below).
2. `use(itemId, petId, opts, requestId)`: `opts` carries the `context` (`'casual' | 'training'`) for treats, the `trickId` for Second Wind, or the `attribute` for Vitamins. `requestId` is the idempotency key.
3. In one SQLite transaction (`BEGIN IMMEDIATE`), the checks run again, the `consume` row (−1 item) is written, and the effect is applied to the pet, so an item is never spent without its effect.

**Item kinds**

| Kind | Stack | Notes |
| --- | --- | --- |
| Basic food | Unlimited | Free. Not in the inventory and never in the ledger, so the pet can always eat |
| Premium food | Yes | Pantry item. Replaces the kibble in the bowl for one meal (rules below) |
| Treats | Yes | Separate casual and training effects (rules below). Training uses basic treats only this round |
| Second Winds | Yes | Ends one trick's training rest early (rules below) |
| Vitamins (later round) | Yes | Raise an attribute's current level (rules below) |
| Cosmetics | Max 1 | Hats, jackets, bandanas, sunglasses, boots. Worn from the Closet |
| Toys (later) | — | Not sold yet. Toys live on the pet today; they need their own toy box inventory first |
| Furniture (later) | Max 1 | Pet-centric items only |

**Treat rules**

- Each treat's catalog entry has two effects, `effects.casual` and `effects.training`. The `context` passed to `use()` picks one.
- **Casual:** today's behavior. Refused when hunger is 0; applies the full hunger, weight and mood effect.
- **Training:** skips the hunger gate, keeps the full mood effect, and applies a quarter of the hunger and weight. The training sim separately applies full credit and half the focus cost; that stays training logic, not part of the item effect.
- This round, training spends basic treats only. Special treats are casual only and get a training effect in a later round.

**Premium food rules**

- A pantry item. Feed opens a Pantry card that lists free kibble and any special food the pet owns. Serving a special food puts it in the bowl instead of kibble for one meal. Once it's eaten the bowl is empty, and the next meal is free kibble unless another special food is chosen. The bowl never refills itself.
- Its effects are multipliers on a normal kibble meal, so balance stays anchored to kibble: hunger ×1, weight ×1 (no faster weight gain), energy ×1.2, XP ×1.5, plus a `moodBonus` and its own eating animation.
- Same gate as kibble: it can't be served when the pet is full.
- Catalog entry: `effects: { mealMultipliers: { hunger: 1, weight: 1, energy: 1.2, xp: 1.5 }, moodBonus }`.

**Vitamin rules**

- **Shown score:** `shown = clamp(applyWeightAndAging(natural + trained + drift + boosted), 1, potential)`. Stored trained is already post-diminish (playdate points are stored there flat), so nothing is diminished again. boosted is the flat Vitamin total. Weight and aging stay as they are now: weight on stamina and agility, aging on a senior's stamina, agility and obedience. The score never displays below 1.
- Each use adds `vitamins.pointsPerUse` to `boosted` for one attribute on one pet.
- **Boost budget:** an attribute's `boosted` total can't exceed `potential × vitamins.boostBudgetRatio` (0.25). This cap is on the boosted total only.
- **Training-only top:** a Vitamin can't raise the shown score above `potential × vitamins.trainingOnlyAbove` (0.9). A use that would cross it adds only up to it. At or above it, the button is disabled: "Only training can take Biscuit higher!" A senior already near the top has little room; that's intended.
- **Daily limit:** `vitamins.dailyLimitPerAttributePerPet` (3), counted in `daily_counters` by pet.
- **Style label:** boosted points never count toward "current style". Playdate grants stay in `trained` and do count.
- **Eligible attributes:** stamina, agility, intelligence, boldness. Not sold: affection (the bond is earned) and obedience (it feeds every trick's success roll). A stamina Vitamin also lengthens training sessions (5 + 5 × stamina); that's intended and bounded by the budget. Vitamins ship in a later round, not in the first catalog.
- **Storage:** `boosted` lives on the pet record per attribute. The ledger records the spend (`consume`, −1 item, `source_ref` = `<petId>:<attribute>`). Both writes commit in one SQLite transaction.

| Attribute | Vitamin |
| --- | --- |
| Stamina | Pep Pellets |
| Agility | Spring Sprinkles |
| Intelligence | Brain Berries |
| Boldness | Brave Bites |

**Second Wind rules**

A Second Wind is a consumable that ends a training rest early. It buys time, not attribute points: training after a Second Wind works exactly like training after a normal rest. It only ends that trick's rest; the energy meter and sleep are unchanged. ("Zoomies" stays reserved for the high-energy running behavior.)

- **Scope: one trick.** Rest is stored per trick, so a Second Wind ends the rest of the trick it's used from (that trick's button or its "needs a break" pop-up). Other tricks' rests are unchanged. Catalog effect: `{ type: "end_rest", scope: "trick" }`; called as `use(itemId, petId, { trickId }, requestId)`.
- **When it can be used:** only while that trick is resting. At any other time the item is shown in inventory but can't be used.
- **Where it's offered:** on the break sheet, next to the countdown. The row shows the pet-shop Second Wind art and "You have N". Owning one offers **Use Second Wind**. Owning none offers **Visit Pet Shop**. After the daily limit the row and both actions are hidden.
- **What happens:** the pet perks up with a quick full-body shake-off, ears up and tail going, and a happy bark or meow. That trick's rest timer ends and its button switches back from the countdown to ready.
- **Reps after a Second Wind:** a fresh session for that trick, with the same rep count as after a natural rest (from the pet's attributes and whether treats are given). No bonus reps, no change to learning rate.
- **Limit:** `secondWind.dailyLimitPerPet` (5) per pet per day, in `daily_counters`. After that the offer is hidden and the rest runs out normally.
- **Ledger:** one `consume` transaction, −1 Second Wind, `source_ref` = `<petId>:<trickId>:rest`. The rest ending and the item spend commit in the same SQLite transaction.
- **Bought in the shop:** the break sheet does not buy a Second Wind in place. **Visit Pet Shop** leaves for the shop, and the player buys it there. `buyAndUse` remains for callers that still purchase and spend in one step.

## Offline, clock integrity and sync

The device writes first and Supabase catches up; once IAP ships, the server becomes the authority for anything bought with money.

**Local storage**

- Use `expo-sqlite` for the ledger, caches, `owner_state` and `daily_counters`, together with the pet, attributes, treats and Closet, so a purchase or item use and its effect commit in one transaction.
- The catalog and economy config ship bundled as JSON. A newer remote version is fetched when online and cached locally.

**Clock guard**

- Keep `last_trusted_time` = the highest time the app has ever seen (device or server).
- If the device clock is behind `last_trusted_time` or `timePaidThrough`: pay no time-based rewards and move no timer. Accrual resumes once the clock is past both, and `last_trusted_time` advances only after the check accepts the current time.
- If the device clock jumps forward: the 8-hour away cap and the daily cap limit the gain. Daily login uses local days, so changing the date can farm one login per change. Accept that until IAP.
- When online, read Supabase server time, store `server_time_offset_ms`, and use `device + offset` for timers.

**Sync (ships with accounts; this round stays local-only)**

1. Unsynced transactions are pushed in order to Supabase when online. Insert is idempotent on `id` and on `(owner_id, idempotency_key)`.
2. Row-level security: a client can insert its own transactions and read its own rows. No update or delete.
3. A Postgres function runs light sanity checks: one starter grant per owner, time Boops ≤ daily cap, one login per day, mini-game total ≤ daily cap. Violations are flagged, not rejected, so the app never breaks offline.
4. The server keeps its own balance from the ledger. A mismatch with the device is logged for review.

**Account linking**

- The guest's anonymous ID is already in Supabase. On sign-up, the anonymous auth user is upgraded in place, so the whole ledger carries over with nothing copied.
- Signing in on a second device downloads the ledger and rebuilds the caches.

**Account-ready now (build these this round)**

- [x] Local rows are keyed by owner id. The install id is the owner until the anonymous session exists, then a bind copies those rows onto the auth user id. The install id is never written to Supabase.
- [ ] Guest ID is a Supabase anonymous auth user (not a custom UUID), session kept in secure storage, so sign-up upgrades it in place and `auth.uid()` never changes.
- [ ] The starter grant's key is `starter`, unique locally; Supabase allows one `starter` per owner. On the first session the anonymous auth user takes the whole local ledger, so the grant can't pay twice.
- [ ] Local tables mirror the future Supabase schema: same names, UUID ids, integer amounts, ISO timestamps.
- [ ] Same pattern for pet state (pet, attributes, training, Closet): every record has `id`, `updated_at`, `server_time`.
- [ ] All reads and writes go through `CurrencyService` and a matching pet-state service.

**Account rules (ship with accounts)**

- **One active device per account.** The device holding a lease (taken while online) can earn and spend offline. Other signed-in devices are read-only until they take the lease. This prevents two phones each earning a full day and spending the same Boops. Each lease has a generation number that every synced row carries. The server rejects any write whose generation is no longer current, so a phone that lost the lease can't land offline spending when it reconnects; its rejected rows are dropped and its local state is rebuilt from the server.
- **Signing into an existing account on a device with a guest pet:** the guest wallet follows the guest pet. Whatever happens to the pet happens to its wallet.
- **Sign-out:** sync pending rows first (warn if offline), clear local data, then create a new anonymous user. A new guest's starter grant goes to that new user, never to the account that just signed out.
- **Account deletion:** delete every ledger row for that owner. This is the one exception to append-only.

**Phase 2 (when IAP ships)**

The purchase rules are in [boops-iap-brief.md](boops-iap-brief.md).

- Guests can buy. The store rules do not allow requiring an account first.
- The RevenueCat webhook writes the grant. The phone copies that server row into the local ledger and does not push it back.
- Earned Boops stay client-trusted until a later hardening pass. That pass is not part of the purchase work.
- A refund is a reversal of the original credit and can push the balance below zero. Spending stays blocked until it is positive again. Items already bought stay.

## CurrencyService API

The app calls only these functions; screens subscribe to balance and inventory changes instead of reading storage.

```ts
interface CurrencyService {
  // Reads
  getBalance(): number;
  getInventory(): InventoryItem[];
  getQuantity(itemId: string): number;
  getCatalog(filter?: { kind?: ItemKind; species?: 'dog' | 'cat'; available?: boolean }): CatalogItem[];
  subscribe(listener: (snapshot: WalletSnapshot) => void): () => void;

  // Spending (requestId = one per button press, used as the idempotency key)
  canAfford(itemId: string, qty?: number): Check;      // { ok, reason? }
  purchase(itemId: string, qty: number, requestId: string): Promise<Result>;
  canUse(itemId: string, petId: string, opts?: UseOpts): Check;
  use(itemId: string, petId: string, opts: UseOpts, requestId: string): Promise<Result>;
  // UseOpts = { context?: 'casual' | 'training'; trickId?: string; attribute?: Attribute }

  // Earning
  getTimeAccrual(): { pending: number; nextPayoutAt: Date };
  payoutTimeAccrual(mode: 'live' | 'return'): Promise<Result>;  // 'live' from the threshold timer, 'return' from onAppOpen
  getDailyLogin(): { claimable: boolean; streakDay: number; reward: number };
  claimDailyLogin(): Promise<Result>;                // granted on open, played as paw coins
  checkLevelUp(petId: string): Promise<LevelUpResult>; // after XP gains, stage changes, app open
  grant(source: Source, amount: number, ref: string): Promise<Result>; // mini-games, playdates, milestones

  // Lifecycle
  onAppOpen(): Promise<OpenRewards>;  // pays what's due, reports the login reward as waiting, plays nothing
  sync(): Promise<void>;              // ships with accounts
}
```

- `Result` returns `{ ok, transactionId?, reason? }`. Reasons are codes such as `insufficient_boops`, `not_available`, `already_owned`, `boost_budget_reached`, `training_only_top`, `daily_limit`, `not_resting`, `already_claimed`, so the UI can show a friendly modal.
- `grant` enforces each source's limit from config. Calling it twice with the same `ref` returns the first result instead of paying again.
- `onAppOpen` pays what's due (the return time payout, welcome back, level-ups and stage grants) and reports the daily login as waiting. It plays nothing itself. The home screen claims that login and plays it as paw coins with the other grants, then the time-away greeting and, when the open is more than 3 hours after the last one, the +energy chip that fills energy to 100 (PRD R2.1).

## Default economy config

The starting numbers aim for about 1,000 Boops a day for an engaged player and about 520 for someone who opens the app once a day. A hat then costs about a day of engaged play. All values are first guesses to tune after launch.

```json
{
  "version": 1,
  "starter": { "boops": 1000, "items": { "treat_basic": 10 } },
  "timeAccrual": { "boopsPerHour": 60, "payoutStep": 15, "awayCapHours": 8, "dailyCap": 600 },
  "dailyLogin": { "rewards": [20, 25, 30, 35, 40, 50, 100], "graceDays": 1 },
  "welcomeBack": { "minDaysAway": 7, "boops": 150 },
  "minigame": { "maxPerRun": 40, "dailyCap": 150 },
  "playdate": { "boops": 30 },
  "playFinds": {
    "minBoops": 5, "maxBoops": 10, "dailyCap": 150,
    "chanceByAction": { "fetch_round": 0.15, "toy_round": 0.15, "cuddle_session": 0.05 }
  },
  "levelUp": { "boops": 50 },
  "milestones": { "trickMastered": 100, "lifeStage": 200 },
  "vitamins": { "pointsPerUse": 2, "boostBudgetRatio": 0.25, "trainingOnlyAbove": 0.9, "dailyLimitPerAttributePerPet": 3, "attributes": ["stamina", "agility", "intelligence", "boldness"] },
  "secondWind": { "dailyLimitPerPet": 5 }
}
```

| Player | Time accrual | Login (avg) | Play finds | Mini-games | Playdates | Per day |
| --- | --- | --- | --- | --- | --- | --- |
| Engaged (several opens, plays) | 600 | 43 | 150 | 150 | 30–90 | about 1,000 |
| Casual (1 open) | 480 | 43 | 0 | 0 | 0 | about 520 |

**First catalog**

Prices, effects and availability live in the catalog, not in the economy config. The store is open from first launch, so the starter 1,000 Boops has somewhere to go.

| Item | Price | Available |
| --- | --- | --- |
| Starter outfits (7): collar, bandana, scarf, beanie, red-rim glasses, puffer, red boots | — | No: `starter: true`, granted free by the starter transaction |
| Other designed outfits, none of the seven starter items (paid neckwear: bell, bow, gold collar; paid jackets and boots: all but the puffer and red boots) | By slot: neckwear 500, eyewear 700, hats 1,000, boots 1,200, jackets 1,600 | Yes |
| Basic treat | 30 | Yes |
| Premium food (1–2 kinds) | 50 | Yes |
| Second Wind | 120 | Yes |
| Vitamins | 150 | Later round |
| Toys | — | Later: needs a toy box inventory |

## Build order and open decisions

Build the ledger and wallet first, then hook existing features into it, then add new faucets and sinks.

**Starter grant**

There are no existing players, so nothing migrates. The starter transaction is the only grant: 1,000 Boops, 10 basic treats, and every catalog outfit with `starter: true`. The starter JSON lists the Boops and treats; the outfits are picked up from the catalog flag.

**Build order for Cursor**

1. Schema in `expo-sqlite`, `CurrencyService` reads and `grant`, starter grant, and a dev screen listing the ledger. First, move the pet (hunger, attributes, trick rests), the treat wallet, the Closet, owner\_state and daily\_counters out of AsyncStorage into the same SQLite database, so every spend and its effect commit in one transaction.
2. Catalog and economy config loading (bundled JSON), `purchase`, `use`, and the inventory page.
3. Move treats onto inventory and wire training's "give treat?" to `use`.
4. Time accrual with 15-Boop threshold payouts and the top-right Boops pill, plus the clock guard.
5. Daily login calendar and welcome-back gift, shown through `onAppOpen`. onAppOpen reports the login. The home screen claims it and plays those coins with the other open grants, then the greeting.
6. Grants from playdates, level-ups (checkLevelUp and lastPaidLevel), trick mastery and life stages.
7. Second Winds (per trick), treat casual/training effects, and premium food. Vitamins and the trained/boosted split come in a later round.
8. Pet store screen.
9. Applied: `pets` and `player_state` on the hosted project, with select-only row-level security and push RPCs. Not applied: the ledger tables, ledger sync, and sanity checks. Those still ship with accounts. Local rows are keyed by owner id. `server_time` stays null until a ledger sync exists.
10. Mini-game payouts when the mini-games exist.

**Open decisions**

- [ ] Decided: obedience is earned only, not sold as a Vitamin.
- [ ] Decided: a Second Wind ends the rest only; no bonus reps.
- [ ] Do the starter grant numbers and price levels feel right after a playtest?
- [ ] Decided: the pet store is open from first launch.
- [ ] Decided: first catalog as listed under Default economy config; item ids still to assign.
