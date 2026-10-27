# Buying Boops (IAP via RevenueCat)

Players buy Boops packs, then spend Boops in the Pet Shop and Training School as they do today. Shop item prices are separate. The Golden Crown is hidden and is not part of this work.

The Get Boops sheet and its art are in the Pet Shop. The sheet shows store prices and still does not charge. RevenueCat is installed and identified. Do the rest from the open list below. Confirm the store product ids before writing the purchase code. Apple and Google require that a guest can pay without creating an account. The account prompt stays after a successful purchase.

## Shipped

- Six SVGs in `assets/boops-packs/`. Cards use `art_key`, at width 84 in a 70-tall box, bottom-aligned. See [boops-pack-art-brief.md](boops-pack-art-brief.md).
- A Get Boops button under the pet scene opens the sheet. Price buttons show the store `priceString`, with no coin, and are not tappable yet.
- While the age gate is `unavailable`, the sheet says "Can't reach the store right now" and offers Try again. Packs stay hidden until it is `ready`. Sparkles are still when Reduce Motion is on, and they stop when the sheet closes.
- The balance-pill "+" and the shortfall prompt are not wired. The home counter still opens the Pet Shop.
- `react-native-purchases` 10.15.1. Android resolves Play Billing Library 8.3.0 through that SDK. Do not add `com.android.vending.BILLING` to `app.json`. The library manifest supplies the permission and `com.google.android.play.billingclient.version`. Play Console keeps reporting AIDL until a new Android build that includes this SDK is the one it reviews.
- `syncPurchasesUser` (`src/economy/purchasesUser.ts`), called from `useIdentity`. A guest is the install id. `Purchases.configure` always receives that id, so RevenueCat does not mint `$RCAnonymousID`. When a Supabase auth user id exists, anonymous or linked, `Purchases.logIn` runs only if the id changed. `Purchases.logOut` is never called. Linking in place keeps the same id, so it does not call `logIn`. The iOS key is `EXPO_PUBLIC_REVENUECAT_IOS_KEY` and the Android key is `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`. There is no Test Store key. Expo Go leaves RevenueCat unconfigured.
- `loadBoopsPrices` (`src/economy/boopsOffering.ts`) runs after configure finishes. It calls `Purchases.getOfferings()` and reads `offerings.current`, the Offering marked current in the dashboard. Development and production use that same Offering. Cards match `package.product.identifier` to the local pack id. A missing pack is hidden and logged. If the Offering is missing or no pack resolves, the sheet says "Can't reach the store right now". Try again refreshes the age gate and loads the Offering again.

## Open

### Before any purchase code

- [ ] Confirm `boops_600`, `boops_2000`, `boops_3500`, `boops_7500`, `boops_16000`, and `boops_45000` match App Store Connect, Play Console, and the RevenueCat product identifier. Each RevenueCat product is a consumable. Flag a mismatch instead of guessing.
- [ ] One sandbox purchase on each store: the product id and transaction id from `purchasePackage` are the ids the webhook writes.

### SDK

- [ ] Set `EXPO_PUBLIC_REVENUECAT_IOS_KEY` and `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` on the EAS development, preview, and production environments. `.env.local` is not uploaded. Purchases need a development build. Expo Go cannot complete a store purchase.

### Sheet

- [ ] Add the "+" on the Boops counter everywhere that pill is shown, and open this same sheet.
- [ ] On Pet Shop or Trick Shop Buy with too few Boops, open shortfall mode: item name and the amount missing. Highlight the smallest pack that covers it. If none covers it, highlight nothing and keep the normal banner. Do not suggest buying several packs. After the credit, close the sheet and return to the item. Do not auto-buy.
- [ ] Cancel does nothing. Pending shows "Waiting for approval. Your Boops will arrive once it's approved." Errors use the store message where it is safe, and "You weren't charged" only when the SDK says so.
- [ ] 13–17 players use Apple and Google family approval only. No extra in-app age gate beyond `ready`.

### Server credit

The balance on screen is the local SQLite ledger. A webhook insert alone does not move it.

- [ ] Edge function `revenuecat-webhook` with `verify_jwt = false`. Require the RevenueCat `Authorization` secret. Anything else is 401.
- [ ] Save every raw webhook in `webhook_events` (event id, body, status) before crediting, so a finite retry can be replayed by hand.
- [ ] Credit `NON_RENEWING_PURCHASE` as `ledger_entries` kind `earn`, source `iap_purchase`, lines `[{ asset: 'boops', qty }]`, idempotency key = the store transaction id.
- [ ] Debit `CANCELLATION` as kind `reversal`, source `iap_refund`, `reverses_key` pointing at that purchase, `qty` the original credit as a negative. Never use the current `boops_packs` amount. If the purchase row is not there yet, return 5xx.
- [ ] `REFUND_REVERSED` credits that same qty with source `iap_refund_reversed`, only when a matching `iap_refund` row exists.
- [ ] Unknown `product_id` returns 5xx so RevenueCat retries. Do not return 200 for a paid purchase that was not credited.
- [ ] Unique on `(transaction_id, reason)` globally, not per user. Duplicates return 200. `TRANSFER` is logged and not credited.
- [ ] Do not add `iap` to `earn_rules`. The service role inserts these rows. `append_ledger_entries` keeps rejecting them.
- [ ] `boops_packs` holds `product_id`, `boops`, `tag`, `sort_order`, `active`, and `art_key`. The sheet reads that table instead of the local stand-in in `src/economy/boopsPacks.ts`.
- [ ] Sandbox purchases credit like production with `environment = 'SANDBOX'`. Exclude those rows from revenue reporting. A sandbox wipe inserts offsetting `sandbox_wipe` reversals. Do not delete ledger rows.

### Phone apply

- [ ] On the "Adding your Boops…" wait, on every launch, and whenever the app returns to the foreground (including when the Apple or Google sheet closes), pull `ledger_entries` this phone does not have whose source is `iap_purchase`, `iap_refund`, `iap_refund_reversed`, or `sandbox_wipe`. Apply them locally, idempotent on the store transaction id, with the outbox skipped.
- [ ] Do not pull other players' or other devices' earn and spend rows on that path. Those still go through reconcile.
- [ ] The apply allows a negative balance. `setBalance` throws below zero today, so a refund cannot use it. Spending stays blocked while the balance is negative, and the counter shows the real number.
- [ ] Each newly applied `iap_purchase` or `iap_refund_reversed` plays one coin burst and count-up, even if the sheet is closed. The burst queue already plays them one at a time.
- [ ] Wait up to 30 seconds for the matching transaction id. Then say "Your Boops are on the way. They'll appear shortly." A later apply still plays the burst.

### Guest who buys, then signs into an existing account

Checkout never asks the player to create an account. A purchase made before any Supabase user uses the install id as RevenueCat `app_user_id`. The webhook credits that id. `logIn` later aliases it to the auth user.

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
