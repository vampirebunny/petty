# Cursor Brief: Boops Earnings & Pet Shop Pricing

Nov 2, 2026 · @A

## Overview

Free Boops shift from a flat daily allowance to rewarding play, and Pet Shop prices are rebuilt around what an engaged free player earns in a day (\~850 Boops). Second Wind goes to 250 Boops and now also gives +10 energy.

- **Time clock cap drops from 600 to 400 per local day.** The difference moves into active sources: first open, a 7-day streak, suggested activities, playdates, competitions and park finds.
- **Clothing has one price per shape.** Handmade pieces and every colorway of a shape cost the same. Exclusive and limited pieces are a fixed multiple of the shape price.
- **Toys, treats, boosts and home items get new prices.** Consumables become cheaper, small, frequent buys.
- **Unchanged:** Boops IAP pack prices (600 Boops = $0.99), the 1,000-Boop starting balance, the 50-Boop level-up payout, the 20% daily deal, and mini-games paying no Boops.

The goal: free players always have something to buy within 1–3 days, and spenders buy Boops to avoid missing time-limited items, not because prices are punishing.

## Free Boop grants

A passive player earns about 450 Boops a day (400 from the clock and 50 for the first open). A full clear is about 890 on a normal day and about 1,015 on day 7, when the streak bonus replaces that day's share of the average. Early game runs higher because level-ups come fast. Trick mastery (100) and a new life stage (200) stay; they are one-time and do not change daily income. All daily caps reset at local midnight.

The login ladder, the 150 welcome-back Boops, and play-find Boops are gone. The welcome-back greeting stays. Mini-games still pay nothing.

| Source | Boops | Daily cap | Rule |
| --- | --- | --- | --- |
| Time clock | 1 per minute | 400 | Was 600. Live payouts stay every 15 Boops. A return pays the exact amount. Ledger source `time_clock`. |
| First open of the day | 50 | 50 | Once per accepted local day. A foreground session that crosses midnight claims the new day then. |
| 7-day streak | 150 | — | Paid on day 7, on top of the 50. The next open is day 1. One missed local day does not reset the streak. Two missed days restart at day 1, still pay the 50, and show no message. |
| Suggested activities | 40 each | 120 | The first 3 completions of the daily list. Tutorial completions pay nothing. Later daily ones still count for progress. |
| Playdates | 30 each | 120 | The first 4. NPC and friend playdates both count. |
| Competitions | 10 for finishing, 30 for a top-3 finish | 100 | A top-3 finish pays 30 total. A did-not-finish pays 0. Friend games pay 0. Pay whatever is left in the cap, so a day at 90 ends with 10. |
| Park finds | 25 per find | 75 | Three finds. Later finds still join the collection. XP stays first-find-only. |
| Level-up | 50 | — | Unchanged. |
| Trick mastered | 100 | — | Unchanged, once per trick. |
| Life stage | 200 | — | Unchanged, once per stage. |
| Mini-games | 0 | — | Unchanged: leaderboard only. |

A suggested playdate, race, or find pays its own grant and the 40.

Every grant uses the existing gold paw-coin burst and the count-up of the Boops total at top right. Grants claimed on the same open (first open, streak, return time payout, and any level-up or milestone already waiting) are one burst and one count-up, with one ledger row each. A live 15-Boop tick stays its own burst.

## Pet Shop prices

All prices live in the Supabase catalog. Update the catalog rows; don't hardcode prices in the app.

### Clothing: one price per shape

Every handmade piece and every colorway of a shape costs the shape price. Theme and rarity don't change it, except for the two multipliers below.

| Shape | Boops |
| --- | --- |
| Bandana, Bow | 500 |
| Collar | 600 |
| Scarf | 700 |
| Bow Tie | 800 |
| Round Specs, Rims, Shades, Star Shades, Heart Shades | 900 |
| Beanie | 1,000 |
| Ball Cap | 1,100 |
| Bucket Hat | 1,200 |
| Party Hat | 1,300 |
| Beret | 1,400 |
| Top Hat | 1,800 |
| Boots, Rain Boots, Sneakers, High-Tops | 2,000 |
| Sweater, Vest | 2,800 |
| Puffer, Hoodie | 3,200 |
| Raincoat | 3,600 |

The Golden Crown (hat:crown) is hidden and inactive, so it cannot be bought. An owned crown still draws, and its closet serial stays.

- **Exclusive** (e.g. Rainbow Sherbet): 1.25 × shape price.
- **Limited** (e.g. Midnight Stars): 1.5 × shape price.
- Round multiplied prices to the nearest 50. Store the final price on each catalog row rather than computing it at runtime. Examples: Midnight Stars Top Hat = 2,700; Rainbow Sherbet Puffer = 4,000; Rainbow Sherbet Bandana = 650.
- Gold Stud Collar, Navy Stripe Beanie, Daisy Bucket Hat, Bubblegum Sneakers, Red Plaid Bow Tie and Red Gingham Bandana drop to their shape price.

### Toys

