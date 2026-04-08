#!/bin/bash

# Fix Gradle compatibility issues for Expo SDK 50
# This script runs after expo prebuild to apply necessary Gradle fixes

set -e

echo "🔧 Applying Gradle compatibility fixes..."

# Fix 1: Downgrade Gradle from 8.3 to 7.6.3
echo "📦 Downgrading Gradle to 7.6.3..."
sed -i 's/gradle-8.3-all.zip/gradle-7.6.3-all.zip/g' android/gradle/wrapper/gradle-wrapper.properties

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
  echo "✅ Updated gradle.properties"
else
  echo "✅ gradle.properties already optimized"
fi

echo ""
echo "✅ All Gradle fixes applied successfully!"
echo ""
echo "Gradle version: 7.6.3"
echo "Java version: 17"
echo "Node version: 18+"
echo ""
echo "Ready to build APK! 🚀"
