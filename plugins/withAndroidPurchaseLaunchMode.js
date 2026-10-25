const { withAndroidManifest } = require('@expo/config-plugins');

// Google Play can cancel a purchase when the user leaves the app to approve
// payment if the activity launchMode is singleTask. singleTop keeps the purchase alive.
function withAndroidPurchaseLaunchMode(config) {
  return withAndroidManifest(config, (mod) => {
    const activities = mod.modResults.manifest.application?.flatMap((application) => application.activity ?? []) ?? [];
    for (const activity of activities) {
      const name = activity.$?.['android:name'] ?? '';
      if (name === '.MainActivity' || name.endsWith('.MainActivity')) {
        activity.$ = { ...activity.$, 'android:launchMode': 'singleTop' };
      }
    }
    return mod;
  });
}

module.exports = withAndroidPurchaseLaunchMode;
