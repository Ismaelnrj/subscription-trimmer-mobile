#!/bin/bash

# Fix Gradle compatibility issues for Expo SDK 50
# This script runs after expo prebuild to apply necessary Gradle fixes
# Fixes Java 17 + Gradle 7.6.3 compatibility issues

set -e

echo "🔧 Applying Gradle compatibility fixes for Expo SDK 50..."

# Fix 1: Downgrade Gradle from 8.3 to 7.6.3
echo "📦 Downgrading Gradle to 7.6.3 (compatible with Java 17 & Expo SDK 50)..."
sed -i 's/gradle-8.3-all.zip/gradle-7.6.3-all.zip/g' android/gradle/wrapper/gradle-wrapper.properties
sed -i 's/gradle-8.2-all.zip/gradle-7.6.3-all.zip/g' android/gradle/wrapper/gradle-wrapper.properties
sed -i 's/gradle-8.1-all.zip/gradle-7.6.3-all.zip/g' android/gradle/wrapper/gradle-wrapper.properties

# Verify the change
if grep -q "gradle-7.6.3-all.zip" android/gradle/wrapper/gradle-wrapper.properties; then
  echo "✅ Gradle downgraded to 7.6.3"
else
  echo "❌ Failed to downgrade Gradle"
  exit 1
fi

# Fix 2: Add gradlePluginPortal to build.gradle if not already present
echo "🔌 Adding gradlePluginPortal to build repositories..."
if ! grep -q "gradlePluginPortal()" android/build.gradle; then
  # Add gradlePluginPortal() after mavenCentral()
  sed -i '/mavenCentral()/a\        gradlePluginPortal()' android/build.gradle
  echo "✅ Added gradlePluginPortal()"
else
  echo "✅ gradlePluginPortal() already present"
fi

# Fix 3: Update gradle.properties for better compatibility
echo "⚙️  Updating gradle.properties..."
if ! grep -q "org.gradle.caching=true" android/gradle.properties; then
  echo "" >> android/gradle.properties
  echo "# Gradle caching and parallel builds for faster builds" >> android/gradle.properties
  echo "org.gradle.caching=true" >> android/gradle.properties
  echo "org.gradle.parallel=true" >> android/gradle.properties
  echo "# Java toolchain configuration for Gradle 7.6.3 + Java 17" >> android/gradle.properties
  echo "org.gradle.java.installations.auto-download=false" >> android/gradle.properties
  echo "✅ Updated gradle.properties"
else
  echo "✅ gradle.properties already optimized"
fi

# Fix 4: Ensure build.gradle doesn't have conflicting Java toolchain settings
echo "🔧 Checking build.gradle for Java toolchain conflicts..."
if grep -q "javaToolchain" android/build.gradle; then
  echo "⚠️  Found javaToolchain configuration, may cause conflicts with Gradle 7.6.3"
else
  echo "✅ No conflicting javaToolchain settings"
fi

echo ""
echo "✅ All Gradle fixes applied successfully!"
echo ""
echo "Configuration Summary:"
echo "  Gradle version: 7.6.3"
echo "  Java version: 17"
echo "  Node version: 18+"
echo "  Caching: Enabled"
echo "  Parallel builds: Enabled"
echo ""
echo "Ready to build APK! 🚀"
