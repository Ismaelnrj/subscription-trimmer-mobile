export interface ServiceTemplate {
  id: string;
  name: string;
  defaultPrice: number;
  currency: "EUR" | "USD" | "CHF" | "GBP";
  billingCycle: "monthly" | "yearly" | "weekly";
  category: string;
  region: "GLOBAL" | "DE" | "AT" | "CH" | "DACH" | "US";
  popular?: boolean;
  domain?: string;
  /* The date this row's price was last checked against the provider.
     Absent means never checked since the catalogue was written, which is
     the case for most of it. The market price insight only speaks for rows
     carrying a recent date, so a stale default cannot tell somebody they
     are overpaying on the strength of a figure nobody has looked at. */
  verified?: string;
}

export const SERVICE_TEMPLATES: ServiceTemplate[] = [
  // ─── STREAMING (Global / USD) ───────────────────────────────────────────────
  { id: "netflix-standard", name: "Netflix Standard", defaultPrice: 15.49, currency: "USD", billingCycle: "monthly", category: "streaming", region: "GLOBAL", domain: "netflix.com", popular: true },
  { id: "netflix-premium", name: "Netflix Premium", defaultPrice: 22.99, currency: "USD", billingCycle: "monthly", category: "streaming", region: "GLOBAL" },
  { id: "netflix-basic", name: "Netflix Basic", defaultPrice: 6.99, currency: "USD", billingCycle: "monthly", category: "streaming", region: "GLOBAL" },
  { id: "disney-plus", name: "Disney+", defaultPrice: 13.99, currency: "USD", billingCycle: "monthly", category: "streaming", region: "GLOBAL", domain: "disneyplus.com", popular: true },
  { id: "hulu-ads", name: "Hulu (With Ads)", defaultPrice: 7.99, currency: "USD", billingCycle: "monthly", category: "streaming", region: "US" },
  { id: "hulu-no-ads", name: "Hulu (No Ads)", defaultPrice: 17.99, currency: "USD", billingCycle: "monthly", category: "streaming", region: "US" },
  { id: "hbo-max", name: "HBO Max", defaultPrice: 15.99, currency: "USD", billingCycle: "monthly", category: "streaming", region: "US" },
  { id: "amazon-prime", name: "Amazon Prime", defaultPrice: 14.99, currency: "USD", billingCycle: "monthly", category: "streaming", region: "GLOBAL", domain: "amazon.com", popular: true },
  { id: "apple-tv-plus", name: "Apple TV+", defaultPrice: 9.99, currency: "USD", billingCycle: "monthly", category: "streaming", region: "GLOBAL" },
  { id: "peacock-premium", name: "Peacock Premium", defaultPrice: 5.99, currency: "USD", billingCycle: "monthly", category: "streaming", region: "US" },
  { id: "paramount-plus", name: "Paramount+", defaultPrice: 5.99, currency: "USD", billingCycle: "monthly", category: "streaming", region: "US" },
  { id: "youtube-tv", name: "YouTube TV", defaultPrice: 72.99, currency: "USD", billingCycle: "monthly", category: "streaming", region: "US" },
  { id: "crunchyroll", name: "Crunchyroll", defaultPrice: 7.99, currency: "USD", billingCycle: "monthly", category: "streaming", region: "GLOBAL" },
  { id: "mubi", name: "MUBI", defaultPrice: 10.99, currency: "USD", billingCycle: "monthly", category: "streaming", region: "GLOBAL" },
  { id: "shudder", name: "Shudder", defaultPrice: 5.99, currency: "USD", billingCycle: "monthly", category: "streaming", region: "US" },

  // ─── ENTERTAINMENT / MUSIC (Global / USD) ───────────────────────────────────
  { id: "spotify", name: "Spotify Premium", defaultPrice: 10.99, currency: "USD", billingCycle: "monthly", category: "entertainment", region: "GLOBAL", domain: "spotify.com", popular: true },
  { id: "apple-music", name: "Apple Music", defaultPrice: 10.99, currency: "USD", billingCycle: "monthly", category: "entertainment", region: "GLOBAL" },
  { id: "youtube-premium", name: "YouTube Premium", defaultPrice: 13.99, currency: "USD", billingCycle: "monthly", category: "entertainment", region: "GLOBAL" },
  { id: "amazon-music", name: "Amazon Music Unlimited", defaultPrice: 10.99, currency: "USD", billingCycle: "monthly", category: "entertainment", region: "GLOBAL" },
  { id: "tidal", name: "Tidal", defaultPrice: 10.99, currency: "USD", billingCycle: "monthly", category: "entertainment", region: "GLOBAL" },
  { id: "audible", name: "Audible", defaultPrice: 7.95, currency: "USD", billingCycle: "monthly", category: "entertainment", region: "GLOBAL" },
  { id: "kindle-unlimited", name: "Kindle Unlimited", defaultPrice: 11.99, currency: "USD", billingCycle: "monthly", category: "entertainment", region: "GLOBAL" },
  { id: "xbox-game-pass", name: "Xbox Game Pass Ultimate", defaultPrice: 22.99, currency: "USD", billingCycle: "monthly", category: "entertainment", region: "GLOBAL", domain: "xbox.com", popular: true, verified: "2026-09-05"},
  { id: "ps-plus-essential", name: "PlayStation Plus Essential", defaultPrice: 9.99, currency: "USD", billingCycle: "monthly", category: "entertainment", region: "GLOBAL" },
  { id: "ps-plus-extra", name: "PlayStation Plus Extra", defaultPrice: 14.99, currency: "USD", billingCycle: "monthly", category: "entertainment", region: "GLOBAL" },
  { id: "ps-plus-premium", name: "PlayStation Plus Premium", defaultPrice: 17.99, currency: "USD", billingCycle: "monthly", category: "entertainment", region: "GLOBAL" },
  { id: "nintendo-switch-online", name: "Nintendo Switch Online", defaultPrice: 3.99, currency: "USD", billingCycle: "monthly", category: "entertainment", region: "GLOBAL" },
  { id: "ea-play", name: "EA Play", defaultPrice: 4.99, currency: "USD", billingCycle: "monthly", category: "entertainment", region: "GLOBAL" },
  { id: "apple-arcade", name: "Apple Arcade", defaultPrice: 6.99, currency: "USD", billingCycle: "monthly", category: "entertainment", region: "GLOBAL" },
  { id: "scribd", name: "Scribd", defaultPrice: 9.99, currency: "USD", billingCycle: "monthly", category: "entertainment", region: "GLOBAL" },
  { id: "blinkist", name: "Blinkist", defaultPrice: 12.99, currency: "USD", billingCycle: "monthly", category: "entertainment", region: "GLOBAL" },
  { id: "readwise", name: "Readwise", defaultPrice: 7.99, currency: "USD", billingCycle: "monthly", category: "entertainment", region: "GLOBAL" },

  // ─── SOFTWARE (Global / USD) ─────────────────────────────────────────────────
  { id: "adobe-cc", name: "Adobe Creative Cloud", defaultPrice: 54.99, currency: "USD", billingCycle: "monthly", category: "software", region: "GLOBAL", domain: "adobe.com", popular: true },
  { id: "ms365-personal", name: "Microsoft 365 Personal", defaultPrice: 6.99, currency: "USD", billingCycle: "monthly", category: "software", region: "GLOBAL", domain: "microsoft.com", popular: true },
  { id: "ms365-family", name: "Microsoft 365 Family", defaultPrice: 9.99, currency: "USD", billingCycle: "monthly", category: "software", region: "GLOBAL" },
  { id: "icloud-50gb", name: "iCloud+ 50GB", defaultPrice: 0.99, currency: "USD", billingCycle: "monthly", category: "software", region: "GLOBAL", domain: "icloud.com", popular: true },
  { id: "icloud-200gb", name: "iCloud+ 200GB", defaultPrice: 2.99, currency: "USD", billingCycle: "monthly", category: "software", region: "GLOBAL" },
  { id: "icloud-2tb", name: "iCloud+ 2TB", defaultPrice: 9.99, currency: "USD", billingCycle: "monthly", category: "software", region: "GLOBAL" },
  { id: "google-one-100", name: "Google One 100GB", defaultPrice: 1.99, currency: "USD", billingCycle: "monthly", category: "software", region: "GLOBAL" },
  { id: "google-one-200", name: "Google One 200GB", defaultPrice: 2.99, currency: "USD", billingCycle: "monthly", category: "software", region: "GLOBAL" },
  { id: "google-one-2tb", name: "Google One 2TB", defaultPrice: 9.99, currency: "USD", billingCycle: "monthly", category: "software", region: "GLOBAL" },
  { id: "dropbox-plus", name: "Dropbox Plus", defaultPrice: 11.99, currency: "USD", billingCycle: "monthly", category: "software", region: "GLOBAL" },
  { id: "1password", name: "1Password", defaultPrice: 2.99, currency: "USD", billingCycle: "monthly", category: "software", region: "GLOBAL" },
  { id: "1password-families", name: "1Password Families", defaultPrice: 4.99, currency: "USD", billingCycle: "monthly", category: "software", region: "GLOBAL" },
  { id: "notion-pro", name: "Notion Pro", defaultPrice: 10.00, currency: "USD", billingCycle: "monthly", category: "software", region: "GLOBAL" },
  { id: "figma-pro", name: "Figma", defaultPrice: 12.00, currency: "USD", billingCycle: "monthly", category: "software", region: "GLOBAL" },
  { id: "canva-pro", name: "Canva Pro", defaultPrice: 12.99, currency: "USD", billingCycle: "monthly", category: "software", region: "GLOBAL" },
  { id: "github-pro", name: "GitHub Pro", defaultPrice: 4.00, currency: "USD", billingCycle: "monthly", category: "software", region: "GLOBAL" },
  { id: "grammarly-premium", name: "Grammarly Premium", defaultPrice: 12.00, currency: "USD", billingCycle: "monthly", category: "software", region: "GLOBAL" },
  { id: "nordvpn", name: "NordVPN", defaultPrice: 4.99, currency: "USD", billingCycle: "monthly", category: "software", region: "GLOBAL" },
  { id: "expressvpn", name: "ExpressVPN", defaultPrice: 9.99, currency: "USD", billingCycle: "monthly", category: "software", region: "GLOBAL" },
  { id: "surfshark", name: "Surfshark", defaultPrice: 3.99, currency: "USD", billingCycle: "monthly", category: "software", region: "GLOBAL" },
  { id: "lastpass", name: "LastPass", defaultPrice: 3.00, currency: "USD", billingCycle: "monthly", category: "software", region: "GLOBAL" },
  { id: "dashlane", name: "Dashlane", defaultPrice: 4.99, currency: "USD", billingCycle: "monthly", category: "software", region: "GLOBAL" },
  { id: "backblaze", name: "Backblaze", defaultPrice: 9.00, currency: "USD", billingCycle: "monthly", category: "software", region: "GLOBAL" },
  { id: "onedrive-100", name: "OneDrive 100GB", defaultPrice: 1.99, currency: "USD", billingCycle: "monthly", category: "software", region: "GLOBAL" },
  { id: "slack-pro", name: "Slack Pro", defaultPrice: 7.25, currency: "USD", billingCycle: "monthly", category: "software", region: "GLOBAL" },
  { id: "zoom-pro", name: "Zoom Pro", defaultPrice: 13.32, currency: "USD", billingCycle: "monthly", category: "software", region: "GLOBAL" },

  // ─── FITNESS / HEALTH (Global / USD) ─────────────────────────────────────────
  { id: "headspace", name: "Headspace", defaultPrice: 12.99, currency: "USD", billingCycle: "monthly", category: "fitness", region: "GLOBAL" },
  { id: "calm", name: "Calm", defaultPrice: 14.99, currency: "USD", billingCycle: "monthly", category: "fitness", region: "GLOBAL" },
  { id: "peloton-app", name: "Peloton App", defaultPrice: 12.99, currency: "USD", billingCycle: "monthly", category: "fitness", region: "GLOBAL" },
  { id: "myfitnesspal", name: "MyFitnessPal Premium", defaultPrice: 9.99, currency: "USD", billingCycle: "monthly", category: "fitness", region: "GLOBAL" },
  { id: "strava", name: "Strava Premium", defaultPrice: 7.99, currency: "USD", billingCycle: "monthly", category: "fitness", region: "GLOBAL" },
  { id: "whoop", name: "Whoop", defaultPrice: 30.00, currency: "USD", billingCycle: "monthly", category: "fitness", region: "GLOBAL" },
  { id: "noom", name: "Noom", defaultPrice: 59.00, currency: "USD", billingCycle: "monthly", category: "health", region: "GLOBAL" },

  // ─── EDUCATION (Global / USD) ─────────────────────────────────────────────────
  { id: "duolingo-plus", name: "Duolingo Plus", defaultPrice: 6.99, currency: "USD", billingCycle: "monthly", category: "education", region: "GLOBAL" },
  { id: "masterclass", name: "MasterClass", defaultPrice: 10.00, currency: "USD", billingCycle: "monthly", category: "education", region: "GLOBAL" },
  { id: "skillshare", name: "Skillshare", defaultPrice: 13.99, currency: "USD", billingCycle: "monthly", category: "education", region: "GLOBAL" },
  { id: "coursera-plus", name: "Coursera Plus", defaultPrice: 59.00, currency: "USD", billingCycle: "monthly", category: "education", region: "GLOBAL" },
  { id: "brilliant", name: "Brilliant", defaultPrice: 24.99, currency: "USD", billingCycle: "monthly", category: "education", region: "GLOBAL" },
  { id: "rosetta-stone", name: "Rosetta Stone", defaultPrice: 14.99, currency: "USD", billingCycle: "monthly", category: "education", region: "GLOBAL" },
  { id: "codecademy-pro", name: "Codecademy Pro", defaultPrice: 17.99, currency: "USD", billingCycle: "monthly", category: "education", region: "GLOBAL" },

  // ─── FOOD (Global / USD) ──────────────────────────────────────────────────────
  { id: "hellofresh", name: "HelloFresh", defaultPrice: 9.99, currency: "USD", billingCycle: "monthly", category: "food", region: "GLOBAL" },

  // ─── MEMBERSHIPS (Global / USD) ───────────────────────────────────────────────
  { id: "linkedin-premium", name: "LinkedIn Premium Career", defaultPrice: 39.99, currency: "USD", billingCycle: "monthly", category: "memberships", region: "GLOBAL" },
  { id: "amazon-prime-membership", name: "Amazon Prime Membership", defaultPrice: 14.99, currency: "USD", billingCycle: "monthly", category: "memberships", region: "GLOBAL" },
  { id: "costco", name: "Costco Gold Star", defaultPrice: 65.00, currency: "USD", billingCycle: "yearly", category: "memberships", region: "US" },

  // ─── STREAMING (DACH / EUR) ───────────────────────────────────────────────────
  { id: "netflix-de-standard", name: "Netflix Standard", defaultPrice: 15.99, currency: "EUR", billingCycle: "monthly", category: "streaming", region: "DACH", domain: "netflix.com", popular: true, verified: "2026-09-05"},
  { id: "netflix-de-premium", name: "Netflix Premium", defaultPrice: 22.99, currency: "EUR", billingCycle: "monthly", category: "streaming", region: "DACH" },
  { id: "netflix-de-basis", name: "Netflix Basis m. Werbung", defaultPrice: 6.99, currency: "EUR", billingCycle: "monthly", category: "streaming", region: "DACH", verified: "2026-09-05"},
  { id: "disney-plus-de", name: "Disney+", defaultPrice: 10.99, currency: "EUR", billingCycle: "monthly", category: "streaming", region: "DACH", domain: "disneyplus.com", popular: true, verified: "2026-09-05"},
  { id: "apple-tv-plus-de", name: "Apple TV+", defaultPrice: 9.99, currency: "EUR", billingCycle: "monthly", category: "streaming", region: "DACH" },
  { id: "amazon-prime-de", name: "Amazon Prime", defaultPrice: 8.99, currency: "EUR", billingCycle: "monthly", category: "streaming", region: "DACH", domain: "amazon.com", popular: true, verified: "2026-09-05"},
  { id: "paramount-plus-de", name: "Paramount+", defaultPrice: 7.99, currency: "EUR", billingCycle: "monthly", category: "streaming", region: "DACH" },
  { id: "discovery-plus-de", name: "discovery+", defaultPrice: 4.99, currency: "EUR", billingCycle: "monthly", category: "streaming", region: "DACH" },
  { id: "dazn-de", name: "DAZN", defaultPrice: 29.99, currency: "EUR", billingCycle: "monthly", category: "streaming", region: "DE", domain: "dazn.com", popular: true },
  { id: "dazn-de-unlimited", name: "DAZN Unlimited", defaultPrice: 44.99, currency: "EUR", billingCycle: "monthly", category: "streaming", region: "DE" },
  { id: "rtl-plus-basic", name: "RTL+ Basic", defaultPrice: 4.99, currency: "EUR", billingCycle: "monthly", category: "streaming", region: "DE", domain: "rtlplus.de", popular: true },
  { id: "rtl-plus-premium", name: "RTL+ Premium", defaultPrice: 7.99, currency: "EUR", billingCycle: "monthly", category: "streaming", region: "DE" },
  { id: "magenta-tv-s", name: "MagentaTV S", defaultPrice: 10.00, currency: "EUR", billingCycle: "monthly", category: "streaming", region: "DE" },
  { id: "magenta-tv-m", name: "MagentaTV M", defaultPrice: 16.00, currency: "EUR", billingCycle: "monthly", category: "streaming", region: "DE" },
  { id: "magenta-tv-l", name: "MagentaTV L", defaultPrice: 26.00, currency: "EUR", billingCycle: "monthly", category: "streaming", region: "DE" },
  { id: "joyn-plus", name: "Joyn+", defaultPrice: 6.99, currency: "EUR", billingCycle: "monthly", category: "streaming", region: "DE" },
  { id: "sky-de-sport", name: "Sky Sport", defaultPrice: 25.00, currency: "EUR", billingCycle: "monthly", category: "streaming", region: "DE" },
  { id: "sky-de-cinema", name: "Sky Cinema", defaultPrice: 25.00, currency: "EUR", billingCycle: "monthly", category: "streaming", region: "DE" },
  { id: "wow-sport", name: "WOW Sport", defaultPrice: 14.99, currency: "EUR", billingCycle: "monthly", category: "streaming", region: "DE", domain: "wow.de", popular: true },
  { id: "wow-cinema", name: "WOW Cinema", defaultPrice: 7.99, currency: "EUR", billingCycle: "monthly", category: "streaming", region: "DE" },
  { id: "wow-live-tv", name: "WOW Live-TV", defaultPrice: 16.99, currency: "EUR", billingCycle: "monthly", category: "streaming", region: "DE" },
  { id: "crunchyroll-de", name: "Crunchyroll", defaultPrice: 7.99, currency: "EUR", billingCycle: "monthly", category: "streaming", region: "DACH" },

  // ─── ENTERTAINMENT / MUSIC (DACH / EUR) ───────────────────────────────────────
  { id: "spotify-de", name: "Spotify Premium", defaultPrice: 12.99, currency: "EUR", billingCycle: "monthly", category: "entertainment", region: "DACH", domain: "spotify.com", popular: true, verified: "2026-09-05"},
  { id: "apple-music-de", name: "Apple Music", defaultPrice: 10.99, currency: "EUR", billingCycle: "monthly", category: "entertainment", region: "DACH" },
  { id: "deezer-de-premium", name: "Deezer Premium", defaultPrice: 10.99, currency: "EUR", billingCycle: "monthly", category: "entertainment", region: "DACH" },
  { id: "deezer-de-hifi", name: "Deezer HiFi", defaultPrice: 14.99, currency: "EUR", billingCycle: "monthly", category: "entertainment", region: "DACH" },
  { id: "audible-de", name: "Audible", defaultPrice: 9.95, currency: "EUR", billingCycle: "monthly", category: "entertainment", region: "DACH" },
  { id: "tidal-de", name: "Tidal", defaultPrice: 10.99, currency: "EUR", billingCycle: "monthly", category: "entertainment", region: "DACH" },
  { id: "xbox-game-pass-de", name: "Xbox Game Pass Ultimate", defaultPrice: 14.99, currency: "EUR", billingCycle: "monthly", category: "entertainment", region: "DACH", domain: "xbox.com", popular: true },
  { id: "ps-plus-essential-de", name: "PlayStation Plus Essential", defaultPrice: 8.99, currency: "EUR", billingCycle: "monthly", category: "entertainment", region: "DACH" },
  { id: "ps-plus-extra-de", name: "PlayStation Plus Extra", defaultPrice: 13.99, currency: "EUR", billingCycle: "monthly", category: "entertainment", region: "DACH" },
  { id: "ps-plus-premium-de", name: "PlayStation Plus Premium", defaultPrice: 16.99, currency: "EUR", billingCycle: "monthly", category: "entertainment", region: "DACH" },
  { id: "nintendo-switch-online-de", name: "Nintendo Switch Online", defaultPrice: 3.99, currency: "EUR", billingCycle: "monthly", category: "entertainment", region: "DACH" },
  { id: "nintendo-switch-family-de", name: "Nintendo Switch Online Family", defaultPrice: 34.99, currency: "EUR", billingCycle: "yearly", category: "entertainment", region: "DACH" },
  { id: "kindle-unlimited-de", name: "Kindle Unlimited", defaultPrice: 9.99, currency: "EUR", billingCycle: "monthly", category: "entertainment", region: "DACH" },
  { id: "readly-de", name: "Readly", defaultPrice: 11.99, currency: "EUR", billingCycle: "monthly", category: "entertainment", region: "DACH" },
  { id: "spiegel-plus", name: "Spiegel+", defaultPrice: 22.99, currency: "EUR", billingCycle: "monthly", category: "entertainment", region: "DE" },
  { id: "spiegel-plus-yearly", name: "Spiegel+ Jahresabo", defaultPrice: 199.99, currency: "EUR", billingCycle: "yearly", category: "entertainment", region: "DE" },
  { id: "zeit-plus", name: "ZEIT+ Digital", defaultPrice: 21.99, currency: "EUR", billingCycle: "monthly", category: "entertainment", region: "DE" },
  { id: "bild-plus", name: "Bild+", defaultPrice: 7.99, currency: "EUR", billingCycle: "monthly", category: "entertainment", region: "DE" },
  { id: "youtube-premium-de", name: "YouTube Premium", defaultPrice: 11.99, currency: "EUR", billingCycle: "monthly", category: "entertainment", region: "DACH" },

  // ─── SOFTWARE (DACH / EUR) ────────────────────────────────────────────────────
  { id: "adobe-cc-de", name: "Adobe Creative Cloud", defaultPrice: 54.99, currency: "EUR", billingCycle: "monthly", category: "software", region: "DACH" },
  { id: "adobe-photo-de", name: "Adobe Foto-Abo", defaultPrice: 12.19, currency: "EUR", billingCycle: "monthly", category: "software", region: "DACH" },
  { id: "ms365-personal-de", name: "Microsoft 365 Personal", defaultPrice: 7.00, currency: "EUR", billingCycle: "monthly", category: "software", region: "DACH", domain: "microsoft.com", popular: true },
  { id: "ms365-family-de", name: "Microsoft 365 Family", defaultPrice: 10.00, currency: "EUR", billingCycle: "monthly", category: "software", region: "DACH" },
  { id: "icloud-50gb-de", name: "iCloud+ 50GB", defaultPrice: 0.99, currency: "EUR", billingCycle: "monthly", category: "software", region: "DACH", domain: "icloud.com", popular: true },
  { id: "icloud-200gb-de", name: "iCloud+ 200GB", defaultPrice: 2.99, currency: "EUR", billingCycle: "monthly", category: "software", region: "DACH" },
  { id: "icloud-2tb-de", name: "iCloud+ 2TB", defaultPrice: 9.99, currency: "EUR", billingCycle: "monthly", category: "software", region: "DACH" },
  { id: "google-one-100-de", name: "Google One 100GB", defaultPrice: 1.99, currency: "EUR", billingCycle: "monthly", category: "software", region: "DACH" },
  { id: "google-one-200-de", name: "Google One 200GB", defaultPrice: 2.99, currency: "EUR", billingCycle: "monthly", category: "software", region: "DACH" },
  { id: "google-one-2tb-de", name: "Google One 2TB", defaultPrice: 9.99, currency: "EUR", billingCycle: "monthly", category: "software", region: "DACH" },
  { id: "dropbox-plus-de", name: "Dropbox Plus", defaultPrice: 11.99, currency: "EUR", billingCycle: "monthly", category: "software", region: "DACH" },
  { id: "1password-de", name: "1Password", defaultPrice: 2.99, currency: "EUR", billingCycle: "monthly", category: "software", region: "DACH" },
  { id: "notion-pro-de", name: "Notion Pro", defaultPrice: 10.00, currency: "EUR", billingCycle: "monthly", category: "software", region: "DACH" },
  { id: "canva-pro-de", name: "Canva Pro", defaultPrice: 12.99, currency: "EUR", billingCycle: "monthly", category: "software", region: "DACH" },
  { id: "nordvpn-de", name: "NordVPN", defaultPrice: 3.99, currency: "EUR", billingCycle: "monthly", category: "software", region: "DACH" },

  // ─── FITNESS / HEALTH (DACH / EUR) ────────────────────────────────────────────
  { id: "freeletics-de", name: "Freeletics Training Coach", defaultPrice: 10.99, currency: "EUR", billingCycle: "monthly", category: "fitness", region: "DACH" },
  { id: "fitbit-premium-de", name: "Fitbit Premium", defaultPrice: 8.99, currency: "EUR", billingCycle: "monthly", category: "fitness", region: "DACH" },
  { id: "calm-de", name: "Calm", defaultPrice: 14.99, currency: "EUR", billingCycle: "monthly", category: "fitness", region: "DACH" },
  { id: "headspace-de", name: "Headspace", defaultPrice: 12.99, currency: "EUR", billingCycle: "monthly", category: "fitness", region: "DACH" },
  { id: "garmin-connect-de", name: "Garmin Connect+", defaultPrice: 6.99, currency: "EUR", billingCycle: "monthly", category: "fitness", region: "DACH" },
  { id: "strava-de", name: "Strava Premium", defaultPrice: 7.99, currency: "EUR", billingCycle: "monthly", category: "fitness", region: "DACH" },

  // ─── TELECOM Germany ──────────────────────────────────────────────────────────
  { id: "telekom-s", name: "Telekom MagentaMobil S", defaultPrice: 30.00, currency: "EUR", billingCycle: "monthly", category: "utilities", region: "DE" },
  { id: "telekom-m", name: "Telekom MagentaMobil M", defaultPrice: 40.00, currency: "EUR", billingCycle: "monthly", category: "utilities", region: "DE" },
  { id: "telekom-l", name: "Telekom MagentaMobil L", defaultPrice: 55.00, currency: "EUR", billingCycle: "monthly", category: "utilities", region: "DE" },
  { id: "telekom-xl", name: "Telekom MagentaMobil XL", defaultPrice: 65.00, currency: "EUR", billingCycle: "monthly", category: "utilities", region: "DE" },
  { id: "o2-blue-basic", name: "O2 Blue Basic", defaultPrice: 17.99, currency: "EUR", billingCycle: "monthly", category: "utilities", region: "DE" },
  { id: "o2-blue-s", name: "O2 Blue S", defaultPrice: 25.00, currency: "EUR", billingCycle: "monthly", category: "utilities", region: "DE" },
  { id: "o2-blue-m", name: "O2 Blue M", defaultPrice: 35.00, currency: "EUR", billingCycle: "monthly", category: "utilities", region: "DE" },
  { id: "o2-blue-l", name: "O2 Blue L", defaultPrice: 45.00, currency: "EUR", billingCycle: "monthly", category: "utilities", region: "DE" },
  { id: "vodafone-basic", name: "Vodafone GigaMobil Basic", defaultPrice: 17.99, currency: "EUR", billingCycle: "monthly", category: "utilities", region: "DE" },
  { id: "vodafone-s", name: "Vodafone GigaMobil S", defaultPrice: 30.00, currency: "EUR", billingCycle: "monthly", category: "utilities", region: "DE" },
  { id: "vodafone-m", name: "Vodafone GigaMobil M", defaultPrice: 45.00, currency: "EUR", billingCycle: "monthly", category: "utilities", region: "DE" },
  { id: "vodafone-l", name: "Vodafone GigaMobil L", defaultPrice: 60.00, currency: "EUR", billingCycle: "monthly", category: "utilities", region: "DE" },

  // ─── TELECOM Austria ──────────────────────────────────────────────────────────
  { id: "a1-basic-at", name: "A1 Mobil Basic", defaultPrice: 15.00, currency: "EUR", billingCycle: "monthly", category: "utilities", region: "AT" },
  { id: "a1-starter-at", name: "A1 Mobil Starter", defaultPrice: 25.00, currency: "EUR", billingCycle: "monthly", category: "utilities", region: "AT" },
  { id: "a1-smart-at", name: "A1 Mobil Smart", defaultPrice: 35.00, currency: "EUR", billingCycle: "monthly", category: "utilities", region: "AT" },
  { id: "magenta-at-s", name: "Magenta S", defaultPrice: 18.00, currency: "EUR", billingCycle: "monthly", category: "utilities", region: "AT" },
  { id: "magenta-at-m", name: "Magenta M", defaultPrice: 28.00, currency: "EUR", billingCycle: "monthly", category: "utilities", region: "AT" },
  { id: "magenta-at-l", name: "Magenta L", defaultPrice: 40.00, currency: "EUR", billingCycle: "monthly", category: "utilities", region: "AT" },
  { id: "drei-at-basic", name: "Drei Basic", defaultPrice: 12.90, currency: "EUR", billingCycle: "monthly", category: "utilities", region: "AT" },
  { id: "drei-at-s", name: "Drei S", defaultPrice: 22.90, currency: "EUR", billingCycle: "monthly", category: "utilities", region: "AT" },
  { id: "drei-at-m", name: "Drei M", defaultPrice: 32.90, currency: "EUR", billingCycle: "monthly", category: "utilities", region: "AT" },

  // ─── TELECOM Switzerland ──────────────────────────────────────────────────────
  { id: "salt-ch", name: "Salt Mobile", defaultPrice: 19.00, currency: "CHF", billingCycle: "monthly", category: "utilities", region: "CH" },
  { id: "sunrise-ch", name: "Sunrise Mobile", defaultPrice: 29.00, currency: "CHF", billingCycle: "monthly", category: "utilities", region: "CH" },
  { id: "swisscom-ch", name: "Swisscom Natel", defaultPrice: 35.00, currency: "CHF", billingCycle: "monthly", category: "utilities", region: "CH" },
];

