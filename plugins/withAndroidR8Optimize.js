const { withAppBuildGradle, withGradleProperties } = require('@expo/config-plugins');

const OPTIMIZE_FILE = 'proguard-android-optimize.txt';
const LEGACY_FILE = 'proguard-android.txt';
const SHRINK_KEY = 'android.r8.optimizedResourceShrinking';

// SDK 57's Android template minifies with proguard-android.txt, which sets
// -dontoptimize. Play Console reports that as "Optimization isn't enabled"
// even when minify and resource shrinking are already on. AGP 8.12 (React
// Native 0.86) also needs this property for optimized resource shrinking.
// AGP 9 turns that on by itself, and SDK 57 cannot move to AGP 9.
function withAndroidR8Optimize(config) {
  config = withAppBuildGradle(config, (mod) => {
    mod.modResults.contents = mod.modResults.contents.replaceAll(
      `getDefaultProguardFile("${LEGACY_FILE}")`,
      `getDefaultProguardFile("${OPTIMIZE_FILE}")`,
    );
    return mod;
  });

  config = withGradleProperties(config, (mod) => {
    const existing = mod.modResults.find((item) => item.type === 'property' && item.key === SHRINK_KEY);
    if (existing) {
      existing.value = 'true';
    } else {
      mod.modResults.push({ type: 'property', key: SHRINK_KEY, value: 'true' });
    }
    return mod;
  });

  return config;
}

module.exports = withAndroidR8Optimize;
