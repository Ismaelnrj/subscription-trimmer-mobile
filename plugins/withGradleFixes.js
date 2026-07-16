const { withDangerousMod } = require("@expo/config-plugins");
const { execSync } = require("child_process");
const path = require("path");

// Runs the project's existing fix-gradle.sh (Gradle 8 / Expo SDK 53
// compatibility patches) as the very last step of Android prebuild, so it
// applies automatically no matter which tool ran `expo prebuild` — Codemagic's
// explicit `--clean` invocation, or `eas build`'s own internal one. Without
// this, `eas build` skips these patches entirely (Codemagic is the only
// pipeline that remembered to call the script by hand) and the native build
// fails before it ever reaches expo-updates' own build-time wiring.
function withGradleFixes(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const scriptPath = path.join(projectRoot, "fix-gradle.sh");
      execSync(`bash "${scriptPath}"`, { cwd: projectRoot, stdio: "inherit" });
      return config;
    },
  ]);
}

module.exports = withGradleFixes;
