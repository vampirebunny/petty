# Boop Boop Analytics — Cursor Brief

Oct 30, 2026 · @A

## Goal and rules

Firebase Analytics (`@react-native-firebase/analytics`) is wired through `src/analytics/` so we can see onboarding drop-off, return behavior, Boops spending and feature usage before the marketing push. Revised Oct 30 after a review against the repo. The calls are in the app; collection still needs a new production EAS build before anything is uploaded.

Rules for this work:

1. **Age gate first.** Nothing is collected or sent until the consent status is playable (`teen`, `adult` or `atLeast13`). An under-13 answer is never uploaded, not even as a count. Players who already passed consent are playable at startup.
2. **One entry point.** All analytics calls go through `src/analytics/`. No other file imports `@react-native-firebase/analytics`.
3. **Typed events only.** Event names, params and every string param are typed. TypeScript must reject an unknown event, a missing param, or a string outside its union.
4. **No free strings.** Every string param is a union taken from constants that already exist in the code (map spots, rooms, item kinds, AccountSheet reasons, grant reasons, competition ids). Where the code has no constant, add one in `events.ts`. Never pass display names, error messages or typed text.
5. **Never block gameplay.** Calls are fire-and-forget, wrapped in try/catch, never awaited from UI or account-deletion code. Analytics failing must never throw or stall the app.
6. **Naming limits.** snake\_case names, at most 40 characters, starting with a letter, never starting with `firebase_`, `google_` or `ga_`. Max 25 params per event; string values at most 100 characters.
7. **Don't change game behavior.** This task only adds logging, plus the `lastBackgroundAt` timestamp in Core loop. If a call site doesn't exist yet, keep the type, skip the call site, and list it in your summary.
8. **`docs/firebase.md`** describes the analytics setup, the age-gate rule, and points here for the event map.

**This brief wins over older docs.** These now point here:

- `docs/boop-boop-pet-cam-cursor-brief.md` logs only `pet_cam_shown` and `pet_cam_played`.
- `docs/boop-boop-accounts-friends-brief.md` section 7 has no events table and no PostHog.

## Setup

Collection is off by default, turns on only in production release builds after the age gate, and needs a new native build before any of it takes effect.

**1. `firebase.json` (project root)** — add or merge:

```json
{
  "react-native": {
    "analytics_auto_collection_enabled": false,
    "google_analytics_adid_collection_enabled": false,
    "google_analytics_ssaid_collection_enabled": false,
    "google_analytics_default_allow_ad_personalization_signals": false,
    "google_analytics_automatic_screen_reporting_enabled": false
  }
}
```

Also set `FirebaseAutomaticScreenReportingEnabled: false` under `ios.infoPlist` in `app.json`, so the plugin and the plist agree. iOS already has `withoutAdIdSupport: true`; leave it and don't add AdSupport.

**2. Block the Android AD\_ID permission** in `app.json`:

```json
"android": { "blockedPermissions": ["com.google.android.gms.permission.AD_ID"] }
```

**3. New native build required.** Items 1 and 2 do nothing until a new EAS build. JS `logEvent` calls can ship over the air only to binaries that already include these settings and the Analytics native module. Test Pass 1 on a fresh build, never on an older binary that may still be auto-collecting.

**4. Which builds collect.** There is no app-env flag today, and `__DEV__` alone treats preview builds as production. Add `EXPO_PUBLIC_ANALYTICS_ENABLED=1` to the `production` EAS profile only (not `development` or `preview`). Collection is allowed when `!__DEV__ && EXPO_PUBLIC_ANALYTICS_ENABLED === '1'`. For DebugView testing, a dev build can set `EXPO_PUBLIC_ANALYTICS_DEBUG=1`. Both are inlined at bundle time, so changing them needs a new bundle, not a runtime toggle.

**5. Age gate.** Even in a collecting build, `enableAfterConsent()` is called only once the consent status is playable: right after a yes on ConsentScreen, at startup when the stored status is already playable, and again on every return to foreground while the stored status is still playable (a no-op when already on; it retries if the native enable failed earlier). A no (or `eraseUnder13()`) never enables collection.

