# Boop Boop — Catalog seed brief (rev 2): prices, tiers, limited editions, treats

This replaces rev 1 and works from the schema, ledger, NPC picker and vitality model as they are today.

**What it does:**
- prices the catalog from `boop-boop-catalog.xlsx`, including existing items;
- turns on the new rows (except Rope Tug);
- adds the **exclusive** and **limited** tiers and NPC filtering;
- builds the limited-edition purchase;
- adds price and serial to the ledger;
- ships the new treat design;
- builds the real furniture purchase path.

The shop is one vertical scroll of category rows, each scrolling horizontally.

---

## 1. Schema changes (use the existing names)

**`shop_items`:**
- Add `tier text not null default 'standard'`, checked against `standard` · `exclusive` · `limited`.
- Add `cap int null`, required when `tier = 'limited'`.
- Add `'home'` to the `category` check.
- Add `'featured'` to the `shop` check.
- `species` stays a `text[]`, where null means any.

**`shop_bundles`:**
- Unchanged structure. Add `treat_tin` (25 × `biscuit`) next to `treat_bag` (10 × `biscuit`). Bundles are never `shop_items` rows.

**`limited_editions`** (new): `item_id` (primary key, references shop_items), `cap int`, `sold_out_at timestamptz null`. Readable by `anon` and `authenticated`.

**`limited_units`** (new): `item_id`, `serial`, `user_id`, `request_id`, `status` (`reserved` · `owned` · `released` · `retired`), `reserved_at`, `confirmed_at`.
- Unique on `(item_id, serial)`.
- Unique on `(item_id, user_id)` where `status in ('reserved','owned')`: **one per player**.

**Ledger:**
- `transaction_lines` gains `unit_price int null`, `deal boolean not null default false` and `serial int null`.
- The transaction gains `catalog_version int null`, the shop catalog version, which is separate from `config_version`.
- The request id stays the transaction's `idempotency_key`.

**Catalog version:** the existing trigger on `shop_items` and `shop_bundles` already bumps it, so add no extra bump. Clients pick up the new catalog at their next local midnight, as designed. For testing, add a dev-panel button: **"Apply catalog now."**

---

## 2. The catalog (seed values)

Upsert these `shop_items` rows. Species is shown as the array value. Starter items stay free grants and out of the shop.

