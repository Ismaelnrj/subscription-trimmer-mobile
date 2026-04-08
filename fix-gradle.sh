#!/bin/bash

# Fix Gradle compatibility issues for Expo SDK 50
# Uses Gradle 8.1.1 with proper plugin resolution

set -e

echo "🔧 Applying Gradle compatibility fixes for Expo SDK 50..."

# Fix 1: Use Gradle 8.1.1
echo "📦 Setting Gradle to 8.1.1..."
sed -i 's/gradle-8.3-all.zip/gradle-8.1.1-all.zip/g' android/gradle/wrapper/gradle-wrapper.properties
sed -i 's/gradle-8.2-all.zip/gradle-8.1.1-all.zip/g' android/gradle/wrapper/gradle-wrapper.properties
sed -i 's/gradle-7.6.3-all.zip/gradle-8.1.1-all.zip/g' android/gradle/wrapper/gradle-wrapper.properties
sed -i 's/gradle-7.5.1-all.zip/gradle-8.1.1-all.zip/g' android/gradle/wrapper/gradle-wrapper.properties

if grep -q "gradle-8.1.1-all.zip" android/gradle/wrapper/gradle-wrapper.properties; then
  echo "✅ Gradle set to 8.1.1"
else
  echo "❌ Failed to set Gradle version"
  exit 1
fi

# Fix 2: Add gradlePluginPortal to settings.gradle (for plugin resolution )
echo "🔌 Adding gradlePluginPortal to settings.gradle..."
if [ -f "android/settings.gradle" ]; then
  if ! grep -q "gradlePluginPortal()" android/settings.gradle; then
    # Find the pluginManagement block and add gradlePluginPortal
    sed -i '/repositories {/a\        gradlePluginPortal()' android/settings.gradle
    echo "✅ Added gradlePluginPortal() to settings.gradle"
  else
    echo "✅ gradlePluginPortal() already in settings.gradle"
  fi
else
  echo "⚠️  settings.gradle not found"
fi

# Fix 3: Also add to build.gradle for regular dependencies
echo "🔌 Adding gradlePluginPortal to build.gradle..."
if ! grep -q "gradlePluginPortal()" android/build.gradle; then
  sed -i '/mavenCentral()/a\        gradlePluginPortal()' android/build.gradle
  echo "✅ Added gradlePluginPortal() to build.gradle"
else
  echo "✅ gradlePluginPortal() already in build.gradle"
fi

# Fix 4: Configure gradle.properties for Java 17
echo "⚙️  Configuring gradle.properties..."
sed -i '/org.gradle.java.installations/d' android/gradle.properties
sed -i '/org.gradle.jvmargs/d' android/gradle.properties
sed -i '/org.gradle.caching/d' android/gradle.properties
sed -i '/org.gradle.parallel/d' android/gradle.properties

{
  echo ""
  echo "org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m -XX:+UseG1GC"
  echo "org.gradle.caching=true"
  echo "org.gradle.parallel=true"
  echo "org.gradle.workers.max=8"
  echo "org.gradle.java.installations.auto-download=false"
} >> android/gradle.properties

echo "✅ Configured gradle.properties"

# Fix 5: Clear Gradle cache
echo "🗑️  Clearing Gradle cache..."
rm -rf android/.gradle
echo "✅ Gradle cache cleared"

echo ""
echo "✅ All Gradle fixes applied successfully!"
echo "Configuration Summary:"
echo "  Gradle version: 8.1.1"
echo "  Java version: 17"
echo "  Plugin resolution: Enabled"
echo "  Ready to build APK! 🚀"