**6. User id: Supabase id only.** Decision: call `setPlayer(supabaseUserId)` only when a Supabase user id exists (after `ensureAnonymousUserId()` resolves, which consent sync already triggers, or on sign-in). Never pass the install id. Events before that are still tied to the device by Firebase's own app-instance id, so nothing splits. `linkIdentity` keeps the same Supabase id, so creating an account needs no new call.

**7. Reset on account deletion and under-13.** Call `resetAndDisable()` without awaiting it from both account deletion and `eraseUnder13()`. It sets the wrapper to `off` and drops the queue immediately, then turns collection off, clears the user id, and resets the app-instance id as three independent native calls. Firebase persists the enabled setting across launches, so the disable runs even when the wrapper was already `off`, and a `setUserId` failure must not skip it. If an enable is still in flight, its completion calls `setAnalyticsCollectionEnabled(false)` again whenever the wrapper is no longer `enabling`, so a late `true` cannot win. A first-run no sends nothing and still force-disables collection. A later downgrade from teen to under-13 stops collection that was already on. A player who goes through consent again gets a fresh `enableAfterConsent()`. Deletion must never wait on Firebase. The client reset doesn't delete data Google already stored; see the founder list.

**8. DebugView testing.** iOS: pass `-FIRAnalyticsDebugEnabled` as a launch argument in your local Xcode scheme; don't commit anything under `ios/` (it's generated). Android: `adb shell setprop debug.firebase.analytics.app app.mylisto.boop`. Events then appear in Firebase console → DebugView within seconds.

## analytics.ts wrapper

Two files: `src/analytics/events.ts` (types) and `src/analytics/analytics.ts` (the only Firebase caller). Import the unions below from these paths. `MiniGameId` and `ActivityId` are not exported anywhere today, so they are declared here. Import `ItemKind` only from `src/economy/catalog.ts`. `src/minigames/paddlePaws/content.ts`, `src/minigames/cloudHop/types.ts`, and `src/items/kinds.ts` export different `ItemKind` types.

