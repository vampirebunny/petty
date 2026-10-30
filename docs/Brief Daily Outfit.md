# Brief: Daily Outfit

Oct 30, 2026 · @A

## Overview

Add an opt-in setting that dresses the pet in a new outfit each day, picked automatically from items the player already owns. It is off by default and available from the start, since every player begins with at least one piece for each attachment point.

The goal is a small reason to open the app each day and to keep owned clothing in rotation. The new look is not announced: no greeting change, modal, banner, badge toast, or XP burst. The player just finds the pet dressed differently.

## UI: wardrobe toggle and tooltip

The toggle lives in the existing wardrobe (Closet) screen, directly underneath the Continue button.

- **Label:** "Automatically choose a new outfit each day"
- **Default:** off for every player, including existing test players. A missing field means off.
- **Style:** match the game's glossy, puffy cotton-candy look; a rounded switch, not a system checkbox
- **Turning it on:** stamps today as already picked and remembers the current outfit, then asks "Choose today's outfit?" **Yes** picks now. **Start tomorrow** leaves the clothes alone. Both leave the toggle on. Stamping first means a killed app does not dress them.
- **Turning it off:** the pet keeps whatever it is wearing; nothing is removed

**First-open tooltip**

- Shown once, the first time the player opens the wardrobe after this ships
- Points at the toggle: "Want a new look every day? Turn this on!"
- A tap anywhere on screen dismisses it; the tap does not also trigger whatever is underneath
- Never shown again after dismissal (persist a `seenDailyOutfitTooltip` flag on the player, and restore it with the player doc)
- Use the existing tooltip component so it matches the others in the app

## Outfit picking rules

The picker builds a random outfit from the player's owned clothing only, never shop or try-on items. Owned clothes come from the ledger (`outfitsOwned`), the same list the wardrobe shows.

1. **Owned items only.** Keep items whose wear id exists. If a catalog row lists species, it has to include this pet. Slots with nothing left are skipped, not rolled.
2. **Variable coverage.** Each remaining attachment point is independently filled or left empty. One owned piece in a slot is worn when that slot fills; several are a uniform pick. Suggested starting chance per slot: 50%, kept in config.
3. **At least one item.** If every slot comes up empty and the player owns something eligible, pick one owned item at random so the pet is never bare. If they own nothing eligible, leave the clothes alone and still stamp the day.
4. **One item per attachment point.** Same replace rules as manual dressing in the Closet.
5. **No repeat of the outfit they last ended on.** Compare slot plus wear id to `previousOutfit`. If it matches, roll again (cap retries at 10, then accept). One owned item may repeat.
6. **Light weather/season tilt (optional, never forced).** When the sky at the moment of the pick is raining or snowing, or the season is winter (`seasonAt`, including the southern hemisphere), add 15 points to the jacket and boots chances. Cap the chance at 99 so weather never guarantees a slot.
7. **Patterns and colors are not filtered** in v1; keep the picker simple.

The picker is a pure function (owned items, species, previous outfit, weather tilt, pet seed, local day) → outfit. The seed mixes the pet seed, the local day, and the attempt.

## When it changes, and manual changes

- **Trigger:** the first app open (or return to foreground) after a new local day. The day is `localDay` from the economy clock (the device date, or the signed-in client's UTC offset when one is set). No background job or timer at midnight. The app can stay in the foreground across midnight; the next open picks.
- **Silent:** apply the outfit before the Home scene is published so the pet appears already dressed. Write `equipped` directly. Do not run the equip event, so there is no Try this completion, suggestion XP, closet tutorial credit, `closet_equip` event, badge toast, or XP burst. If this pick is what earns Dressed Up, store the badge and mark its XP skipped so a later publish does not celebrate it.
- **Offline:** works fully offline; it uses only local inventory and the local day.
- **Missed days:** if the player was away several days, pick once on return. Don't generate or store outfits for skipped days.
- **Manual changes while on:** if the player changes anything in the wardrobe, stamp today and set `previousOutfit` to the clothes after that change. Their choice stays for the rest of that day. The toggle stays on, and the next day's auto-pick resumes as normal. Playdate outfits are stored separately and do not count.
- A local day that is not later than `lastOutfitPickDate` does not pick. Setting the clock backward does not pick.

## Data and edge cases

Store on the pet's state (outfits stay with the pet), synced with the rest of pet state:

| Field | Type | Purpose |
| --- | --- | --- |
| `dailyOutfitEnabled` | boolean, missing means false | The toggle |
| `lastOutfitPickDate` | local date string (YYYY-MM-DD) | Prevents more than one pick per day, and holds a manual outfit for the day |
| `previousOutfit` | equipped map, slot to wear id | The outfit the no-repeat rule compares against |

Player-level flag: `seenDailyOutfitTooltip` (boolean), since the tooltip is about the wardrobe, not the pet.

**Edge cases**

- **Item no longer owned or not valid for species:** skip it; never auto-equip something the player doesn't own.
- **Only one owned item total:** wear it; the no-repeat rule can't be met, so accept the repeat.
- **Pet retired/rehomed:** the setting goes with that pet; a new pet starts with the toggle off. Retired pets are not loaded, so the picker does not run for them.
- **Playdates:** unaffected. Players still choose the playdate outfit separately. When a friend picks this pet as a partner, it shows whatever it's wearing.
- **Newly bought items** become eligible from the next pick; buying doesn't trigger a re-pick.

## Out of scope and acceptance

**Do not build:** pinned/locked items, a reroll or shuffle button, personality-based picks, color or pattern matching, shop or try-on items in the pick, any greeting, modal or announcement for the new look.

**Acceptance checklist**

- [ ] Toggle appears under Continue in the wardrobe, off by default
- [ ] Tooltip shows on first wardrobe open only, any tap dismisses it, never returns
- [ ] Turning the toggle on asks "Choose today's outfit?" Yes picks now; Start tomorrow does not. Turning it off removes nothing
- [ ] With the toggle on, the first open of a new local day shows a new outfit with no announcement, badge toast, or XP burst
- [ ] Outfit uses only owned, species-valid items; one per attachment point; at least one item when they own any
- [ ] Outfit size varies day to day (sometimes one item, sometimes all)
- [ ] Never identical to `previousOutfit` when 2+ items are owned, except after the retry cap
- [ ] Rain, snow, or winter only raises jacket and boot odds, and never to a guarantee
- [ ] Manual wardrobe change holds for the day; auto-pick resumes the next day; toggle stays on
- [ ] Several days away = one pick on return
- [ ] Works offline; a local day that is not later causes no pick
