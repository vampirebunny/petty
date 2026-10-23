# Boop Boop — Account Creation, Welcome Screen, Prompts & Settings (Brief v2)

**Replaces `boop-boop-accounts-brief.md` (v1).** Changes from v1 are marked **[v2]**.

**Prerequisite:** the identity/ownership migration (brief v3 + follow-up decisions) is merged and tested. This brief builds on it.

**Relationship to `docs/boop-boop-accounts-friends-brief.md`:** that brief owns the social schema (`profiles` with display `handle` + `handle_lower`, `searchable`, `handle_changed_at`; friend requests; blocks; per-owner playdate tables) and the handle rule `^[a-zA-Z0-9]{3,20}$`. **Use its schema and rules for handles.** This brief adds the welcome screen, sign-in, linking, restore, device handoff, prompts, settings, and deletion. Friends UI, search, requests, and blocking are **out of scope** here.

---

## 0. Product decisions

- **Sign-in methods:** Sign in with Apple and Google only. **No email.** Both buttons appear on **both** iOS and Android.
- **Accounts upgrade the existing anonymous user in place:** same `user_id`, same pet, Boops, inventory, and consent records.
- **Returning player on a device with a guest pet:** the account wins, after a clear confirmation. The guest's data is deleted.
- **[v2] One active device at a time, with handoff.** A player can switch between devices (e.g. phone and iPad). Whichever device last opened the app is the active one; the other re-downloads when it next opens (§7). No simultaneous two-way sync.
- **No sign-out in v1.**
- **Account deletion is immediate** after confirmation. No grace period.
- **Handle is created right after sign-in**, as the last step of account creation.

---

## 1. Step 0 — verify before building