```ts
// src/analytics/events.ts
import type { PURCHASES_ERROR_CODE } from 'react-native-purchases';
import type { Stage, OutfitSlot } from '../sim/types';
import type { RoadSpot } from '../sim/road';
import type { HomeRoom } from '../ui/town/rooms';
import type { RaceEvent, RaceClass, RaceCup } from '../sim/stadium';
import type { ItemKind as CatalogItemKind } from '../economy/catalog';
import type { ShopCategory } from '../economy/shop';
import type { AccountSheetReason } from '../ui/AccountSheet';
import type { ParkFindRarity } from '../sim/parkFindsConfig';

export type Species = 'dog' | 'cat';
export type LifeStage = Stage; // puppy | olderPuppy | adolescent | adult | senior
export type MapSpot = RoadSpot; // home | petShop | park | trainingSchool | arcade | stadium
export type Room = HomeRoom['id']; // livingroom | bedroom | catio
export type Place = MapSpot | Room;
export type MiniGameId = 'paddlePaws' | 'cloudHop' | 'stay';
// Tutorial actions are gameplayConfig.goals. Daily slots add hat, park, and find.
// park and parkFind stay distinct. Prefixed slots log the prefix only:
// toy:<id>, practice:<trickId>, progress:<trickId> → toy | practice | progress.
export type ActivityId =
  | 'feed' | 'water' | 'school' | 'play' | 'nap' | 'parkFind' | 'pat' | 'cuddle'
  | 'closet' | 'sit' | 'race' | 'friendGame' | 'hat' | 'park' | 'find'
  | 'toy' | 'practice' | 'progress';
export type SpendCategory = CatalogItemKind | 'trick';
export type ShopSection = 'picks' | 'limited' | 'bundle' | 'collection' | ShopCategory;
export type PromptReason = Exclude<AccountSheetReason, 'restore' | 'reauth' | 'apple_reauth'>;
export type EarnSource =
  | 'away_payout' | 'session_accrual' | 'starter' | 'life_stage' | 'trick_mastered' | 'iap'
  | 'level_up' | 'daily_login' | 'welcome_back' | 'playdate' | 'play_find';
export type HoursAway = '5m-1h' | '1-5' | '5-12' | '12-24' | '24-72' | '72+';
export type OnboardingStep = 'consent_accepted' | 'adopt' | 'attributes' | 'name' | 'meet' | 'home';
export type IapContext = 'petShop' | 'insufficient_boops';
export type BlockContext = 'petShop' | 'trickShop' | 'furnitureBundle';
export type TreatContext = 'training' | 'care' | 'shop';
export type NotifContext = 'friends' | 'race' | 'care';
export type PlaydatePartner = 'npc' | 'friend' | 'retired'; // 'retired' has no call site yet
// Place ids are reused as screen names so screen_view and location_visit join.
export type Screen =
  | 'welcome' | 'consent' | 'adopt' | 'meet'
  | Room | Exclude<MapSpot, 'home'>
  | 'map' | 'closet' | 'storage' | 'collection' | 'race' | 'minigame' | 'petCam' | 'settings' | 'friends';

type Bit = 0 | 1;
type NoParams = Record<string, never>;

export type AnalyticsEvents = {
  // Onboarding
  onboarding_step: { step: OnboardingStep };
  pet_adopted: { species: Species; breed: string; coat_style: string; eye_color: string; archetype: string };
  tutorial_begin: NoParams;
  tutorial_complete: NoParams;
  suggested_activity_complete: { activity_id: ActivityId; list: 'tutorial' | 'daily'; pet_level: number };

  // Core loop
  app_return: { hours_away: HoursAway; tummy: number; energy: number; mood: number; boops_paid: number };
  care_action: { action: 'feed' | 'water' | 'treat' | 'bed' | 'cuddle'; stat_before: number; item_id?: string };
  toy_play: { toy_id: string; place: Place };
  location_visit: { place: Place };
  level_up: { level: number; character: Species };
  unlock_achievement: { achievement_id: string; tier?: number };
  pet_cam_shown: { clip_id: string; night: Bit };
  pet_cam_played: { clip_id: string; night: Bit };
  park_find: { item_id: string; rarity: ParkFindRarity; first_time: Bit };
  collection_open: { found_count: number };
  closet_equip: { slot: OutfitSlot; item_id: string; action: 'on' | 'off' };

  // Training
  trick_attempt: { trick_id: string; success: Bit; treat_given: Bit; at_school: Bit };
  trick_learned: { trick_id: string; attempts_total: number; days_to_learn: number };
  training_break: { trick_id: string; second_wind_owned: number };
  second_wind_used: { trick_id: string };

  // Economy (Boops)
  earn_virtual_currency: { virtual_currency_name: 'Boops'; value: number; source: EarnSource };
  spend_virtual_currency: { virtual_currency_name: 'Boops'; value: number; item_name: string /* catalog id */; category: SpendCategory };
  shop_item_view: { item_id: string; section: ShopSection };
  shop_try_on: { item_id: string };
  shop_add_to_cart: { item_id: string; price_boops: number; section: ShopSection };
  shop_checkout: { total_boops: number; item_count: number };
  insufficient_boops: { context: BlockContext; shortfall: number };
  out_of_treats: { context: TreatContext };

  // Real-money IAP (intent + outcome; revenue comes from Firebase's automatic in_app_purchase)
  iap_view: { context: IapContext };
  iap_pack_tap: { pack_id: string };
  iap_result: { pack_id: string; result: 'success' | 'cancelled' | 'failed'; error_code?: PURCHASES_ERROR_CODE };

  // Accounts & social
  account_prompt: { reason: PromptReason; result: 'accepted' | 'dismissed' };
  sign_up: { method: 'apple' | 'google' };
  login: { method: 'apple' | 'google' };
  notif_permission: { context: NotifContext; granted: Bit };
  friend_request_sent: { via: 'handle' | 'qr' };
  friend_request_response: { result: 'accept' | 'decline' | 'block' };
  share: { content_type: 'invite'; completed: Bit };
  playdate_start: { partner_type: PlaydatePartner; friend_count: number };
  playdate_complete: { partner_type: PlaydatePartner; friend_count: number };

  // Mini-games & races
  minigame_start: { game_id: MiniGameId };
  minigame_end: { game_id: MiniGameId; score: number; duration_s: number };
  post_score: { game_id: MiniGameId; score: number };
  competition_enter: { type: RaceEvent; class: RaceClass; cup: RaceCup; live_players: number };
  competition_result: { type: RaceEvent; class: RaceClass; cup: RaceCup; placement: number; ribbon: Bit };
  competition_blocked: { type: RaceEvent; missing_trick: string };
};

export type UserProps = {
  species: Species;
  breed: string;
  archetype: string;
  life_stage: LifeStage;
  pet_level_bucket: '1-2' | '3-5' | '6-10' | '11-20' | '21+';
  has_account: 'yes' | 'no';
  is_payer: 'yes' | 'no';
  friend_count_bucket: '0' | '1-2' | '3-5' | '6+';
};
```

