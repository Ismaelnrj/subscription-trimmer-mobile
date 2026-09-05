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

   The first six are a validated categorical palette rather than chosen by eye.
   Checked against the warm white ground (#F7F6F1) on the adjacent pairlist,
   which is the right one for a donut: slices touch only their neighbours, the
   same geometry as a stacked bar, and the chart ships a legend with labels and
   values so identity is never carried by colour alone. All five gates pass:
   lightness band, chroma floor, colourblind separation (worst adjacent deutan
   ΔE 8.7, tritan 10.2), normal vision separation (worst 18.5, floor 15) and
   3:1 contrast against the ground.

   Six is the ceiling here, not a preference. Under an all-pairs check no
   ordering of six clears the floors, which is a property of the colour space
   rather than of these particular hues. The donut therefore wants a cap of
   about three visible categories with the remainder folded into Other; until
   that lands, the legend is what keeps it readable.

   The last five are deliberately quieter, drawn from the brand neutrals and
   the coral and amber that already exist in the palette. They mark categories
   that are rare enough to sit behind an icon and a label rather than needing
   to be told apart at a glance in a chart. */
export const CATEGORY_ICON: Record<string, { icon: string; color: string }> = {
  software: { icon: "laptop", color: "#3B6FBC" },
  streaming: { icon: "television-play", color: "#C24C3C" },
  education: { icon: "school", color: "#0F918B" },
  food: { icon: "food", color: "#B07A12" },
  entertainment: { icon: "music-note", color: "#A8456B" },
  fitness: { icon: "dumbbell", color: "#4E8C36" },
  health: { icon: "heart-pulse", color: "#C4544A" },
  insurance: { icon: "shield-check", color: "#3E7A6E" },
  memberships: { icon: "card-account-details", color: "#A8632E" },
  utilities: { icon: "lightning-bolt", color: "#52616B" },
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
