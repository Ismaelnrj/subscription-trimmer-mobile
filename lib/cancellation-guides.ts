export type CancellationGuide = {
  steps: string[];
  url: string;
  note?: string;
};

// Keys are lowercase match strings (checked via .includes())
const GUIDES: Record<string, CancellationGuide> = {
  netflix: {
    steps: [
      "Open netflix.com in a browser (cancellation requires desktop/mobile web, not the app).",
      'Click your profile icon (top right) → "Account".',
      'Under "Membership", tap "Cancel Membership".',
      "Confirm the cancellation — you keep access until the end of your billing period.",
    ],
    url: "https://www.netflix.com/cancelplan",
    note: "You can restart your membership at any time without losing your profile or viewing history.",
  },
  spotify: {
    steps: [
      'Go to spotify.com/account and log in.',
      'Under "Your plan", click "Change plan".',
      'Scroll to the bottom and select "Cancel Premium".',
      'Click "Yes, Cancel" to confirm.',
    ],
    url: "https://www.spotify.com/account/subscription/change/",
    note: "You'll keep Premium until the end of your billing cycle, then revert to the free tier.",
  },
  "apple tv": {
    steps: [
      "On your iPhone/iPad, open the Settings app.",
      'Tap your name at the top → "Subscriptions".',
      'Find "Apple TV+" and tap it.',
      'Tap "Cancel Subscription" and confirm.',
    ],
    url: "https://support.apple.com/en-us/HT202039",
  },
  "apple music": {
    steps: [
      "On your iPhone/iPad, open the Settings app.",
      'Tap your name → "Subscriptions".',
      'Select "Apple Music" and tap "Cancel Subscription".',
    ],
    url: "https://support.apple.com/en-us/HT202039",
  },
  "apple arcade": {
    steps: [
      "Open Settings on your iPhone/iPad.",
      'Tap your name → "Subscriptions" → "Apple Arcade".',
      'Tap "Cancel Subscription".',
    ],
    url: "https://support.apple.com/en-us/HT202039",
  },
  icloud: {
    steps: [
      "Open Settings on your iPhone/iPad and tap your name.",
      'Tap "iCloud" → "Manage Account Storage".',
      'Tap "Change Storage Plan" → "Downgrade Options".',
      'Select "Free" to cancel the paid plan.',
    ],
    url: "https://support.apple.com/en-us/HT201318",
    note: "If you're over 5 GB, your data won't be deleted immediately but new syncing will stop.",
  },
  "disney": {
    steps: [
      "Go to disneyplus.com and log in.",
      'Click your profile icon → "Account".',
      'Under "Subscription", click "Cancel Subscription".',
      "Follow the confirmation steps.",
    ],
    url: "https://www.disneyplus.com/account",
    note: "Includes Disney+, Hulu, and ESPN+ bundle cancellations from the same page.",
  },
  hulu: {
    steps: [
      "Go to hulu.com/account and log in.",
      'Under "Your Subscription", click "Cancel".',
      "Complete the cancellation flow.",
    ],
    url: "https://secure.hulu.com/account",
  },
  "hbo": {
    steps: [
      "Go to max.com and log in.",
      'Tap your profile icon → "Account".',
      'Under "Plan & Payment", select "Cancel Plan".',
    ],
    url: "https://www.max.com/account",
    note: "If you subscribed through a third party (Apple, Amazon, etc.), cancel there instead.",
  },
  "amazon prime": {
    steps: [
      "Go to amazon.com and sign in.",
      'Hover over "Account & Lists" → "Prime Membership".',
      'Click "Manage membership" → "End Membership".',
      "Choose whether to end immediately or at the next renewal date.",
    ],
    url: "https://www.amazon.com/mc",
  },
  "youtube": {
    steps: [
      "Open YouTube and tap your profile icon.",
      'Go to "Purchases and memberships".',
      "Tap the subscription you want to cancel.",
      'Tap "Deactivate".',
    ],
    url: "https://www.youtube.com/paid_memberships",
  },
  "microsoft 365": {
    steps: [
      "Go to account.microsoft.com and sign in.",
      'Click "Services & subscriptions".',
      'Find Microsoft 365 and click "Manage".',
      'Select "Cancel" and follow the prompts.',
    ],
    url: "https://account.microsoft.com/services/",
  },
  "microsoft": {
    steps: [
      "Go to account.microsoft.com and sign in.",
      'Click "Services & subscriptions".',
      'Find your subscription and click "Manage" → "Cancel".',
    ],
    url: "https://account.microsoft.com/services/",
  },
  adobe: {
    steps: [
      "Go to account.adobe.com and sign in.",
      'Click "Plans" → "Manage plan".',
      'Click "Cancel plan" and follow the prompts.',
      "Note: cancelling mid-term may incur an early termination fee (50% of remaining balance).",
    ],
    url: "https://account.adobe.com/plans",
    note: "Annual plans cancelled before the year ends incur a 50% early termination fee. Monthly plans can be cancelled any time.",
  },
  dropbox: {
    steps: [
      "Go to dropbox.com and sign in.",
      'Click your avatar → "Settings" → "Plan".',
      'Click "Cancel plan" at the bottom.',
    ],
    url: "https://www.dropbox.com/account/plan",
  },
  "google one": {
    steps: [
      "Open the Google One app or go to one.google.com.",
      'Tap "Settings" → "Manage subscription".',
      'Tap "Cancel subscription" and confirm.',
    ],
    url: "https://one.google.com/storage",
  },
  "paramount": {
    steps: [
      "Go to paramountplus.com and sign in.",
      'Click your profile → "Account" → "Cancel Subscription".',
    ],
    url: "https://www.paramountplus.com/account/",
  },
  peacock: {
    steps: [
      "Go to peacocktv.com and sign in.",
      'Click your profile icon → "Account" → "Manage Plan".',
      'Select "Cancel Plan" and confirm.',
    ],
    url: "https://www.peacocktv.com/account",
  },
  duolingo: {
    steps: [
      "Open Duolingo and tap your profile icon.",
      'Go to "Super Duolingo" or "Duolingo Max" settings.',
      'Tap "Manage subscription" — this redirects to your App Store or Google Play subscription settings.',
      "Cancel from there.",
    ],
    url: "https://support.duolingo.com/hc/en-us/articles/360002659012",
  },
  headspace: {
    steps: [
      "Go to headspace.com and log in.",
      'Go to "Account" → "Subscription".',
      'Click "Cancel subscription" and follow the steps.',
    ],
    url: "https://www.headspace.com/account",
  },
  calm: {
    steps: [
      "Go to calm.com and log in.",
      'Click your email address (top right) → "Settings".',
      'Under "Subscription", click "Manage Subscription".',
      "Follow the cancellation steps.",
    ],
    url: "https://app.calm.com/settings",
  },
  "xbox": {
    steps: [
      "Go to microsoft.com/en-us/store/b/account and sign in.",
      'Click "Services & subscriptions".',
      'Find Xbox Game Pass and click "Manage" → "Cancel".',
    ],
    url: "https://account.microsoft.com/services/",
  },
  "playstation": {
    steps: [
      "Go to playstation.com and sign in.",
      'Click your profile → "Subscription".',
      'Find PlayStation Plus and click "Cancel Automatic Renewal".',
    ],
    url: "https://store.playstation.com/",
  },
  "nintendo": {
    steps: [
      "Go to accounts.nintendo.com and sign in.",
      'Click "Shop Menu" → "Nintendo Switch Online".',
      'Select "Cancel automatic renewal".',
    ],
    url: "https://accounts.nintendo.com/",
  },
  "nordvpn": {
    steps: [
      "Go to nordvpn.com and log in to My Nord Account.",
      'Navigate to "Billing" → "Subscriptions".',
      'Click "Cancel subscription".',
    ],
    url: "https://my.nordaccount.com/dashboard/nordvpn/",
  },
  "expressvpn": {
    steps: [
      "Go to expressvpn.com and log in.",
      'Go to "My Account" → "Subscriptions".',
      'Click "Cancel Subscription".',
    ],
    url: "https://www.expressvpn.com/subscriptions",
  },
  notion: {
    steps: [
      "Open Notion and go to Settings (sidebar).",
      'Click "Plans" → "Downgrade" to switch to Free.',
    ],
    url: "https://www.notion.so/my-account",
  },
  "canva": {
    steps: [
      "Go to canva.com and log in.",
      'Click your profile → "Account settings" → "Billing & plans".',
      'Click "Cancel plan".',
    ],
    url: "https://www.canva.com/settings/",
  },
  "grammarly": {
    steps: [
      "Go to grammarly.com/account and log in.",
      'Navigate to the "Subscription" tab.',
      'Click "Cancel subscription".',
    ],
    url: "https://www.grammarly.com/account/subscription",
  },
  "1password": {
    steps: [
      "Go to my.1password.com and sign in.",
      'Click "Billing" in the sidebar.',
      'Click "Cancel subscription" at the bottom.',
    ],
    url: "https://my.1password.com/billing",
  },
  "lastpass": {
    steps: [
      "Log in to your LastPass vault at lastpass.com.",
      'Go to "Account Settings" → "Subscription".',
      'Select "Cancel Premium".',
    ],
    url: "https://lastpass.com/",
  },
  "slack": {
    steps: [
      "In your Slack workspace, go to your workspace name (top left).",
      'Click "Settings & administration" → "Billing".',
      'Click "Downgrade" to move to the free plan.',
    ],
    url: "https://slack.com/intl/en-gb/help/articles/204756460",
  },
  zoom: {
    steps: [
      "Go to zoom.us and sign in.",
      'Click "Account Management" → "Billing".',
      'Under your current plan, click "Cancel Subscription".',
    ],
    url: "https://zoom.us/billing",
  },
  "skillshare": {
    steps: [
      "Go to skillshare.com and log in.",
      'Click your profile icon → "Account" → "Membership".',
      'Click "Cancel Membership".',
    ],
    url: "https://www.skillshare.com/settings/membership",
  },
  "masterclass": {
    steps: [
      "Go to masterclass.com and log in.",
      'Click your name → "Settings" → "Membership".',
      'Click "Cancel Membership".',
    ],
    url: "https://www.masterclass.com/account",
  },
  "crunchyroll": {
    steps: [
      "Go to crunchyroll.com and log in.",
      'Click your profile icon → "Premium".',
      'Click "Manage Premium" → "Cancel Membership".',
    ],
    url: "https://www.crunchyroll.com/account",
  },
};

const GENERIC_GUIDE: CancellationGuide = {
  steps: [
    "Open the service's official website and log in to your account.",
    'Look for "Settings", "Account", "Billing", or "Subscription" in your profile menu.',
    'Find an option like "Cancel subscription", "Downgrade", or "End membership".',
    "If you subscribed via Google Play or App Store, cancel directly there instead — the service's own site won't work for those.",
    "Take a screenshot of the cancellation confirmation for your records.",
  ],
  url: "",
  note: "If subscribed via Apple: Settings → your name → Subscriptions. If via Google Play: Play Store app → your profile → Payments & subscriptions.",
};

export function getCancellationGuide(name: string): CancellationGuide {
  const n = name.toLowerCase().trim();
  for (const [key, guide] of Object.entries(GUIDES)) {
    if (n.includes(key)) return guide;
  }
  return GENERIC_GUIDE;
}
