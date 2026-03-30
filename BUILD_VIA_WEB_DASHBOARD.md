# Build SubTrimmer App via Expo Web Dashboard (No Command Line!)

This guide shows you how to build your Android app using Expo's web dashboard. **No command line needed!** ✨

## Step 1: Upload Project to Expo

### 1a. Go to Expo.dev

1. Open https://expo.dev in your browser
2. Log in with your Expo account
3. Click your profile icon (top right)
4. Select "Projects"

### 1b. Create New Project

1. Click "Create project" or "New project"
2. Choose "Blank" template
3. Name it: `SubTrimmer`
4. Click "Create"

You'll see a project dashboard with a project ID. **Save this ID!**

## Step 2: Link Your Local Project to Expo

This step requires ONE command line action. I promise it's the last one! 😊

1. **Open Command Prompt** (not as admin)
2. **Copy and paste this:**
   ```
   cd /d C:\Users\ismael\subscription-trimmer-mobile
   ```
3. **Press Enter**
4. **Then copy and paste this:**
   ```
   npx eas init --id YOUR_PROJECT_ID
   ```
   (Replace `YOUR_PROJECT_ID` with the ID from Step 1b)

5. **Press Enter and wait for it to complete**

If it works, you'll see a message saying the project is linked. ✅

## Step 3: Build via Web Dashboard

**From now on, NO MORE COMMAND LINE!** 🎉

1. Go back to https://expo.dev
2. Open your SubTrimmer project
3. Click the **"Builds"** tab (or similar)
4. Click **"Create build"** or **"New build"**
5. Select:
   - Platform: **Android**
   - Build type: **App bundle (.aab)**
6. Click **"Start build"**

The build will start and show a progress bar. This takes 5-15 minutes.

## Step 4: Download the .aab File

1. Wait for the build to complete (you'll see a green checkmark)
2. Click the completed build
3. Click **"Download"** button
4. Save the `.aab` file to your Downloads folder

**You now have your app bundle!** 🎉

## Step 5: Upload to Google Play Store

1. Go to https://play.google.com/console
2. Log in with your Google Play Developer account
3. Open your SubTrimmer app
4. Go to **"Release" → "Production"**
5. Click **"Create release"**
6. Click **"Browse files"** and select the `.aab` file you just downloaded
7. Upload it
8. Add release notes:
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
9. Click **"Review release"**
10. Click **"Start rollout to production"**

**Done!** Your app is submitted for review! 🚀

## Troubleshooting

**"Project not linked" error?**
- Make sure you ran `npx eas init --id YOUR_PROJECT_ID` correctly
- Check that YOUR_PROJECT_ID is correct from Expo.dev

**Build fails?**
- Go to Expo.dev → Builds tab
- Click the failed build
- Scroll down to see the error message
- Common fixes:
  - Make sure `app.json` is valid
  - Check that all dependencies are compatible

**Can't find the build download?**
- Go to https://expo.dev
- Open SubTrimmer project
- Click "Builds" tab
- Find your completed build
- Click it and look for download button

## Important Notes

✅ The `.aab` file is what Google Play Store needs  
✅ Keep it safe - you'll need it for updates too  
✅ Build times vary (usually 5-15 minutes)  
✅ You can build multiple times - just start a new build  

## Next Steps After Submission

1. **Wait for review** (usually 2-4 hours)
2. **Check your email** for approval/rejection
3. **If approved**, your app appears on Google Play Store!
4. **Share the link** with users: https://play.google.com/store/apps/details?id=com.subtrimmer.app

## Support

- [Expo Docs](https://docs.expo.dev)
- [Google Play Console Help](https://support.google.com/googleplay)
- [EAS Build Docs](https://docs.expo.dev/build/introduction/)

---

**You've got this!** 💪 The hardest part is done. Now it's just a few clicks! 🎉
