const { withInfoPlist } = require('@expo/config-plugins');

const phone = ['UIInterfaceOrientationPortrait'];
const pad = [
  'UIInterfaceOrientationPortrait',
  'UIInterfaceOrientationPortraitUpsideDown',
  'UIInterfaceOrientationLandscapeLeft',
  'UIInterfaceOrientationLandscapeRight',
];

// iPhone stays portrait. iPad may rotate. Doing this in Info.plist avoids
// UIDevice.orientation, which UIKit rejects in favor of UIWindowScene.requestGeometryUpdate.
function withPhonePortrait(config) {
  return withInfoPlist(config, (mod) => {
    mod.modResults.UISupportedInterfaceOrientations = phone;
    mod.modResults['UISupportedInterfaceOrientations~ipad'] = pad;
    delete mod.modResults.EXDefaultScreenOrientationMask;
    return mod;
  });
}

module.exports = withPhonePortrait;
