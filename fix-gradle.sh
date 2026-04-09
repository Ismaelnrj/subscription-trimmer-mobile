#!/bin/bash

# fix-gradle.sh
# Fixes two Gradle 8 build errors in Expo SDK 50 / React Native 0.73+ projects:
#
#   Error 1 — "compileSdkVersion is not specified on the :expo module"
#             Root cause: in Gradle 8, buildscript { ext {} } properties are not
#             visible to submodules via rootProject.ext.has() / .get().
#
#   Error 2 — "Could not get unknown property 'release' for SoftwareComponentContainer"
#             Root cause: Groovy dynamic property access (components.release) no
#             longer works on SoftwareComponentContainer in Gradle 8.
#
# NOTE: do NOT add a subprojects { afterEvaluate {} } block to android/build.gradle.
#       In Gradle 8.8+, calling afterEvaluate on an already-evaluated project throws
#       "Cannot run Project.afterEvaluate(Closure) when the project is already evaluated."
#       The two fixes below are sufficient on their own.
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

# ── Fix 1: Add top-level ext {} to android/build.gradle ──────────────────────
# In Gradle 8, properties inside buildscript { ext {} } may not be returned by
# rootProject.ext.has() / rootProject.ext.get(), which expo's safeExtGet()
# helper relies on.  Declaring the same values in a root-level ext {} block
# guarantees they are always visible to every submodule.
echo "[1/3] Patching android/build.gradle — top-level ext {} ..."

python3 - "$ANDROID/build.gradle" << 'PYEOF'
import sys

path = sys.argv[1]
with open(path) as f:
    content = f.read()

# Idempotency: already patched?
if '\next {' in content or content.startswith('ext {'):
    print("      SKIP — top-level ext {} already present")
    sys.exit(0)

ext_block = (
    "// Gradle 8 compatibility: re-declare SDK versions at the root project ext\n"
    "// level so that submodule safeExtGet() calls can find them via\n"
    "// rootProject.ext (buildscript { ext {} } is not always visible in Gradle 8).\n"
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
    print("      WARN — marker not found in " + path + "; ext {} not added")
    sys.exit(0)

with open(path, 'w') as f:
    f.write(content.replace(marker, ext_block + marker, 1))
print("      OK   — top-level ext {} added")
PYEOF

# ── Fix 2: Patch ExpoModulesCorePlugin.gradle ────────────────────────────────
# This is the root cause of Error 2.  The useExpoPublishing() function uses
# `from components.release` inside afterEvaluate.  In Gradle 8 this Groovy
# dynamic property lookup throws MissingPropertyException.  Replace it with
# components.findByName("release") which returns null instead of throwing.
echo "[2/3] Patching ExpoModulesCorePlugin.gradle ..."

PLUGIN_FILE=$(find "$NODE_MODULES" \
    -path "*/expo-modules-core/android/ExpoModulesCorePlugin.gradle" \
    2>/dev/null | head -1)

if [ -z "$PLUGIN_FILE" ]; then
    echo "      WARN — ExpoModulesCorePlugin.gradle not found; skipping"
else
    python3 - "$PLUGIN_FILE" << 'PYEOF'
import sys

path = sys.argv[1]
with open(path) as f:
    content = f.read()

# Idempotency check
if 'components.findByName("release")' in content:
    print("      SKIP — already patched")
    sys.exit(0)

old = (
    "  project.afterEvaluate {\n"
    "    publishing {\n"
    "      publications {\n"
    "        release(MavenPublication) {\n"
    "          from components.release\n"
    "        }\n"
    "      }\n"
    "      repositories {\n"
    "        maven {\n"
    "          url = mavenLocal().url\n"
    "        }\n"
    "      }\n"
    "    }\n"
    "  }"
)

new = (
    "  project.afterEvaluate {\n"
    "    // Gradle 8 fix: 'components.release' dynamic property access throws\n"
    "    // \"Could not get unknown property 'release' for SoftwareComponentContainer\".\n"
    "    // findByName() returns null instead of throwing; guard prevents NPE.\n"
    "    def releaseComponent = project.components.findByName(\"release\")\n"
    "    if (releaseComponent != null) {\n"
    "      publishing {\n"
    "        publications {\n"
    "          release(MavenPublication) {\n"
    "            from releaseComponent\n"
    "          }\n"
    "        }\n"
    "        repositories {\n"
    "          maven {\n"
    "            url = mavenLocal().url\n"
    "          }\n"
    "        }\n"
    "      }\n"
    "    }\n"
    "  }"
)

if old not in content:
    print("      WARN — expected pattern not found in " + path)
    print("             The file may already be patched or has a different structure.")
    sys.exit(0)

with open(path, 'w') as f:
    f.write(content.replace(old, new, 1))
print("      OK   — patched (components.release -> components.findByName())")
PYEOF
fi

# ── Fix 3: JVM tuning in gradle.properties ───────────────────────────────────
echo "[3/3] Tuning android/gradle.properties ..."

GRADLE_PROPS="$ANDROID/gradle.properties"
if [ -f "$GRADLE_PROPS" ]; then
    # Remove the lines we are about to re-add (idempotent)
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
echo "  android/build.gradle          top-level ext {} added"
echo "  ExpoModulesCorePlugin.gradle  components.release -> components.findByName()"
echo "  android/gradle.properties     JVM heap 4 GB, G1GC, parallel builds"
echo "  android/.gradle               cache cleared"
echo ""
echo "You can now build with:  cd android && ./gradlew assembleRelease"
