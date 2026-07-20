const expoConfig = require("eslint-config-expo/flat");
const { defineConfig } = require("eslint/config");
const globals = require("globals");

module.exports = defineConfig([
  ...expoConfig,
  {
    ignores: ["dist/*", "android/*", "ios/*", "backend/*", ".claude/**", ".agents/**"],
  },
  {
    files: [
      "*.config.js",
      "scripts/**/*.js",
      "plugins/**/*.js",
      "react-native.config.js",
    ],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    // These are React Compiler-readiness rules (this project doesn't use the
    // compiler). They flag existing, working patterns (Date.now() in render,
    // syncing local state from a query in an effect) throughout the app that
    // would need case-by-case testing to change safely, so warn instead of
    // block until there's a real reason to migrate.
    rules: {
      "react-hooks/purity": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
    },
  },
]);