Report back on:
1. Whether the installed supabase-js version supports **linking a native ID token to the current anonymous user** (e.g. `linkIdentity` with an ID token). If not, use the OAuth redirect version of `linkIdentity` for linking, and confirm the deep-link return works in the dev build.
2. Whether the app is on a **dev build** (required: native Google Sign-In and `expo-apple-authentication` don't work in Expo Go).
3. Whether `profiles` from the accounts-friends brief already exists in Supabase. If not, create it exactly as that brief specifies, plus `on delete cascade` from `auth.users`.
4. **[v2]** How the current onboarding entry screen is built, and where the Boop Boop app icon asset lives (so the welcome screen can use the same artwork).

Then propose the exact changes before implementing.

---

## 2. [v2] Welcome screen (new first screen)

Replaces v1's small "Already have an account? Sign in" text link.

### Layout
- **Boop Boop icon** at the top: the same artwork as the app icon (logo treatment, not a tiny square).
- Below it, a puppy and a kitten idling together in a scene (blinks, tail wags, a little bounce), using the existing pet renderer with fixed default breeds/coats.
- Headline: **"Let's adopt your pet!"**
- Primary button (big, glossy, cotton candy style, matching the Home buttons): **Get started**
- Secondary button directly underneath, lighter but clearly a button (not a text link): **I already have an account**

### Behavior
- **Get started** → age attestation → terms → adoption (existing flow, unchanged). Works offline as today.
- **I already have an account** → opens `AccountSheet` with reason `restore` → §5 restore (no guest data yet, so no confirmation).
  - After restore, check that the account has a consent record (13+ attestation + terms) on the server. If yes, **skip the age/terms screens** and go to Home. If no record, show the age/terms screens before Home and write the record.
  - Offline: show "You'll need internet to sign in." **Get started** stays available.
  - Cancel or sign-in failure: return to the welcome screen, never into adoption.
- **When it shows:** first launch only, or after a delete/full wipe. Any device with a pet goes straight to Home.

---

## 3. Sign-in sheet (`AccountSheet`)

One reusable bottom sheet, opened with a **reason** that sets the copy:

| Reason | Title / body |
|---|---|
| `friends` | "Pick a handle so friends can find you and bring their pets to play." |
| `purchase` | "Keep your Boops safe. Create an account to back them up." |
| `day3` | "Back up {petName} and your progress so you never lose them." |
| `settings` **[v2]** | "Create an account to back up {petName}, or sign in to one you already have." |
| `restore` | "Welcome back! Sign in to bring your pet home." |
| `reauth` **[v2]** | "Sign in again to keep {petName} backed up." |

- Buttons: **Sign in with Apple** (Apple's official button style, required by Apple's guidelines) and **Continue with Google**, then **Not now** (`restore` and `reauth` have a close button instead).
- Style matches the game's fun modal look; the Apple button keeps Apple's required styling.
- **Requires network.** If offline: "You'll need internet to create an account" plus a close button. Never queue sign-in.

### iOS
- Apple: `expo-apple-authentication` (native sheet). Request the full name and email scopes, though neither is required. Keep the `authorizationCode` for §9.
- Google: native Google Sign-In → ID token.

### Android
- Google: native Google Sign-In → ID token.
- Apple: Supabase OAuth web flow with deep-link return (no native Apple sheet on Android).

---

## 4. Linking flow (new account)

1. User taps a provider. Get the credential (ID token, or OAuth on Android Apple).
2. **Link it to the current anonymous user** (per Step 0). The `user_id` doesn't change. Nothing local is rewritten.
3. On success:
   - If Apple on iOS: send `authorizationCode` to the `apple_store_token` edge function (§9) and don't block the UI on it; retry in the background if it fails.
   - Continue to **handle creation** (§6).
4. If linking fails because **this identity already belongs to another user**, go to §5 (returning player).
5. Any other failure: friendly error plus retry. The user stays a guest with all data intact.

**[v2] The `settings` reason uses this same flow:** it links if the identity is new, or falls into §5 if it already belongs to an account.

---

## 5. Returning player (identity already linked to another account)

Happens when someone reinstalls or gets a new device, plays as a guest, then signs in, or uses **I already have an account** on the welcome screen.

1. If the device has a guest pet or any guest progress, confirm:
   **"You already have an account. Signing in will bring back your pet from that account and remove the guest pet on this device."** Buttons: **Sign in** / **Cancel**.
   If the device has no guest progress (welcome screen), skip the confirmation.
2. While still in the guest session: call the existing guest data deletion (`delete_my_guest_data()` or `delete_account`) so the orphaned anonymous user is removed server-side. Skip if no anonymous user exists yet.
3. Sign in to the existing account with the same credential (`signInWithIdToken`, or OAuth on Android Apple).
4. **Restore** (pull once):
   - Read the owner's `active` pet, `retired` pets, and `player_state`.
   - Write them locally: active pet → `pet` singleton, retired → `retired_pets`, player_state → owner-keyed SQLite tables (Boops, inventory, toys, furniture, both species layouts, owner_state).
   - Set the local revision counter in `meta` to **max(server `local_revision` values) + 1**, so this device's next pushes aren't rejected as stale.
   - Restore local identity: owner id = this account's `user_id`.
   - **[v2]** Mark this device as the active device (§7).
   - If the account has no active pet (e.g. it retired one and never adopted), go to adoption.
5. Handle: if the account already has a `profiles` row with a handle, skip §6. Otherwise run §6.
6. Local NPC playdate data (AsyncStorage) isn't on the server yet. After restore it starts empty for the restored pet. That's acceptable for v1; note it in the code.
7. If anything fails after step 2, show an error and send the user to the `restore` sheet to try again. Don't leave a half-written local state: write restored data to local storage in one transaction, and only clear the old guest data once the restore succeeds.

---

## 6. Handle creation

- Shown right after a successful link (or after restore if the account has no handle).
- Rules and storage from the accounts-friends brief: `^[a-zA-Z0-9]{3,20}$`, display capitalization kept, uniqueness on `handle_lower`, stored in `profiles`.
- Live availability check (debounced) plus a final check on save. Handle the unique-violation race with "That handle was just taken."
- Copy: "Pick your handle. This is how friends find you." Show the result as **@handle · with {petName}**.
- Not skippable within the flow. If the app is killed before saving, the account still exists; on next launch, show the handle screen again before Home.
- Add a reserved/profanity word list (start with a small list: admin, boopboop, support, moderator, plus common profanity). Reject case-insensitively.

---

## 7. [v2] Device handoff (e.g. phone ↔ iPad)

Applies to linked accounts only (guests are single-device by definition).

- **Active device:** add `active_device_id` (the device's `installId`) and `active_since` to the player's server state. A device becomes active when it signs in/restores, and when it opens the app and claims it (below).
- **Pull on foreground:** every time the app launches or returns from background (online), check the server revision and `active_device_id` before showing Home:
  - If the server revision is newer than local, **or** another device is active: download the latest state (same restore logic as §5 step 4, no confirmation), then claim the active device.
  - If local is current: claim the active device if needed and continue.
  - Keep the check fast; show Home's normal loading state, not a blocking spinner, unless a download is needed.
- **Stale pushes:** the server rejects pushes from a device that is not the active device. On rejection, the device re-downloads and shows a light, on-brand message: **"Welcome back! Picking up where you left off on your other device."**
- **Offline play:** a device can keep playing offline. When it reconnects:
  - If it's still the active device and nothing newer is on the server: push normally.
  - If another device took over in the meantime: **server wins** for pet state, needs, training, and room layouts. The offline session's local changes to those are discarded.
  - **Anything purchased or spent must never be lost or duplicated.** When Boops/IAP land, they must be recorded as ledger transactions that merge regardless of which device wins. Build the transaction table with that in mind (unique transaction ids, idempotent apply).
- **Time-based effects (note for upcoming currency work, not built here):** Boops accrual while away and stat decay while away must be computed from a single server-side `last_seen`, not from each device's clock, so an absence pays out and decays exactly once across devices.

---

## 8. Entry points

### 8a. Welcome screen
See §2.

### 8b. [v2] Settings
For guests, Settings has a **Sign in or create account** row (§10) opening `AccountSheet` with reason `settings`. This lets a returning player who skipped the welcome-screen button get their account back without waiting for a prompt.

### 8c. The three prompts
| Prompt | Trigger | Type | Ships |
|---|---|---|---|
| `friends` | User taps "Add friends" / "Play with a friend" on the playdate screen | **Hard gate**: friend features require an account | Behind flag `ACCOUNT_PROMPT_FRIENDS`, **off** until friends UI ships |
| `purchase` | On the success screen after a successful IAP purchase, never before checkout | Soft | Behind flag `ACCOUNT_PROMPT_PURCHASE`, **off** until IAP ships |
| `day3` | App opened on the user's **3rd distinct local calendar day** | Soft | **On** |

Rules:
- Never show any prompt once the user has an account.
- Soft prompts appear **only when Home is idle**: after the greeting animation finishes, and never during onboarding, adoption, training, mini-games, a playdate, the Closet, the Pet Shop, or any open modal. If the trigger fires at a bad moment, hold it until Home is next idle in that session.
- **Cooldown:** after any soft prompt is dismissed, no soft prompt for **3 days**.
- **Each soft prompt shows at most twice**, ever (per device/owner). After that, no more prompting.
- The hard gate (`friends`) ignores the cooldown and caps; it appears every time the user tries a friend feature.
- Store prompt state locally in SQLite `meta` (distinct-day count, last dismissal time, per-prompt show counts). Include it in the bind; don't wipe it on retire.
- Distinct days: count local calendar days on which the app was opened (foregrounded), per owner.

### 8d. [v2] Lost session (`reauth`)
- If a linked account's session refresh fails (revoked, or refresh token invalid):
  - **Retry first** (network blips are common). Never silently create a new anonymous user.
  - If it still fails and the server says the account **exists**: keep all local data, let the player keep playing offline, and show `AccountSheet` with reason `reauth` when Home is next idle. Pushes are paused until they sign in again. Signing in with the same identity resumes normally (run the §7 pull).
  - If the server says the account **no longer exists** (deleted from another device): full local wipe (§11) and return to the welcome screen.

---

## 9. Apple token storage (required for deletion)

Apple requires apps that offer Sign in with Apple to **revoke the user's Apple tokens when they delete their account**.

- Edge function `apple_store_token` (auth required): receives `authorizationCode`, exchanges it with Apple (`https://appleid.apple.com/auth/token`) using the app's client secret (JWT signed with the Apple .p8 key), and stores the returned **refresh token** in a private table:
  ```sql
  create table private.apple_tokens (
    user_id uuid primary key references auth.users(id) on delete cascade,
    refresh_token text not null,
    created_at timestamptz not null default now()
  );
  ```
  The `private` schema is not exposed to the API; only edge functions with the service role read it.
- Android Apple (OAuth web flow): use the provider refresh token from the Supabase session if available and store it the same way. If none is available, log it; deletion still proceeds.

---

## 10. Settings page (minimum)

- **Entry:** a gear icon (lucide `Settings`) **next to the pet's name in the Home header**. Tapping opens Settings (a full screen with a back button). Style matches the game: the icon sits in a small glossy, puffy cotton candy button like the other Home controls, with a tap target of at least 44×44pt even if the glyph is smaller. Don't use a paw print here; that shape is the Boops coin.
- **[v2] Leave the existing settings controls on Home exactly as they are.** Don't move, restyle, or duplicate them on the new page. The new Settings page only holds the account rows below for now.
- **Rows:**
  - **[v2] Guests only:** **Sign in or create account** (top row) → `AccountSheet` reason `settings`.
  - **[v2] Linked accounts only:** in place of that row, a non-tappable status line: **"Signed in as @handle · Apple"** (or **· Google**), using the provider of the identity linked to the account. If both are linked, show both ("Apple & Google"). If the handle isn't saved yet, the handle screen shows before Home anyway (§6), so this line always has a handle.
  - **Everyone:** **Delete account** (same label for guests and accounts; a guest is an anonymous account).
- Nothing else for now (no sign-out).

---

## 11. Delete account

### Flow
1. Tap **Delete account** → confirmation modal (clear and serious, still on-brand):
   - **Account:** "Delete your account? This permanently deletes your account, {petName}, your retired pets, your Boops (including any you bought), and everything you own. This can't be undone."
   - **Guest:** "Delete your account? This permanently deletes {petName} and all your progress. This can't be undone."
   - A text field: **"Type DELETE to confirm."** The **Delete** button stays disabled until the field reads exactly `DELETE` (case-sensitive, trimmed).
   - Buttons: **Delete** (destructive) / **Cancel**.
2. Requires network. If offline: "You'll need internet to delete your account."
3. Show progress, then call the **`delete_account`** edge function.
4. On success: full local wipe, then return to the welcome screen.
5. On failure: error plus retry. Nothing is wiped locally unless the server deletion succeeded.

### Edge function `delete_account` (auth required; works for guests and accounts)
1. Identify the caller from the JWT.
2. If the user has an Apple identity: read the refresh token from `private.apple_tokens` and call Apple's revoke endpoint (`https://appleid.apple.com/auth/revoke`). If revoke fails, log it and continue (don't block deletion).
3. Google: optionally revoke via Google's revoke endpoint; best effort.
4. Delete the auth user with the admin API (service role). Everything cascades: `pets`, `player_state`, `profiles`, `consent_records`, `apple_tokens`, and any social tables. **Verify every table that references `auth.users` has `on delete cascade`** (add a migration if not).
5. Return success.
6. Can replace the existing `delete_my_guest_data()` as the single deletion path. Keep the RPC working if other code uses it.

### Local wipe after deletion
Full reset: pet, retired pets, all owner-keyed SQLite tables, transactions, AsyncStorage `petty.*` (including `petty.draft`), push queue, prompt state, Supabase session, **and** `boop.ageRecord` / `boop.termsAccepted` (the user re-attests in onboarding). Generate a **new** `boop.installId`. Keep only `storageVersion` in `meta`. Cancel all scheduled notifications. Then show the welcome screen.

---

## 12. Supabase & platform setup (manual tasks for me, not code)

- Supabase → Authentication → Sign In / Providers: enable **Apple** and **Google**; enable **manual linking** (required for linking identities to anonymous users).
- Apple Developer: enable the Sign in with Apple capability on the Boop Boop App ID; create a **Boop Boop–specific** Services ID (for the Android web flow) and a Sign in with Apple **key (.p8)**; note Team ID and Key ID. Don't reuse another app's Services ID. Add the key details to Supabase and as edge function secrets.
- Google Cloud: OAuth client IDs for iOS, Android (with debug and release SHA-1), and Web; add the Web client ID/secret to Supabase.
- Edge function secrets: Apple Team ID, Key ID, .p8 key, client/Services IDs; service role key.
- Before resubmitting: update the privacy policy and App Store privacy label (user ID, plus email if Apple/Google provides one).

Cursor: list the exact values needed and where each goes, as a checklist.

---

## 13. Done when

- **[v2]** First launch shows the welcome screen with the Boop Boop icon, idling puppy and kitten, **Get started**, and **I already have an account**. A device with a pet skips it.
- **[v2]** **I already have an account** restores the account on a fresh install and skips age/terms when a consent record exists; offline shows the internet message; cancel returns to the welcome screen.
- Guest → Sign in with Apple (iOS) and Google (iOS + Android), plus Apple on Android: same `user_id` before and after; pet, Boops, inventory, layouts, and consent records unchanged; handle saved in `profiles`.
- Killing the app before saving the handle shows the handle screen on next launch.
- Guest with a pet signs in to an existing account: confirmation shown; guest server data deleted; account restored locally.
- **[v2]** Guest Settings shows **Sign in or create account**; it links a new identity or restores an existing account. After signing in, that row is replaced by "Signed in as @handle · Apple/Google".
- **[v2]** Phone → iPad → phone: each device shows the latest state on open; a push from the inactive device is rejected and replaced with a re-download and the "Welcome back!" message; no progress is duplicated.
- **[v2]** Lost session: local data kept, `reauth` sheet shown, no new anonymous user created; a deleted account wipes locally and returns to the welcome screen.
- Day-3 prompt: shows on the 3rd distinct day, only when Home is idle, respects the 3-day cooldown and the 2-show cap, never shows after account creation.
- Friends and purchase prompts exist behind flags that default to off.
- Gear icon next to the pet name opens Settings with the right rows for guest vs account.
- **[v2]** Delete stays disabled until the user types `DELETE`.
- Deleting an Apple account revokes the Apple token, deletes the auth user and all cascaded data, wipes local storage, and returns to the welcome screen with a new install id.
- Deletion is blocked offline with a clear message; a failed server deletion wipes nothing locally.
