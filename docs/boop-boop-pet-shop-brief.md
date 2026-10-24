# Boop Boop — Pet Shop brief (v2)

Build the Pet Shop: the place where players spend Boops on treats, food, clothing, toys and boosts. This covers the first page only. The item detail view, the Toy Box page, events, and IAP are out of scope. Vitamins ship as a Coming soon card. Section 10 moves the shop catalog to Supabase.

The "Boop Boop pet shop" design canvas (Pet Shop artboard) is the reference for **layout, states and flow only**. Its item names, prices and art are illustrative. This round's items and prices are placeholders (section 1). Use the app's existing fonts, the cotton candy glossy button style from the Home restyle, the Boops paw-coin icon, the existing pet renderer and the existing item art.

This version replaces v1 and answers your review. Build it in two phases: sections 1–9 on a local placeholder file, then section 10 moves the shop catalog to Supabase.

---

## 1. Placeholder items and prices

Building the real catalog (items, prices, art) is a separate body of work. This round, the shop runs on **placeholder data** so the page, picks, deal and checkout can be built and tested end to end. Keep the placeholder data easy to replace.

- **Use only items that already exist in `src/economy/catalog.ts`,** under their existing ledger ids. Don't create new items or ids. **One exception:** `coming_soon` entries are display-only and never bought, so they don't need a `catalog.ts` row (e.g. `vitamins`).
- **Their current `catalog.ts` prices are the placeholder prices.** Where a sold item has no price yet (e.g. the toys), add a placeholder price in `catalog.ts`. Never keep a second price list; the shop, the Pantry, the break pop-up and the Closet all charge from `catalog.ts`.
- **Put the shop-only data in one new file, `src/economy/shopConfig.ts`,** marked as placeholder at the top: the per-item shop fields below, the bundles, and the settings (`pickSlots`, `noRepeatDays`, `dealPct`). The catalog work will replace this file later without touching the shop code.
- **No Supabase catalog in phase 1.** Phase 2 (section 10) moves it there.

### Shop fields per item (in `shopConfig.ts`, keyed by item id)

| Field | Notes |
|---|---|
| `shop` | `always` · `rotation` · `coming_soon` · `hidden`. Starter items and anything not sold are `hidden`. `coming_soon` shows the card with no price or buy button. |
| `category` | `boosts` · `clothes` · `toys` · `treats` (shop section), if not already derivable from `kind` |
| `species` | Optional, e.g. `['dog']`. Omitted means any pet. |
| `isNewUntil` | Optional local calendar date, `YYYY-MM-DD`, inclusive. Shows the NEW badge through that date. |
| `description` | Optional one line, e.g. "Ends a trick's rest early" |
| `sort` | Order inside a category |

Drop `min_renderer` for now; nothing compares against it until the catalog is remote.

### Bundles

Add bundles to `shopConfig.ts`: `{ id, name, price, contents: [{ itemId, qty }], description }`. The placeholder bundle is **Treat Bag ×10**: 10 × `biscuit` for **240** (10 loose would be 300, so "Save 20%").

### What the shop sells this round (placeholder)

| Tab | Items |
|---|---|
| Treats | `biscuit` (30), `special` (60, casual only, see below), `food_gourmet` (50), Treat Bag ×10 bundle |
| Clothes | The paid `slot:wearId` outfits at their live prices (500–1600) |
| Toys | `frisbee` (400, dog), `squeaky` (300, dog), `yarn` (300, cat). Add them to `catalog.ts` as toy rows with these placeholder prices. |
| Boosts | `second_wind` (120); a `vitamins` entry in `shopConfig.ts` only, with `shop: coming_soon` and no price, so the card is data, not hardcoded |

- **Starter items stay free grants and are not in the shop:** the 10 starting biscuits, the ball, and the starter wardrobe (including `hat:beanie`). Keep them `hidden`, as today. Biscuits are still sold; only the free starting 10 are a grant.
- **`special`:** set it available. It's casual only this round (training effect stays null), per the currency doc.
- **`food_fish`:** leave it out of the shop (`hidden`).
- **Rope Tug:** not sold. It has no play rule.
- **Prices:** the current `catalog.ts` prices. Ignore v1's prices.
- **Rotation split:** pick a placeholder split yourself, about half the paid outfits and one toy per species as `rotation`, so picks and the deal have something to work with. No need to confirm it.

---

## 2. Species

