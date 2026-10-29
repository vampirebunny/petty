const path = require('path');
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const config = getSentryExpoConfig(__dirname);
config.watchFolders = [...(config.watchFolders ?? []), path.resolve(__dirname, 'supabase/functions/_shared')];

module.exports = config;
