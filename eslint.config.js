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
    /* The test files had NO globals configured, so every `describe`, `it`,
       `expect`, `require`, `__dirname` and `Buffer` in __tests__ was a
       no-undef error. 885 of them, which is why `pnpm lint` has been failing
       and, because Lint ran before Test, why `pnpm test` had never once
       executed in CI. Zero of the 885 were in app code.

       Worth stating plainly: this was not a new problem. Every Checks run on
       master was red, the failure was always this, and it looked like a lint
       opinion rather than a test suite that was not running. */
    files: ["__tests__/**/*.{js,jsx,ts,tsx}", "**/*.test.{js,jsx,ts,tsx}"],
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
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
      // react-native-reanimated's SharedValue.value is a documented mutable
      // escape hatch (like a ref), but this rule doesn't know about it and
      // flags every `.value =` assignment as an illegal mutation.
      "react-hooks/immutability": "warn",
    },
  },
]);
