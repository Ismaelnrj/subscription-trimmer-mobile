# SubTrimmer Mobile App - Quick Start

## 🚀 Get Started in 5 Minutes

### 1. Install & Run

```bash
cd /home/ubuntu/subscription-trimmer-mobile

# Install dependencies (already done)
npm install --legacy-peer-deps

# Start development server
npm start

# Run on Android
npm run android
```

### 2. Test the App

- **Dashboard:** View spending overview
- **Add Subscription:** Click "+ Add Subscription"
  - Name: Netflix
  - Price: 15.99
  - Billing: Monthly
- **View Analytics:** See spending breakdown
- **Check Alerts:** View renewal reminders
- **Get Insights:** Click "Generate AI Insights"

### 3. Build for Production

```bash
# Create Expo account first at https://expo.dev
npx expo login

# Generate signing key
eas credentials

# Build app bundle for Play Store
eas build --platform android --type app-bundle

# Download the .aab file from the link provided
```

### 4. Submit to Play Store

1. Create Google Play Developer account ($25)
2. Create app in Play Console
3. Upload .aab file
4. Add store listing (description, screenshots)
5. Submit for review

**See SUBMISSION_GUIDE.md for detailed steps**

## 📱 Features

✅ Dashboard - Overview of spending  
✅ Subscriptions - Add, edit, delete  
✅ Analytics - Visual spending breakdown  
✅ Alerts - Renewal & expensive alerts  
✅ Insights - AI recommendations  
✅ Profile - Account settings  
✅ Notifications - Notification center  
✅ Push Notifications - Native Android  
✅ Offline Mode - Works without internet  
✅ Camera - Scan receipts  

## 🔧 Troubleshooting

**App won't start?**
```bash
npm install --legacy-peer-deps
npm start
```

**Build fails?**
```bash
eas build --platform android --type app-bundle --clear-cache
```

**API not connecting?**
- Check backend is running at https://3000-ia39shsfy6ozctawtvoyh-bff2e256.us2.manus.computer
- Verify API URL in app.json

## 📚 Documentation

- `README.md` - Full documentation
- `BUILD_GUIDE.md` - Detailed build instructions
- `SUBMISSION_GUIDE.md` - Play Store submission steps
- `app.json` - App configuration

## 🎯 Next Steps

1. ✅ Dependencies installed
2. ✅ App configured
3. 👉 Test locally: `npm run android`
4. 👉 Create Expo account
5. 👉 Build app bundle
6. 👉 Submit to Play Store

## 📞 Need Help?

- [Expo Docs](https://docs.expo.dev)
- [React Native Docs](https://reactnative.dev)
- [Google Play Console](https://play.google.com/console)

---

**Ready to launch?** Follow the steps in SUBMISSION_GUIDE.md! 🚀