`string` is allowed only for catalog/code ids (`breed`, `coat_style`, `eye_color`, `archetype`, `item_id`, `item_name`, `trick_id`, `toy_id`, `clip_id`, `pack_id`, `achievement_id`, `missing_trick`), never display names.

```ts
// src/analytics/analytics.ts
import type { AnalyticsEvents, UserProps, Screen, HoursAway } from './events';

type Mod = typeof import('@react-native-firebase/analytics');
let mod: Mod | null = null;
let inst: ReturnType<Mod['getAnalytics']> | null = null;

// 'off' = not allowed (pre-consent, under-13, after reset, failed enable, or non-collecting build): calls are dropped.
// 'enabling' = consent given, native enable in flight: calls queue.
// 'on' = calls go straight through.
let state: 'off' | 'enabling' | 'on' = 'off';
let queue: Array<() => void> = [];

const BUILD_COLLECTS =
  (!__DEV__ && process.env.EXPO_PUBLIC_ANALYTICS_ENABLED === '1') ||
  process.env.EXPO_PUBLIC_ANALYTICS_DEBUG === '1';

function fb() {
  // Lazy: nothing touches Firebase on import (safe for tests and web).
  if (!mod) {
    mod = require('@react-native-firebase/analytics') as Mod;
    inst = mod.getAnalytics();
  }
  return { m: mod, a: inst! };
}

const clean = (p: object | undefined) =>
  Object.fromEntries(Object.entries(p ?? {}).filter(([, v]) => v !== undefined));

/**
 * Call when consent status is playable (teen | adult | atLeast13): after a yes, at startup,
 * and on every foreground. No-op unless 'off', so it doubles as the retry after a failed enable.
 */
export function enableAfterConsent(): void {
  if (!BUILD_COLLECTS || state !== 'off') return;
  state = 'enabling';
  try {
    const { m, a } = fb();
    m.setAnalyticsCollectionEnabled(a, true)
      .then(() => {
        if (state !== 'enabling') {
          // Reset won the race. The in-flight true must not be the last write.
          m.setAnalyticsCollectionEnabled(a, false).catch(() => {});
          return;
        }
        state = 'on';
        const q = queue; queue = [];
        q.forEach(fn => fn());
      })
      .catch(() => {
        if (state !== 'enabling') {
          m.setAnalyticsCollectionEnabled(a, false).catch(() => {});
          return;
        }
        state = 'off';
        queue = [];
      });
  } catch { state = 'off'; queue = []; }
}

function run(fn: (m: Mod, a: NonNullable<typeof inst>) => Promise<unknown>) {
  if (state === 'off') return;
  const call = () => {
    try { const { m, a } = fb(); fn(m, a).catch(() => {}); } catch {}
  };
  if (state === 'enabling') queue.push(call); else call();
}

type Args<E extends keyof AnalyticsEvents> =
  AnalyticsEvents[E] extends NoParams ? [params?: AnalyticsEvents[E]] : [params: AnalyticsEvents[E]];

export function track<E extends keyof AnalyticsEvents>(name: E, ...[params]: Args<E>) {
  const p = clean(params);
  if (__DEV__) console.log(`[analytics${state === 'off' ? ' (dropped)' : ''}]`, name, p);
  run((m, a) => m.logEvent(a, name as string, p));
}

export function trackScreen(screen: Screen) {
  if (__DEV__) console.log(`[analytics${state === 'off' ? ' (dropped)' : ''}] screen`, screen);
  run((m, a) => m.logScreenView(a, { screen_name: screen, screen_class: screen }));
}

/** Supabase user id only. Never the install id. */
export function setPlayer(supabaseUserId: string) {
  run((m, a) => m.setUserId(a, supabaseUserId));
}

export function setProp<K extends keyof UserProps>(key: K, value: UserProps[K]) {
  run((m, a) => m.setUserProperty(a, key, value));
}

/**
 * Account deletion and eraseUnder13(). Never awaited. Bypasses run() so it still
 * force-disables collection when the wrapper is already off. The three native calls
 * are independent: a setUserId failure must not skip the disable.
 */
export function resetAndDisable(): void {
  state = 'off';
  queue = [];
  if (!BUILD_COLLECTS) return;
  try {
    const { m, a } = fb();
    m.setAnalyticsCollectionEnabled(a, false).catch(() => {});
    m.setUserId(a, null).catch(() => {});
    m.resetAnalyticsData(a).catch(() => {});
  } catch {}
}

export const bucketHoursAway = (h: number): HoursAway =>
  h < 1 ? '5m-1h' : h < 5 ? '1-5' : h < 12 ? '5-12' : h < 24 ? '12-24' : h < 72 ? '24-72' : '72+';
export const stat = (n: number) => Math.round(Math.max(0, Math.min(100, n)));
```

