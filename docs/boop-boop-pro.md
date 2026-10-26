# Boop Boop Pro

There is no Boop Boop Pro subscription, lifetime unlock, or paywall. Settings does not offer one, and nothing in the app checks a Pro entitlement. Pet care, the shop, friends, and Boops stay available without a purchase.

`react-native-purchases`, `react-native-purchases-ui`, and the Android purchase launch-mode plugin are not part of the app. Do not add a RevenueCat paywall or Customer Center for a Pro plan.

Real-money Boops, if they are added later, are a separate consumable purchase. They are credited only by the store webhook described in [Boop Boop — Currency System Architecture.md](Boop%20Boop%20%E2%80%94%20Currency%20System%20Architecture.md). The client never writes that grant. That work is not built, and it is not a subscription.
