# SubTrimmer Mobile App - Build & Deployment Guide

## Pre-Build Checklist

- [ ] Update version number in `app.json`
- [ ] Update app icon (1024x1024 PNG) in `assets/icon.png`
- [ ] Update splash screen (1200x1200 PNG) in `assets/splash.png`
- [ ] Update adaptive icon (1024x1024 PNG) in `assets/adaptive-icon.png`
- [ ] Test all features on Android device/emulator
- [ ] Verify API connection to backend
- [ ] Test offline functionality
- [ ] Test push notifications

## Building for Development

### Local Development

```bash
# Install dependencies
npm install

# Start development server
npm start

# Run on Android emulator or device
npm run android
```

### Preview Build (APK)

```bash
# Create preview APK for testing
eas build --platform android --type apk

# This will:
# 1. Build the app
# 2. Generate a shareable link
# 3. You can install directly on Android devices
```

## Building for Production

### Step 1: Set Up EAS Account

```bash
# Login to Expo
eas login

# Link project to Expo
eas project:init
```

### Step 2: Configure Keystore

```bash
# Generate a new keystore for signing
eas credentials

# Select: Android > Production > Create new
# This will generate your signing key
```

### Step 3: Build App Bundle

```bash
# Build optimized app bundle for Play Store
eas build --platform android --type app-bundle

# This creates a .aab file ready for Google Play Store
```

### Step 4: Upload to Google Play Store

1. **Create Play Console Account**
   - Go to https://play.google.com/console
   - Create a developer account ($25 one-time fee)

2. **Create App**
   - Click "Create app"
   - Enter app name: "SubTrimmer"
   - Select category: "Productivity" or "Finance"
   - Accept declarations

3. **Set Up App Listing**
   - Add app title, short description, full description
   - Add screenshots (minimum 2, recommended 4-5)
   - Add app icon (512x512 PNG)
   - Add feature graphic (1024x500 PNG)

4. **Configure Pricing & Distribution**
   - Set pricing (free or paid)
   - Select countries
   - Content rating questionnaire

5. **Upload Build**
   - Go to "Testing" > "Internal Testing"
   - Click "Create release"
   - Upload the .aab file from `eas build`
   - Add release notes

6. **Test with Internal Testers**
   - Add testers' Google accounts
   - Share internal testing link
   - Gather feedback

7. **Promote to Production**
   - After internal testing, create production release
   - Upload same .aab file
   - Review all store listing details
   - Submit for review

## Versioning

Update version in `app.json`:

```json
{
  "expo": {
    "version": "1.0.0",
    "android": {
      "versionCode": 1
    }
  }
}
```

- **version**: Semantic versioning (1.0.0, 1.1.0, etc.)
- **versionCode**: Incremental integer (1, 2, 3, etc.) - must increase for each Play Store release

## Monitoring & Updates

### Using EAS Update

For over-the-air updates without rebuilding:

```bash
# Update app code
# Commit changes

# Publish update
eas update --platform android

# Users will get the update on next app launch
```

### Analytics

Monitor app performance in Google Play Console:
- Install metrics
- Crash reports
- User reviews
- Performance data

## Troubleshooting

### Build Fails

```bash
# Clear cache and rebuild
eas build --platform android --type app-bundle --clear-cache
```

### App Crashes on Launch

1. Check logcat: `adb logcat`
2. Verify API connection in `app.json`
3. Check backend is running
4. Review error logs in Play Console

### Push Notifications Not Working

1. Verify Expo project ID in `app.json`
2. Check notification permissions are granted
3. Test with local notification first
4. Review Expo notification docs

### Performance Issues

1. Profile with React Native Debugger
2. Check for unnecessary re-renders
3. Optimize images and assets
4. Use React Query caching effectively

## Release Checklist

Before submitting to Play Store:

- [ ] App builds successfully
- [ ] All screens load without errors
- [ ] Add/edit/delete subscriptions work
- [ ] Analytics display correctly
- [ ] Alerts trigger appropriately
- [ ] AI insights generate
- [ ] Notifications work
- [ ] Offline mode functions
- [ ] Camera/receipt scanning works
- [ ] Push notifications work
- [ ] No console errors
- [ ] App icon looks good
- [ ] Splash screen displays correctly
- [ ] Store listing is complete
- [ ] Privacy policy is linked
- [ ] Terms of service are linked

## Support & Resources

- [Expo Documentation](https://docs.expo.dev)
- [Google Play Console Help](https://support.google.com/googleplay/android-developer)
- [React Native Best Practices](https://reactnative.dev/docs/performance)
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