| Item | Boops |
| --- | --- |
| Blue Crinkle Ball | 600 |
| Squeaky Duckie, Pink Yarn Ball, Lilac Catnip Mouse | 800 |
| Mint Chew Bone | 900 |
| Red Rope Tug | 1,000 |
| Blue Frisbee | 1,200 |
| Feather Wand | 1,500 |
| Purple Laser Pointer | 2,000 |

### Treats, food and boosts

| Item | Boops |
| --- | --- |
| Biscuit | 10 |
| Treat Bag ×10 | 80 |
| Treat Tin ×25 | 175 |
| Salmon Bites | 120 |
| Chicken Jerky, Tuna Flakes | 150 |
| Gourmet Bowl, Steak Dinner, Fish Feast | 200 |
| Second Wind | 250 (see next section) |

### Home

| Item | Boops |
| --- | --- |
| Extra food bowl, Extra water bowl | 600 |
| Standard Bed | 2,500 |
| Scratch Pole | 3,000 |
| Marshmallow Mat, Cushion Stack (2× energy tier) | 5,000 |
| Peach Chaise, Sultan Pillow (2.5× energy tier) | 7,500 |
| Pup Cabana | 9,000 |
| Cat Tree | 10,000 |

The 20% daily deal still applies to that day's rotating item, using the new price. The "2×" and "2.5×" home rows keep their faster-rest multipliers; only the Boop prices change. Client price pins no longer override a downloaded catalog.

## Second Wind

Second Wind costs 250 Boops (was 500). It still ends the training rest, and now also adds +10 energy.

- **Energy:** +10 points, capped at 100 (`min(10, 100 - energy)`). At 100 the cookie still ends the rest and the energy is lost. Don't block use. The 5-uses-per-pet daily limit stays, and the sheet still hides the row after that.
- **Feedback:** the existing perk-up still plays. When energy actually increases, also play a burst on the pet plus a short sound. The burst must not look like the Boops coin burst. The sound is new; use a placeholder until the final file is added. No nap or sleep animation or naming.
- **Break modal:** unchanged aside from the cookie line. It shows the cookie and owned quantity even at 0, and at 0 offers "Visit Pet Shop." The cookie description, in the modal and the shop, is "Ends the training break and gives +10 energy." The "stay focused longer" body line stays.

## Implementation notes

Every amount and cap in this brief is tuning data, so it belongs in config rather than code.

- **Config:** grant amounts, daily caps, the streak length, bonus, and grace (default 1), the exclusive/limited multipliers, and Second Wind's energy amount live in `economy_config`, downloaded with the catalog. The bundled default covers offline play. Stored catalog prices do not recompute when a multiplier changes.
- **Ledger:** write every grant with a source (`time_clock`, `first_open`, `streak`, `activity`, `playdate`, `competition`, `park_find`, `level_up`, `milestone`) and the local day it counted against. Count daily caps from those rows. Trick mastery and life stage stay on `milestone`.
- **Local day:** a new day counts when server time has entered it in the last trusted timezone, including a real midnight a few minutes after the previous open. A backward clock or a timezone change alone does not count. The 20-hour trusted gap is the fallback when a day has to be accepted without a matching server day. Offline, grant at most the next local day and reverse it on sync if the device was ahead.
- **Analytics (Firebase):** log each grant with source and the amount actually paid. The clock stays `session_accrual` or `away_payout` under the one `time_clock` ledger source. Shop spends include whether that item was the daily deal. `second_wind_used` includes `energy_gained` (points actually added, or 0).
- **Migration:** `20261102120000_boops_earnings.sql` is applied on the hosted project. No real players yet, so it resets catalog prices in place rather than migrating balances.

**Out of scope:** Boops IAP pack pricing, Training School trick and furniture-trick bundle prices, a new mid-tier dog home item (not designed yet), and the starting balance.

## Acceptance checklist

- [ ] Time clock stops at 400 per local day. Live payouts stay every 15. Away payouts stay exact.
- [ ] First open pays 50 once per accepted local day. Day 7 pays an extra 150, then the next open is day 1. One missed day does not reset the streak. Crossing midnight in the foreground claims the new day.
- [ ] Suggested activities, playdates, and competitions pay only up to their daily caps. A top-3 finish pays 30, or whatever is left in the cap. Tutorial suggestions pay no Boops. Friend games and a did-not-finish pay 0.
- [ ] Park finds pay 25 up to 75 a day. Later finds still join the collection. XP stays first-find-only.
- [ ] Combined grants show as one coin burst with the count-up.
- [ ] Catalog prices match the tables; all colorways of a shape cost the same; exclusive and limited prices are stored, rounded to 50.
- [ ] Daily deal takes 20% off the new prices.
- [ ] Second Wind costs 250, ends the rest, adds +10 energy (capped at 100) with its own burst and sound, and its description mentions the energy.
- [ ] Changing the device clock or time zone doesn't grant extra daily caps or streak days.
- [ ] Every grant is in the ledger with its source, and the Firebase events fire.
