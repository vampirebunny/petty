const { withEntitlementsPlist } = require('@expo/config-plugins');

function withAgeSignals(config) {
  return withEntitlementsPlist(config, (mod) => {
    mod.modResults['com.apple.developer.declared-age-range'] = true;
    return mod;
  });
}

module.exports = withAgeSignals;
