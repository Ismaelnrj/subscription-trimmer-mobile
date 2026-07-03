export const DEFAULT_CATEGORIES = [
  "entertainment",
  "streaming",
  "software",
  "health",
  "fitness",
  "food",
  "education",
  "utilities",
  "insurance",
  "memberships",
  "other",
] as const;

// Maps each category to the service/brand keywords it should match.
// Ordered most-specific first so "apple tv" beats "apple".
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  streaming: [
    "netflix", "disney+", "disney plus", "hulu", "hbo", "hbo max", "max",
    "apple tv+", "apple tv", "amazon prime video", "prime video", "amazon prime",
    "paramount+", "paramount plus", "peacock", "crunchyroll", "mubi", "youtube tv",
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
    "pcloud", "mega", "monday", "asana", "clickup", "trello",
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
    "hims", "hers", "roman", "noom health", "babylon", "betterhelp",
    "talkspace", "mental health", "medic",
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
    "chegg", "bartleby", "quizlet", "readwise", "blinkist",
  ],
  utilities: [
    "electricity", "electric", "gas bill", "water bill", "internet",
    "broadband", "fiber", "cable", "phone bill", "mobile plan",
    "at&t", "att", "verizon", "t-mobile", "tmobile", "sprint",
    "comcast", "xfinity", "spectrum", "cox", "frontier", "optimum",
    "centurylink", "lumen", "utility", "power bill", "energy bill",
    "sewage", "trash", "waste management", "heating", "cooling",
  ],
  insurance: [
    "insurance", "geico", "allstate", "state farm", "progressive",
    "liberty mutual", "nationwide", "usaa", "aaa", "farmers", "travelers",
    "aetna", "cigna", "humana", "anthem", "blue cross", "bluecross",
    "united health", "unitedhealthcare", "oscar health", "oscar",
    "lemonade", "hippo", "toggle", "metlife", "sunlife", "zurich",
    "renters policy", "home policy", "auto policy", "car policy",
    "life policy", "pet insurance", "dental insurance", "vision insurance",
    "dental plan", "vision plan", "health plan",
  ],
  memberships: [
    "costco", "sam's club", "sams club", "bj's wholesale", "bjs",
    "linkedin premium", "linkedin",
    "wework", "regus", "coworking", "co-working space",
    "gym membership", "club membership",
    "amazon business", "prime business",
    "professional association", "trade association",
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
