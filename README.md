# SubTrimmer Mobile App

A React Native Android app built with Expo for managing and optimizing subscription expenses.

## Features

- **Dashboard** - Overview of spending, active subscriptions, and alerts
- **Subscriptions** - Add, edit, delete subscriptions with billing cycle tracking
- **Analytics** - Visual breakdown of spending by category and monthly/yearly projections
- **Alerts** - Real-time notifications for expensive subscriptions and upcoming renewals
- **AI Insights** - Personalized recommendations for subscription optimization
- **Profile** - User account management and notification preferences
- **Notifications** - Notification center with full history
- **Push Notifications** - Native Android push notifications
- **Offline Support** - Local caching for offline access
- **Receipt Scanning** - Camera integration for uploading subscription receipts

## Getting Started

### Prerequisites

- Node.js 16+ and npm/pnpm
- Expo CLI: `npm install -g expo-cli`
- Android device or emulator (for testing)

### Installation

1. Navigate to the project directory:
```bash
cd subscription-trimmer-mobile
```

2. Install dependencies:
```bash
npm install
# or
pnpm install
```

3. Start the development server:
```bash
npm start
# or
pnpm start
```

4. Run on Android:
```bash
npm run android
# or
pnpm android
```

## Architecture

### API Connection
- Connects to existing SubTrimmer backend at `https://3000-ia39shsfy6ozctawtvoyh-bff2e256.us2.manus.computer`
- Uses tRPC client for type-safe API calls
- Axios for HTTP requests with automatic token injection

### State Management
- Zustand for authentication state
- React Query for server state and caching
- AsyncStorage for local data persistence

### Native Features
- **Notifications**: Expo Notifications for push notifications
- **Storage**: AsyncStorage for offline caching
- **Camera**: Expo Image Picker for receipt photos
- **Security**: Expo Secure Store for token storage

## Project Structure

```
app/
  ├── _layout.tsx           # Root layout with splash screen
  ├── (tabs)/               # Tab navigation
  │   ├── _layout.tsx       # Tab navigation setup
  │   ├── index.tsx         # Dashboard screen
  │   ├── subscriptions.tsx # Subscriptions management
  │   ├── analytics.tsx     # Analytics screen
  │   └── profile.tsx       # Profile screen
  ├── alerts.tsx            # Alerts screen (modal)
  ├── insights.tsx          # AI Insights screen (modal)
  └── notifications.tsx     # Notifications center (modal)

lib/
  ├── api.ts                # Axios client with interceptors
  ├── auth-store.ts         # Zustand auth store
  ├── notifications.ts      # Push notification utilities
  ├── storage.ts            # Offline storage utilities
  └── camera.ts             # Camera and image utilities
```

## Building for Production

### Generate APK for Google Play Store

```bash
# Build APK
eas build --platform android --type apk

# Build App Bundle (recommended for Play Store)
eas build --platform android --type app-bundle
```

### Configuration

Update `app.json` with your app details:
- App name
- Package name (com.subtrimmer.app)
- Icons and splash screens
- Permissions

## Environment Variables

The app uses the following environment variables (configured in `app.json`):

```json
{
  "extra": {
    "apiUrl": "https://your-api-url.com",
    "projectId": "your-expo-project-id"
  }
}
```

## Testing

### Manual Testing
1. Test on Android device or emulator
2. Verify all screens load correctly
3. Test add/edit/delete subscription flows
4. Test offline functionality by disabling network
5. Test push notifications

### Common Issues

**API Connection Fails**
- Check that backend is running
- Verify API URL in `app.json`
- Check network connectivity

**Push Notifications Not Working**
- Ensure permissions are granted
- Check device is registered for push notifications
- Verify Expo project ID in `app.json`

**Offline Mode Not Working**
- Check AsyncStorage is accessible
- Verify data is being cached before going offline

## Deployment

### Google Play Store

1. Create a Google Play Developer account
2. Create a new app in Play Console
3. Build the app bundle: `eas build --platform android --type app-bundle`
4. Upload to Play Console
5. Configure store listing, pricing, and release

### Continuous Deployment

Set up EAS Build for automatic builds:

```bash
eas build --platform android --auto-submit
```

## Support

For issues or questions, refer to:
- [Expo Documentation](https://docs.expo.dev)
- [React Native Documentation](https://reactnative.dev)
- [SubTrimmer Backend Documentation](../README.md)

## License

MIT
