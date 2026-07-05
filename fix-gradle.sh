#!/bin/bash

# fix-gradle.sh
# Fixes two Gradle 8 build errors in Expo SDK 53 / React Native 0.79+ projects:
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
#   Fix 2 — adds allprojects { plugins.withId("com.android.library") { compileSdk 35 } }
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

echo "Applying Gradle 8 compatibility fixes for Expo SDK 53..."
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
    "    compileSdkVersion = Integer.parseInt(findProperty('android.compileSdkVersion') ?: '36')\n"
    "    targetSdkVersion  = Integer.parseInt(findProperty('android.targetSdkVersion')  ?: '35')\n"
    "    minSdkVersion     = Integer.parseInt(findProperty('android.minSdkVersion')      ?: '24')\n"
    "    buildToolsVersion = findProperty('android.buildToolsVersion') ?: '35.0.0'\n"
    "    kotlinVersion     = findProperty('android.kotlinVersion')     ?: '2.0.21'\n"
    "    ndkVersion        = \"27.1.12297006\"\n"
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
    "            compileSdk 36\n"
    "        }\n"
    "    }\n"
    "}\n"
)

with open(path, 'a') as f:
    f.write(hook)
print("      OK   — allprojects compileSdk hook added")
PYEOF

# ── Fix 3: Pin Kotlin 2.0.21 + force matching language version ──────────────
# expo-modules-core (SDK 53) and React Native 0.79's Gradle plugin both build
# against Kotlin 2.0 (e.g. the org.jetbrains.kotlin.plugin.compose plugin
# requires Kotlin >= 2.0). React Native's BOM provides kotlin-gradle-plugin
# without a version pin, so we force it here.
# Fix A: pin classpath('org.jetbrains.kotlin:kotlin-gradle-plugin:2.0.21')
# Fix B: add allprojects { tasks.withType(KotlinCompile) } to force 2.0 on all
#        submodules, so even if the BOM overrides the plugin version the
#        language version is still explicitly 2.0.
echo "[3/5] android/build.gradle — pin AGP 8.9.1 + Kotlin 2.0.21 + language version 2.0 ..."

python3 - "$ANDROID/build.gradle" << 'PYEOF'
import sys, re
path = sys.argv[1]
with open(path) as f:
    content = f.read()

modified = False

# Fix 0: pin the Android Gradle Plugin version. expo prebuild generates an
# unversioned classpath('com.android.tools.build:gradle'), which resolves
# through React Native's BOM to whatever that RN/Expo release pinned at the
# time — for Expo SDK 53 that's 8.8.2. Some transitive deps (e.g. a newer
# androidx.core pulled in by expo-splash-screen or other modules) require
# AGP 8.9.1+ and compileSdk 36+, so both must move together.
if 'com.android.tools.build:gradle:' not in content:
    pattern = r"""classpath\(['"]com\.android\.tools\.build:gradle['"]\)"""
    if re.search(pattern, content):
        content = re.sub(pattern,
            "classpath('com.android.tools.build:gradle:8.9.1')",
            content, count=1)
        print("      OK   — AGP classpath pinned to 8.9.1")
        modified = True
    else:
        print("      WARN — AGP classpath line not found; Fix 0 skipped")
else:
    print("      SKIP — AGP classpath already pinned")

# Fix A: pin Kotlin gradle plugin version.
# expo prebuild generates double-quote form; handle both single and double quotes.
if 'kotlin-gradle-plugin:2.0.21' not in content:
    # Match both classpath('...') and classpath("...") forms
    pattern = r"""classpath\(['"]org\.jetbrains\.kotlin:kotlin-gradle-plugin['"]\)"""
    if re.search(pattern, content):
        content = re.sub(pattern,
            "classpath('org.jetbrains.kotlin:kotlin-gradle-plugin:2.0.21')",
            content, count=1)
        print("      OK   — Kotlin plugin classpath pinned to 2.0.21")
        modified = True
    else:
        print("      WARN — Kotlin classpath line not found; Fix A skipped")
else:
    print("      SKIP — Kotlin plugin already pinned")