- **Toys the current pet can't play with are hidden** everywhere in the shop: categories, picks and the deal. A cat is never offered a frisbee.
- Clothes work for dogs and cats, so they have no species.
- Bought toys still belong to the player. A future pet of the other species can use them if the species fits.

---

## 3. Today's picks

Picks refresh at the player's **local midnight**, including live while the shop is open. The countdown chip counts down to it.

**Slots:** one pick per slot in `pickSlots = ["clothes", "toys", "treats_or_boosts"]` (configurable in the catalog/config file). No `picks_count`; the slot list is the count.

**For each slot, in order:**
1. **Eligible** = items in the slot's categories with `shop` `rotation` or `always`, for this pet's species, not owned (non-stackable), and not already picked today.
2. **Prefer fresh:** remove items shown in this slot in the last `noRepeatDays` days (config, 5). If that leaves nothing, ignore the history.
3. **Prefer rotation:** if any eligible item is `rotation`, choose among those; otherwise choose among `always`.
4. **Choose** with a deterministic seeded PRNG (e.g. mulberry32) seeded by `hash(localDate + slot)`.
5. If nothing is eligible, the slot is empty. **Show fewer picks**; never show an Owned card in picks.

**Store the day's picks locally** (`{ date, picks, dealId }`) and keep a short per-slot history of past picks for step 2. Recompute only when the date changes. A catalog change mid-day doesn't reshuffle today.

**Buying a pick:** it's owned immediately, but the day's picks aren't recomputed until midnight. Keep the stored picks, hide the one the player now owns, and don't fill the gap. If the bought pick was the deal, there's no deal for the rest of the day.

Known gap, fine for now: changing the device clock changes the picks.

---

## 4. Deal of the day

- **Every day, one pick is the deal.** The deal is the first `rotation` pick in slot order (clothes, then toys). If neither pick is `rotation`, the deal is the clothes pick; if there's no clothes pick, the toys pick. **Consumables are never discounted** (treats, food, Second Wind), so the treats-or-boosts pick is never the deal. If no pick qualifies, there's no deal that day.
- **Price:** `round(price × (100 − dealPct) / 100)`, with `dealPct` 20 in config.
- **One discount per card, ever.** The deal applies to single items only. Bundles have their own fixed price and are never the deal. Events don't exist this round. So no stacking rules are needed; the DEAL badge never appears with "Save N%".
- **On the card:**
  - a gold glossy **"DEAL −20%"** badge on the top-right corner, slightly tilted and overlapping the card edge
  - a line under the name: "Deal of the day · ~~1,200~~"
  - the discounted price in the price row
- **Where the deal price applies:** the pick card, the cart line, the total and the charge. If the deal item also appears in its category (an `always` item), its category card shows the same deal price and badge.
- **Midnight with a deal item in the cart:** reprice it to full price, update the total, and show a short note in the cart: "Today's deal ended. Price updated." This is intended.

---

## 5. Featured spot

No events this round. The featured card cycles through bundles by day (`bundles[day % bundles.length]`), so for now it's always the Treat Bag. Card: "BUNDLE" label, name, description, price, the struck-through value of its contents (300), a "Save 20%" ribbon, and Add or a stepper.

---

## 6. Page layout (match the mockup)

Top to bottom:

1. **Header:** Back, "Pet Shop", Boops balance pill.
2. **Pet stage, fixed at the top while the rest scrolls:**
   - The current pet in the shop scene (awning, shelves, floor), **wearing its current outfit**.
   - **Try-on:** clothing in the cart is drawn on top of that, by slot (`hat`, `glasses`, `neckwear`, `jacket`, `boots`), using the existing wardrobe renderer. It's a preview only; checking out or leaving the shop shows the pet's own outfit again.
   - **Two items for one slot in the cart:** the one added most recently is the one shown. The other stays in the cart; its card says **In cart** instead of **Wearing**.
   - The chip says "Trying on: Rain Boots", or "Add clothes to try them on" when no clothes are in the cart.
3. **Today's picks:** a horizontally scrolling row on a butter-yellow shelf, plus the countdown chip.
4. **Featured bundle card.**
5. **Categories:** Boosts, Clothes, Toys, and Treats, all on the page under the bundle. Each section has a title and where items go: "Goes to your Pantry", "Try on, then Closet", "Goes to your Toy Box". There is no tab bar.
6. **Item rows:** each category is a horizontal scroll of `always` and `coming_soon` items, filtered by species. Cards are a fixed width so the next one peeks in. `coming_soon` cards sort after the buyable ones in their category. A category with nothing to show is omitted.

