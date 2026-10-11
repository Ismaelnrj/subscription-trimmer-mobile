export type CancellationGuide = {
  steps: string[];
  url: string;
  note?: string;
};

type Lang = "en" | "de";

export type LocalizedGuide = {
  steps: Record<Lang, string[]>;
  /* One URL, or one per language where the service runs a separate store per
     country: a German reader sent to amazon.com lands in the wrong account. */
  url: string | Record<Lang, string>;
  note?: Record<Lang, string>;
  /* The date somebody checked these steps against the service's own help
     pages, YYYY-MM-DD. Absent means never checked since it was written. The
     public guide pages print it, so never set it without checking. */
  verified?: string;
};

function urlFor(guide: LocalizedGuide, lang: Lang): string {
  return typeof guide.url === "string" ? guide.url : guide.url[lang];
}

// Keys are lowercase match strings (checked via .includes()).
// Quoted UI labels (e.g. "Manage plan") are kept in English in both
// languages since they're literal references to text on the service's own
// website, which we can't verify is translated the same way for every
// service and locale.
const GUIDES: Record<string, LocalizedGuide> = {
  netflix: {
    steps: {
      en: [
        "Sign in at netflix.com in a browser. The Netflix app sends you to the website for this step.",
        'Select your profile icon (top right) → "Account".',
        'Under "Membership & Billing", select "Cancel Membership".',
        'If Netflix offers a pause instead, choose to continue, then confirm with "Finish Cancellation".',
      ],
      de: [
        "Melde dich in einem Browser auf netflix.com an. Die Netflix App leitet dich für diesen Schritt auf die Website weiter.",
        'Wähle oben rechts dein Profilbild → "Konto".',
        'Wähle im Bereich "Mitgliedschaft und Abrechnung" die Option "Mitgliedschaft kündigen".',
        'Bietet Netflix stattdessen eine Pause an, fahre mit der Kündigung fort und bestätige mit "Kündigung abschließen".',
      ],
    },
    url: "https://www.netflix.com/cancelplan",
    note: {
      en: "You keep access until the end of your billing period and get a confirmation email. Deleting the app or signing out does not cancel. If you pay through Google Play, Apple or a TV or mobile provider, cancel there instead.",
      de: "Du behältst den Zugang bis zum Ende deines Abrechnungszeitraums und bekommst eine Bestätigung per E-Mail. Die App zu löschen oder dich abzumelden kündigt nicht. Zahlst du über Google Play, Apple oder einen TV- oder Mobilfunkanbieter, kündigst du dort.",
    },
    verified: "2026-10-11",
  },
  spotify: {
    steps: {
      en: [
        "Sign in at spotify.com/account in a browser. Plan changes are not available inside the Spotify app.",
        'Open "Manage your subscription".',
        'Select "Cancel subscription" and confirm. Spotify may offer a discount or a pause first.',
      ],
      de: [
        "Melde dich in einem Browser auf spotify.com/account an. In der Spotify App lässt sich das Abo nicht ändern.",
        'Öffne "Abo verwalten".',
        'Wähle "Abo kündigen" und bestätige. Spotify bietet dir vorher eventuell einen Rabatt oder eine Pause an.',
      ],
    },
    url: "https://www.spotify.com/account/",
    note: {
      en: "Premium stays until your next billing date, then your account switches to Spotify Free and keeps your playlists. A free trial cancelled early ends at once. On Family or Duo only the plan manager can cancel. If the option is missing, you probably pay through a partner such as your mobile provider, Google Play or Apple: cancel there.",
      de: "Premium bleibt bis zum nächsten Rechnungsdatum, danach wechselt dein Konto zu Spotify Free und deine Playlists bleiben erhalten. Ein kostenloses Probe-Abo endet bei Kündigung sofort. Bei Family oder Duo kann nur der Hauptnutzer kündigen. Fehlt die Option, zahlst du vermutlich über einen Partner wie deinen Mobilfunkanbieter, Google Play oder Apple: Kündige dort.",
    },
    verified: "2026-10-11",
  },
  "apple tv": {
    steps: {
      en: [
        "On your iPhone/iPad, open the Settings app.",
        'Tap your name at the top → "Subscriptions".',
        'Find "Apple TV+" and tap it.',
        'Tap "Cancel Subscription" and confirm.',
      ],
      de: [
        "Öffne auf deinem iPhone oder iPad die Einstellungen App.",
        'Tippe oben auf deinen Namen → "Subscriptions".',
        'Suche "Apple TV+" und tippe darauf.',
        'Tippe auf "Cancel Subscription" und bestätige.',
      ],
    },
    url: "https://support.apple.com/en-us/HT202039",
  },
  "apple music": {
    steps: {
      en: [
        "On your iPhone/iPad, open the Settings app.",
        'Tap your name → "Subscriptions".',
        'Select "Apple Music" and tap "Cancel Subscription".',
      ],
      de: [
        "Öffne auf deinem iPhone oder iPad die Einstellungen App.",
        'Tippe auf deinen Namen → "Subscriptions".',
        'Wähle "Apple Music" und tippe auf "Cancel Subscription".',
      ],
    },
    url: "https://support.apple.com/en-us/HT202039",
  },
  "apple arcade": {
    steps: {
      en: [
        "Open Settings on your iPhone/iPad.",
        'Tap your name → "Subscriptions" → "Apple Arcade".',
        'Tap "Cancel Subscription".',
      ],
      de: [
        "Öffne die Einstellungen auf deinem iPhone oder iPad.",
        'Tippe auf deinen Namen → "Subscriptions" → "Apple Arcade".',
        'Tippe auf "Cancel Subscription".',
      ],
    },
    url: "https://support.apple.com/en-us/HT202039",
  },
  icloud: {
    steps: {
      en: [
        "Open Settings on your iPhone/iPad and tap your name.",
        'Tap "iCloud" → "Manage Account Storage".',
        'Tap "Change Storage Plan" → "Downgrade Options".',
        'Select "Free" to cancel the paid plan.',
      ],
      de: [
        "Öffne die Einstellungen auf deinem iPhone oder iPad und tippe auf deinen Namen.",
        'Tippe auf "iCloud" → "Manage Account Storage".',
        'Tippe auf "Change Storage Plan" → "Downgrade Options".',
        'Wähle "Free", um den kostenpflichtigen Plan zu kündigen.',
      ],
    },
    url: "https://support.apple.com/en-us/HT201318",
    note: {
      en: "If you're over 5 GB, your data won't be deleted immediately but new syncing will stop.",
      de: "Wenn du mehr als 5 GB nutzt, werden deine Daten nicht sofort gelöscht, aber die Synchronisierung neuer Daten stoppt.",
    },
  },
  disney: {
    steps: {
      en: [
        "Sign in at disneyplus.com in a browser.",
        'Select your profile icon (top right) → "Account".',
        'Under "Subscription", select your plan, then "Cancel Subscription".',
        "Confirm. Disney+ may offer a pause or ask whether you are sure first.",
      ],
      de: [
        "Melde dich in einem Browser auf disneyplus.com an.",
        'Wähle oben rechts dein Profilbild → "Konto".',
        'Wähle unter "Abo" dein Abo aus und dann "Abo kündigen".',
        "Bestätige die Kündigung. Disney+ fragt eventuell nach oder bietet dir vorher eine Pause an.",
      ],
    },
    url: "https://www.disneyplus.com/account",
    note: {
      en: "Access continues until the end of the period you already paid for. Keep the confirmation email. If you pay through Google Play, Apple, Amazon or a TV provider, cancel there instead.",
      de: "Der Zugang bleibt bis zum Ende des bereits bezahlten Zeitraums. Bewahre die Bestätigungsmail auf. Zahlst du über Google Play, Apple, Amazon oder einen TV-Anbieter, kündigst du dort.",
    },
    verified: "2026-10-11",
  },
  hulu: {
    steps: {
      en: [
        "Go to hulu.com/account and log in.",
        'Under "Your Subscription", click "Cancel".',
        "Complete the cancellation flow.",
      ],
      de: [
        "Gehe zu hulu.com/account und melde dich an.",
        'Klicke unter "Your Subscription" auf "Cancel".',
        "Schließe den Kündigungsvorgang ab.",
      ],
    },
    url: "https://secure.hulu.com/account",
  },
  hbo: {
    steps: {
      en: [
        "Go to max.com and log in.",
        'Tap your profile icon → "Account".',
        'Under "Plan & Payment", select "Cancel Plan".',
      ],
      de: [
        "Gehe zu max.com und melde dich an.",
        'Tippe auf dein Profilsymbol → "Account".',
        'Wähle unter "Plan & Payment" die Option "Cancel Plan".',
      ],
    },
    url: "https://www.max.com/account",
    note: {
      en: "If you subscribed through a third party (Apple, Amazon, etc.), cancel there instead.",
      de: "Wenn du über einen Drittanbieter abonniert hast (Apple, Amazon usw.), kündige stattdessen dort.",
    },
  },
  "amazon prime": {
    steps: {
      en: [
        "Sign in at amazon.com in a browser.",
        'Open "Account & Lists" → "Prime Membership".',
        'Select "Update, cancel and more" → "End membership".',
        'Amazon shows offers on the way: select "Continue to cancel" on each, then choose whether Prime ends now or at the end of your billing period.',
      ],
      de: [
        "Melde dich in einem Browser auf amazon.de an.",
        'Öffne "Konto und Listen" → "Meine Prime-Mitgliedschaft".',
        'Wähle "Aktualisieren, kündigen und mehr" → "Mitgliedschaft beenden".',
        'Amazon zeigt dir unterwegs Angebote: Wähle jeweils "Mit Kündigung fortfahren" und dann, ob Prime sofort oder zum Ende des Abrechnungszeitraums endet.',
      ],
    },
    url: { en: "https://www.amazon.com/mc", de: "https://www.amazon.de/gp/subs/primeclub/account/homepage.html" },
    note: {
      en: "Cancelling also ends Prime Video, which is part of Prime. Menu names change from time to time; the Prime Membership page is always reachable from Account & Lists.",
      de: "Mit Prime endet auch Prime Video, denn es gehört zur Mitgliedschaft. Die Menünamen ändern sich gelegentlich, die Prime-Seite findest du aber immer über Konto und Listen.",
    },
    verified: "2026-10-11",
  },
  youtube: {
    steps: {
      en: [
        "Open youtube.com/paid_memberships in a browser, or in the YouTube app select your profile picture → \"Paid memberships\".",
        'Select your Premium membership → "Manage membership" → "Deactivate".',
        'YouTube offers a pause first: select "Continue to cancel" instead.',
        "Choose a reason and confirm.",
      ],
      de: [
        "Öffne youtube.com/paid_memberships in einem Browser, oder wähle in der YouTube App dein Profilbild → \"Kostenpflichtige Mitgliedschaften\".",
        'Wähle deine Premium-Mitgliedschaft → "Mitgliedschaft verwalten" → "Deaktivieren".',
        "YouTube bietet dir zuerst eine Pause an: Fahre stattdessen mit der Kündigung fort.",
        "Wähle einen Grund und bestätige.",
      ],
    },
    url: "https://www.youtube.com/paid_memberships",
    note: {
      en: "Premium continues until the end of the billing period. If you were billed through Apple or Google Play, cancel in that account instead.",
      de: "Premium läuft bis zum Ende des Abrechnungszeitraums weiter. Wurde über Apple oder Google Play abgerechnet, kündigst du dort.",
    },
    verified: "2026-10-11",
  },
  "microsoft 365": {
    steps: {
      en: [
        "Go to account.microsoft.com and sign in.",
        'Click "Services & subscriptions".',
        'Find Microsoft 365 and click "Manage".',
        'Select "Cancel" and follow the prompts.',
      ],
      de: [
        "Gehe zu account.microsoft.com und melde dich an.",
        'Klicke auf "Services & subscriptions".',
        'Suche Microsoft 365 und klicke auf "Manage".',
        'Wähle "Cancel" und folge den Anweisungen.',
      ],
    },
    url: "https://account.microsoft.com/services/",
  },
  microsoft: {
    steps: {
      en: [
        "Go to account.microsoft.com and sign in.",
        'Click "Services & subscriptions".',
        'Find your subscription and click "Manage" → "Cancel".',
      ],
      de: [
        "Gehe zu account.microsoft.com und melde dich an.",
        'Klicke auf "Services & subscriptions".',
        'Suche dein Abonnement und klicke auf "Manage" → "Cancel".',
      ],
    },
    url: "https://account.microsoft.com/services/",
  },
  adobe: {
    steps: {
      en: [
        "Go to account.adobe.com and sign in.",
        'Click "Plans" → "Manage plan".',
        'Click "Cancel plan" and follow the prompts.',
        "Note: cancelling mid-term may incur an early termination fee (50% of remaining balance).",
      ],
      de: [
        "Gehe zu account.adobe.com und melde dich an.",
        'Klicke auf "Plans" → "Manage plan".',
        'Klicke auf "Cancel plan" und folge den Anweisungen.',
        "Hinweis: Eine vorzeitige Kündigung kann eine Gebühr von 50 % des Restbetrags zur Folge haben.",
      ],
    },
    url: "https://account.adobe.com/plans",
    note: {
      en: "Annual plans cancelled before the year ends incur a 50% early termination fee. Monthly plans can be cancelled any time.",
      de: "Wer einen Jahresplan vorzeitig kündigt, zahlt eine Gebühr von 50 % des Restbetrags. Monatspläne kannst du jederzeit kündigen.",
    },
  },
  dropbox: {
    steps: {
      en: [
        "Go to dropbox.com and sign in.",
        'Click your avatar → "Settings" → "Plan".',
        'Click "Cancel plan" at the bottom.',
      ],
      de: [
        "Gehe zu dropbox.com und melde dich an.",
        'Klicke auf dein Profilbild → "Settings" → "Plan".',
        'Klicke unten auf "Cancel plan".',
      ],
    },
    url: "https://www.dropbox.com/account/plan",
  },
  "google one": {
    steps: {
      en: [
        "Open the Google One app or go to one.google.com.",
        'Tap "Settings" → "Manage subscription".',
        'Tap "Cancel subscription" and confirm.',
      ],
      de: [
        "Öffne die Google One App oder gehe zu one.google.com.",
        'Tippe auf "Settings" → "Manage subscription".',
        'Tippe auf "Cancel subscription" und bestätige.',
      ],
    },
    url: "https://one.google.com/storage",
  },
  paramount: {
    steps: {
      en: [
        "Go to paramountplus.com and sign in.",
        'Click your profile → "Account" → "Cancel Subscription".',
      ],
      de: [
        "Gehe zu paramountplus.com und melde dich an.",
        'Klicke auf dein Profil → "Account" → "Cancel Subscription".',
      ],
    },
    url: "https://www.paramountplus.com/account/",
  },
  peacock: {
    steps: {
      en: [
        "Go to peacocktv.com and sign in.",
        'Click your profile icon → "Account" → "Manage Plan".',
        'Select "Cancel Plan" and confirm.',
      ],
      de: [
        "Gehe zu peacocktv.com und melde dich an.",
        'Klicke auf dein Profilsymbol → "Account" → "Manage Plan".',
        'Wähle "Cancel Plan" und bestätige.',
      ],
    },
    url: "https://www.peacocktv.com/account",
  },
  duolingo: {
    steps: {
      en: [
        "Open Duolingo and tap your profile icon.",
        'Go to "Super Duolingo" or "Duolingo Max" settings.',
        'Tap "Manage subscription". This redirects to your App Store or Google Play subscription settings.',
        "Cancel from there.",
      ],
      de: [
        "Öffne Duolingo und tippe auf dein Profilsymbol.",
        'Gehe zu den Einstellungen von "Super Duolingo" oder "Duolingo Max".',
        'Tippe auf "Manage subscription". Du wirst zu den Abo Einstellungen im App Store oder bei Google Play weitergeleitet.',
        "Kündige dort dein Abonnement.",
      ],
    },
    url: "https://support.duolingo.com/hc/en-us/articles/360002659012",
  },
  headspace: {
    steps: {
      en: [
        "Go to headspace.com and log in.",
        'Go to "Account" → "Subscription".',
        'Click "Cancel subscription" and follow the steps.',
      ],
      de: [
        "Gehe zu headspace.com und melde dich an.",
        'Gehe zu "Account" → "Subscription".',
        'Klicke auf "Cancel subscription" und folge den Schritten.',
      ],
    },
    url: "https://www.headspace.com/account",
  },
  calm: {
    steps: {
      en: [
        "Go to calm.com and log in.",
        'Click your email address (top right) → "Settings".',
        'Under "Subscription", click "Manage Subscription".',
        "Follow the cancellation steps.",
      ],
      de: [
        "Gehe zu calm.com und melde dich an.",
        'Klicke oben rechts auf deine E-Mail-Adresse → "Settings".',
        'Klicke unter "Subscription" auf "Manage Subscription".',
        "Folge den Kündigungsschritten.",
      ],
    },
    url: "https://app.calm.com/settings",
  },
  xbox: {
    steps: {
      en: [
        "Go to microsoft.com/en-us/store/b/account and sign in.",
        'Click "Services & subscriptions".',
        'Find Xbox Game Pass and click "Manage" → "Cancel".',
      ],
      de: [
        "Gehe zu microsoft.com/en-us/store/b/account und melde dich an.",
        'Klicke auf "Services & subscriptions".',
        'Suche Xbox Game Pass und klicke auf "Manage" → "Cancel".',
      ],
    },
    url: "https://account.microsoft.com/services/",
  },
  playstation: {
    steps: {
      en: [
        "Go to playstation.com and sign in.",
        'Click your profile → "Subscription".',
        'Find PlayStation Plus and click "Cancel Automatic Renewal".',
      ],
      de: [
        "Gehe zu playstation.com und melde dich an.",
        'Klicke auf dein Profil → "Subscription".',
        'Suche PlayStation Plus und klicke auf "Cancel Automatic Renewal".',
      ],
    },
    url: "https://store.playstation.com/",
  },
  nintendo: {
    steps: {
      en: [
        "Go to accounts.nintendo.com and sign in.",
        'Click "Shop Menu" → "Nintendo Switch Online".',
        'Select "Cancel automatic renewal".',
      ],
      de: [
        "Gehe zu accounts.nintendo.com und melde dich an.",
        'Klicke auf "Shop Menu" → "Nintendo Switch Online".',
        'Wähle "Cancel automatic renewal".',
      ],
    },
    url: "https://accounts.nintendo.com/",
  },
  nordvpn: {
    steps: {
      en: [
        "Go to nordvpn.com and log in to My Nord Account.",
        'Navigate to "Billing" → "Subscriptions".',
        'Click "Cancel subscription".',
      ],
      de: [
        "Gehe zu nordvpn.com und melde dich in deinem My Nord Account an.",
        'Gehe zu "Billing" → "Subscriptions".',
        'Klicke auf "Cancel subscription".',
      ],
    },
    url: "https://my.nordaccount.com/dashboard/nordvpn/",
  },
  expressvpn: {
    steps: {
      en: [
        "Go to expressvpn.com and log in.",
        'Go to "My Account" → "Subscriptions".',
        'Click "Cancel Subscription".',
      ],
      de: [
        "Gehe zu expressvpn.com und melde dich an.",
        'Gehe zu "My Account" → "Subscriptions".',
        'Klicke auf "Cancel Subscription".',
      ],
    },
    url: "https://www.expressvpn.com/subscriptions",
  },
  notion: {
    steps: {
      en: [
        "Open Notion and go to Settings (sidebar).",
        'Click "Plans" → "Downgrade" to switch to Free.',
      ],
      de: [
        "Öffne Notion und gehe in der Seitenleiste zu Settings.",
        'Klicke auf "Plans" → "Downgrade", um zur kostenlosen Version zu wechseln.',
      ],
    },
    url: "https://www.notion.so/my-account",
  },
  canva: {
    steps: {
      en: [
        "Go to canva.com and log in.",
        'Click your profile → "Account settings" → "Billing & plans".',
        'Click "Cancel plan".',
      ],
      de: [
        "Gehe zu canva.com und melde dich an.",
        'Klicke auf dein Profil → "Account settings" → "Billing & plans".',
        'Klicke auf "Cancel plan".',
      ],
    },
    url: "https://www.canva.com/settings/",
  },
  grammarly: {
    steps: {
      en: [
        "Go to grammarly.com/account and log in.",
        'Navigate to the "Subscription" tab.',
        'Click "Cancel subscription".',
      ],
      de: [
        "Gehe zu grammarly.com/account und melde dich an.",
        'Gehe zum Tab "Subscription".',
        'Klicke auf "Cancel subscription".',
      ],
    },
    url: "https://www.grammarly.com/account/subscription",
  },
  "1password": {
    steps: {
      en: [
        "Go to my.1password.com and sign in.",
        'Click "Billing" in the sidebar.',
        'Click "Cancel subscription" at the bottom.',
      ],
      de: [
        "Gehe zu my.1password.com und melde dich an.",
        'Klicke in der Seitenleiste auf "Billing".',
        'Klicke unten auf "Cancel subscription".',
      ],
    },
    url: "https://my.1password.com/billing",
  },
  lastpass: {
    steps: {
      en: [
        "Log in to your LastPass vault at lastpass.com.",
        'Go to "Account Settings" → "Subscription".',
        'Select "Cancel Premium".',
      ],
      de: [
        "Melde dich in deinem LastPass Vault auf lastpass.com an.",
        'Gehe zu "Account Settings" → "Subscription".',
        'Wähle "Cancel Premium".',
      ],
    },
    url: "https://lastpass.com/",
  },
  slack: {
    steps: {
      en: [
        "In your Slack workspace, go to your workspace name (top left).",
        'Click "Settings & administration" → "Billing".',
        'Click "Downgrade" to move to the free plan.',
      ],
      de: [
        "Gehe in deinem Slack Workspace oben links auf den Workspace Namen.",
        'Klicke auf "Settings & administration" → "Billing".',
        'Klicke auf "Downgrade", um zum kostenlosen Plan zu wechseln.',
      ],
    },
    url: "https://slack.com/intl/en-gb/help/articles/204756460",
  },
  zoom: {
    steps: {
      en: [
        "Go to zoom.us and sign in.",
        'Click "Account Management" → "Billing".',
        'Under your current plan, click "Cancel Subscription".',
      ],
      de: [
        "Gehe zu zoom.us und melde dich an.",
        'Klicke auf "Account Management" → "Billing".',
        'Klicke bei deinem aktuellen Plan auf "Cancel Subscription".',
      ],
    },
    url: "https://zoom.us/billing",
  },
  skillshare: {
    steps: {
      en: [
        "Go to skillshare.com and log in.",
        'Click your profile icon → "Account" → "Membership".',
        'Click "Cancel Membership".',
      ],
      de: [
        "Gehe zu skillshare.com und melde dich an.",
        'Klicke auf dein Profilsymbol → "Account" → "Membership".',
        'Klicke auf "Cancel Membership".',
      ],
    },
    url: "https://www.skillshare.com/settings/membership",
  },
  masterclass: {
    steps: {
      en: [
        "Go to masterclass.com and log in.",
        'Click your name → "Settings" → "Membership".',
        'Click "Cancel Membership".',
      ],
      de: [
        "Gehe zu masterclass.com und melde dich an.",
        'Klicke auf deinen Namen → "Settings" → "Membership".',
        'Klicke auf "Cancel Membership".',
      ],
    },
    url: "https://www.masterclass.com/account",
  },
  crunchyroll: {
    steps: {
      en: [
        "Go to crunchyroll.com and log in.",
        'Click your profile icon → "Premium".',
        'Click "Manage Premium" → "Cancel Membership".',
      ],
      de: [
        "Gehe zu crunchyroll.com und melde dich an.",
        'Klicke auf dein Profilsymbol → "Premium".',
        'Klicke auf "Manage Premium" → "Cancel Membership".',
      ],
    },
    url: "https://www.crunchyroll.com/account",
  },
};