| id | name | category | species | tier | cap | shop | price |
|---|---|---|---|---|---|---|---|
| `neckwear:bandana-cherry` | Cherry Bandana | clothes | null | standard | — | always | 500 |
| `neckwear:bell` | Bell Collar | clothes | null | standard | — | always | 600 |
| `neckwear:bow` | Pink Bow | clothes | null | standard | — | rotation | 600 |
| `neckwear:scarf-stripe` | Candy Stripe Scarf | clothes | null | standard | — | always | 700 |
| `neckwear:bandana-gingham` | Picnic Bandana | clothes | null | standard | — | rotation | 700 |
| `neckwear:bowtie` | Navy Bow Tie | clothes | null | standard | — | always | 800 |
| `neckwear:gold` | Gold Stud Collar | clothes | null | standard | — | rotation | 900 |
| `neckwear:bowtie-plaid` | Plaid Bow Tie | clothes | null | standard | — | rotation | 900 |
| `glasses:classic` | Classic Shades | clothes | null | standard | — | always | 800 |
| `glasses:square` | Round Gold Specs | clothes | null | standard | — | rotation | 800 |
| `glasses:heart` | Heart Shades | clothes | null | standard | — | always | 1,000 |
| `glasses:heart-sky` | Sky Heart Shades | clothes | null | standard | — | rotation | 1,000 |
| `hat:beanie-pink` | Pink Beanie | clothes | null | standard | — | always | 900 |
| `hat:beanie-stripe` | Stripe Beanie | clothes | null | standard | — | rotation | 1,000 |
| `hat:cap` | Red Ball Cap | clothes | null | standard | — | always | 1,000 |
| `hat:cap-sky` | Sky Ball Cap | clothes | null | standard | — | rotation | 1,000 |
| `hat:bucket` | Sunny Bucket Hat | clothes | null | standard | — | always | 1,100 |
| `hat:party` | Party Hat | clothes | null | standard | — | always | 1,200 |
| `hat:beret` | Rose Beret | clothes | null | standard | — | rotation | 1,200 |
| `hat:bucket-daisy` | Daisy Bucket Hat | clothes | null | standard | — | rotation | 1,300 |
| `hat:top` | Top Hat | clothes | null | standard | — | rotation | 1,500 |
| `boots:rain` | Yellow Rain Boots | clothes | null | standard | — | always | 1,600 |
| `boots:sneaker` | Classic Sneakers | clothes | null | standard | — | always | 1,600 |
| `boots:rain-blue` | Puddle Blue Boots | clothes | null | standard | — | rotation | 1,600 |
| `boots:sneaker-pink` | Bubblegum Sneakers | clothes | null | standard | — | rotation | 1,700 |
| `jacket:sweater` | Cherry Sweater | clothes | null | standard | — | always | 2,400 |
| `jacket:vest` | Quilted Vest | clothes | null | standard | — | always | 2,400 |
| `jacket:puffer-mint` | Mint Puffer | clothes | null | standard | — | rotation | 2,400 |
| `jacket:sweater-lilac` | Lilac Sweater | clothes | null | standard | — | rotation | 2,400 |
| `jacket:hoodie` | Cozy Hoodie | clothes | null | standard | — | always | 2,600 |
| `jacket:rain` | Yellow Raincoat | clothes | null | standard | — | always | 2,800 |
| `glasses:star` | Star Shades | clothes | null | exclusive | — | rotation | 3,000 |
| `hat:top-velvet` | Midnight Top Hat | clothes | null | exclusive | — | rotation | 3,500 |
| `boots:sneaker-gold` | Gold High-Tops | clothes | null | exclusive | — | rotation | 3,800 |
| `jacket:puffer-rainbow` | Rainbow Puffer | clothes | null | exclusive | — | rotation | 4,500 |
| `hat:crown` | Golden Crown | clothes | null | limited | 500 | featured | 7,500 |
| `squeaky` | Squeaky Toy | toys | {dog} | standard | — | always | 800 |
| `bone` | Chewy Bone | toys | {dog} | standard | — | rotation | 900 |
| `rope` | Rope Tug | toys | {dog} | standard | — | hidden | 1,000 |
| `frisbee` | Frisbee | toys | {dog} | standard | — | always | 1,200 |
| `crinkle` | Crinkle Ball | toys | {cat} | standard | — | rotation | 700 |
| `yarn` | Yarn Ball | toys | {cat} | standard | — | always | 800 |
| `mouse` | Catnip Mouse | toys | {cat} | standard | — | always | 800 |
| `wand` | Feather Wand | toys | {cat} | standard | — | always | 1,400 |
| `laser` | Laser Pointer | toys | {cat} | standard | — | rotation | 2,000 |
| `dogHouse` | Pup Cabana | home | {dog} | standard | 2× bed, open on every side, one per room | always | 6,000 |
| `catTree` | Cat Tree | home | {cat} | standard | — | always | 6,000 |
| `biscuit` | Biscuit | treats | null | standard | — | always | 15 |
| `special` | Salmon Bites | treats | null | standard | — | always | 40 |
| `treat_jerky` | Chicken Jerky | treats | {dog} | standard | — | always | 80 |
| `treat_tuna` | Tuna Flakes | treats | {cat} | standard | — | always | 80 |
| `food_gourmet` | Gourmet Bowl | treats | null | standard | — | always | 60 |
| `food_steak` | Steak Dinner | treats | {dog} | standard | — | always | 60 |
| `food_fish` | Fish Feast | treats | {cat} | standard | — | always | 60 |
| `second_wind` | Second Wind | boosts | null | standard | — | always | 150 |
| `vitamins` | Vitamins | boosts | null | standard | — | coming_soon | — |
**Sort:** the upsert sets `sort` for every row: number each category from 0 in the table's order above (the price ladder).

**Bundles (`shop_bundles`):**
- `treat_bag`: Treat Bag ×10, 10 × `biscuit`, **120** (was 240).
- `treat_tin`: Treat Tin ×25, 25 × `biscuit`, **280**.

**Notes:**
- Rope Tug stays `hidden`.
- `food_fish` becomes `always`.
- The hoodie moves from 1,600 to 2,600.
- No cookie rows.
- `limited_editions` gets one row: `hat:crown`, cap 500.

