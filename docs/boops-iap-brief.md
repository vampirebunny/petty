# Buying Boops (IAP via RevenueCat)

Players buy Boops packs, then spend Boops in the Pet Shop and Training School as they do today. Shop item prices are separate. The Golden Crown is hidden and is not part of this work.

The Get Boops sheet and its art are in the Pet Shop. A price button buys that consumable pack. The Boops land in the server ledger, then on this phone. Apple and Google require that a guest can pay without creating an account. The account prompt stays after a successful purchase. Android is the live store. iOS is waiting on App Review and is not connected yet.

## Shipped

- Six SVGs in `assets/boops-packs/`. Cards use `art_key`, at width 84 in a 70-tall box, bottom-aligned. See [boops-pack-art-brief.md](boops-pack-art-brief.md).
- A Get Boops button under the pet scene opens the sheet. Price buttons show the store `priceString`, with no coin, and call `buyBoopsPack` (`src/economy/buyBoops.ts`).
- While the age gate is `unavailable`, the sheet says "Can't reach the store right now" and offers Try again. Packs stay hidden until it is `ready`. Sparkles are still when Reduce Motion is on, and they stop when the sheet closes.
- The balance-pill "+" and the shortfall prompt are not wired. The home counter still opens the Pet Shop.
- `react-native-purchases` 10.15.1. Android resolves Play Billing Library 8.3.0 through that SDK. Do not add `com.android.vending.BILLING` to `app.json`. The library manifest supplies the permission and `com.google.android.play.billingclient.version`. Play Console keeps reporting AIDL until a new Android build that includes this SDK is the one it reviews.
- `syncPurchasesUser` (`src/economy/purchasesUser.ts`), called from `useIdentity`. A guest is the install id. `Purchases.configure` always receives that id, so RevenueCat does not mint `$RCAnonymousID`. When a Supabase auth user id exists, anonymous or linked, `Purchases.logIn` runs only if the id changed. `Purchases.logOut` is never called. Linking in place keeps the same id, so it does not call `logIn`. The iOS key is `EXPO_PUBLIC_REVENUECAT_IOS_KEY` and the Android key is `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`. The app does not read a Test Store key. Expo Go leaves RevenueCat unconfigured.
- `loadBoopsPrices` (`src/economy/boopsOffering.ts`) runs after configure finishes. It calls `Purchases.getOfferings()` and reads `offerings.current`, the Offering marked current in the dashboard. Development and production use that same Offering. Cards match `package.product.identifier` to the local pack id. A missing pack is hidden and logged. If the Offering is missing or no pack resolves, the sheet says "Can't reach the store right now". Try again refreshes the age gate and loads the Offering again. `loadBoopsPackage` returns the package `purchasePackage` buys.
- `boops_600`, `boops_2000`, `boops_3500`, `boops_7500`, `boops_16000`, and `boops_45000` are the consumable product ids on App Store Connect, Play Console, and RevenueCat.
- `EXPO_PUBLIC_REVENUECAT_IOS_KEY` and `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` are set on the EAS development, preview, and production environments. `.env.local` is not uploaded. `EXPO_PUBLIC_REVENUECAT_TEST_STORE_KEY` is set there too and the app does not read it. Purchases need a development build. Expo Go cannot complete a store purchase.
- A purchase waits for `ensureAnonymousUserId()`, then `Purchases.logIn` to that id. If RevenueCat's app user id is still the install id, the button does not charge and the sheet says "Can't reach the store right now". Checkout still does not ask the player to create an account. The anonymous user is the one consent sync creates after the age gate.
- Cancel does nothing. Pending shows "Waiting for approval. Your Boops will arrive once it's approved." Errors use the store message where it is safe, and "You weren't charged" only when the SDK message says the player was not charged. 13–17 players use Apple and Google family approval only. There is no extra in-app age gate beyond `ready`.
- After the store accepts the purchase, the sheet says "Adding your Boops…" and waits up to 30 seconds. Then it says "Your Boops are on the way. They'll appear shortly." A later apply still plays the burst.
- Migration `20261028170000_iap_boops.sql` is applied on `unfatkwtzfkqnnbgzuqs`. It adds `webhook_events`, `boops_packs`, `iap_events`, and `apply_iap_webhook`. `boops_packs` holds `product_id`, `boops`, `tag`, `sort_order`, `active`, and `art_key`. `iap_events` is unique on `(transaction_id, reason)` globally, not per user.
- Edge function `revenuecat-webhook` is deployed with `verify_jwt = false`. It requires `REVENUECAT_WEBHOOK_SECRET` to match the RevenueCat `Authorization` header. Anything else is 401. The URL is `https://unfatkwtzfkqnnbgzuqs.supabase.co/functions/v1/revenuecat-webhook`. `service_role` does not get table writes by default in this project, so `20261028180000_iap_service_grants.sql` grants it insert and update on `webhook_events` and select on `boops_packs`.
- Every raw webhook is saved in `webhook_events` (event id, body, status) before crediting. `NON_RENEWING_PURCHASE` inserts `ledger_entries` kind `earn`, source `iap_purchase`, lines `[{ asset: 'boops', qty }]`, idempotency key = the store transaction id. The qty comes from `boops_packs`. An unknown `product_id`, or an `app_user_id` that is not an `auth.users` id (aliases are checked first), returns 5xx so RevenueCat retries. Duplicates return 200. `TEST` and `TRANSFER` are saved and not credited.
- `CANCELLATION` inserts kind `reversal`, source `iap_refund`, idempotency key `<transaction id>:refund`, `reverses_key` pointing at the purchase. `qty` is the original credit as a negative. If that purchase row is not there yet, the function returns 5xx. `REFUND_REVERSED` credits that same qty with source `iap_refund_reversed` and key `<transaction id>:refund_reversed`, only when a matching `iap_refund` row exists. `environment` is stored on `iap_events`, including `SANDBOX`. Sandbox purchases credit like production. Exclude those rows from revenue reporting.
- `iap` is not in `earn_rules`. The service role inserts these rows through `apply_iap_webhook`. `append_ledger_entries` keeps rejecting them.
- `pullIapCredits` (`src/economy/iapApply.ts`) runs on launch, whenever the app returns to the foreground (including when the Play or App Store sheet closes), and during the 30-second wait. It pulls this player's `ledger_entries` whose source is `iap_purchase`, `iap_refund`, `iap_refund_reversed`, or `sandbox_wipe`, applies any this phone does not have, and skips the outbox. Other earn and spend rows still go through reconcile. The apply writes the balance directly, including below zero. `setBalance` still throws below zero, so spending stays blocked while the balance is negative and the counter shows the real number. Each newly applied `iap_purchase` or `iap_refund_reversed` plays one coin burst and count-up, even if the sheet is closed.

