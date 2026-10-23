# Boop Boop — Accounts, Welcome Screen, Device Handoff, Prompts & Settings (Brief v3)

**Replaces v2.** v3 answers Cursor's review of v2 against the codebase. Changes from v2 are marked **[v3]**. The biggest change: **Phase A (§2) fixes the existing auth, sync, and app-open paths before any account feature is built.** Layering accounts on the current paths would overwrite an account with a guest pet, drop another device's progress, or pay Boops twice.

**Prerequisite:** the identity/ownership migration (brief v3 + follow-up decisions) is merged.

**Relationship to `docs/boop-boop-accounts-friends-brief.md`:** that brief owns the social schema (`profiles` with display `handle` + `handle_lower`, `searchable`, `handle_changed_at`; friend requests; blocks) and the handle rule `^[a-zA-Z0-9]{3,20}$`. Use its schema and rules for handles. Friends UI, search, requests, and blocking are **out of scope** here.

**How to work:** build one phase at a time, in order (§1). After each phase, report what changed and how you tested it before starting the next.

---

## 0. Product decisions

- **Sign-in methods:** Sign in with Apple and Google only. No email. Both buttons on both iOS and Android.
- **Accounts upgrade the existing anonymous user in place:** same `user_id`, same pet, Boops, inventory, and consent records.
- **Returning player on a device with a guest pet:** the account wins, after a clear confirmation. The guest's data is deleted.
- **One active device at a time, with handoff.** Whichever device last opened the app is active; the other re-downloads when it next opens (§9). No simultaneous two-way sync.
- **Purchases and spends are never lost or duplicated.** Earned Boops (time, welcome back, login, starter pack) are paid exactly once per account, across devices.
- **No sign-out in v1.**
- **Account deletion is immediate** after confirmation. No grace period.
- **Handle is created right after sign-in**, as the last step of account creation.

---

## 1. [v3] Phases

| Phase | What | Section |
|---|---|---|
| A | Fix identity publishing, push queue, app-open ordering, Boops idempotency, dead-session handling | §2 |
| B | Native sign-in packages, dev build, URL scheme, edge function scaffold, `profiles` table | §3 |
| C | `AccountSheet`, linking a guest, handle creation | §4–§6 |
| D | Restore (returning player) | §7 |
| E | Welcome screen and screen order in `App.tsx` | §8 |
| F | Device handoff | §9 |
| G | Prompts and lost session | §10 |
| H | Apple token storage, Settings, Delete account, full wipe | §11–§13 |

Findings from the v2 review are taken as known (supabase-js 2.118 has `linkIdentity` with an ID token and `signInWithIdToken`; no sign-in packages, no URL scheme, no `supabase/functions`, no `profiles`; `pets`, `player_state`, `consent_records` already cascade from `auth.users`). Don't re-audit those; do flag anything else that conflicts.

---

## 2. [v3] Phase A — fix the existing paths first

### A1. Ownership changes only through explicit operations
Today `useIdentity`'s `onAuthStateChange` listener binds the install to whatever user just signed in, and the `App.tsx` effect (`if (petState.ownerId !== identity.ownerId) setOwnerId(...)`) stamps that id onto the loaded pet and queues a push. On a returning player this stamps the **guest pet** with the **account id** and pushes it over the cloud pet. `deleteGuestAccount`'s `signOut` then moves the pet a second time.

Fix:
- **Remove the `App.tsx` effect** that copies `identity.ownerId` onto the pet. A pet's owner changes in exactly two places, both explicit functions:
  1. `bindGuestPet(installId → anonUserId)`: the first anonymous sign-in binds an install-owned pet to the anonymous user (existing bind, kept).
  2. `applyRestore(serverState)`: replaces local state with the server's (§7).
  Linking (§5) changes nothing local, because the `user_id` doesn't change.
- **Add an auth-transition lock** (`authTransition: 'idle' | 'linking' | 'restoring' | 'deleting' | 'reauth'`). While it isn't `idle`:
  - the auth listener records events but does **not** bind, rebind, or publish a new owner;
  - the push queue is **paused** (nothing pushes);
  - `settleReturn` / `onAppOpen` don't run.
  The flow that set the lock publishes the final identity and owner once, at the end, then releases the lock.
