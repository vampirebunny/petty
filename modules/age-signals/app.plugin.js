const { withEntitlementsPlist } = require('@expo/config-plugins');

// Keep the entitlement on the native entitlements file during prebuild. The same key is also
// declared in app.json under ios.entitlements so signing tools can see it without running mods.
function withAgeSignals(config) {
  return withEntitlementsPlist(config, (mod) => {
    mod.modResults['com.apple.developer.declared-age-range'] = true;
    return mod;
  });
}

module.exports = withAgeSignals;
