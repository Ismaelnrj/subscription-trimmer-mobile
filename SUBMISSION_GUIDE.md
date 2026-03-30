# SubTrimmer - Google Play Store Submission Guide

This guide walks you through submitting the SubTrimmer Android app to Google Play Store.

## Prerequisites

✅ **Already done by the AI:**
- React Native app built with Expo
- All screens and features implemented
- Signing configuration ready
- EAS Build setup complete

❌ **You need to do:**
1. Create Google Play Developer account ($25 one-time fee)
2. Create Expo account (free)
3. Prepare app store assets (screenshots, descriptions)

## Step 1: Create Google Play Developer Account

1. Go to https://play.google.com/console
2. Click "Create account"
3. Pay the $25 registration fee
4. Complete your developer profile

## Step 2: Create Expo Account & Link Project

```bash
# Create free account at https://expo.dev

# Login to Expo CLI
cd /home/ubuntu/subscription-trimmer-mobile
npx expo login

# Link project to Expo
eas project:init

# When prompted, select "Create a new project"
```

## Step 3: Generate Signing Key

```bash
# Create keystore for signing
eas credentials

# Follow prompts:
# 1. Select: Android
# 2. Select: Production
# 3. Select: Create new
# 4. Follow instructions to generate key

# Save the keystore details - you'll need them later
```

## Step 4: Build App Bundle

```bash
# Build production app bundle
eas build --platform android --type app-bundle

# This will:
# - Build the app
# - Sign it with your keystore
# - Generate a .aab file
# - Provide a download link

# Download the .aab file and save it
```

## Step 5: Create App in Play Console

1. Go to https://play.google.com/console
2. Click "Create app"
3. Fill in:
   - **App name:** SubTrimmer
   - **Default language:** English
   - **App type:** Application
   - **Category:** Productivity or Finance
   - **Content rating:** Complete questionnaire

## Step 6: Prepare Store Listing

### 6a. App Details

1. Go to "Store listing"
2. Fill in:
   - **Short description** (80 chars max):
     "Manage and optimize your subscriptions to save money"
   
   - **Full description** (4000 chars max):
     ```
     SubTrimmer helps you take control of your subscription expenses.
     
     Features:
     • Track all your subscriptions in one place
     • See monthly and yearly spending breakdown
     • Get alerts for expensive subscriptions
     • Receive renewal reminders before billing
     • Get AI-powered recommendations to save money
     • View step-by-step cancellation guides
     • Offline access to your subscription data
     
     Stop subscription creep and start saving today!
     ```

### 6b. Graphics & Images

You need to provide:

1. **App Icon** (512x512 PNG)
   - Create a simple icon with the SubTrimmer logo
   - Use the indigo/violet color (#4F46E5)

2. **Feature Graphic** (1024x500 PNG)
   - Landscape banner showing app benefits
   - Text: "SubTrimmer - Control Your Subscriptions"

3. **Screenshots** (minimum 2, recommended 4-5)
   - Dashboard screen
   - Subscriptions list
   - Analytics/spending breakdown
   - Alerts screen
   - Profile screen
   
   Each screenshot should be 1080x1920 PNG

4. **Video Preview** (optional but recommended)
   - 15-30 second walkthrough of key features

### 6c. Content Rating

1. Go to "Content rating"
2. Fill out questionnaire
3. Get rating certificate

## Step 7: Configure Pricing & Distribution

1. Go to "Pricing & distribution"
2. Select:
   - **Free** (or set a price if you prefer)
   - **Countries:** Select all or your target markets
   - **Content guidelines:** Accept all
   - **US export laws:** Accept

## Step 8: Upload Build

1. Go to "Testing" → "Internal testing"
2. Click "Create release"
3. Upload the .aab file you built earlier
4. Add release notes:
   ```
   Initial release of SubTrimmer
   
   Features:
   - Track subscriptions
   - View spending analytics
   - Get renewal alerts
   - AI-powered recommendations
   - Offline access
   - Push notifications
   ```

## Step 9: Internal Testing

1. Add your email as internal tester
2. Share the internal testing link
3. Test thoroughly on your device
4. Verify:
   - All screens load
   - Add/edit/delete subscriptions work
   - Alerts trigger
   - Notifications work
   - No crashes or errors

## Step 10: Submit for Review

1. Go to "Production" release
2. Upload the same .aab file
3. Review all store listing details
4. Click "Submit for review"

**Review time:** Typically 2-4 hours, sometimes up to 24 hours

## After Approval

Once approved:
- App appears on Google Play Store
- Users can search for "SubTrimmer"
- Share the link: https://play.google.com/store/apps/details?id=com.subtrimmer.app

## Updating the App

To push updates:

```bash
# Update version in app.json
# Increment versionCode by 1
# Update version to next semver (e.g., 1.0.1)

# Rebuild
eas build --platform android --type app-bundle

# Upload new .aab to Play Console
# Submit for review (usually faster for updates)
```

## Troubleshooting

### Build Fails
```bash
eas build --platform android --type app-bundle --clear-cache
```

### App Crashes
- Check logcat: `adb logcat`
- Verify API URL in app.json
- Check backend is running

### Rejected by Play Store
- Check content policy compliance
- Ensure privacy policy is linked
- Verify app doesn't violate guidelines

## Support

- [Expo Docs](https://docs.expo.dev)
- [Google Play Console Help](https://support.google.com/googleplay/android-developer)
- [Android App Publishing Guide](https://developer.android.com/studio/publish)

## Checklist Before Submission

- [ ] App builds successfully
- [ ] All features work on device
- [ ] No console errors
- [ ] App icon created (512x512)
- [ ] Feature graphic created (1024x500)
- [ ] Screenshots prepared (1080x1920)
- [ ] Store listing complete
- [ ] Privacy policy written
- [ ] Content rating completed
- [ ] Pricing set
- [ ] Countries selected
- [ ] Internal testing passed
- [ ] Ready for production release

Good luck! 🚀
