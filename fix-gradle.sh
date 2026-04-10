#!/bin/bash

# fix-gradle.sh
# Fixes two Gradle 8 build errors in Expo SDK 50 / React Native 0.73+ projects:
#
#   Error 1 — "compileSdkVersion is not specified. Please add it to build.gradle"
#             Root cause A: in Gradle 8, buildscript { ext {} } properties are not
#             visible to submodules via rootProject.ext.has() / .get().
#             Root cause B: AGP's compileSdkVersion() method may be silently ignored.
#
#   Error 2 — "Could not get unknown property 'release' for SoftwareComponentContainer"
#             Root cause: Groovy dynamic property access (components.release) no
#             longer resolves named software components in Gradle 8.
#
# What this script does
#   Fix 1 — adds a root-level ext {} block to android/build.gradle so that
#            compileSdkVersion is always on rootProject.ext for safeExtGet().
#   Fix 2 — adds an allprojects { plugins.withId("com.android.library") {} }
#            block to android/build.gradle that forcibly sets compileSdk 34 on
#            every android library module (Gradle 8 safe; no afterEvaluate).
#   Fix 3 — patches every ExpoModulesCorePlugin.gradle found in node_modules:
#            replaces the single "from components.release" line with a null-safe
#            components.findByName("release") call (works across all versions).
#   Fix 4 — tunes gradle.properties (JVM heap, G1GC, parallel builds).
#
# Safe to run multiple times — every step is idempotent.

set -e

ANDROID="android"
NODE_MODULES="node_modules"

echo "Applying Gradle 8 compatibility fixes for Expo SDK 50..."
echo ""

# ── Prerequisite check ────────────────────────────────────────────────────────
if [ ! -f "package.json" ]; then
  echo "ERROR: Run this script from the root of your Expo project (where package.json lives)."
  exit 1
fi

if [ ! -d "$ANDROID" ]; then
  echo "ERROR: android/ directory not found."
  echo "       Generate it first: npx expo prebuild --platform android --no-install"
  exit 1
fi

# ── Fix 1: Root-level ext {} in android/build.gradle ─────────────────────────
# Ensures compileSdkVersion is on rootProject.ext so that expo's safeExtGet()
# can read it via rootProject.ext.has() / .get().
echo "[1/4] Patching android/build.gradle — root-level ext {} ..."

python3 - "$ANDROID/build.gradle" << 'PYEOF'
import sys

path = sys.argv[1]
with open(path) as f:
    content = f.read()

if '\next {' in content or content.startswith('ext {'):
    print("      SKIP — root-level ext {} already present")
    sys.exit(0)

ext_block = (
    "// Gradle 8 compatibility: expose SDK versions on rootProject.ext so that\n"
    "// submodule safeExtGet() calls find them via rootProject.ext.has()/.get().\n"
    "// In Gradle 8, buildscript { ext {} } is not always visible that way.\n"
    "ext {\n"
    "    compileSdkVersion = Integer.parseInt(findProperty('android.compileSdkVersion') ?: '34')\n"
    "    targetSdkVersion  = Integer.parseInt(findProperty('android.targetSdkVersion')  ?: '34')\n"
    "    minSdkVersion     = Integer.parseInt(findProperty('android.minSdkVersion')      ?: '23')\n"
    "    buildToolsVersion = findProperty('android.buildToolsVersion') ?: '34.0.0'\n"
    "    kotlinVersion     = findProperty('android.kotlinVersion')     ?: '1.9.23'\n"
    "    ndkVersion        = \"26.1.10909125\"\n"
    "}\n\n"
)

marker = 'apply plugin: "com.facebook.react.rootproject"'
if marker not in content:
    print("      WARN — marker not found; ext {} not added")
    sys.exit(0)

with open(path, 'w') as f:
    f.write(content.replace(marker, ext_block + marker, 1))
print("      OK   — root-level ext {} added")
PYEOF

# ── Fix 2: allprojects compileSdk hook in android/build.gradle ───────────────
# Forces compileSdk = 34 on every android library module via plugins.withId(),
# which fires during project evaluation (Gradle 8 safe — no afterEvaluate).
# Uses the non-deprecated compileSdk property instead of compileSdkVersion().
echo "[2/4] Patching android/build.gradle — allprojects compileSdk hook ..."

python3 - "$ANDROID/build.gradle" << 'PYEOF'
import sys

path = sys.argv[1]
with open(path) as f:
    content = f.read()