**Card states:**

| State | Shows |
|---|---|
| Not in cart | Price + **Add** (clothes say **Try on**) |
| Stackable, in cart | − qty + stepper |
| Clothes, in cart and shown on the pet | Pink **Wearing**. Tapping removes it from the cart. |
| Clothes or toy, in cart but not shown | Pink **In cart**. Tapping removes it from the cart. |
| Owned (bought non-stackable) | Lavender **Owned**, no price |
| Coming soon | "Coming soon", no price |

Badges: NEW (pink, top-left) through `isNewUntil`; DEAL (section 4); "Save N%" on bundles only. All tap targets at least 44 px.

---

## 7. Cart and checkout

- **Cart bar:** appears only when the cart has items; floats at the bottom with a pop-in; shows "3 items" and the total. Tapping it opens the cart sheet.
- **Cart sheet:** each line shows the art, the name, where it goes, a stepper (stackable) or Remove, and the line total; then Total, "You have", "After checkout", and a gold glossy **"Buy for N Boops"** button.
- **Not enough Boops:** the button is dimmed and disabled, with "You need N more Boops. Play with {pet} to earn more!"
- **The cart is session-only.** It clears when the player leaves the shop.

### `purchaseCart(lines, requestId)`: a new single transaction

Don't loop over `purchase()`. Add one function that, inside one SQLite transaction:

1. **Prices every line from `catalog.ts` and today's stored deal.** Never trust prices held in the cart.
2. **Expands bundles and merges by asset.** A Treat Bag plus 3 loose biscuits becomes one `biscuit` line of 13, so `(transaction_id, asset)` stays unique. The charge is still the sum of the priced cart lines (bundle at 240, loose biscuits at 30 each).
3. **Checks the balance**, then writes one transaction with its lines and debits Boops, keyed by `requestId` so a double tap can't charge twice.
4. **Grants to the player, never the pet:**
   - treats, food, Second Wind → inventory (qty)
   - clothes → owned outfits (`slot:wearId`)
   - toys → `owned_toys` for this owner
5. **Doesn't change what the pet wears.** Bought clothes go to the Closet unworn, and the player puts them on from there. Try-on is only a preview: after checkout, the pet stage shows the pet's own outfit again.

**Ownership:** everything bought belongs to the player and is kept when a pet is retired or rehomed. The pet only stores what it's currently wearing.

If anything fails, nothing is charged or granted. Then queue a `player_state` push through the existing single sync queue. Checkout never changes the pet, so it needs no pet push.

**Celebration:** full-screen overlay with the spinning, bouncing 3D Boops coin, "Yay! {pet} loves it!", "−N Boops", one line per item ("Frisbee → Toy Box"), and **Keep shopping**. If the purchase included clothes, add a second button, **Open Closet**, that goes to the Closet. The pet barks or meows happily. No speech balloons.

---

## 8. Toys in play

`owned_toys` already belongs to the player, and `grantToyOnce` already grants the ball. Point the play toy list and the toy picker at `toysOf()`, filtered by the current pet's species, instead of `ownsBall`. A bought frisbee, squeaky or yarn must show up in play right after checkout. The Toy Box page is a separate brief.

---

## 9. Second Wind and entry points

- **Keep the break pop-up's one-tap buy-and-use** when the player has no Second Wind but can afford one. It now charges the `catalog.ts` price, the same as the shop.
- **When they can't afford it**, the button opens the Pet Shop. Boosts is the first merch category.
- Other entry points: a Pet Shop entry wherever the Closet and Pantry are reached, and the Pantry's shop button.
- **Rename "Pet Store" to "Pet Shop" everywhere:** the Pantry, the out-of-treats modal and the break pop-up.
- The shop is available from first launch.

---

## 10. Phase 2: move the shop catalog to Supabase

Prices, names, and where an item sits on the shelf live in Supabase. New colorways and treats that reuse a shape, pattern, reaction, and effect this app already knows can be added with a `def` on `shop_items` and no app release. See [remote item defs](remote-item-defs.md). The notes below are the original phase 2 brief.

Do this after phase 1 (sections 1–9) works on the local placeholder file. The goal is to have the Supabase plumbing in place before the real catalog work, and to let me tune placeholder prices and the rotation split live while testing.