# Fix B: add buildscript resolutionStrategy to force Kotlin 2.0.21 even if
# the React Native BOM provides a different version via dependency management.
if 'resolutionStrategy' not in content:
    # Insert resolutionStrategy into the buildscript block right before repositories
    bom_override = (
        "    // Force Kotlin 2.0.21 so BOM cannot downgrade it.\n"
        "    configurations.all {\n"
        "        resolutionStrategy.force 'org.jetbrains.kotlin:kotlin-gradle-plugin:2.0.21'\n"
        "        resolutionStrategy.force 'org.jetbrains.kotlin:kotlin-stdlib:2.0.21'\n"
        "        resolutionStrategy.force 'org.jetbrains.kotlin:kotlin-stdlib-jdk7:2.0.21'\n"
        "        resolutionStrategy.force 'org.jetbrains.kotlin:kotlin-stdlib-jdk8:2.0.21'\n"
        "    }\n"
    )
    # Insert before the first repositories { block inside buildscript
    repos_pattern = r'(\bbuildscript\b[^{]*\{[^}]*?)(    repositories\s*\{)'
    m = re.search(repos_pattern, content, re.DOTALL)
    if m:
        content = content[:m.start(2)] + bom_override + content[m.start(2):]
        print("      OK   — buildscript resolutionStrategy added (forces Kotlin 2.0.21)")
        modified = True
    else:
        print("      WARN — buildscript repositories marker not found; Fix B skipped")
else:
    print("      SKIP — resolutionStrategy already present")

# Fix C: add allprojects Kotlin language version hook
if 'languageVersion' not in content:
    hook = (
        "\n"
        "// expo-modules-core (SDK 53) requires Kotlin language version 2.0.\n"
        "// Force it on every KotlinCompile task across all subprojects so the\n"
        "// React Native BOM cannot silently downgrade it.\n"
        "allprojects {\n"
        "    tasks.withType(org.jetbrains.kotlin.gradle.tasks.KotlinCompile).configureEach {\n"
        "        kotlinOptions {\n"
        "            languageVersion = '2.0'\n"
        "            apiVersion      = '2.0'\n"
        "            jvmTarget       = '17'\n"
        "        }\n"
        "    }\n"
        "}\n"
        "\n"
        "// KSP tasks (Room's annotation processor, used by expo-updates) don't\n"
        "// extend KotlinCompile, so the hook above never reaches them — they\n"
        "// instead inherit their default languageVersion/apiVersion from the\n"
        "// project's Kotlin extension (KotlinCompilation.compilerOptions), a\n"
        "// separate mechanism from the per-task kotlinOptions set above. Set it\n"
        "// there too, otherwise KSP falls back to a default that lags behind the\n"
        "// apiVersion Gradle infers from the Kotlin 2.0.21 toolchain, causing\n"
        "// \"api-version cannot be greater than language-version\".\n"
        "allprojects {\n"
        "    plugins.withId(\"org.jetbrains.kotlin.android\") {\n"
        "        kotlin {\n"
        "            compilerOptions {\n"
        "                languageVersion.set(org.jetbrains.kotlin.gradle.dsl.KotlinVersion.KOTLIN_2_0)\n"
        "                apiVersion.set(org.jetbrains.kotlin.gradle.dsl.KotlinVersion.KOTLIN_2_0)\n"
        "            }\n"
        "        }\n"
        "    }\n"
        "}\n"
    )
    content += hook
    print("      OK   — Kotlin languageVersion 2.0 hook + KSP compilerOptions fix added to allprojects")
    modified = True
else:
    print("      SKIP — languageVersion already set")

if modified:
    with open(path, 'w') as f:
        f.write(content)
PYEOF

# ── Fix 3b: Force codegen-before-autolinking task ordering ──────────────────
# :app:generateAutolinkingNewArchitectureFiles writes autolinking.cpp/.cmake,
# unconditionally listing every autolinked module with a codegenConfig in its
# package.json — assuming that module's own generateCodegenArtifactsFromSchema
# task has already produced its android/build/generated/source/codegen/jni/
# output. Gradle's task graph doesn't guarantee that ordering by default, so
# modules like @sentry/react-native and react-native-gesture-handler can lose
# the race: the generated autolinking.cpp then #includes a header
# (e.g. RNSentrySpec.h) that doesn't exist yet, and the native build fails at
# C++ compile time with no earlier warning. Force the correct ordering
# explicitly once every subproject has been configured.
echo "[3b/5] android/build.gradle — force codegen-before-autolinking task ordering ..."

