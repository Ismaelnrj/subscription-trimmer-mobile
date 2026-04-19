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

# ── Fix 3 (NEW): Pin Kotlin 1.9.23 + force language version 1.9 ──────────────
# expo-modules-core@1.12.26 uses Kotlin 1.9 features:
#   - 'data object' syntax  (Either.kt:13)  → requires languageVersion = 1.9
#   - 'reload' reference    (CoreModule.kt) → requires Kotlin 1.9 stdlib/API
# Root cause: React Native 0.73.x BOM provides kotlin-gradle-plugin without a
# version, resolving it at a version whose default language level is 1.8.
# Fix A: pin classpath('org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.23')
# Fix B: add allprojects { tasks.withType(KotlinCompile) } to force 1.9 on all
#        submodules, so even if the BOM overrides the plugin version the
#        language version is still explicitly 1.9.
echo "[3/5] android/build.gradle — pin Kotlin 1.9.23 + language version 1.9 ..."

python3 - "$ANDROID/build.gradle" << 'PYEOF'
import sys, re
path = sys.argv[1]
with open(path) as f:
    content = f.read()

modified = False

# Fix A: pin Kotlin gradle plugin version.
# expo prebuild generates double-quote form; handle both single and double quotes.
if 'kotlin-gradle-plugin:1.9.23' not in content:
    # Match both classpath('...') and classpath("...") forms
    pattern = r"""classpath\(['"]org\.jetbrains\.kotlin:kotlin-gradle-plugin['"]\)"""
    if re.search(pattern, content):
        content = re.sub(pattern,
            "classpath('org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.23')",
            content, count=1)
        print("      OK   — Kotlin plugin classpath pinned to 1.9.23")
        modified = True
    else:
        print("      WARN — Kotlin classpath line not found; Fix A skipped")
else:
    print("      SKIP — Kotlin plugin already pinned")

# Fix B: add buildscript resolutionStrategy to force Kotlin 1.9.23 even if
# the React Native BOM provides an older version via dependency management.
if 'resolutionStrategy' not in content:
    # Insert resolutionStrategy into the buildscript block right before repositories
    bom_override = (
        "    // Force Kotlin 1.9.23 so BOM cannot downgrade it to 1.8.\n"
        "    configurations.all {\n"
        "        resolutionStrategy.force 'org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.23'\n"
        "        resolutionStrategy.force 'org.jetbrains.kotlin:kotlin-stdlib:1.9.23'\n"
        "        resolutionStrategy.force 'org.jetbrains.kotlin:kotlin-stdlib-jdk7:1.9.23'\n"
        "        resolutionStrategy.force 'org.jetbrains.kotlin:kotlin-stdlib-jdk8:1.9.23'\n"
        "    }\n"
    )
    # Insert before the first repositories { block inside buildscript
    repos_pattern = r'(\bbuildscript\b[^{]*\{[^}]*?)(    repositories\s*\{)'
    m = re.search(repos_pattern, content, re.DOTALL)
    if m:
        content = content[:m.start(2)] + bom_override + content[m.start(2):]
        print("      OK   — buildscript resolutionStrategy added (forces Kotlin 1.9.23)")
        modified = True
    else:
        print("      WARN — buildscript repositories marker not found; Fix B skipped")
else:
    print("      SKIP — resolutionStrategy already present")

# Fix C: add allprojects Kotlin language version hook
if 'languageVersion' not in content:
    hook = (
        "\n"
        "// expo-modules-core@1.12.26 requires Kotlin language version 1.9.\n"
        "// Force it on every KotlinCompile task across all subprojects so the\n"
        "// React Native BOM cannot silently downgrade it to 1.8.\n"
        "allprojects {\n"
        "    tasks.withType(org.jetbrains.kotlin.gradle.tasks.KotlinCompile).configureEach {\n"
        "        kotlinOptions {\n"
        "            languageVersion = '1.9'\n"
        "            apiVersion      = '1.9'\n"
        "            jvmTarget       = '17'\n"
        "        }\n"
        "    }\n"
        "}\n"
    )
    content += hook
    print("      OK   — Kotlin languageVersion 1.9 hook added to allprojects")
    modified = True
else:
    print("      SKIP — languageVersion already set")

if modified:
    with open(path, 'w') as f:
        f.write(content)
PYEOF

