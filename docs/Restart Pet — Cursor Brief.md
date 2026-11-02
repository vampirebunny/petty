# Restart Pet — Cursor Brief

Nov 1, 2026 · @A

Shipped. Migrations `20261101210000_pet_restarted_status.sql` and `20261101220000_restart_pet.sql` are applied.

## Summary

Add a **Restart Pet** action in Settings that replaces the player's current pet with a brand-new one chosen through the normal pet-selection flow. It is a plain game function: no farewell screen, no emotional or retirement language.

The rule: **anything that belongs to the player stays; anything that belongs to the pet is wiped from the player's view.** There is no separate "Reset Game" option. A full wipe is handled by the existing Delete account flow.

Under the hood, the old pet is soft-deleted (status change), not hard-deleted. This is the groundwork for pet retirement later.

## What stays vs what resets

Ownership decides it: player-scoped data is untouched, pet-scoped data is hidden with the old pet.

| Data | On restart | Why |
| --- | --- | --- |
| Account, handle, anonymous guest ID | Stays | Player-owned |
| Friends, friend requests, block list | Stays | Friends are by player |
| Boops balance and Boops ledger | Stays | Player-owned; IAP value must never disappear |
| Treats, toys, boosts (incl. Second Wind) | Stays | Player inventory |
| Wardrobe / Closet items | Stays | Player inventory |
| Furniture and props (beds, Pup Cabana, cat tree, trick props, Treasure Chest), Storage | Stays | Player inventory |
| Player settings (daily outfit toggle, notification prefs) | Stays | Player-owned |
| Pet name, species, breed, coat color, look | Reset | New pet chosen in onboarding |
| Origin archetype, attributes, potential, current style | Reset | Pet-owned |
| Stats: tummy, energy, mood, vitality, weight index | Reset to new-pet defaults | Pet-owned |
| Age and life stage | Reset to day 0 | Pet-owned |
| XP and pet level | Reset | Levels stay with the pet |
| Learned tricks, in-training tricks, trick progress, training rest timer | Reset | Tricks belong to the pet (sit, speak, paw free again) |
| Badges | Reset | Badges stay with the pet |
| Ribbons, trophies, Cover Stars, Crowd Favorite sashes | Hidden | Pet trophies are wiped on restart (unlike future retirement) |
| What the pet is currently wearing | Cleared | Items return to the Closet, still owned |

The confirm copy says nothing about badges, wardrobe or friends. Behavior must still match this table exactly.

## Settings entry and confirmation