marker = 'plugins.withId("com.android.library")'
if marker in content:
    print("      SKIP — allprojects compileSdk hook already present")
    sys.exit(0)

hook = (
    "\n"
    "// Gradle 8 compatibility: forcibly set compileSdk on every android library\n"
    "// module. The plugins.withId hook fires when the plugin is applied (during\n"
    "// project evaluation) — Gradle 8 safe, unlike afterEvaluate.\n"
    "allprojects {\n"
    "    plugins.withId(\"com.android.library\") {\n"
    "        android {\n"
    "            compileSdk 34\n"
    "        }\n"
    "    }\n"
    "}\n"
)

with open(path, 'a') as f:
    f.write(hook)
print("      OK   — allprojects compileSdk hook appended")
PYEOF

# ── Fix 3: Patch ALL ExpoModulesCorePlugin.gradle files ──────────────────────
# The root cause of Error 2: useExpoPublishing() uses `from components.release`
# inside afterEvaluate. In Gradle 8 the Groovy dynamic property accessor no
# longer works on SoftwareComponentContainer.
#
# Strategy: simple one-line find-and-replace of "from components.release"
# → "def _rc = project.components.findByName('release'); if (_rc) from _rc"
# This is version-agnostic (no whitespace or block-structure assumptions) and
# patches every ExpoModulesCorePlugin.gradle found in node_modules.
echo "[3/4] Patching ExpoModulesCorePlugin.gradle (all versions found) ..."

PLUGIN_FILES=$(find "$NODE_MODULES" \
    -path "*/expo-modules-core/android/ExpoModulesCorePlugin.gradle" \
    2>/dev/null)

if [ -z "$PLUGIN_FILES" ]; then
    echo "      WARN — no ExpoModulesCorePlugin.gradle found in $NODE_MODULES"
else
    echo "$PLUGIN_FILES" | while IFS= read -r PLUGIN_FILE; do
        python3 - "$PLUGIN_FILE" << 'PYEOF'
import sys

path = sys.argv[1]
with open(path) as f:
    content = f.read()

TARGET = 'from components.release'
REPLACEMENT = (
    'def _rc = project.components.findByName("release"); '
    'if (_rc != null) from _rc'
)

if TARGET not in content:
    if 'findByName("release")' in content:
        print("      SKIP [" + path + "] — already patched")
    else:
        print("      WARN [" + path + "] — target line not found (different format?)")
    sys.exit(0)

patched = content.replace(TARGET, REPLACEMENT)
with open(path, 'w') as f:
    f.write(patched)
print("      OK   [" + path + "]")
PYEOF
    done
fi

# ── Fix 4: JVM tuning in gradle.properties ───────────────────────────────────
echo "[4/4] Tuning android/gradle.properties ..."

GRADLE_PROPS="$ANDROID/gradle.properties"
if [ -f "$GRADLE_PROPS" ]; then
    sed -i.bak \
        -e '/^org\.gradle\.jvmargs/d'                            \
        -e '/^org\.gradle\.caching/d'                            \
        -e '/^org\.gradle\.parallel/d'                           \
        -e '/^org\.gradle\.workers\.max/d'                       \
        -e '/^org\.gradle\.java\.installations\.auto-download/d' \
        "$GRADLE_PROPS"
    rm -f "$GRADLE_PROPS.bak"

    cat >> "$GRADLE_PROPS" << 'EOF'

# Gradle 8 performance tuning
org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m -XX:+UseG1GC
org.gradle.caching=true
org.gradle.parallel=true
org.gradle.workers.max=8
org.gradle.java.installations.auto-download=false
EOF
    echo "      OK   — gradle.properties updated"
else
    echo "      WARN — $GRADLE_PROPS not found; skipping"
fi

rm -rf "$ANDROID/.gradle"
echo "      OK   — android/.gradle cache cleared"

echo ""
echo "All fixes applied."
echo ""
echo "  android/build.gradle"
echo "    + root-level ext {} (compileSdkVersion on rootProject.ext)"
echo "    + allprojects { plugins.withId('com.android.library') { compileSdk 34 } }"
echo "  ExpoModulesCorePlugin.gradle (all versions)"
echo "    + components.release  →  components.findByName() with null guard"
echo "  android/gradle.properties — JVM 4 GB heap, G1GC, parallel"
echo "  android/.gradle           — cache cleared"
echo ""
echo "You can now build with:  cd android && ./gradlew assembleRelease"