const GENERIC_GUIDE: LocalizedGuide = {
  steps: {
    en: [
      "Open the service's official website and log in to your account.",
      'Look for "Settings", "Account", "Billing", or "Subscription" in your profile menu.',
      'Find an option like "Cancel subscription", "Downgrade", or "End membership".',
      "If you subscribed via Google Play or App Store, cancel directly there instead. The service's own site won't work for those.",
      "Take a screenshot of the cancellation confirmation for your records.",
    ],
    de: [
      "Öffne die offizielle Website des Anbieters und melde dich in deinem Konto an.",
      'Suche in deinem Profilmenü nach "Settings", "Account", "Billing" oder "Subscription".',
      'Suche nach einer Option wie "Cancel subscription", "Downgrade" oder "End membership".',
      "Wenn du über Google Play oder den App Store abonniert hast, kündige stattdessen direkt dort. Die Website des Anbieters funktioniert dafür nicht.",
      "Mache einen Screenshot der Kündigungsbestätigung für deine Unterlagen.",
    ],
  },
  url: "",
  note: {
    en: "If subscribed via Apple: Settings → your name → Subscriptions. If via Google Play: Play Store app → your profile → Payments & subscriptions.",
    de: "Bei Apple: Einstellungen → dein Name → Subscriptions. Bei Google Play: Play Store App → dein Profil → Payments & subscriptions.",
  },
};