const DACH_REGIONS = new Set(["DE", "AT", "CH", "DACH"]);

export function isDachTemplate(t: ServiceTemplate): boolean {
  return DACH_REGIONS.has(t.region);
}

/* One row per service.
 *
 * 33 services were listed twice, once priced globally in dollars and once for
 * DACH in euros, and the region was written into the name to tell them apart:
 * "Amazon Prime" next to "Amazon Prime DE", "Spotify Premium" next to
 * "Spotify DE". Nobody can be expected to know which of those to pick, and
 * choosing wrong meant a subscription permanently named "Spotify DE" at the
 * wrong price. The region is a property of the row, not part of what the
 * service is called, so it no longer appears in any name.
 *
 * With the names cleaned up the two rows collide, which is the point: the
 * caller's region decides which one survives, and the person just sees
 * "Amazon Prime" at the price that applies where they live. */
export function dedupeForRegion(list: ServiceTemplate[], preferDach: boolean): ServiceTemplate[] {
  const out = new Map<string, ServiceTemplate>();
  for (const t of list) {
    const key = t.name.toLowerCase();
    const existing = out.get(key);
    if (!existing) {
      out.set(key, t);
      continue;
    }
    // Only replace when the newcomer matches the wanted region and the
    // incumbent does not, so the first declaration wins every other tie.
    if (isDachTemplate(t) === preferDach && isDachTemplate(existing) !== preferDach) {
      out.set(key, t);
    }
  }
  return [...out.values()];
}

