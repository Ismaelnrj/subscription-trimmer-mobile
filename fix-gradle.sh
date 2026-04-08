#!/bin/bash

# Fix Gradle compatibility issues for Expo SDK 50
# Uses Gradle 7.6.3 + disables Foojay toolchains plugin

set -e

echo "🔧 Applying Gradle compatibility fixes for Expo SDK 50..."

# Fix 1: Use Gradle 7.6.3
echo "📦 Setting Gradle to 7.6.3..."
sed -i 's/gradle-8.3-all.zip/gradle-7.6.3-all.zip/g' android/gradle/wrapper/gradle-wrapper.properties
sed -i 's/gradle-8.2-all.zip/gradle-7.6.3-all.zip/g' android/gradle/wrapper/gradle-wrapper.properties
sed -i 's/gradle-8.1-all.zip/gradle-7.6.3-all.zip/g' android/gradle/wrapper/gradle-wrapper.properties
sed -i 's/gradle-7.5.1-all.zip/gradle-7.6.3-all.zip/g' android/gradle/wrapper/gradle-wrapper.properties

if grep -q "gradle-7.6.3-all.zip" android/gradle/wrapper/gradle-wrapper.properties; then
  echo "✅ Gradle set to 7.6.3"
else
  echo "❌ Failed to set Gradle version"
  exit 1
fi

# Fix 2: Add gradlePluginPortal
echo "🔌 Adding gradlePluginPortal to build repositories..."
if ! grep -q "gradlePluginPortal( )" android/build.gradle; then
  sed -i '/mavenCentral()/a\        gradlePluginPortal()' android/build.gradle
  echo "✅ Added gradlePluginPortal()"
else
  echo "✅ gradlePluginPortal() already present"
fi

# Fix 3: Disable Foojay toolchains plugin in settings.gradle
echo "🔧 Disabling Foojay toolchains plugin..."
if [ -f "android/settings.gradle" ]; then
  # Comment out the Foojay plugin
  sed -i 's/^id "org.gradle.toolchains.foojay-resolver-convention"/\/\/ id "org.gradle.toolchains.foojay-resolver-convention"/' android/settings.gradle
  echo "✅ Disabled Foojay toolchains plugin"
else
  echo "⚠️  settings.gradle not found, skipping Foojay disable"
fi

# Fix 4: Update gradle.properties
echo "⚙️  Updating gradle.properties..."
sed -i '/org.gradle.java.installations/d' android/gradle.properties
sed -i '/org.gradle.jvmargs/d' android/gradle.properties

{
  echo ""
  echo "org.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=512m"
  echo "org.gradle.caching=true"
  echo "org.gradle.parallel=true"
} >> android/gradle.properties
echo "✅ Updated gradle.properties"

# Fix 5: Clear Gradle cache
rm -rf android/.gradle
echo "✅ Gradle cache cleared"

echo ""
echo "✅ All Gradle fixes applied successfully!"
echo "Configuration Summary:"
echo "  Gradle version: 7.6.3"
echo "  Foojay plugin: Disabled"
echo "  Java version: 17"
echo "  Ready to build APK! 🚀"