Notes: booleans are sent as `0 | 1`. Stats are rounded integers 0–100. Undefined params are stripped before sending. Check the exact modular export names against the installed RNFB version (`logScreenView`, `resetAnalyticsData`) and keep the same wrapper shape if they differ.

## Event catalog and call sites

Each event fires exactly once per real occurrence, after the state change it reports has committed. Never fire on re-render, on an overlay re-opening, or from both a handler and an effect.

### Onboarding

The measurable funnel starts at consent: welcome-screen views and anyone who stops at ConsentScreen are never collected (age-gate rule). That's an accepted blind spot.

| Event | Fires when | Notes |
| --- | --- | --- |
| `onboarding_step` `consent_accepted` | Playable yes on ConsentScreen during first onboarding, immediately after `enableAfterConsent()` | Not on terms-only updates that reopen ConsentScreen |
| `onboarding_step` `adopt` | AdoptScreen first shows (species, breed and coat on one screen) |  |
| `onboarding_step` `attributes` | The attribute-offers step first shows | Sub-step inside the Adopt flow; fire on its state change |
| `onboarding_step` `name` | The name step first shows |  |
| `onboarding_step` `meet` | MeetScreen shows |  |
| `onboarding_step` `home` | HomeScreen first shows after adoption |  |
| `pet_adopted` | Pet is created and saved | `coat_style` and `eye_color` are ids, `archetype` = chosen attribute set |
| `tutorial_begin` | First tutorial goal is shown to a new pet | Once per pet |
| `tutorial_complete` | Every tutorial goal is complete |  |
| `suggested_activity_complete` | Any tutorial goal or daily-list item completes | `activity_id` is a tutorial goal action (`feed`, `parkFind`, `school`, …), a fixed daily slot (`hat`, `park`, `find`, …), or the prefix `toy`, `practice`, or `progress`. Strip `toy:<id>`, `practice:<trickId>`, and `progress:<trickId>` down to that prefix. Never send the `tutorial:` prefix or the label. `park` and `parkFind` stay distinct |

Each step fires once per onboarding run; going back and forward doesn't re-fire.

### Core loop

| Event | Fires when | Notes |
| --- | --- | --- |
| `app_return` | Cold start or foreground, when local `lastBackgroundAt` is ≥ 5 minutes old | See mechanics below |
| `care_action` | Feed, water, treat, bed or cuddle completes (including tap-on-prop the pet finishes later) | `stat_before` = the targeted stat before it changes; `item_id` only for treats and premium food |
| `toy_play` | Each toy session starts (first throw/fling, or feather wand/laser pointer picked up) | Not per throw |
| `location_visit` | Pet arrives at a map spot, or the room changes | `place` = the code's spot and room ids. Closing an overlay back to a room does not fire this |
| `level_up` | Pet level increases |  |
| `unlock_achievement` | A badge or badge tier is awarded |  |
| `pet_cam_shown` / `pet_cam_played` | Pet Cam overlay appears / play tapped | The only Pet Cam events; no `petcam_*` set |
| `park_find` | Add-to-collection tapped | `rarity` = `ParkFindRarity`; `first_time` = 1 if new to the collection |
| `collection_open` | Treasure Chest collection opens |  |
| `closet_equip` | Item put on or taken off in the Closet | `slot` = `OutfitSlot`; a replace = one `off` + one `on` |