python3 - "$ANDROID/build.gradle" << 'PYEOF'
import sys
path = sys.argv[1]
with open(path) as f:
    content = f.read()

if 'generateAutolinkingNewArchitectureFiles' in content and 'appProject.tasks.findByName' in content:
    print("      SKIP — already present")
else:
    hook = (
        "\n"
        "// Force generateAutolinkingNewArchitectureFiles to wait for every\n"
        "// subproject's own codegen task — see fix-gradle.sh Fix 3b.\n"
        "gradle.projectsEvaluated {\n"
        "    def appProject = rootProject.findProject(\":app\")\n"
        "    if (appProject == null) return\n"
        "    // findByName (not tasks.matching{}.configureEach{}) — by projectsEvaluated\n"
        "    // time these tasks are already registered, and configureEach's lazy-\n"
        "    // registration API has stricter context rules that collide with Gradle's\n"
        "    // own task-graph resolution already in flight at this point\n"
        "    // (\"configureEach(Action) on task set cannot be executed in the current context\").\n"
        "    def autolinkTask = appProject.tasks.findByName(\"generateAutolinkingNewArchitectureFiles\")\n"
        "    if (autolinkTask == null) return\n"
        "    rootProject.subprojects.each { sub ->\n"
        "        def codegenTask = sub.tasks.findByName(\"generateCodegenArtifactsFromSchema\")\n"
        "        if (codegenTask != null) {\n"
        "            autolinkTask.dependsOn(codegenTask)\n"
        "        }\n"
        "    }\n"
        "}\n"
    )
    with open(path, 'a') as f:
        f.write(hook)
    print("      OK   — codegen-before-autolinking task ordering added")
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
# ── Fix 5: Patch PermissionsService.kt — nullable requestedPermissions ────────
echo "[5/7] Patching PermissionsService.kt for nullable requestedPermissions ..."

PATCHED_PS=0
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

TARGET = 'requestedPermissions.contains(permission)'
REPLACEMENT = 'requestedPermissions?.contains(permission) ?: false'

if TARGET not in content:
    print("skip")
    sys.exit(0)

with open(path, 'w') as f:
    f.write(content.replace(TARGET, REPLACEMENT))
print("ok")
PYEOF
    )
    case "$RESULT" in
        ok)
            echo "      OK   — $KT_FILE"
            PATCHED_PS=$((PATCHED_PS + 1))
            ;;
        skip) ;;
        error:*) echo "      WARN — ${RESULT#error:}" ;;
    esac
done < <(find "$NODE_MODULES" -name "PermissionsService.kt" 2>/dev/null || true)

if [ "$PATCHED_PS" -eq 0 ]; then
    echo "      SKIP — no PermissionsService.kt files needed patching"
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
        -e '/^ksp\.useKsp2/Id'                                   \
        "$GRADLE_PROPS"
    rm -f "$GRADLE_PROPS.bak"

    cat >> "$GRADLE_PROPS" << 'EOF'

# Gradle 8 performance tuning
org.gradle.jvmargs=-Xmx1536m -XX:MaxMetaspaceSize=512m -XX:+UseG1GC
org.gradle.caching=true
org.gradle.parallel=true
org.gradle.workers.max=2
org.gradle.java.installations.auto-download=false
# Kotlin daemon — keep small to fit within linux_x2's 4GB total RAM
kotlin.daemon.jvm.options=-Xmx768m -XX:MaxMetaspaceSize=256m
# KSP2 (the K2-based implementation) avoids the legacy language/api-version
# compatibility check that fails Room's annotation processing (expo-updates)
# under Kotlin 2.0 with "-api-version cannot be greater than -language-version".
# Property name is case-sensitive: "useKSP2", not "useKsp2".
ksp.useKSP2=true
EOF
    echo "      OK   — gradle.properties updated"
else
    echo "      WARN — $GRADLE_PROPS not found; skipping"
fi

rm -rf "$ANDROID/.gradle"
echo "      OK   — android/.gradle cache cleared"

