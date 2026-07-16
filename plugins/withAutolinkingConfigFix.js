const { withSettingsGradle } = require("@expo/config-plugins");

// A previous fix for RNGP's "Could not find project.android.packageName in
// react-native config output" error (during :app:generateAutolinkingPackageList)
// was hand-written directly into the committed android/settings.gradle. That
// never actually survived any fresh `expo prebuild`, which always regenerates
// settings.gradle from Expo's own vanilla template, discarding hand edits
// whether the native folder is committed to git or not. Injecting the same
// logic here makes it part of the generated file itself, every time, on any
// tool that runs prebuild (Codemagic's explicit --clean call, or eas build's
// own internal one).
const AUTOLINKING_CONFIG_BLOCK = `
def getRNMinorVersionForAutolinkingFix() {
  def version = providers.exec {
    commandLine("node", "-e", "console.log(require('react-native/package.json').version);")
  }.standardOutput.asText.get().trim()

  def coreVersion = version.split("-")[0]
  def (major, minor, patch) = coreVersion.tokenize('.').collect { it.toInteger() }

  return minor
}

if (getRNMinorVersionForAutolinkingFix() >= 75) {
  def scriptPath = new File(rootDir.parentFile, 'scripts/generate-autolinking-config.js').absolutePath
  def autolinkingJson = new File(rootDir, 'build/generated/autolinking/autolinking.json')

  // Runs scripts/generate-autolinking-config.js (which guarantees
  // project.android.packageName is set) and returns its JSON stdout.
  def generateAutolinkingConfigForFix = {
    def out = new StringWriter(), err = new StringWriter()
    def proc = ['node', '--no-warnings', scriptPath].execute(null, rootDir.parentFile)
    proc.consumeProcessOutput(out, err)
    proc.waitFor()
    def json = out.toString().trim()
    if (proc.exitValue() != 0 || json.isEmpty()) {
      throw new GradleException("[autolinking] script failed (exit=\${proc.exitValue()}): \${err.toString().take(500)}")
    }
    return json
  }

  // Step 1: write autolinking.json directly so generateAutolinkingPackageList
  // always reads the correct file regardless of RNGP caching.
  def configJsonForFix = generateAutolinkingConfigForFix()
  autolinkingJson.parentFile.mkdirs()
  autolinkingJson.text = configJsonForFix

  // Step 2: tell RNGP which libraries to include as Gradle subprojects. Use a
  // staging file (not autolinking.json itself) so copyTo never operates on
  // the same source and destination.
  def stagingFileForFix = new File(rootDir, 'build/generated/autolinking/autolinking-staging.json')
  stagingFileForFix.text = configJsonForFix

  extensions.configure(com.facebook.react.ReactSettingsExtension) { ex ->
    ex.autolinkLibrariesFromConfigFile(stagingFileForFix)
  }

  // Step 3: safety net, re-generate autolinking.json immediately before the
  // two tasks that actually consume it, in case anything upstream caches or
  // regenerates a stale copy in between.
  gradle.taskGraph.beforeTask { task ->
    if (task.name == 'generateAutolinkingPackageList' || task.name == 'generateAutolinkingNewArchitectureFiles') {
      def json = generateAutolinkingConfigForFix()
      autolinkingJson.parentFile.mkdirs()
      autolinkingJson.text = json
      def pkg = new groovy.json.JsonSlurper().parseText(json)?.project?.android?.packageName
      if (!pkg) {
        throw new GradleException("[autolinking] beforeTask \${task.name}: generated config is still missing project.android.packageName")
      }
    }
  }
}
`;

function withAutolinkingConfigFix(config) {
  return withSettingsGradle(config, (config) => {
    if (config.modResults.contents.includes("getRNMinorVersionForAutolinkingFix")) {
      return config; // already injected
    }
    config.modResults.contents = config.modResults.contents.replace(
      /rootProject\.name\s*=/,
      `${AUTOLINKING_CONFIG_BLOCK}\nrootProject.name =`
    );
    return config;
  });
}

module.exports = withAutolinkingConfigFix;