/* The single matching rule, so the lookup and the "did we have one" question
   cannot drift apart. Both functions below delegate here rather than repeating
   the loop: two copies of a match rule is how one of them quietly stops
   agreeing with the other. */
function matchGuideKey(name: string): string | null {
  const n = name.toLowerCase().trim();
  for (const key of Object.keys(GUIDES)) {
    if (n.includes(key)) return key;
  }
  return null;
}

/* Whether a SPECIFIC guide exists for this service, as opposed to the generic
   fallback. getCancellationGuide always returns something, so from the outside
   a real guide and the generic one are indistinguishable, and the screen needs
   to tell them apart to report which it showed. */
export function hasCancellationGuide(name: string): boolean {
  return matchGuideKey(name) !== null;
}

export function getCancellationGuide(name: string, lang: Lang = "en"): CancellationGuide {
  const key = matchGuideKey(name);
  if (key) {
    const guide = GUIDES[key];
    return { steps: guide.steps[lang], url: urlFor(guide, lang), note: guide.note?.[lang] };
  }
  return { steps: GENERIC_GUIDE.steps[lang], url: urlFor(GENERIC_GUIDE, lang), note: GENERIC_GUIDE.note?.[lang] };
}

/* The raw bilingual entry for one key, for tools/build-guides.mjs, which
   turns the verified guides into public web pages. One source for the app
   and the site, so a correction reaches both. */
export function getLocalizedGuide(key: string): LocalizedGuide | null {
  return Object.prototype.hasOwnProperty.call(GUIDES, key) ? GUIDES[key] : null;
}
