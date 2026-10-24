# Cursor Brief: Accounts, Cloud Sync & Friends (Boop Boop)

**Accounts, sign-in, restore, and deletion are superseded by `docs/boop-boop-accounts-brief-v14.md`.** That brief drops email OTP and sign-out. A guest who signs into an existing account is asked once, then the account replaces the device. There is no Keep / Cancel choice and no sign-out in v1. Handle rules below still stand. Friend search, requests, and blocks are not built yet.

## Goal
Let guests create a full account without losing their pet, give every account a unique handle, sync game data to Supabase, and let users find each other by handle, send friend requests, and block. Real friend playdates come in the next brief; this one builds the foundations.

Builds on the guest identity layer (anonymous Supabase user + local `ownerId`) and NPC playdates (snapshots, records, relationships).

## Principles
- **Same user ID forever.** Signing up upgrades the anonymous user in place. All data keyed to `user_id` carries over with no migration.
- **Still local-first.** The game stays fully playable offline. Sync runs when online.
- **Friends only by handle.** No phone numbers, contact matching or friends-of-friends suggestions. Users find each other by searching handles.
- **Safety built in.** Requests need acceptance, blocks are enforced server-side, and there's reporting for handles and pet names (required by Apple and Google once users can see each other's content).

## 1. Sign-in
- Methods: **Sign in with Apple, Google, and email with a 6-digit code** (Supabase email OTP). No passwords, no magic links.
- Entry points: a "Create account" prompt in settings, plus soft prompts at natural moments (e.g. after the first playdate, or when tapping Friends). Never block play to force sign-up.
- **Upgrading the guest:** while signed in anonymously, use `linkIdentity` (Apple, Google) or `updateUser({ email })` plus OTP verification. The `user_id` stays the same.
- **Existing-account conflict:** if the identity already belongs to another account (e.g. a returning user on a new phone who played as a guest first), linking fails. Then:
  - Sign in to the existing account instead.
  - If the device has a guest pet, show: "You already have an account with **[their pet]**. This device has **[guest pet]**." with options **Keep [their pet]** (discard the guest data) and **Cancel**.
  - Never silently merge or overwrite pets.
- **Sign-out:** confirm that pending sync has finished (or warn that unsynced progress will be lost), clear local data, and return to onboarding as a new guest.

## 2. Handle
Shown as the screen right after the first successful sign-in. It can't be skipped, because an account isn't finished without a handle.
- **Rules:** letters and numbers only (`^[a-zA-Z0-9]{3,20}$`). Store the lowercase form for uniqueness; the user's capitalization can be kept for display.
- **Unique regardless of case:** unique index on `handle_lower`.
- **Blocked:** a `reserved_handles` table (boopboop, admin, support, official, moderator, help, etc.) and a profanity filter, including common letter-for-number swaps.
- **UI:** label it "Your handle — friends use this to find you." Prefill a suggestion from the pet's name (e.g. `biscuitsmom`, `biscuit482`). Check availability as the user types (debounced ~300ms) with a ✓ or "Taken," and offer 2 or 3 available alternatives when taken. The unique constraint is the final check on submit; if it fails, show "Just taken — try another."
- **Changing it:** allowed once every 30 days, from settings. A released handle is **held for 30 days** before anyone else can claim it, to prevent impersonation.

## 3. Cloud sync
### What syncs
| data | strategy |
|---|---|
| pet state | one document per pet; last write wins by `updated_at`, with a `version` counter |
| playdate records | append-only; never conflict |
| NPC snapshots | append-only per owner |
| relationships | per (pet, partner); merge by taking the higher `bond` and `playdateCount` |
| cooldown (`lastPlaydateCompletedAt`) | take the latest |
| guest compliance | already in Supabase from the guest layer |

### How
- Keep a local outbox of changed records. Push on foreground, network reconnect, and every few minutes while active. Pull on launch and after sign-in.
- A sync module sits behind the existing storage layer, so game code doesn't change.
- On first sign-in from a fresh install (no local pet), pull everything and hydrate the local store before showing the game.

