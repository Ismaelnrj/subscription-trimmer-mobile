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

/* Fallback icon and colour shown when a subscription has no matching brand
   logo. These drive four surfaces at once: the quick add icons, the
   subscription card icons, the Stats donut with its legend, and the calendar
   day dots.

   This used to be the pre-rebrand set (#8B5CF6 violet, #E50914 Netflix red,
   #3B82F6 blue and the rest of a highlighter scale). It survived the move to
   Ink Navy untouched, which made the Stats donut the single most off-brand
   thing left in the app.

   All ten real categories are a validated categorical palette rather than
   colours chosen by eye. Checked against the warm white ground (#F7F6F1) on
   the adjacent pairlist, which is the right one for a donut: slices touch only
   their neighbours, the same geometry as a stacked bar, and the chart carries
   a legend with names and amounts so identity is never colour alone. All five
   gates pass across the ten: lightness band, chroma floor, colourblind
   separation (worst adjacent deutan ΔE 8.8, tritan 10.8), normal vision
   separation (worst 19.0 against a floor of 15) and 3:1 contrast.

   The declaration order is load bearing, because it is the order the checks
   ran against. Two pairs fail when adjacent and are kept apart here: red with
   olive-green, and orange with green, both of which collapse under deuter- and
   protanopia however far apart they look to full colour vision. Reordering
   this map without re-running the validator can silently reintroduce them.

   `other` is deliberately the one neutral. It is the catch-all rather than a
   category in its own right, and the donut already uses a grey for the slice
   that folds the tail together, so giving it a hue would imply a specificity
   it does not have. */
export const CATEGORY_ICON: Record<string, { icon: string; color: string }> = {
  software: { icon: "laptop", color: "#3B6FBC" },
  streaming: { icon: "television-play", color: "#C24C3C" },
  education: { icon: "school", color: "#0F918B" },
  food: { icon: "food", color: "#B07A12" },
  entertainment: { icon: "music-note", color: "#8E4F94" },
  fitness: { icon: "dumbbell", color: "#4E8C36" },
  health: { icon: "heart-pulse", color: "#C0407E" },
  insurance: { icon: "shield-check", color: "#5A5FB5" },
  memberships: { icon: "card-account-details", color: "#C06A28" },
  utilities: { icon: "lightning-bolt", color: "#0E80B0" },
  other: { icon: "credit-card", color: "#8B949C" },
};

export function getCategoryIcon(category: string) {
  return CATEGORY_ICON[category] ?? CATEGORY_ICON.other;
}

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
