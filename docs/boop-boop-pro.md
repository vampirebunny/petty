# Boop Boop Pro

Subscriptions and the lifetime purchase go through RevenueCat (`react-native-purchases` and `react-native-purchases-ui`). Pro is the `boop_boop_pro` entitlement. The products on the current offering are `lifetime` (one-time), `yearly`, and `monthly`.

Settings shows **Boop Boop Pro**, which presents the RevenueCat paywall when that entitlement is missing, and **Manage Boop Boop Pro**, which opens Customer Center once it is active. `usePro().isPro` is the check for a later feature. It does not gate pet care, the shop, or Boops.

This is separate from the Boops store webhook in [Boop Boop — Currency System Architecture.md](Boop%20Boop%20%E2%80%94%20Currency%20System%20Architecture.md). That webhook is not built here. The client never writes a real-money Boops grant.

## Where it lives

- `src/purchases/revenueCat.ts` configures the SDK, checks `boop_boop_pro`, buys a package from the current offering, and presents the paywall and Customer Center.
- `src/state/usePro.ts` starts that work after identity is ready and keeps customer info updated.
- `plugins/withAndroidPurchaseLaunchMode.js` sets the Android activity to `singleTop` so a Play purchase survives when the player leaves the app to approve payment.

A linked account is identified with `Purchases.logIn`. A guest stays anonymous so a later sign-in can alias the purchase. Deleting the local account calls `Purchases.logOut`.

## Keys

The Test Store key in `src/purchases/revenueCat.ts` is used on iOS and Android only while `__DEV__` is true. Release builds never use a `test_` key, because the SDK crashes when one is shipped. Preview and production read:

```sh
EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY
EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY
```

Set those on the Expo project for `preview` and `production`, the same way as the Supabase vars. If either is missing in a release build, Purchases stays unconfigured and the app still opens. Web skips Purchases.

## Dashboard

In the RevenueCat project for this app:

- Entitlement: `boop_boop_pro`
- Products, each attached to that entitlement: `lifetime`, `yearly`, `monthly`
- One current offering that contains all three
- A Paywall on that offering
- A Customer Center (restore, manage subscription, and the iOS refund request)

Enable In-App Purchase on the App ID `app.mylisto.boop` before an App Store build. The Test Store does not need that.

## Trying a purchase

A development build is required. Expo Go only runs RevenueCat's preview mocks, so a paywall there does not complete a real purchase.

```sh
npx expo run:ios
npx expo run:android
```

Open Settings, buy a Test Store product, and confirm the row switches to Manage. Customer Center restores from there.