## 4. Friends
### Search
- A search bar on the Friends screen. Searches by handle prefix (starting at 3 characters), case-insensitive, up to 20 results.
- Each result shows the handle plus the pet's name, species and breed, and a small avatar rendered from the pet's snapshot.
- Search excludes: the user themselves, anyone either side has blocked, deleted accounts, and users with search turned off.
- **Setting:** "Let others find me in search" (default on). When off, the user can still send requests but can't be found.
- Run search through an RPC (`search_handles`), not direct table reads, so block and visibility rules are always enforced.
- **Share my handle:** a button that opens the share sheet with "Add me on Boop Boop: @handle". Plain text only, no deep links in this pass.

### Requests
- Actions: send, cancel (sender), accept, decline (receiver). Declines are silent; the sender just sees no change. Accepting creates a friendship.
- If both users send each other a request, the second one auto-accepts.
- Limits: at most 50 outgoing requests per day and 100 pending outgoing at once. Re-requesting someone who declined is limited to once every 7 days.
- The Friends screen has three tabs or sections: **Friends**, **Requests** (incoming, with a badge count), **Sent**.
- Notifications are an in-app badge only; push is out of scope.

### Friends list
- Shows each friend's handle and a pet card (name, breed, age stage, current style, avatar).
- **Unfriend** is available from a friend's card and is silent.

### Blocking
Available from search results, incoming requests, and friend cards.
- Blocking removes any friendship and cancels pending requests in both directions.
- The blocked user can't find the blocker in search, can't send requests, and can't see their pets or playdates. The blocker doesn't see them either.
- It's silent: the blocked user is never told. To them, the blocker just looks unfindable.
- A **Blocked users** list in settings allows unblocking. Unblocking doesn't restore the friendship.

### Reporting
Available alongside blocking. Reasons: offensive handle, offensive pet name, impersonation, other. Reports go to a `reports` table for manual review. After reporting, ask "Also block @handle?" Add a simple admin query or view to list open reports, and a server-side way to force a handle or pet-name reset.

## 5. Account deletion (required by Apple)
- In settings: **Delete account**. Show a confirmation explaining that the pet and all progress will be permanently deleted, and require typing the handle or confirming twice.
- Server side (Edge Function): delete the profile, pets, playdate records, snapshots, relationships, friendships, requests in both directions, and blocks the user created. Keep blocks *against* them until the auth user is removed, then cascade. Anonymize the user's reports. Delete the auth user.
- **Sign in with Apple:** revoke the user's Apple tokens via Apple's REST API as part of deletion (Apple requires this).
- The handle goes into the 30-day hold, then is released.
- Afterward, clear local data and return to onboarding.