**`app_return` mechanics:**

1. Keep `lastBackgroundAt` in device-local storage (the same local store the app already uses for device-only values), never in the synced pet or player document.
2. Write it to now on every transition to background, so a process killed while backgrounded still counts.
3. On cold start and on `active`: read it. If missing (first launch) or under 5 minutes old, skip.
4. Otherwise compute decay and the away payout, fire `app_return` once (stats rounded 0–100, `boops_paid` = the away payout or 0), then immediately set `lastBackgroundAt` to now. A second reader in the same launch (the startup path and the `active` event both see it on cold start) then sees under 5 minutes and skips.

### Training

| Event | Fires when | Notes |
| --- | --- | --- |
| `trick_attempt` | Each attempt resolves (after the treat yes/no on success) | `treat_given` = 0 on failure |
| `trick_learned` | Trick reaches 100% and moves to learned tricks | `days_to_learn` = whole days since purchase (starter tricks: since adoption) |
| `training_break` | Needs-a-break modal shown |  |
| `second_wind_used` | Second Wind cookie consumed | Buying it is a separate `spend_virtual_currency` |

### Economy

One `earn_virtual_currency` per successful credit, fired after the write commits, skipping amounts of 0. No background rollup. Dashboards total Boops earned by summing `earn_virtual_currency.value` only; `app_return.boops_paid` repeats the away payout for the return report and must not be added to it.

| Code path | `source` |
| --- | --- |
| `payoutTimeAccrual('return')` | `away_payout` |
| `payoutTimeAccrual('live')` | `session_accrual`, one event per payout (each 15-Boop step) |
| `starter_grant` via `grantLines` | `starter` |
| `milestone` with a `stage:` key | `life_stage` |
| `milestone` with a trick key | `trick_mastered` |
| `iapApply.ts`: `iap_purchase`, `iap_refund_reversed` | `iap` (positive amounts only; refunds are not logged as earn) |
| `level_up`, `daily_login`, `welcome_back`, `playdate`, `play_find` | Same names |
| `grantDevBoops` | Never logged |

Log at each of these sites (or one switch over the grant reason), not with a generic hook on `grantBoops`, since live and away payouts share `grantBoops('time_payout', …)` and IAP credits never pass through it.

| Event | Fires when | Notes |
| --- | --- | --- |
| `spend_virtual_currency` | Once per catalog item when Boops are deducted | Item-deduct hook; `item_name` = catalog id; `category` = catalog `ItemKind` |
| `spend_virtual_currency` `trick` | Training School trick purchase | Logged at the trick-purchase site with `category: 'trick'`, since tricks aren't a catalog `ItemKind`. A furniture bundle logs the trick and the prop separately if they're deducted separately |
| `shop_item_view` | Item detail opens in the Pet Shop or Trick Shop | `section` = picks, limited, bundle, collection, or the `ShopCategory` |
| `shop_try_on` | Try-on applied in the shop |  |
| `shop_add_to_cart` | Item added to cart |  |
| `shop_checkout` | Checkout succeeds |  |
| `insufficient_boops` | Purchase blocked by balance | `shortfall` = price − balance |
| `out_of_treats` | Treat offered or requested with 0 owned |  |
| `iap_view` | Boops packs shown | `context` is `petShop` or `insufficient_boops`. `GetBoopsSheet` only opens from `PetShopScreen`; there is no settings pack screen |
| `iap_pack_tap` | Pack tapped |  |
| `iap_result` | RevenueCat purchase call returns | `error_code` = RevenueCat's code enum only, never its message. Never log `purchase` or revenue manually |

### Accounts and social

