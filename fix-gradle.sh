#!/bin/bash

# Fix Gradle compatibility issues for Expo SDK 50
# Uses Gradle 7.5.1 - most stable version for Expo SDK 50 + Java 17

set -e

echo "🔧 Applying Gradle compatibility fixes for Expo SDK 50..."

# Fix 1: Downgrade Gradle to 7.5.1 (most stable)
echo "📦 Downgrading Gradle to 7.5.1 (most stable for Expo SDK 50)..."
sed -i 's/gradle-8.3-all.zip/gradle-7.5.1-all.zip/g' android/gradle/wrapper/gradle-wrapper.properties
sed -i 's/gradle-8.2-all.zip/gradle-7.5.1-all.zip/g' android/gradle/wrapper/gradle-wrapper.properties
sed -i 's/gradle-8.1-all.zip/gradle-7.5.1-all.zip/g' android/gradle/wrapper/gradle-wrapper.properties
sed -i 's/gradle-7.6.3-all.zip/gradle-7.5.1-all.zip/g' android/gradle/wrapper/gradle-wrapper.properties

if grep -q "gradle-7.5.1-all.zip" android/gradle/wrapper/gradle-wrapper.properties; then
  echo "✅ Gradle downgraded to 7.5.1"
else
  echo "❌ Failed to downgrade Gradle"
  exit 1
fi

# Fix 2: Add gradlePluginPortal
echo "🔌 Adding gradlePluginPortal to build repositories..."
if ! grep -q "gradlePluginPortal()" android/build.gradle; then
  sed -i '/mavenCentral()/a\        gradlePluginPortal()' android/build.gradle
  echo "✅ Added gradlePluginPortal()"
else
  echo "✅ gradlePluginPortal() already present"
fi

# Fix 3: Update gradle.properties
echo "⚙️  Updating gradle.properties..."
sed -i '/org.gradle.java.installations/d' android/gradle.properties
sed -i '/org.gradle.jvmargs/d' android/gradle.properties
sed -i '/org.gradle.caching/d' android/gradle.properties
sed -i '/org.gradle.parallel/d' android/gradle.properties

{
  echo ""
  echo "org.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=512m"
  echo "org.gradle.caching=true"
  echo "org.gradle.parallel=true"
  echo "org.gradle.java.installations.auto-download=false"
} >> android/gradle.properties
echo "✅ Updated gradle.properties"

# Fix 4: Remove javaToolchain conflicts
if grep -q "javaToolchain" android/build.gradle; then
  sed -i '/javaToolchain/,/}/s/^/\/\/ /' android/build.gradle
  echo "✅ Removed conflicting javaToolchain settings"
fi

# Fix 5: Clear Gradle cache
rm -rf android/.gradle
echo "✅ Gradle cache cleared"

echo ""
echo "✅ All Gradle fixes applied successfully!"
echo "Configuration Summary:"
echo "  Gradle version: 7.5.1 (most stable)"
echo "  Java version: 17"
echo "  Ready to build APK! 🚀"