**Labels: one name everywhere.**
- The shop reads `shop_items.name`; the Closet reads `wardrobe.ts`.
- **Update `wardrobe.ts` labels to the catalog names**, starters included: Red Collar, Blue Bandana, Sunny Scarf, Green Beanie, Red Rims, Orange Puffer, Red Boots, Bell Collar, Pink Bow, Gold Stud Collar, Classic Shades, Round Gold Specs, Party Hat, Top Hat, Yellow Rain Boots, Classic Sneakers, Cherry Sweater, Quilted Vest, Yellow Raincoat, Cozy Hoodie, plus every new item as named in the table.
- Add a test that every wardrobe item with a shop row has the same name in both places.

---

## 3. Shop layout with tiers

**Order:** Today's picks, then the featured spot, then the category rows: **Treats & Food · Clothes · Toys · Home · Boosts**. A row with nothing to show is hidden.

**Category rows:**
- Each row shows `always` and `coming_soon` items for the current pet's species.
- **Treats & Food also shows the bundle cards at its end**, except the bundle that's in the featured spot that day, so nothing appears twice.
- A bundle card adds the bundle to the cart, and checkout grants its contents (10 or 25 biscuits), as `featuredBundle` does today.

**Today's picks:**
- The pool is every `rotation` item, exclusives included, filtered by species and ownership as today.
- The deal rule is unchanged, and an exclusive can be the deal.
- Limited items never appear in picks.

**Featured spot:**
- While a limited edition is on sale (not sold out), it takes the featured spot instead of the bundle cycle.
- When `sold_out_at` is set, the card shows **Sold out** until `sold_out_at + 24 h` by the server clock (from the cached value offline). Then the bundle cycle returns.

**Badges:**
- **Exclusive:** a lavender pill (`#EFE6FF` / `#4B3A8A`).
- **Limited:** a gold pill (`#FFF1B8` / `#6B4600`), plus "**312 of 500 left**" from `units_left` (cached offline).
- **An owned limited item** shows "**#47 of 500**" on its card and in the Closet, read from the purchase line's `serial` **only while the item's inventory quantity is positive**.

---

## 4. Limited editions

### Honest limits
Boops live on the device until IAP receipt validation makes the server the source of truth. So the server can enforce **the cap and one per player**, but it **can't verify payment**: a modified client could take a serial without paying. That's acceptable before launch. When Boops move server-side, `confirm_limited` will debit the server balance. Write it so that check slots in.

Refunds for real-money Boops purchases are out of scope. They'll happen outside the app, through RevenueCat, later.

### Not in the cart
A limited item never goes in the cart. Its featured card has its own **Buy** button, which opens a confirm sheet ("Buy the Golden Crown for 7,500 Boops?") and runs its own purchase, with its own `request_id`.

### One request id per attempt
The client creates a `request_id` **when the confirm sheet opens** and reuses it for the whole attempt: reserve, the local debit (behind the existing idempotency key, so a replay never charges twice), and confirm.

### Units left: public, cached separately
- A **public view** `limited_stock`: `item_id`, `cap`, `units_left`, `sold_out_at`, granted to `anon` and `authenticated`, so the count shows before anyone signs in.
- A unit is **free** if `status = 'released'`, or if `status = 'reserved'` and `reserved_at < now() − 10 minutes`.
- `units_left` = `cap` − the count of rows that are `owned`, `retired`, or fresh `reserved`. No sweep or cron.
- Fetch the view when the shop opens and after each purchase. **Store the snapshot beside the shop, not in `shop_catalog_cache`**: the catalog waits until midnight, but the count changes on every sale. Offline, show the last snapshot.

### Server functions (security definer, `authenticated` only, `user_id` from `auth.uid()`)

**`reserve_limited(item_id, request_id)`** returns a status and a serial:

| Status | When | Client |
|---|---|---|
| `already_owned` | This user has an `owned` row | Show "#47 of 500". **Don't debit.** |
| `reserved` | A row already has this `request_id`, or a new hold was just made for it | **Debit, grant, confirm.** (A retry is safe.) |
| `in_progress` | A fresh hold exists for this user under a *different* `request_id` | Do nothing: don't debit, don't release. |
| `sold_out` | No free serial | Read `sold_out_at`: set means the 24-hour **Sold out** card; null means **"None left right now."** |