## Open

- [ ] One sandbox purchase on Android: confirm the transaction id from `purchasePackage` is the idempotency key the webhook writes. Repeat on iOS after that app is connected.
- [ ] Add the "+" on the Boops counter everywhere that pill is shown, and open this same sheet.
- [ ] On Pet Shop or Trick Shop Buy with too few Boops, open shortfall mode: item name and the amount missing. Highlight the smallest pack that covers it. If none covers it, highlight nothing and keep the normal banner. Do not suggest buying several packs. After the credit, close the sheet and return to the item. Do not auto-buy.
- [ ] The sheet still reads the local stand-in in `src/economy/boopsPacks.ts`. Point it at `boops_packs` when that table should drive tags and amounts.
- [ ] A sandbox wipe inserts offsetting `sandbox_wipe` reversals. Do not delete ledger rows. The phone already applies that source. Nothing writes it yet.
- [ ] Connect the iOS app in RevenueCat when App Review clears it. The same webhook covers both stores.

### Guest who buys, then signs into an existing account

Checkout never asks the player to create an account. A purchase does not start until the anonymous Supabase user exists, and RevenueCat is that user, so the webhook can insert `ledger_entries`. A webhook that still names an install id returns 5xx and retries. If RevenueCat has already aliased that install id to an auth user, the alias list is tried first.

Linking in place (`linkIdentity`) keeps the auth user id, so those rows do not move. Signing into an account that already exists deletes the guest today, and `ledger_entries` cascades with them.

- [ ] Inside `supersede_guest`, before `pull_account_state`: upsert `guest_id → account user_id`, then move that guest's `iap_purchase`, `iap_refund`, `iap_refund_reversed`, and `sandbox_wipe` rows onto the account. Leave spend, earn, and consume rows on the guest.
- [ ] If the account already has the same idempotency key, keep the account row and drop the guest copy.
- [ ] Resolve `app_user_id` through the alias before crediting, so a webhook that still names the guest lands on the account. The alias exists before the move.
- [ ] Pull after the move, then delete the guest. The account balance includes the full pack amount. Items the guest already bought do not come with it.

## Not in this work

- `ACCOUNT_PROMPT_PURCHASE` stays false. When the accounts work turns it on, it shows only after the coin burst, never over the payment sheet.
- Earned Boops stay client-trusted. Server checks for earned entries are a later currency-hardening pass.
- No Restore Purchases button. These products are consumables.
- No urgency or countdown on the sheet.

## Packs

| Product ID | Price (US, reference only) | Boops | Tag |
|---|---|---|---|
| `boops_600` | $0.99 | 600 | |
| `boops_2000` | $2.99 | 2,000 | |
| `boops_3500` | $4.99 | 3,500 | Popular |
| `boops_7500` | $9.99 | 7,500 | |
| `boops_16000` | $19.99 | 16,000 | |
| `boops_45000` | $49.99 | 45,000 | Best value |

US prices are not shown in the app. The most expensive shop item is 8,000 Boops, so one pack always covers a shortfall in the current catalog.