| Event | Fires when | Notes |
| --- | --- | --- |
| `account_prompt` | AccountSheet closes for reasons `friends`, `purchase`, `day3`, `settings`, `score` | `accepted` = the link or sign-in succeeded before the sheet closed; closing after a cancelled provider sheet = `dismissed`. Not logged for `restore`, `reauth`, `apple_reauth` (covered by `login`) |
| `sign_up` / `login` | Apple/Google sign-in completes | `sign_up` when it links a guest to a new account |
| `notif_permission` | OS permission dialog resolves | `context`: `friends` (`requestFriendPermission`), `race` (`askRaceReminderPermission`), `care` (`syncReminder`). Only when the system dialog actually showed |
| `friend_request_sent` | Request sent | `via: qr` when the handle came from a scanned code |
| `friend_request_response` | Accept, decline or block |  |
| `share` | Invite share sheet closes | `completed` from the share result |
| `playdate_start` / `playdate_complete` | Playdate begins / its reward is granted | `friend_count` = friend pets in the session, 0 for an NPC. `retired` has no call site yet |

### Mini-games and races

| Event | Fires when | Notes |
| --- | --- | --- |
| `minigame_start` / `minigame_end` | A run starts / ends (death, finish or quit) | `game_id`: paddlePaws, cloudHop, stay |
| `post_score` | Score submitted to the leaderboard |  |
| `competition_enter` | Pet placed at the starting gate | `type` = `RaceEvent`, `class` = `RaceClass`, `cup` = `RaceCup`; `live_players` includes this player |
| `competition_result` | Results screen shown | `ribbon` = 1 for places 1–3 (they already write a ribbon) |
| `competition_blocked` | Skill-check message shown |  |

If a feature in these tables isn't built yet, keep the type, skip the call site, and list it in your summary.

## User properties

Set these with `setProp` whenever the underlying value changes, so every report can be filtered by them.

| Property | Set when | Values |
| --- | --- | --- |
| `species` | Adoption; startup | dog, cat |
| `breed` | Adoption; startup | Breed id |
| `archetype` | Adoption; startup | Attribute-set id |
| `life_stage` | Startup; when stage changes | The app's `LifeStage` ids (also used for kittens) |
| `pet_level_bucket` | Startup; on level-up | 1-2, 3-5, 6-10, 11-20, 21+ |
| `has_account` | Startup; after a link or sign-in; after deletion | `yes` only when the Supabase user is linked (`is_anonymous === false`). Guests have an anonymous id from consent and are `no` |
| `is_payer` | Startup; when an IAP succeeds | `yes` when `iapPurchaseKeys()` in `src/economy/iapApply.ts` is non-empty. Those keys are the `iap_purchase` credits and come back with a restore, so do not keep a second device-local flag. Set it again when a purchase succeeds. Never infer it from the Boops balance |
| `friend_count_bucket` | Startup; when the friend list changes | 0, 1-2, 3-5, 6+ |

At startup, once the player and pet load and `enableAfterConsent()` has been called, set all of them from current state so they stay correct if a change was missed. Before consent they are dropped like everything else.

## Screen tracking

There is no navigator: `App.tsx` swaps top-level screens, and everything else is an overlay inside HomeScreen. Screen views are logged from those state changes with `trackScreen`, using the `Screen` union in `events.ts`.

| Screen | Logged when |
| --- | --- |
| `welcome`, `consent` | Top-level screen switches in `App.tsx` (dropped by design until consent, kept for completeness) |
| `adopt`, `meet` | Top-level screen switches in `App.tsx` |
| `livingroom`, `bedroom`, `catio` | Home shows with that room, the room changes, or an overlay closes back to the room |
| `map` | Map overlay opens |
| `park`, `trainingSchool`, `stadium`, `arcade` | Pet arrives at that spot |
| `petShop` | Pet Shop opens |
| `closet`, `storage`, `collection` | Those overlays open |
| `race` | A race starts (the starting gate) |
| `minigame` | A mini-game opens (the game id goes on `minigame_start`) |
| `petCam` | Pet Cam overlay appears |
| `settings`, `friends` | Those pages open |

Place screens use the same ids as `location_visit.place` so the two join. Log on open only. When an overlay closes back to home, call `trackScreen` for the room again (time-on-screen stays correct) but do not fire another `location_visit`. Modals (treat yes/no, training break, AccountSheet) are not screens; their events are enough. Automatic native screen reporting is off (Setup step 1).

## Do-not-log and privacy follow-ups