Logic (every lookup is scoped to `auth.uid()`):
1. This user's `owned` row returns `already_owned`.
2. This user's row with **this `request_id` and status `reserved`** returns `reserved` with its serial (a safe retry). An `owned` row is step 1 and must not debit. A `released` row with this `request_id` does **not** match; it falls through.
3. This user's **fresh** hold under another `request_id` returns `in_progress` and isn't touched.
4. **This user's own stale hold** (`reserved`, older than 10 minutes) is refreshed in place: same row and serial, new `request_id`, `reserved_at = now()`. Returns `reserved`. This comes before any other serial, because the unique index allows only one held or owned row per player.
5. Otherwise, lock the item's `limited_editions` row:
   - update the lowest free serial **in place** (this user, this request id, `reserved`, now; this includes this user's own `released` row),
   - or insert the next serial if fewer than `cap` rows exist,
   - or return `sold_out`.

**`confirm_limited(item_id, request_id)`:** looks up this user and this `request_id`.
- `reserved` (fresh or stale, as long as it wasn't reassigned) becomes `owned` and returns `confirmed`.
- An already `owned` row returns `confirmed` again.
- **No row** (the hold was reassigned) returns `lost`.
- When **`owned + retired`** reaches `cap`, set `sold_out_at` only while it is null: `sold_out_at = coalesce(sold_out_at, now())`. A resume must not restart the 24-hour window. Retired units never come back, so counting `owned` alone would never reach the cap after deletions.

**`release_limited(item_id, request_id)`:** releases only a `reserved` row whose `request_id` matches. It never releases `owned`, and never another attempt's hold.

### Client flow
1. **Online only.** Offline, the button reads "Connect to buy." A player with no session is signed in anonymously through the existing consent-sync sign-in.
2. The confirm sheet creates the `request_id`, then calls `reserve_limited`, handling the status per the table. Only `reserved` continues.
3. **One local transaction** re-checks the balance, debits Boops and grants the item (an inventory row `hat:crown`, quantity 1), writing `unit_price` and `serial` on the line. **If it fails, call `release_limited`** with the same `request_id`.
4. Call `confirm_limited`. If it can't be reached, queue it with the `request_id`.
5. **Resuming never reserves again.** On the next launch, a queued attempt calls **`confirm_limited` only**: `confirmed` means the grant stands, and `lost` runs the failed purchase reversal. `reserve_limited` runs only when a new confirm sheet creates a new `request_id`.

### Failed purchase reversal (not a refund)
**There are no refunds for Pet Shop purchases.** This is only the automatic undo when `confirm_limited` returns `lost`, meaning the player paid for a unit the server gave to someone else first.
- Only if this `request_id` has a purchase line that hasn't already been reversed.
- Write a reversal transaction on a new key: **+price Boops** and **`hat:crown` delta −1**. That drops the inventory quantity to 0, so the Closet (`outfitsOwned()`) stops showing it. **Leave the serial off the reversal line.**
- If the pet is wearing it, **clear that slot**. Don't touch the AsyncStorage wardrobe; the shop never writes it.
- Show: "Sorry, the last one sold just before your purchase went through. Your Boops have been returned."

### Buy button states
- **On sale:** Buy.
- **`units_left` = 0 and no `sold_out_at`:** the remaining units are only on hold, so the button is disabled with **"None left right now."** Don't start the 24-hour window; units can come back when holds expire.
- **`sold_out_at` set:** "Sold out" until `sold_out_at + 24 h`, then the bundle cycle returns to the featured spot.

### Serials are never resold
- **Account deletion:** keep the rows and change their status. `reserved` becomes `released`, `owned` becomes `retired`. Never delete rows, so serials stay unique.
- `retired` serials are never reissued. Only unpaid holds (`released`, or stale `reserved`) go back on sale.

---

## 5. NPC access

- `wear()` in `src/playdate/npcs.ts` (which retired pets also use) **skips any wardrobe item whose shop row has `tier` `exclusive` or `limited`**.
- Items with no shop row (the starters) count as standard and stay eligible.
- Read the tier from the cached shop catalog. With no catalog yet, treat every item that isn't a starter as ineligible.
- Toys don't need a filter.

---

## 6. Furniture purchase (not the dev grant)

1. **Registry:** build the `defaultSpot` registry from the art brief. For each kind, list its allowed scenes and a default position per scene:
   - `dogHouse`: living room and bedroom.
   - `catTree`: catio and rooms.
2. **Buying:** the `home` row's items use the normal cart and checkout. A purchased kind writes **one owned-furniture row per player per kind**, with piece id = the kind (`dogHouse`, `catTree`). Then it places the piece in the current scene if allowed, otherwise the first allowed scene, at the default spot or the nearest free spot.
3. **Already owned** shows **Owned**, like outfits. No second purchase.
4. **Dev grant:** switch it to this same path (piece id = kind, placed via the registry) instead of `grant-…` ids and a hardcoded coordinate.

---

## 7. Treats

| Item | Role | Rule |
|---|---|---|
| `biscuit` | Training treat | Unchanged |
| `treat_jerky` (dog), `treat_tuna` (cat) | **Energy treat** | Sets energy to **100**. Refused when energy ≥ **95**: "Already full of energy!" **Waive the hunger gate**, so it works on a full pet. Applies one biscuit's casual hunger and weight effect, clamped as usual. Reaction: `hop`. |
| `special` Salmon Bites (any) | **Mood treat** | Sets happiness to **100**. Refused when ≥ **95**: "Already super happy!" Hunger gate waived; biscuit-level hunger and weight. Reaction **by species**: dogs `wag_burst`, cats `purr_headbump`. |
| `food_gourmet` (any), `food_steak` (dog), `food_fish` (cat) | **Premium meal** | Served in the bowl, replacing the kibble for one meal, as today. **When eaten, set hunger to 0 (a full tummy)**, with a weight effect of one normal kibble meal. **Diet quality +0.25** instead of a meal's +0.08 (capped at 1). Over the 7-day care window, this raises the vitality target. **Remove** the XP ×1.5 and energy ×1.2 multipliers and the mood bonuses (gourmet 12, fish 8). Mood is the mood treat's job now. |

**Why premium meals show up slowly:** vitality moves toward the 7-day care target at most `vitalityMaxStepPerDay` (0.03) per day, and never below 0.35. Premium meals raise that target, so a pet fed well **for several days** looks and moves younger. That shows most on seniors (bags, gait), and a little on every grown pet. Don't change the step limit. **Shop description:** "A full tummy, and a healthier diet. Fed for a few days, older pets look and move younger."

**Reactions per species:** a treat definition can hold `reaction` as either one id or `{ dog, cat }`.

**Cleanup:**
- **Merge** `catalog.ts` effects and `treats/kinds.ts` into one treat definition.
- **Remove `softchew`** (its definition and art). If a test install owns some, convert them to biscuits one for one.
- **Biscuit art:** the active pet's species picks it (a bone for dogs, a fish cracker for cats). With no active pet, show the bone.
- **Species filter:** the Pantry and the shop show what the current pet can eat. With no active pet, show everything with a species chip. Owned stacks survive a change of pet.
- Energy and mood treats are casual only; training keeps using biscuits.

---

## Done when

- [ ] Schema uses the existing names (`shop`, `category`, `species text[]`); tier, cap, `home`, `featured` and the limited tables exist; there's no duplicate version bump; "Apply catalog now" works in dev
- [ ] The 56 rows (with `sort`) and 2 bundles are seeded; bundles appear at the end of Treats & Food and aren't duplicated with the featured spot; Rope Tug stays hidden
- [ ] `wardrobe.ts` and `shop_items` names match (test added)
- [ ] Exclusives appear only in picks; the crown appears only in the featured spot with its own Buy flow, never the cart
- [ ] Limited: one `request_id` per attempt; reserve statuses (`already_owned`, `reserved`, `in_progress`, `sold_out`) with step 2 matching only a `reserved` row and a player's own stale hold refreshed first; only `reserved` debits; resume calls confirm only; `sold_out_at` is set once, when `owned + retired` reaches the cap; the serial shows only while the quantity is positive; release matches the request id; confirm returns `confirmed` or `lost`; the failed purchase reversal clears the closet row and the worn slot; the public `limited_stock` view is cached beside the shop; "None left right now" vs. "Sold out"; deletion releases holds and retires owned units; no Pet Shop refunds
- [ ] Ledger lines store `unit_price`, `deal` and `serial`; transactions store `catalog_version`
- [ ] `wear()` skips exclusive and limited items; starters stay eligible
- [ ] Furniture is bought through checkout, one per kind, placed via the registry; the dev grant uses the same path
- [ ] Energy and mood treats set 100, are refused at 95 or more, and skip the hunger gate; premium meals fill the tummy and add 0.25 diet quality; the old multipliers and mood bonuses are gone; `softchew` is removed; treat definitions are merged