A **Restart Pet** row lives on the Settings page (opened from the icon next to the pet's name in the Home header). It is a coral candy button, with no section heading, for guests and signed-in players. On a phone, and on a portrait tablet, it sits immediately above Delete (Log out stays above it when the player is signed in). In landscape on a large window it sits under Music, in the sound column. Delete stays in the account column.

Tapping it opens a confirmation modal in the app's current modal style (cotton candy, glossy buttons):

> **Restart with a new pet?** You'll choose a new pet and start from the beginning. \[Cancel\]  \[Restart\]

- Copy is exactly as above. Do not add lines about badges, wardrobe, friends or Boops.
- Do not use the pet's name anywhere in the modal.
- Cancel is the default (left, bolded). Restart uses the destructive color and sits on the right.
- Tapping outside the modal or Back = Cancel.
- No second "are you really sure" step and no typed confirmation.

## Restart flow

After Restart, the player goes straight into pet selection with no farewell or transition screen.

1. Mark the current pet `status = 'restarted'`, set `restarted_at`, and clear the player's `active_pet_id`.
2. Withdraw the old pet from anything in flight (see Edge cases).
3. Return all items the old pet was wearing to the Closet (ownership unchanged).
4. Open the existing pet-selection onboarding at the species step: species → breed → look/coat → attribute set (1 of 3) → name.
   - Skip the welcome screen, the 13+ attestation, terms and the catalog download. Those are player-level and already done.
   - Skip any first-run tooltips the player has already seen. Tooltip state is player-scoped.
5. On finish, create the new pet record, set it as `active_pet_id`, and land on Home as a fresh pet (day 0, starter tricks, default stats).
6. Room layout and placed props stay exactly as the player left them.

If the player quits mid-onboarding, they resume pet selection on next launch. There is no way back to the old pet from the UI.

## Data model

One player, many pet records, one active pet. Restart only flips a status, so retirement can later reuse the same model with a different status.

- **`pets.status`** is `active`, `retired`, or `restarted`. `restarted_at` is set when a pet is restarted. `retired` already existed and is a different status. Do not call `retire_pet` for a restart.
- The active pet is the row with `status = 'active'`. A unique partial index allows one of those per owner. There is no `players.active_pet_id`. Reads that already filter on `active` hide restarted pets.
- Locally the active pet is the single `pet` row. The old pet moves to `restarted_pets`. A `restart_pending` marker in `meta` keeps the next launch on pet selection until the new pet is saved, including when the player is offline.
- **Pet-scoped tables** (tricks and progress, XP/level, badges, ribbons/trophies/Cover Stars, stats, attributes) keep their `pet_id` foreign key and are **not deleted**. Hide them by filtering on the pet's status.
- **Player-scoped tables** (Boops ledger, inventory, wardrobe, furniture, friends, settings) have no `pet_id` dependency and are untouched.
- `push_active_pet` refuses to write a restarted pet back to active. If a new active pet is pushed while another active row is still there, that leftover row becomes `restarted`, not `retired`.
- `restart_pet` stores the old pet as `restarted`, clears what it was wearing, withdraws an upcoming stadium entry, cancels a friend competition this player is hosting that has not started, withdraws them from one they joined that has not started, and marks runway invites `withdrawn` only when looks are not submitted.
- **No hard deletes.** Support can restore a restarted pet manually by flipping its status back to `active` and making sure no other row is active. No restore UI.
- Delete account still removes all pets, including restarted ones, because `pets.owner_user_id` cascades from `auth.users`.

## Edge cases

Anything in flight for the old pet ends quietly at restart. Nothing is refunded because nothing in these flows costs Boops.

| Situation | Behavior |
| --- | --- |
| Signed up for an upcoming Stadium race | Withdraw the old pet from the lineup |
| Initiated a friend competition (waiting for players) | Cancel it for everyone, same as the Cancel button |
| Joined a friend competition not yet started | Withdraw the player |
| Runway show, looks not yet submitted | Withdraw; the player can still watch and vote as a non-submitter |
| Runway show, looks already submitted | Keep the submission; the old pet walks in that show and its replay |
| Unopened NPC invite ("You're invited!" mail) | Discard it |
| Park find in progress | Discard it; nothing is added to the collection |
| Pending Pet Cam clip | Discard; the away timer restarts with the new pet |
| Scheduled local push notifications about the pet | Cancel them |
| Saved playdates and Past Shows | Stay watchable, showing the old pet as it was |
| Friends at the Park | Friends see the new pet from the next park visit |
| Daily outfit toggle is on | The new pet gets an auto-outfit from owned items on its first day |
| Restart while offline | Works locally; the status change and new pet sync to Supabase when back online |
| Guest (no account) | Same flow, keyed to the anonymous ID |

## Analytics

Log three Firebase events so restarts can inform onboarding tuning:

- `restart_pet_tapped`: the Settings row was tapped.
- `restart_pet_confirmed`, with params: `old_species`, `old_breed`, `old_pet_age_days`, `old_pet_level`, `old_tricks_learned`.
- `restart_pet_completed`, with params: `new_species`, `new_breed`, `seconds_to_complete`.

The gap between tapped and confirmed shows how often the modal stops people. Old vs new species shows whether players are fixing a dog/cat choice.

## Open questions

Decided with the defaults below.

- [x] **Species-specific items after a species switch** (e.g. cat tree placed in a room when the new pet is a dog, or any wardrobe item that only fits one species). Keep everything owned. Leave placed props where they are.
- [x] **Park finds collection (Treasure Chest)**: the collection stays. It is stored on the pet document, so the new pet receives `items` and `firstFindVisitDone`. An in-progress find and an unrevealed modal are dropped. The chest furniture stays.
- [x] **Playdate cooldown**: carry over. The cooldown is per player.

## Acceptance criteria

- [x] Settings shows a Restart Pet row, for guests and signed-in players.
- [x] The modal copy matches exactly; Cancel is the default; no pet name appears.
- [x] Confirming goes straight to species selection, skipping welcome, attestation and catalog download.
- [x] The new pet starts at day 0 and level 1, with sit and speak unlocked and paw in the starter set but still locked until a prerequisite, the same as a first pet. No badges, no trophies, default stats.
- [x] The Boops balance, inventory, Closet items, furniture, room layout and friends are identical before and after.
- [x] The old pet's row still exists in Supabase with `status = 'restarted'`, and its tricks, badges and awards rows are intact but hidden.
- [x] Restarting a pet with an upcoming race, open friend competition or unsubmitted runway show withdraws it cleanly, with no orphaned lobby.
- [x] Restart works offline and syncs on reconnect.
- [x] Delete account still removes restarted pets.
- [x] All three analytics events fire with their params.