# ── Fix 7: ProGuard keep rules for React Native + Expo release build ─────────
# R8/ProGuard strips native module bridge classes by default. React Native's JNI
# bridge, Expo modules, Reanimated, and Kotlin reflection all require explicit
# keep rules or the release APK crashes on launch with no error screen.
echo "[7/7] Appending ProGuard keep rules to android/app/proguard-rules.pro ..."

PROGUARD_FILE="$ANDROID/app/proguard-rules.pro"
if [ -f "$PROGUARD_FILE" ]; then
    if grep -q "expo.modules" "$PROGUARD_FILE" 2>/dev/null; then
        echo "      SKIP — rules already present"
    else
        cat >> "$PROGUARD_FILE" << 'EOF'

# ── React Native / Hermes ────────────────────────────────────────────────────
-keep class com.facebook.react.** { *; }
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }
-dontwarn com.facebook.react.**
-dontwarn com.facebook.hermes.**

# ── Expo modules ─────────────────────────────────────────────────────────────
-keep class expo.modules.** { *; }
-keep class expo.** { *; }
-dontwarn expo.**

# ── React Native Reanimated ──────────────────────────────────────────────────
-keep class com.swmansion.reanimated.** { *; }
-keep class com.swmansion.gesturehandler.** { *; }
-keep class com.swmansion.rnscreens.** { *; }

# ── React Native Safe Area Context ──────────────────────────────────────────
-keep class com.th3rdwave.safeareacontext.** { *; }

# ── Async Storage ────────────────────────────────────────────────────────────
-keep class com.reactnativecommunity.asyncstorage.** { *; }

# ── Kotlin ───────────────────────────────────────────────────────────────────
-keep class kotlin.** { *; }
-keep class kotlinx.** { *; }
-dontwarn kotlin.**
-dontwarn kotlinx.**
EOF
        echo "      OK   — ProGuard keep rules added"
    fi
else
    echo "      WARN — $PROGUARD_FILE not found; skipping"
fi

# ── Fix 8: Guard generated Android-autolinking.cmake against missing codegen output
# GenerateAutolinkingNewArchitecturesFileTask (React Native's own Gradle plugin)
# blindly emits `add_subdirectory("<path>" <target>)` for every autolinked module
# that declares a codegenConfig in its package.json, and lists a matching
# `react_codegen_<name>` entry in AUTOLINKED_LIBRARIES — without ever checking
# whether that module's own build actually finished generating
# android/build/generated/source/codegen/jni/CMakeLists.txt yet. When a module
# (e.g. @sentry/react-native, react-native-gesture-handler) hasn't produced that
# output in time, CMake fails with "add_subdirectory given source ... which is
# not an existing directory", then a second failure trying to
# target_link_libraries() against a target that was never built.
# Fix: hook the task that generates that file and strip out any add_subdirectory
# line (and its matching AUTOLINKED_LIBRARIES entry) whose CMakeLists.txt doesn't
# actually exist yet — mirroring the if(EXISTS ...) guard the upstream
# ReactNative-application.cmake already uses for the app's own codegen output,
# which this per-module list never got.
echo "[8/8] android/app/build.gradle — guard autolinking cmake against missing codegen output ..."

APP_BUILD_GRADLE="$ANDROID/app/build.gradle"
if [ -f "$APP_BUILD_GRADLE" ]; then
    if grep -q "autolinking-fix" "$APP_BUILD_GRADLE" 2>/dev/null; then
        echo "      SKIP — already present"
    else
        cat >> "$APP_BUILD_GRADLE" << 'EOF'