- **`SIGNED_OUT` never points the owner back at the install id for a device that has a linked account.** Add `meta.accountLinked` (set true after a successful link or restore; cleared only by the full wipe). With no sign-out in v1, a `SIGNED_OUT` on a linked device means the session died (§A5) or one of our own locked flows is running.

### A2. Pushes rejected as stale or from an inactive device are not discarded
Today `queue.ts` deletes the queue row when the result is `stale`, so the change is silently lost and nothing re-downloads.

Fix:
- Server RPCs `push_active_pet`, `retire_pet`, and `push_player_state` return three distinct results: `ok`, `stale` (revision behind), and `not_active` (caller's `device_id` isn't the account's `active_device_id`, see §9). Add `p_device_id` to each.
- Client: only `ok` deletes the row. On `stale` or `not_active`, stop the queue, keep the rows, and trigger a **pull** (§9). After the pull, apply the §9 conflict rules to the kept rows (ledger rows replay; state rows are dropped because the server wins), then clear them.
- Add RPC `pull_account_state()` returning the active pet, retired pets, `player_state` (including the ledger, daily counters, shop state, and `last_seen`), server revision, and `active_device_id`.

### A3. App open: pull and claim before paying anything
Today `usePet` runs `settleReturn` → `onAppOpen` on launch and every foreground. That grants the starter pack, time payout, welcome-back bonus, and login reward, deduplicated only by the local `transactions` table, which isn't in `player_state`. A restored device has the balance but an empty ledger, so it pays the starter pack and welcome-back again. Away decay runs from the local `lastUpdatedAt` before the other device's state arrives, so an absence can decay twice.

Fix the order on launch and on every foreground:
1. If guest, or offline: run `settleReturn` as today (local clock).
2. If linked and online: call `claim_device(p_device_id)` **first**. It returns `{ server_revision, active_device_id_before, last_seen_before, server_now }`, then sets `active_device_id = p_device_id` and `last_seen = server_now`.
   - If the server revision is newer than local, or `active_device_id_before` is another device: pull and `applyRestore` (§7 rules, no confirmation).
   - Then run `settleReturn` using **`last_seen_before` → `server_now`** as the away window, not the local `lastUpdatedAt`. Decay and time payout use that window.
3. On going to background (and on any successful push), call `touch_last_seen(p_device_id)` so the next open measures from the right moment.

### A4. Boops grants get keys that survive restore
- Move the ledger (`transactions`), `daily_counters`, and shop state (shop day, pick history) into `player_state` so they restore with the account. The shop rotation then matches across devices and daily caps don't reset.
- Every ledger entry has a unique `entry_id` and a `kind` (`purchase`, `spend`, `earn`). Earned grants carry a deterministic **grant key**, unique per account:
  - starter pack: `starter`
  - login reward: `login:<local YYYY-MM-DD>`
  - welcome back / time payout: `away:<last_seen_before ISO>` (one per away window)
  - anything else currently idempotent locally: give it a key the same way
- Server: unique `(user_id, grant_key)` for earned entries and unique `(user_id, entry_id)` for all entries; applying an entry twice is a no-op.
- Balance and purchased items are **derived from the ledger**, not stored as a free-standing snapshot that can drift.
- Guests: keys work the same locally. When a guest links, nothing changes (same `user_id`). When a guest is replaced by a restore, the guest's ledger is discarded with the guest.

### A5. A dead session doesn't become a new guest
Today a failed refresh looks like sign-out: the owner points back at the install id, `setOwnerId` rewrites the pet, and `ensureAnonymousUserId` signs in a brand-new anonymous user the next time consent needs to flush.

Fix:
- `ensureAnonymousUserId` never creates an anonymous user when `meta.accountLinked` is true. It returns null and lets the caller wait.
- On a linked device, a null session after refresh failure enters the `reauth` path (§10b): keep all local data, pause pushes, set the lock to `reauth`, show the reauth sheet.

### Phase A done when
- Signing in to a different account with a guest pet loaded never pushes the guest pet under the account id (test it before restore exists by forcing a sign-in to a second test user: the local pet must not be re-stamped).
- A push answered `stale` or `not_active` keeps its row and triggers a pull.
- Opening the app on a second device, or after a restore, doesn't pay the starter pack, login reward, or welcome back twice; an absence decays once.
- Forcing a refresh failure on a linked test device keeps the pet and creates no new anonymous user.

---

## 3. [v3] Phase B — packages, build, and scaffolding

- Add `expo-apple-authentication` and `@react-native-google-signin/google-signin` with their Expo config plugins. Both require a **dev build**; Expo Go won't run them.
- Add a URL scheme to `app.json` (e.g. `boopboop`) and use `boopboop://auth-callback` as the redirect for the Android Apple web flow.
- Supabase client: switch to `flowType: 'pkce'`, keep `detectSessionInUrl: false`. Android Apple: `signInWithOAuth({ provider: 'apple', options: { redirectTo, skipBrowserRedirect: true } })`, open it with `expo-web-browser` `openAuthSessionAsync`, then `exchangeCodeForSession(code)` from the returned URL. For linking a guest on Android Apple, use the OAuth form of `linkIdentity` the same way.
- Create `supabase/functions/` with `apple_store_token` and `delete_account` (§11, §13).
- Create `profiles` exactly as the accounts-friends brief specifies, with `on delete cascade` from `auth.users`.
- Edge function secrets already set in Supabase: `APPLE_PRIVATE_KEY`, `APPLE_KEY_ID`, `APPLE_TEAM_ID`, `APPLE_BUNDLE_ID`, `APPLE_SERVICES_ID`. Use these names. Use `APPLE_BUNDLE_ID` as `client_id` for tokens from native iOS sign-in and `APPLE_SERVICES_ID` for tokens from the Android web flow. `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically.
- Ask me for the public IDs you need (Google Web client ID for `webClientId`, iOS client ID and its reversed URL scheme).

---

## 4. Sign-in sheet (`AccountSheet`)

**[v3] New component.** `FunModal` is a two-button dialog; this needs the Apple and Google buttons plus a dismiss. Match `FunModal`'s visual style.

Opened with a **reason** that sets the copy:

| Reason | Title / body |
|---|---|
| `friends` | "Pick a handle so friends can find you and bring their pets to play." |
| `purchase` | "Keep your Boops safe. Create an account to back them up." |
| `day3` | "Back up {petName} and your progress so you never lose them." |
| `settings` | "Create an account to back up {petName}, or sign in to one you already have." |
| `restore` | "Welcome back! Sign in to bring your pet home." |
| `reauth` | "Sign in again to keep {petName} backed up." |

- Buttons: **Sign in with Apple** (Apple's official button style, required) and **Continue with Google**, then **Not now** (`restore` and `reauth` have a close button instead).
- **Requires network.** If offline: "You'll need internet to sign in" plus a close button. Never queue sign-in.
- iOS Apple: native sheet; request full name and email scopes (neither required). Keep the `authorizationCode` for §11. Google (both platforms): native Google Sign-In → ID token. Android Apple: web flow (§3).

---

## 5. Linking a guest (new account)

**[v3] Which call to use:**
- **Device has an anonymous session** (a guest who has played): `linkIdentity` with the ID token (or the OAuth form on Android Apple). The `user_id` doesn't change.
- **No session yet** (welcome screen, before consent flush has created an anonymous user): `signInWithIdToken` directly, then §7 restore. Don't create an anonymous user first.

Flow (guest with a session):
1. Set lock `linking`. Get the credential.
2. `linkIdentity`. Nothing local is rewritten.
3. On success: set `meta.accountLinked = true`; claim the active device (§9); if Apple on iOS, send `authorizationCode` to `apple_store_token` in the background (retry on failure, don't block). Release the lock and go to handle creation (§6).
4. If linking fails with **identity already linked to another user**: keep the lock (switch it to `restoring`) and go to §7.
5. Any other failure: friendly error plus retry. Release the lock. The user stays a guest with all data intact.

The `settings` reason uses this same flow.

---

## 6. Handle creation

- Shown right after a successful link, or after restore if the account has no handle.
- Rules and storage from the accounts-friends brief: `^[a-zA-Z0-9]{3,20}$`, display capitalization kept, uniqueness on `handle_lower`, stored in `profiles`.
- Live availability check (debounced) plus a final check on save. Handle the unique-violation race with "That handle was just taken."
- Copy: "Pick your handle. This is how friends find you." Show the result as **@handle · with {petName}**.
- Not skippable. If the app is killed before saving, the next launch shows the handle screen again before Home.
- Reserved/profanity word list (start with admin, boopboop, support, moderator, plus common profanity), case-insensitive.

---

## 7. Restore (returning player)

Happens when someone reinstalls or gets a new device, then signs in with an identity that already has an account (from the welcome screen, Settings, a prompt, or a failed link).

1. **If the device has a guest pet or any guest progress**, confirm: **"You already have an account. Signing in will bring back your pet from that account and remove the guest pet on this device."** Buttons: **Sign in** / **Cancel**. No guest progress (welcome screen): skip.
2. Set lock `restoring` (if not already). The push queue is paused; the listener won't publish an owner.
3. **[v3] Delete the orphaned guest server-side without bouncing the identity:** if an anonymous session exists, call `delete_account` (§13) while still in that session. Don't call `signOut` in between; signing in with the new credential replaces the session. If no anonymous session exists, skip.
4. `signInWithIdToken` with the same credential (or OAuth on Android Apple).
5. `claim_device`, then `pull_account_state`.
6. **`applyRestore`, in one local transaction:**
   - active pet → `pet` singleton; retired pets → `retired_pets`; `player_state` → owner-keyed SQLite tables (ledger, inventory, toys, furniture, both species layouts, owner_state, daily counters, shop state);
   - `meta.localRevision` = max(server revisions) + 1;
   - local owner = this account's `user_id`; `meta.accountLinked = true`;
   - clear the guest's local data and push queue.
7. **[v3] Consent:** if the account has a `consent_records` row, write `boop.ageRecord` and `boop.termsAccepted` to SecureStore from it so the age gate doesn't show. If not, show age/terms after restore and write the record.
8. Release the lock and publish the identity once. Then run the A3 open sequence (`settleReturn` with the server away window).
9. Handle: skip §6 if `profiles` has one; otherwise run §6.
10. No active pet on the account (retired one, never adopted): go to adoption.
11. Local NPC playdate data isn't on the server yet; after restore it starts empty. Acceptable for v1; note it in the code.
12. Any failure after step 3: error, then the `restore` sheet to retry. Nothing local is cleared unless `applyRestore` commits.

---

## 8. Welcome screen (new first screen)

### Screen order in `App.tsx` **[v3]**
There's no router; `App.tsx` picks the screen. New order:
1. **No local pet and no restore in progress → Welcome.**
2. Welcome → **Get started** → age gate → terms → adoption → Home (existing flow).
3. Welcome → **I already have an account** → `AccountSheet` (`restore`) → §7 → Home (age/terms only if the account has no consent record).
4. Local pet exists → Home (handle screen first if a linked account has no handle).

### Layout
- **Boop Boop icon** at the top, the same artwork as the app icon (logo treatment, not a tiny square).
- A puppy and a kitten idling together in a scene: blinks, tail wags, a little bounce, light wandering. **[v3]** `PetPreview` draws one pet with idle wander off, so build this on the **actor world**, which can hold two pets. Use fixed default breeds and coats.
- Headline: **"Let's adopt your pet!"**
- Primary button (big, glossy, cotton candy style): **Get started**
- Secondary button directly underneath, lighter but clearly a button: **I already have an account**

### Behavior
- **Get started** works offline, as today.
- **I already have an account** offline: "You'll need internet to sign in." Get started stays available.
- Cancel or sign-in failure returns to the welcome screen, never into adoption.
- Shown only when there's no local pet: first launch, or after a delete/full wipe.

---

## 9. Device handoff (e.g. phone ↔ iPad)

Linked accounts only.

- **Server state:** add `active_device_id` (the device's `installId`), `active_since`, and `last_seen` to `player_state`. RPCs from Phase A: `claim_device`, `touch_last_seen`, `pull_account_state`; push RPCs take `p_device_id` and return `not_active` for inactive devices.
- **On every launch/foreground (online):** the A3 sequence: claim, pull if needed, then `settleReturn`. Keep it quick; show Home's normal loading state, and only block if a download is needed.
- **Rejected push (`stale` / `not_active`):** pull, `applyRestore`, and show a light, on-brand message. **[v3] Copy:** **"All caught up from your other device!"** ("Welcome back!" is already the away-payout label.)
- **Conflict rules after an offline session on a device that lost the active slot:**
  - **Server wins** for pet state, needs, training, room layouts, daily counters, and shop state. The losing device's kept rows for these are dropped.
  - **Ledger entries replay:** `purchase` and `spend` entries from the losing device are pushed after the pull; the server dedupes by `entry_id`. Items bought by a replayed spend are granted with it.
  - **Earned entries** whose grant key the server already has are no-ops. Earned entries for an away window the server never saw are dropped (the server's away window already covered that time).
  - If a replayed spend would push the balance below zero, apply it anyway and let the balance sit negative until earned back. Report how often this can happen; it should be rare.

---

## 10. Prompts and lost session

### 10a. The three prompts
| Prompt | Trigger | Type | Ships |
|---|---|---|---|
| `friends` | "Add friends" / "Play with a friend" on the playdate screen | **Hard gate** | Behind `ACCOUNT_PROMPT_FRIENDS`, **off** until friends UI ships |
| `purchase` | Success screen after a successful IAP purchase, never before checkout | Soft | Behind `ACCOUNT_PROMPT_PURCHASE`, **off** until IAP ships |
| `day3` | App opened on the user's **3rd distinct local calendar day** | Soft | **On** |

Rules:
- Never show any prompt once the user has an account.
- Soft prompts appear **only when Home is idle**: after the greeting animation, never during onboarding, adoption, training, mini-games, a playdate, the Closet, the Pet Shop, or any open modal. Hold a trigger that fires at a bad moment until Home is next idle in that session.
- **Cooldown:** after any soft prompt is dismissed, no soft prompt for **3 days**.
- **Each soft prompt shows at most twice**, ever. The hard gate ignores cooldown and caps.
- Prompt state lives in SQLite `meta` (distinct-day count, last dismissal, per-prompt show counts). Distinct days: local calendar days the app was foregrounded.

### 10b. Lost session (`reauth`)
- A linked device's refresh fails: **retry first**. Never create a new anonymous user (A5).
- Still failing and the account **exists**: keep local data, allow offline play, pause pushes, and show `AccountSheet` (`reauth`) when Home is next idle. Signing in with the same identity resumes; run the A3 open sequence.
- Account **no longer exists** (deleted from another device): full wipe (§13) and return to the welcome screen.

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
- Android Apple (web flow): store the provider refresh token from the Supabase session if available (`client_id` = `APPLE_SERVICES_ID`). If none, log it; deletion still proceeds.

---

## 12. Settings page

- **Entry:** a gear icon (lucide `Settings`) **next to the pet's name in the Home header**, in a small glossy, puffy cotton candy button with a tap target of at least 44×44pt. Don't use a paw print (that's the Boops coin). Opens Settings as a full screen with a back button.
- **Leave the existing Style & sound controls in `HomeActionPanel` exactly as they are.** Don't move, restyle, or duplicate them.
- **Rows:**
  - **Guests:** **Sign in or create account** (top) → `AccountSheet` (`settings`).
  - **Linked accounts:** in its place, a non-tappable line: **"Signed in as @handle · Apple"** (or **· Google**, or **· Apple & Google**).
  - **Everyone:** **Delete account** (same label for guests; a guest is an anonymous account).
- Nothing else for now (no sign-out).

---

## 13. Delete account

### Flow
1. Tap **Delete account** → confirmation modal (serious, still on-brand):
   - **Account:** "Delete your account? This permanently deletes your account, {petName}, your retired pets, your Boops (including any you bought), and everything you own. This can't be undone."
   - **Guest:** "Delete your account? This permanently deletes {petName} and all your progress. This can't be undone."
   - Text field: **"Type DELETE to confirm."** **Delete** stays disabled until it reads exactly `DELETE` (case-sensitive, trimmed).
   - Buttons: **Delete** (destructive) / **Cancel**.
2. Requires network. Offline: "You'll need internet to delete your account."
3. Set lock `deleting`, show progress, call `delete_account`.
4. Success: full local wipe, then the welcome screen.
5. Failure: error plus retry; release the lock. Nothing is wiped locally unless the server deletion succeeded.

### Edge function `delete_account` (auth required; guests and accounts)
1. Identify the caller from the JWT.
2. Apple identity: read the refresh token from `private.apple_tokens` and revoke at `https://appleid.apple.com/auth/revoke`. On failure, log and continue.
3. Google: revoke best effort.
4. Delete the auth user with the admin API. Everything cascades (`pets`, `player_state`, `profiles`, `consent_records`, `apple_tokens`, ledger, any social tables). Verify every table referencing `auth.users` has `on delete cascade`.
5. Replaces `delete_my_guest_data()` (which only deletes an anonymous caller) as the single deletion path. Keep the RPC working if other code uses it.

### Full local wipe **[v3: extend `wipeLocalData`]**
`wipeLocalData` today clears SQLite and some `petty.*` keys. Extend it to the full reset:
- pet, retired pets, all owner-keyed SQLite tables, ledger, push queue, prompt state, `meta.accountLinked`;
- **all** AsyncStorage `petty.*` keys, including `petty.draft`, `petty.sound`, `petty.music`, `petty.reminders`;
- SecureStore `boop.ageRecord` and `boop.termsAccepted`;
- the Supabase session;
- **rotate `boop.installId`** to a new value;
- cancel all reminders (`cancelReminders`);
- keep only `storageVersion` in `meta`.
Then show the welcome screen.

---

## 14. Manual setup (me, not code)

- Supabase Auth: Apple and Google providers on; **manual linking** on; add `boopboop://auth-callback` to the redirect URL allow list.
- Apple provider Client IDs: bundle ID, then Services ID. Secret key: JWT from the `.p8` (needed for the Android web flow; regenerate within 6 months).
- Google: OAuth clients for Web (redirect `https://<project-ref>.supabase.co/auth/v1/callback`), iOS, and Android (one client per SHA-1: EAS key, Play app signing key, debug if used). Supabase Google Client IDs: Web first, then iOS and Android. Client secret: the Web client's.
- Edge function secrets: done (see §3).
- Before resubmitting: update the privacy policy and App Store privacy label (user ID, plus email if Apple/Google provides one).

Cursor: list any values you still need from me, as a checklist.

---

## 15. Done when

**Phase A** (see §2) plus:
- Welcome screen shows with the Boop Boop icon, the puppy and kitten idling together, **Get started**, and **I already have an account**; a device with a pet skips it.
- **I already have an account** on a fresh install restores the account with `signInWithIdToken` (no anonymous user created), writes the local consent keys, skips age/terms when a record exists; offline shows the internet message; cancel returns to Welcome.
- Guest → Sign in with Apple (iOS), Google (iOS + Android), Apple on Android: same `user_id` before and after; pet, Boops, ledger, inventory, layouts, consent unchanged; handle saved.
- Killing the app before saving the handle shows the handle screen on next launch.
- Guest with a pet signs in to an existing account: confirmation shown; guest deleted server-side; account restored; the guest pet is never pushed under the account id.
- Phone → iPad → phone: each device shows the latest state on open; a push from the inactive device keeps its rows, pulls, and shows "All caught up from your other device!"; purchases and spends survive; starter pack, login, and away payouts are paid once; an absence decays once.
- Lost session: local data kept, no new anonymous user, `reauth` sheet shown; a deleted account wipes and returns to Welcome.
- Day-3 prompt follows the idle, cooldown, and cap rules and never shows after account creation; friends and purchase prompts exist behind flags that default to off.
- Settings: gear next to the pet name; guest sees **Sign in or create account**, linked account sees "Signed in as @handle · provider"; Style & sound on Home unchanged.
- Delete stays disabled until `DELETE` is typed; deleting an Apple account revokes the token, deletes the auth user and cascaded data, runs the full wipe (new install id), and returns to Welcome; offline deletion is blocked; a failed server deletion wipes nothing locally.
