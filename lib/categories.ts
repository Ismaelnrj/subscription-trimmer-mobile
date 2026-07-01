export const DEFAULT_CATEGORIES = [
  "entertainment",
  "streaming",
  "software",
  "health",
  "fitness",
  "food",
  "education",
  "other",
] as const;

// Maps each category to the service/brand keywords it should match.
// Ordered most-specific first so "apple tv" beats "apple".
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  streaming: [
    "netflix", "disney+", "disney plus", "hulu", "hbo", "hbo max", "max",
    "apple tv+", "apple tv", "amazon prime video", "prime video", "amazon prime",
    "paramount+", "paramount plus", "peacock", "crunchyroll", "mubi",
    "discovery+", "discovery plus", "dazn", "funimation", "shudder",
    "criterion", "britbox", "acorn", "amc+", "starz", "showtime",
  ],
  entertainment: [
    "spotify", "apple music", "tidal", "amazon music", "deezer", "pandora",
    "youtube music", "soundcloud", "youtube premium", "youtube",
    "xbox game pass", "xbox", "playstation plus", "playstation", "ps plus",
    "nintendo switch online", "nintendo", "ea play", "ubisoft+", "ubisoft",
    "humble bundle", "apple arcade", "google play pass", "audible",
    "kindle unlimited", "scribd", "comic",
  ],
  software: [
    "adobe", "microsoft 365", "microsoft office", "office 365", "microsoft",
    "notion", "evernote", "figma", "sketch", "jetbrains", "github", "gitlab",
    "linear", "airtable", "zapier", "slack", "zoom", "loom", "grammarly",
    "canva", "lastpass", "1password", "bitwarden", "dashlane", "nordvpn",
    "expressvpn", "surfshark", "mullvad", "tailscale", "cloudflare",
    "icloud", "google one", "dropbox", "onedrive", "backblaze", "box",
    "pcloud", "mega", "notion", "monday", "asana", "clickup", "trello",
    "jira", "confluence", "basecamp", "harvest", "toggl", "freshbooks",
    "quickbooks", "xero", "shopify", "squarespace", "wix", "webflow",
    "mailchimp", "convertkit", "substack", "ghost",
  ],
  fitness: [
    "peloton", "fitbit", "myfitnesspal", "strava", "nike training",
    "headspace", "calm", "noom", "beachbody", "whoop", "planet fitness",
    "anytime fitness", "orangetheory", "future", "ladder", "tempo",
    "les mills", "openfit", "daily burn", "glo yoga", "obé", "sweat",
    "aaptiv", "centr", "apple fitness",
  ],
  health: [
    "cerebral", "teladoc", "one medical", "weight watchers", "ww",
    "hims", "hers", "roman", "noom health", "babylon", "life", "medical",
    "therapy", "betterhelp", "talkspace", "mental", "dental", "vision",
    "health insurance", "medic",
  ],
  food: [
    "hellofresh", "blue apron", "instacart", "doordash", "ubereats",
    "grubhub", "freshly", "factor", "daily harvest", "green chef",
    "gousto", "mindful chef", "sunbasket", "home chef", "marley spoon",
    "hungryroot", "imperfect foods", "thrive market",
  ],
  education: [
    "duolingo", "masterclass", "skillshare", "coursera", "udemy",
    "linkedin learning", "brilliant", "babbel", "rosetta stone",
    "pluralsight", "codecademy", "treehouse", "datacamp", "khan",
    "chegg", "bartleby", "quizlet", "scribd", "readwise", "blinkist",
  ],
};

export function guessCategory(name: string): string {
  const n = name.toLowerCase().trim();
  if (!n) return "other";
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((k) => n.includes(k))) return category;
  }
  return "other";
}

// Keyword lists for insights overlap detection (replaces hardcoded lists in insights.tsx)
export const STREAMING_KEYWORDS = CATEGORY_KEYWORDS.streaming;
export const FITNESS_KEYWORDS = CATEGORY_KEYWORDS.fitness;