**What moves and what stays:**
- **Moves to Supabase:** everything that's data. Shop fields, prices, names, bundles and the settings (`pickSlots`, `noRepeatDays`, `dealPct`).
- **Stays in `catalog.ts`:** what items *do*. Effects, kinds, slots and render keys, keyed by the same ids. An id in Supabase with no definition in code is skipped, so an older build never shows an item it can't draw or use. **Exception: `coming_soon` rows** render without a code definition, as display-only cards that can never be added to the cart. Draw their art from `render` if the app knows that key; otherwise use a generic wrapped-gift placeholder.
- **Prices leave `catalog.ts`.** After phase 2, the only price source is the loaded shop catalog.

**Tables** (read-only for clients; I edit them in the Supabase dashboard):
- `shop_items`: `id` (the ledger id), `name`, `category`, `price`, `shop` (`always` · `rotation` · `coming_soon` · `hidden`), `species` (text array, null = any), `is_new_until` (date), `description`, `sort`, `active`
- `shop_bundles`: `id`, `name`, `price`, `contents` (jsonb `[{ itemId, qty }]`), `description`, `sort`, `active`
- `shop_config`: one row with `pick_slots`, `no_repeat_days`, `deal_pct`
- A catalog version (e.g. `shop_config.version`, bumped by a trigger on any change)

RLS: `select` for both `anon` and `authenticated`. The catalog isn't private, so the app reads it with **no session at all**, and the fetch doesn't depend on anonymous sign-in. No client inserts, updates or deletes.

**Seeding:** turn `shopConfig.ts` plus the placeholder prices into a seed script under `scripts/` that writes these tables. Then remove `shopConfig.ts` from the app.

**Loading:**
- **First fetch** happens during onboarding, right after the player adopts a pet (start it in the background as soon as onboarding begins if that's easy).
- **After that,** check the version on every app open and return to the foreground, when online. If it changed, download the full catalog and cache it locally in SQLite.
- **A newer catalog takes effect at the next local midnight**, so today's picks, deal and prices never change mid-day. The very first load applies immediately.
- **No bundled copy ships in the app.**

**Before the catalog has ever loaded:**
- The Pet Shop shows a friendly state in the shop's style: "The shop is opening soon! Connect to the internet to visit." The app keeps retrying in the background.
- The break pop-up hides the one-tap Second Wind buy and shows only the rest countdown.
- Nothing else depends on the shop catalog. Starter grants, training, Pantry, Closet and play work offline as before.

**Checkout** prices every line from the active cached catalog and today's deal, exactly as in phase 1.

Phase 2 is done when:
- [ ] Changing a price in the Supabase dashboard shows up in the app from the next local midnight after the next launch
- [ ] A fresh install that goes through onboarding online has a working shop, even if it goes offline afterward
- [ ] A fresh install that's offline the whole time shows the "opening soon" state, and the break pop-up has no buy option
- [ ] Prices exist only in Supabase; effects exist only in `catalog.ts`
- [ ] The catalog loads with no session (a guest who never signed in anonymously); no client can write to it

---

## Out of scope

The real catalog (new items, final prices, new art), item detail sheet, Toy Box page, Vitamins (Coming soon card only), events and `shop_events`, IAP and Boops packs, server-side price validation.

## Done when

- [ ] Prices come only from `catalog.ts`; shop-only data lives in the placeholder `shopConfig.ts`; the shop and the break pop-up charge the same Second Wind price
- [ ] Starter items (starting biscuits, ball, starter wardrobe) don't appear in the shop
- [ ] A cat is never offered a dog toy, and vice versa
- [ ] Picks refresh at local midnight, avoid the last 5 days where possible, never show owned items, and drop to fewer picks rather than repeat or show Owned
- [ ] One non-stackable pick is the deal, with the badge, struck price and discounted charge; consumables are never discounted
- [ ] A deal item in the cart reprices at midnight with the "deal ended" note
- [ ] The pet stage shows the current outfit with cart clothes on top; the latest item per slot wins
- [ ] `purchaseCart` is one transaction, merges bundle contents by asset, and can't double charge
- [ ] Checkout never changes the pet's outfit; bought clothes appear in the Closet and bought toys in play right away; checkout pushes only `player_state`
- [ ] "Pet Store" is renamed to "Pet Shop" everywhere