// Guard the generated Android-autolinking.cmake against autolinked modules
// whose own codegen output (android/build/generated/source/codegen/jni/) wasn't
// actually produced yet when this file was generated — see fix-gradle.sh Fix 8.
tasks.matching { it.name == "generateAutolinkingNewArchitectureFiles" }.configureEach {
    doLast {
        def cmakeFile = new File(project.buildDir, "generated/autolinking/src/main/jni/Android-autolinking.cmake")
        if (!cmakeFile.exists()) return

        def text = cmakeFile.text
        def missingLibraries = [] as Set

        text = text.replaceAll(/(?m)^add_subdirectory\("([^"]+)"\s+(\S+)\)$/) { full, path, buildName ->
            if (new File(path, "CMakeLists.txt").exists()) return full
            def libraryName = buildName.replaceAll(/_cxxmodule_autolinked_build$|_autolinked_build$/, "")
            missingLibraries << libraryName
            return "# [autolinking-fix] skipped, no codegen output yet: ${full}"
        }

        if (!missingLibraries.isEmpty()) {
            missingLibraries.each { libName ->
                text = text.replaceAll(/(?m)^(\s*)react_codegen_${libName}\s*$/) { fullLine, indent ->
                    "${indent}# [autolinking-fix] skipped react_codegen_${libName}, no codegen output yet"
                }
            }
            cmakeFile.text = text
            println("[autolinking-fix] Skipped autolinked libraries with no codegen output: ${missingLibraries.join(', ')}")
        }
    }
}
EOF
        echo "      OK   — autolinking cmake guard added"
    fi
else
    echo "      WARN — $APP_BUILD_GRADLE not found; skipping"
fi

# ── Fix 9: Native Sentry auto-init via AndroidManifest meta-data ─────────────
# Sentry.init() in app/_layout.tsx only runs once the JS bundle loads, so it can
# never catch a crash that happens before or during native startup (a broken
# native module, a bad Activity theme, etc.) — exactly the class of crash this
# fix-gradle.sh's own fixes have been chasing. Adding these meta-data tags lets
# the underlying Android Sentry SDK self-initialize at process start (via its
# own ContentProvider), independent of JS, so native/early startup crashes are
# still reported.
echo "[9/9] AndroidManifest.xml — native Sentry auto-init meta-data ..."

MANIFEST_FILE="$ANDROID/app/src/main/AndroidManifest.xml"
if [ -f "$MANIFEST_FILE" ]; then
    if grep -q "io.sentry.dsn" "$MANIFEST_FILE" 2>/dev/null; then
        echo "      SKIP — already present"
    else
        python3 - "$MANIFEST_FILE" << 'PYEOF'
import sys, re
path = sys.argv[1]
with open(path) as f:
    content = f.read()

meta = (
    '    <meta-data android:name="io.sentry.dsn" android:value="https://5b30942b14811df56225d1264a1841be@o4511377765367808.ingest.de.sentry.io/4511377795907664"/>\n'
    '    <meta-data android:name="io.sentry.auto-init" android:value="true"/>\n'
)

m = re.search(r'(<application\b[^>]*>\n)', content)
if not m:
    print("      WARN — <application> tag not found; skipping")
else:
    content = content[:m.end()] + meta + content[m.end():]
    with open(path, 'w') as f:
        f.write(content)
    print("      OK   — native Sentry auto-init meta-data added")
PYEOF
    fi
else
    echo "      WARN — $MANIFEST_FILE not found; skipping"
fi

echo ""
echo "All fixes applied."
echo ""
echo "  android/build.gradle"
echo "    + root-level ext {}  (compileSdkVersion 36 on rootProject.ext)"
echo "    + allprojects { plugins.withId('com.android.library') { compileSdk 36 } }"
echo "    + AGP classpath pinned to 8.9.1 (was unversioned, resolved via BOM to 8.8.2)"
echo "    + Kotlin plugin pinned to 2.0.21 (was unversioned, resolved via BOM)"
echo "    + allprojects { tasks.withType(KotlinCompile) { languageVersion = 2.0 } }"
echo "    + allprojects { kotlin { compilerOptions { languageVersion = apiVersion = 2.0 } } } (for KSP)"
echo "  node_modules/**/*.gradle"
echo "    + 'from components.release'  →  null-safe components.findByName()"
echo "      (covers ExpoModulesCorePlugin.gradle + all individual expo modules)"
echo "  android/gradle.properties — JVM 1.5 GB heap, G1GC, parallel builds, Kotlin daemon 768 MB"
echo "  android/.gradle           — cache cleared"
echo "  android/app/build.gradle"
echo "    + ProGuard keep rules for RN/Expo/Reanimated bridge classes"
echo "    + guard against autolinked modules with no codegen output yet (Fix 8)"
echo ""
echo "You can now build with:  cd android && ./gradlew assembleRelease"