export function getPopularTemplates(preferDach = false): ServiceTemplate[] {
  return dedupeForRegion(SERVICE_TEMPLATES.filter((t) => t.popular), preferDach);
}

// Exact (not fuzzy) match on purpose — used to compare a tracked
// subscription's price against this service's known current price, so a
// loose match could misattribute a completely different plan's price.
/* How recently a price must have been checked for the app to make a claim
   about it. Six months is long enough that the handful of verified rows stay
   useful between passes, and short enough that a figure nobody has revisited
   in a year stops being presented as the market rate. */
const PRICE_FRESHNESS_MONTHS = 6;

export function isPriceFresh(t: ServiceTemplate, now: Date = new Date()): boolean {
  if (!t.verified) return false;
  const checked = new Date(t.verified);
  if (isNaN(checked.getTime())) return false;
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - PRICE_FRESHNESS_MONTHS);
  return checked >= cutoff;
}

export function findTemplateByExactName(name: string, preferCurrency?: string): ServiceTemplate | undefined {
  const n = name.trim().toLowerCase();
  const matches = SERVICE_TEMPLATES.filter((t) => t.name.toLowerCase() === n);
  if (matches.length <= 1) return matches[0];
  /* A service now appears once globally and once for DACH under the same
     name, so "which one" has to be answered here rather than by taking the
     first. Matching the caller's currency is the closest available signal:
     without it a euro subscriber's Spotify Premium would be measured against
     the dollar price converted down, and reported as overpaying when they are
     paying exactly the list price where they live. */
  return matches.find((t) => t.currency === preferCurrency) ?? matches[0];
}

export function searchTemplates(query: string, preferDach = false): ServiceTemplate[] {
  if (!query.trim()) return getPopularTemplates(preferDach);
  const q = query.toLowerCase().trim();
  const hits = SERVICE_TEMPLATES.filter((t) => t.name.toLowerCase().includes(q));
  return dedupeForRegion(hits, preferDach).slice(0, 40);
}

export function formatTemplatePrice(t: ServiceTemplate): string {
  const symbol = t.currency === "EUR" ? "€" : t.currency === "CHF" ? "Fr." : t.currency === "GBP" ? "£" : "$";
  const cycle = t.billingCycle === "monthly" ? "mo" : t.billingCycle === "yearly" ? "yr" : "wk";
  return `${symbol}${t.defaultPrice}/${cycle}`;
}