Google's terms forbid sending personal info to Analytics, and every value here must be safe to show on a dashboard.

**Never send:**

- Anything from a player before a playable consent status, and anything at all from an under-13 answer
- Pet names, player handles, friend handles or any other typed text
- The install id, emails, Apple/Google account ids, push tokens
- Supabase auth tokens or anything from the auth session (the Supabase user id via `setPlayer` is the only identifier)
- Error messages of any kind, including RevenueCat's (codes only)

**Founder follow-ups (not Cursor tasks), before this build ships:**

- [ ] App Store privacy label: add Usage Data (Product Interaction) and Diagnostics, linked to user (because of `setUserId`), not used for tracking
- [ ] Google Play Data safety: add App activity (app interactions) and App info and performance
- [ ] Privacy policy at boopboop.mylisto.app: name Google Analytics for Firebase as a service provider collecting app usage data from players 13+
- [ ] Firebase console: register these params as custom dimensions so they appear in reports (limit 50 event-scoped): `step`, `place`, `source`, `reason`, `hours_away`, `category`, `trick_id`, `species`, `type`, `game_id`
- [ ] Firebase console: set data retention to 14 months
- [ ] Server-side deletion: the client reset doesn't delete data Google already stored. For an account deletion or an under-13 erase, delete that user's GA4 data with the User Deletion API (by user id) or the console's user-deletion request. Decide whether to automate this from the delete-account flow or handle requests manually
- [ ] Pick one revenue source: either Firebase's automatic `in_app_purchase` or RevenueCat's Firebase integration, not both

## Build order and acceptance checks

Ship in three passes so activation and retention data starts flowing first. Pass 1 needs a new native build.

1. **Pass 1 — foundation and core events.** Setup (including the new EAS build), wrapper, consent gating, user id, screen tracking, user properties, then: `onboarding_step`, `pet_adopted`, `app_return`, `care_action`, `location_visit`, `level_up`, `trick_learned`, `earn_virtual_currency`, `spend_virtual_currency`, `insufficient_boops`, `iap_result`.
2. **Pass 2 — economy and training.** Remaining Economy and Training events, tutorial and suggested activities, badges, Closet, park finds, Pet Cam.
3. **Pass 3 — social and competitive.** Accounts and social, mini-games, competitions.

**Acceptance checks (each pass):**

- [ ] `tsc` passes; `track` with an unknown event, a wrong param, or a string outside its union fails to compile; `track('tutorial_begin')` compiles with no second argument
- [ ] No file outside `src/analytics/` imports `@react-native-firebase/analytics`; importing `analytics.ts` in a test doesn't touch Firebase
- [ ] With debug on, a fresh install that answers no on ConsentScreen sends nothing to DebugView, before or after `eraseUnder13()`
- [ ] A teen who is later downgraded to under-13 stops sending immediately, and nothing is sent on the next launch. That still holds when the downgrade happens while enable is in flight, and when `setUserId` fails
- [ ] A fresh install that answers yes shows `onboarding_step consent_accepted` in DebugView (not lost while enabling)
- [ ] Preview and development builds without the debug flag send nothing; dev console marks those calls as dropped
- [ ] `setUserId` is only ever called with a Supabase user id, never the install id
- [ ] Killing the app in the background and reopening after 5+ minutes fires exactly one `app_return`; first launch fires none
- [ ] Each Boops credit produces exactly one `earn_virtual_currency` with the mapped source; a live payout isn't logged twice; `grantDevBoops` logs nothing; `iap_refund` logs nothing
- [ ] Undefined params never reach `logEvent`
- [ ] One console line per action; no duplicates on re-render, overlay reopen or app resume
- [ ] Airplane mode or a forced Firebase error doesn't throw or slow any interaction; account deletion completes without waiting on analytics
- [ ] Android merged manifest has no `AD_ID` permission; iOS build doesn't link AdSupport
- [x] `docs/firebase.md`, the Pet Cam brief and the accounts/friends brief point here
- [x] Call sites left unlogged, with the types kept: playdate partner `retired`; race types `sniffOut`, `trickShow`, and `weave` (no playable screen); IAP context `insufficient_boops` (Get Boops opens only from the pet shop, so `iap_view` uses `petShop`)