## 6. Schema (Supabase)
```sql
profiles (
  user_id uuid primary key references auth.users on delete cascade,
  handle text not null,             -- display capitalization
  handle_lower text not null unique,
  handle_changed_at timestamptz,
  searchable boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

handle_holds (handle_lower text primary key, released_at timestamptz not null);
reserved_handles (handle_lower text primary key);

friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_user uuid references auth.users on delete cascade,
  to_user uuid references auth.users on delete cascade,
  status text check (status in ('pending','accepted','declined','cancelled')),
  created_at timestamptz default now(),
  responded_at timestamptz
);
-- one pending request per ordered pair
create unique index on friend_requests (from_user, to_user) where status = 'pending';

friendships (
  user_a uuid references auth.users on delete cascade,
  user_b uuid references auth.users on delete cascade,
  created_at timestamptz default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);

blocks (
  blocker uuid references auth.users on delete cascade,
  blocked uuid references auth.users on delete cascade,
  created_at timestamptz default now(),
  primary key (blocker, blocked)
);

reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid references auth.users on delete set null,
  reported_user uuid references auth.users on delete cascade,
  reason text,
  target text check (target in ('handle','pet_name','other')),
  note text,
  status text default 'open',
  created_at timestamptz default now()
);

-- Already applied. Do not recreate. See supabase/migrations/20261022120000_pets_and_player_state.sql.
-- pets (id, owner_user_id, status active|retired, doc, doc_schema, local_revision, client_updated_at, retired_at)
-- player_state (user_id, doc, doc_schema, local_revision, client_updated_at)
-- Writes go through push_active_pet, retire_pet, and push_player_state. Select is owner-only.
playdate_records (playdate_id uuid primary key, owner_id uuid references auth.users on delete cascade, record jsonb, created_at timestamptz);
npc_snapshots (snapshot_id uuid primary key, owner_id uuid references auth.users on delete cascade, data jsonb, created_at timestamptz);
relationships (owner_id uuid, pet_id uuid, partner_snapshot_id uuid, bond numeric, playdate_count int, last_playdate_at timestamptz, primary key (pet_id, partner_snapshot_id));
```
- **RLS on everything.** Users read only their own rows in `pets` and `player_state` (already applied; writes go through the push RPCs). The same own-row rule applies to `playdate_records`, `npc_snapshots`, `relationships`, and `profiles` when those tables exist.
- **Social actions go through `security definer` RPCs:** `search_handles`, `check_handle_available`, `claim_handle`, `send_friend_request`, `respond_friend_request`, `cancel_friend_request`, `unfriend`, `block_user`, `unblock_user`, `report_user`. Each one enforces blocks, rate limits and validation server-side; the client is never trusted for these rules.
- **Friend pet cards:** an RPC `get_friend_pet_cards()` returns a limited snapshot (name, species, breed, coat, cosmetics, age stage, current style) only for accepted, unblocked friends. Never the raw pet document.

## 7. Analytics (minimal)
Log a small set of events to an `events` table (or PostHog if you prefer): `app_open`, `onboarding_complete`, `account_created`, `playdate_started`, `playdate_completed`, `friend_request_sent`, `friend_added`. Key them by `user_id`, without content. This gives D1/D7 retention and playdates per user. Update the privacy label and the Data Safety form to cover it.

## Out of scope
- Friend playdates and async replay sharing (next brief)
- Push notifications
- Invite deep links and QR codes
- Contacts and phone numbers
- Purchases

## Retirement (from the identity migration; do not rebuild it here)
Retirement replaces "rehome to farm." A retired pet stays owned by the same user, with `status = 'retired'`, and can later be a playdate partner for that user and their friends. Friends read it through a narrow view or RPC (render and playdate fields only, never the raw doc). Access ends on unfriend or block. Playdate logic dresses retired pets from the NPC catalog.

Pull/restore must treat a pet doc and `player_state` with different `local_revision` values as a mismatch. Homes are per `(owner, species)` inside `player_state`, not on the pet.

## Acceptance checks
- A guest with a pet signs up with Apple, Google or email: same `user_id`, the pet and playdate history are intact, and the guest compliance row is still linked.
- Signing in on a second device restores the pet and history. Edits on one device appear on the other after sync.
- A returning user who played as a guest on a new phone gets the keep-pet prompt; nothing is overwritten silently.
- Handle: rejects spaces, emoji, symbols, reserved words and profanity; `Maya` and `maya` collide; two simultaneous claims of one handle → exactly one succeeds; a second change within 30 days is refused; a released handle can't be claimed for 30 days.
- Search finds by prefix, excludes blocked users in both directions and users with search off.
- Requests: mutual requests auto-accept; rate limits enforced server-side (verified by calling the RPC directly).
- Block: removes the friendship, hides both users from each other in search and friend cards, prevents requests, and the blocked user gets no notification. Unblocking doesn't restore the friendship.
- Delete account: all user data removed, Apple tokens revoked, handle held, app returns to onboarding.
- Airplane mode: the game still works; changes sync after reconnecting.
