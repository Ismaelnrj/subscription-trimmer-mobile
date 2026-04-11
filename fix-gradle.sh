#!/bin/bash

# fix-gradle.sh
# Fixes two Gradle 8 build errors in Expo SDK 50 / React Native 0.73+ projects:
#
#   Error 1 — "compileSdkVersion is not specified. Please add it to build.gradle"
#   Error 2 — "Could not get unknown property 'release' for SoftwareComponentContainer"
#
# Root causes
#   Error 1: In Gradle 8, buildscript { ext {} } is not always visible to
#            submodules via rootProject.ext.has()/.get(), which expo's safeExtGet()
#            helper relies on. Additionally, compileSdkVersion() (old method API)
#            may be silently ignored in some AGP 8.x versions.
#   Error 2: Individual expo module build.gradle files (expo-camera, expo-font,
#            expo-device, expo-constants, expo-application, expo-notifications, etc.)
#            each contain their own direct "from components.release" line.  In
#            Gradle 8 the Groovy dynamic property accessor no longer resolves
#            named software components on SoftwareComponentContainer.
#
# What this script does
#   Fix 1 — adds a root-level ext {} to android/build.gradle so compileSdkVersion
#            is always available on rootProject.ext for safeExtGet() calls.
#   Fix 2 — adds allprojects { plugins.withId("com.android.library") { compileSdk 34 } }
#            to android/build.gradle. Fires at plugin-apply time (Gradle 8 safe —
#            no afterEvaluate) using the non-deprecated compileSdk property.
#   Fix 3 — scans EVERY .gradle file inside node_modules for "from components.release"
#            and replaces it with a null-safe components.findByName() call. This
#            covers ExpoModulesCorePlugin.gradle AND all individual expo module
#            build.gradle files that embed the same broken pattern directly.
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
echo "[1/4] android/build.gradle — root-level ext {} ..."

python3 - "$ANDROID/build.gradle" << 'PYEOF'
import sys
path = sys.argv[1]
with open(path) as f:
    content = f.read()

if '\next {' in content or content.startswith('ext {'):
    print("      SKIP — already present")
    sys.exit(0)

ext_block = (
    "// Gradle 8: expose SDK versions on rootProject.ext so submodule\n"
    "// safeExtGet() calls find them via rootProject.ext.has()/.get().\n"
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
    print("      WARN — marker not found; skipping")
    sys.exit(0)

with open(path, 'w') as f:
    f.write(content.replace(marker, ext_block + marker, 1))
print("      OK   — root-level ext {} added")
PYEOF

# ── Fix 2: allprojects compileSdk hook in android/build.gradle ───────────────
echo "[2/4] android/build.gradle — allprojects compileSdk hook ..."

python3 - "$ANDROID/build.gradle" << 'PYEOF'
import sys
path = sys.argv[1]
with open(path) as f:
    content = f.read()

if 'plugins.withId("com.android.library")' in content:
    print("      SKIP — already present")
    sys.exit(0)

hook = (
    "\n"
    "// Gradle 8: set compileSdk on every android library via plugins.withId().\n"
    "// Fires at plugin-apply time (no afterEvaluate) — Gradle 8.8 safe.\n"
    "// Uses the non-deprecated compileSdk property (not compileSdkVersion()).\n"
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
print("      OK   — allprojects compileSdk hook added")
PYEOF

# ── Fix 3: Patch ALL .gradle files containing "from components.release" ───────
# In Gradle 8, `components.release` (Groovy dynamic property) throws
# "Could not get unknown property 'release' for SoftwareComponentContainer".
# This broken pattern appears in ExpoModulesCorePlugin.gradle AND in the
# individual build.gradle of many expo packages (expo-camera, expo-font,
# expo-device, expo-constants, expo-application, expo-notifications, etc.).
# We scan every .gradle file in node_modules and apply the same one-line fix.
#
# Replacement:
#   from components.release
# →
#   def _rc = components.findByName("release"); if (_rc != null) from _rc
#
# components.findByName() is a method call (not a property) so it never throws.
# The null guard prevents NPE when the component hasn't been registered yet.
echo "[3/4] Patching all .gradle files with 'from components.release' ..."

PATCHED=0
ALREADY=0

while IFS= read -r GRADLE_FILE; do
    RESULT=$(python3 - "$GRADLE_FILE" << 'PYEOF'
import sys
path = sys.argv[1]
try:
    with open(path) as f:
        content = f.read()
except Exception as e:
    print("error:" + str(e))
    sys.exit(0)

TARGET      = 'from components.release'
REPLACEMENT = 'def _rc = components.findByName("release"); if (_rc != null) from _rc'

if TARGET not in content:
    # Already patched or different pattern
    print("skip")
    sys.exit(0)

patched = content.replace(TARGET, REPLACEMENT)
with open(path, 'w') as f:
    f.write(patched)
print("ok")
PYEOF
    )
    case "$RESULT" in
        ok)
            echo "      OK   — $GRADLE_FILE"
            PATCHED=$((PATCHED + 1))
            ;;
        skip)
            ALREADY=$((ALREADY + 1))
            ;;
        error:*)
            echo "      WARN — could not process $GRADLE_FILE: ${RESULT#error:}"
            ;;
    esac
done < <(find "$NODE_MODULES" -name "*.gradle" -type f 2>/dev/null | \
         xargs grep -l "from components\.release" 2>/dev/null || true)

if [ "$PATCHED" -eq 0 ] && [ "$ALREADY" -gt 0 ]; then
    echo "      SKIP — all files already patched ($ALREADY checked)"
elif [ "$PATCHED" -eq 0 ]; then
    echo "      SKIP — no matching files found"
else
    echo "      OK   — $PATCHED file(s) patched"
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
echo "    + root-level ext {}  (compileSdkVersion on rootProject.ext)"
echo "    + allprojects { plugins.withId('com.android.library') { compileSdk 34 } }"
echo "  node_modules/**/*.gradle"
echo "    + 'from components.release'  →  null-safe components.findByName()"
echo "      (covers ExpoModulesCorePlugin.gradle + all individual expo modules)"
echo "  android/gradle.properties — JVM 4 GB heap, G1GC, parallel builds"
echo "  android/.gradle           — cache cleared"
echo ""
echo "You can now build with:  cd android && ./gradlew assembleRelease"
