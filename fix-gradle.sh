#!/bin/bash

# Fix Gradle compatibility issues for Expo SDK 50
# Uses Gradle 8.1.1 with proper Java 17 configuration

set -e

echo "🔧 Applying Gradle compatibility fixes for Expo SDK 50..."

# Fix 1: Use Gradle 8.1.1 (best Java 17 support )
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

# Fix 2: Add gradlePluginPortal
echo "🔌 Adding gradlePluginPortal to build repositories..."
if ! grep -q "gradlePluginPortal()" android/build.gradle; then
  sed -i '/mavenCentral()/a\        gradlePluginPortal()' android/build.gradle
  echo "✅ Added gradlePluginPortal()"
else
  echo "✅ gradlePluginPortal() already present"
fi

# Fix 3: Configure gradle.properties for Java 17 + Gradle 8.1.1
echo "⚙️  Configuring gradle.properties for Java 17..."

# Remove conflicting settings
sed -i '/org.gradle.java.installations/d' android/gradle.properties
sed -i '/org.gradle.jvmargs/d' android/gradle.properties
sed -i '/org.gradle.caching/d' android/gradle.properties
sed -i '/org.gradle.parallel/d' android/gradle.properties

# Add proper Java 17 configuration
{
  echo ""
  echo "# Java 17 configuration for Gradle 8.1.1"
  echo "org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m -XX:+UseG1GC"
  echo ""
  echo "# Performance settings"
  echo "org.gradle.caching=true"
  echo "org.gradle.parallel=true"
  echo "org.gradle.workers.max=8"
  echo ""
  echo "# Disable problematic toolchain features"
  echo "org.gradle.java.installations.auto-download=false"
} >> android/gradle.properties

echo "✅ Configured gradle.properties"

# Fix 4: Clear Gradle cache
echo "🗑️  Clearing Gradle cache..."
rm -rf android/.gradle
echo "✅ Gradle cache cleared"

echo ""
echo "✅ All Gradle fixes applied successfully!"
echo "Configuration Summary:"
echo "  Gradle version: 8.1.1 (best Java 17 support)"
echo "  Java version: 17"
echo "  JVM memory: 4GB"
echo "  Parallel builds: Enabled"
echo "  Ready to build APK! 🚀"