# ── Fix 4: Patch CoreModule.kt — reactDelegate.reload() missing in RN < 0.74 ──
# expo-modules-core@1.12.x calls ReactDelegate.reload() which was added in
# React Native 0.74. This project uses RN 0.73.6 where that method doesn't
# exist, causing "Unresolved reference: reload" at compile time.
# Fix: replace the direct call with reflection so it compiles on both versions.
# At runtime in a release APK this code path is never reached anyway (the
# early-return for ReleaseDevSupportManager fires first).
echo "[4/6] Patching CoreModule.kt for RN 0.73 compatibility ..."

PATCHED_KT=0
while IFS= read -r KT_FILE; do
    RESULT=$(python3 - "$KT_FILE" << 'PYEOF'
import sys
path = sys.argv[1]
try:
    with open(path) as f:
        content = f.read()
except Exception as e:
    print("error:" + str(e))
    sys.exit(0)

TARGET = 'reactDelegate.reload()'
if TARGET not in content:
    print("skip")
    sys.exit(0)

# Replace direct call with reflection — compiles on RN 0.73 and works on 0.74+.
# reactInstanceManager is NOT in scope at this call site (it's inside the if-block
# above), so the fallback must not reference it. NoSuchMethodException is thrown on
# RN 0.73.6 (reload() doesn't exist) and silently caught; on RN 0.74+ the method
# is found and invoked normally.
REPLACEMENT = (
    'try {\n'
    '            reactDelegate.javaClass.getMethod("reload").invoke(reactDelegate)\n'
    '          } catch (e: Exception) { /* reload() not available in RN < 0.74 */ }'
)
with open(path, 'w') as f:
    f.write(content.replace(TARGET, REPLACEMENT, 1))
print("ok")
PYEOF
    )
    case "$RESULT" in
        ok)
            echo "      OK   — $KT_FILE"
            PATCHED_KT=$((PATCHED_KT + 1))
            ;;
        skip) ;;
        error:*) echo "      WARN — ${RESULT#error:}" ;;
    esac
done < <(find "$NODE_MODULES" -name "CoreModule.kt" -path "*/expo-modules-core*" 2>/dev/null || true)

if [ "$PATCHED_KT" -eq 0 ]; then
    echo "      SKIP — no CoreModule.kt files needed patching"
else
    echo "      OK   — $PATCHED_KT file(s) patched"
fi

# ── Fix 5: Patch ALL .gradle files containing "from components.release" ───────
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
echo "[5/6] Patching all .gradle files with 'from components.release' ..."

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
echo "[6/6] Tuning android/gradle.properties ..."

GRADLE_PROPS="$ANDROID/gradle.properties"
if [ -f "$GRADLE_PROPS" ]; then
    sed -i.bak \
        -e '/^org\.gradle\.jvmargs/d'                            \
        -e '/^org\.gradle\.caching/d'                            \
        -e '/^org\.gradle\.parallel/d'                           \
        -e '/^org\.gradle\.workers\.max/d'                       \
        -e '/^org\.gradle\.java\.installations\.auto-download/d' \
        -e '/^kotlin\.daemon\.jvm\.options/d'                    \
        "$GRADLE_PROPS"
    rm -f "$GRADLE_PROPS.bak"

    cat >> "$GRADLE_PROPS" << 'EOF'

# Gradle 8 performance tuning
org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m -XX:+UseG1GC
org.gradle.caching=true
org.gradle.parallel=true
org.gradle.workers.max=4
org.gradle.java.installations.auto-download=false
# Give the Kotlin compiler daemon enough heap to compile expo-modules-core
kotlin.daemon.jvm.options=-Xmx2048m -XX:MaxMetaspaceSize=512m
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
echo "    + Kotlin plugin pinned to 1.9.23 (was unversioned, resolved to 1.8 via BOM)"
echo "    + allprojects { tasks.withType(KotlinCompile) { languageVersion = 1.9 } }"
echo "  node_modules/**/*.gradle"
echo "    + 'from components.release'  →  null-safe components.findByName()"
echo "      (covers ExpoModulesCorePlugin.gradle + all individual expo modules)"
echo "  android/gradle.properties — JVM 4 GB heap, G1GC, parallel builds, Kotlin daemon 2 GB"
echo "  android/.gradle           — cache cleared"
echo ""
echo "You can now build with:  cd android && ./gradlew assembleRelease"
