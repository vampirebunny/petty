// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const globals = require('globals');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'supabase/functions/**'],
  },
  {
    files: ['scripts/**/*.js', 'tools/**/*.mjs'],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      // tools/genMoon.mjs imports astronomy-engine, which is installed only when regenerating the calendar.
      'import/no-unresolved': 'off',
    },
  },
  {
    files: ['**/*-test.ts', 'src/sync/harnessDb.ts'],
    rules: {
      // Jest mock factories are hoisted and have to call require(). harnessDb loads node:sqlite the same way when Expo sqlite is absent.
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
]);
