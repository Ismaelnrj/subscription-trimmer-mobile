// Attempts to extract subscription details from a purchase/confirmation email body.
// Returns partial form fields — whatever it can confidently detect.

export interface ParsedSubscription {
  name?: string;
  price?: string;
  billingCycle?: "monthly" | "yearly" | "weekly";
}

// $ must be escaped (\$) so the regex engine treats it as a literal character,
// not an end-of-string anchor — otherwise "$9.99" prices are never matched.
const CURRENCY_SYMBOLS = ["\\$", "€", "£", "₹", "¥", "R\\$", "C\\$", "A\\$", "MX\\$"];
const CURRENCY_PATTERN = CURRENCY_SYMBOLS.join("|");

// Well-known service name hints extracted from email content
const KNOWN_SERVICES: Record<string, string> = {
  netflix: "Netflix", spotify: "Spotify", apple: "Apple", disney: "Disney+",
  hulu: "Hulu", amazon: "Amazon Prime", "prime video": "Amazon Prime",
  youtube: "YouTube Premium", "google one": "Google One", google: "Google",
  microsoft: "Microsoft 365", dropbox: "Dropbox", adobe: "Adobe",
  "adobe creative": "Adobe Creative Cloud", notion: "Notion",
  slack: "Slack", zoom: "Zoom", linkedin: "LinkedIn Premium",
  "duolingo plus": "Duolingo Plus", duolingo: "Duolingo Plus",
  canva: "Canva", figma: "Figma", github: "GitHub",
  nord: "NordVPN", expressvpn: "ExpressVPN", grammarly: "Grammarly",
  "new york times": "NY Times", nyt: "NY Times", hbo: "HBO Max",
  peacock: "Peacock", paramount: "Paramount+", crunchyroll: "Crunchyroll",
  headspace: "Headspace", calm: "Calm",
  // AI services
  anthropic: "Claude", claude: "Claude", chatgpt: "ChatGPT", openai: "ChatGPT",
  perplexity: "Perplexity", midjourney: "Midjourney", "cursor ": "Cursor",
  copilot: "GitHub Copilot",
  // Other common services
  dashlane: "Dashlane", lastpass: "LastPass", "1password": "1Password",
  proton: "Proton", mullvad: "Mullvad VPN", surfshark: "Surfshark",
  todoist: "Todoist", evernote: "Evernote", bear: "Bear",
  pocketcasts: "Pocket Casts", overcast: "Overcast",
  shopify: "Shopify",
};

// Payment intermediaries — never use these as the subscription name
const PAYMENT_INTERMEDIARIES = new Set([
  "paypal", "venmo", "cashapp", "cash app", "stripe", "square",
  "paddle", "fastspring", "gumroad", "lemonsqueezy", "lemon squeezy",
]);

function isIntermediaryText(text: string): boolean {
  const lower = text.toLowerCase();
  for (const name of PAYMENT_INTERMEDIARIES) {
    if (lower.includes(name)) return true;
  }
  return false;
}

function extractMerchantFromIntermediaryEmail(text: string): string | undefined {
  const patterns = [
    /(?:sent|paid)\s+(?:a\s+payment\s+of\s+)?(?:[\$€£₹¥][\d,.]+\s*(?:USD|EUR|GBP|INR|JPY)?\s+)?to\s+([A-Za-z0-9][A-Za-z0-9 .,&'"\-]{1,40})/i,
    /merchant(?:\s+name)?[:\s]+([A-Za-z0-9][A-Za-z0-9 .,&'"\-]{1,40})/i,
    /seller(?:\s+info(?:rmation)?)?[:\s]+([A-Za-z0-9][A-Za-z0-9 .,&'"\-]{1,40})/i,
    /(?:payment|receipt)\s+to[:\s]+([A-Za-z0-9][A-Za-z0-9 .,&'"\-]{1,40})/i,
    /you\s+paid\s+([A-Za-z0-9][A-Za-z0-9 .,&'"\-]{1,40})/i,
    /subscription\s+(?:to|for|with)\s+([A-Za-z0-9][A-Za-z0-9 .,&'"\-]{1,40})/i,
  ];

  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const candidate = m[1].trim().replace(/\s{2,}/g, " ");
      // Discard if it's just another intermediary name or too short
      if (candidate.length >= 2 && !isIntermediaryText(candidate)) return candidate;
    }
  }
  return undefined;
}

function detectKnownService(text: string): string | undefined {
  const lower = text.toLowerCase();
  for (const [key, label] of Object.entries(KNOWN_SERVICES)) {
    if (lower.includes(key)) return label;
  }
  return undefined;
}

function extractName(text: string): string | undefined {
  // Step 1: always scan the full content for known services first —
  // this correctly handles intermediary emails (e.g. PayPal receipt for Claude)
  const known = detectKnownService(text);
  if (known) return known;

  // Step 2: if the email came through a payment intermediary, use
  // merchant-specific patterns before falling back to generic ones
  if (isIntermediaryText(text)) {
    const merchant = extractMerchantFromIntermediaryEmail(text);
    if (merchant) return merchant;
    // Can't determine merchant — return undefined so the form stays blank
    // rather than pre-filling with "PayPal"
    return undefined;
  }

  // Step 3: generic patterns for direct merchant emails
  const patterns = [
    /your\s+([A-Z][A-Za-z0-9\s&+.'-]{1,30}?)\s+(?:subscription|membership|plan|account)/i,
    /subscri(?:bed|ption)\s+to\s+([A-Z][A-Za-z0-9\s&+.'-]{1,30})/i,
    /payment\s+(?:to|for)\s+([A-Z][A-Za-z0-9\s&+.'-]{1,30})/i,
    /charged\s+by\s+([A-Z][A-Za-z0-9\s&+.'-]{1,30})/i,
    /receipt\s+from\s+([A-Z][A-Za-z0-9\s&+.'-]{1,30})/i,
    /thank\s+you\s+for\s+(?:subscribing|your\s+order)[^\n]*?(?:to|from|at)\s+([A-Z][A-Za-z0-9\s&+.'-]{1,30})/i,
    /invoice\s+from\s+([A-Z][A-Za-z0-9\s&+.'-]{1,30})/i,
  ];

  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const candidate = m[1].trim().replace(/\s{2,}/g, " ");
      // Never return an intermediary name from a generic pattern
      if (!isIntermediaryText(candidate)) return candidate;
    }
  }
  return undefined;
}

const BILLING_CONTEXT_RE = /(?:per month|\/month|\/mo\b|monthly|per year|\/year|annually|per week|\/week|subscription|membership|plan|renewal|recurring|charged)/i;

function extractPrice(text: string): string | undefined {
  // Match currency symbol followed by number, e.g. $9.99 or €14,99
  const withSymbol = new RegExp(
    `(?:${CURRENCY_PATTERN})\\s*(\\d{1,6}(?:[.,]\\d{1,2})?)`,
    "g"
  );

  // Match number followed by currency code, e.g. 9.99 USD
  const withCode = /(\d{1,6}(?:[.,]\d{1,2})?)\s*(?:USD|EUR|GBP|BRL|CAD|AUD|JPY|MXN|INR)\b/gi;

  const candidates: { value: number; index: number }[] = [];

  let m: RegExpExecArray | null;
  while ((m = withSymbol.exec(text)) !== null) {
    const n = parseFloat(m[1].replace(",", "."));
    if (!isNaN(n) && n > 0 && n < 10000) candidates.push({ value: n, index: m.index });
  }
  while ((m = withCode.exec(text)) !== null) {
    const n = parseFloat(m[1].replace(",", "."));
    if (!isNaN(n) && n > 0 && n < 10000) candidates.push({ value: n, index: m.index });
  }

  if (candidates.length === 0) return undefined;

  // Prefer a candidate that appears within 60 chars of a billing-cycle keyword
  const contextual = candidates.filter(({ index }) => {
    const window = text.slice(Math.max(0, index - 60), index + 60);
    return BILLING_CONTEXT_RE.test(window);
  });

  // Among contextual hits (or all candidates as fallback), pick the most frequent value;
  // ties broken by choosing the smallest (avoids totals/one-time fees).
  const pool = contextual.length > 0 ? contextual : candidates;
  const freq: Record<string, number> = {};
  for (const { value } of pool) {
    const k = value.toFixed(2);
    freq[k] = (freq[k] ?? 0) + 1;
  }
  const maxFreq = Math.max(...Object.values(freq));
  const best = Object.entries(freq)
    .filter(([, f]) => f === maxFreq)
    .map(([k]) => parseFloat(k))
    .sort((a, b) => a - b)[0];

  return best.toFixed(2);
}

function extractCycle(text: string): "monthly" | "yearly" | "weekly" | undefined {
  const lower = text.toLowerCase();
  if (/\b(?:annual|yearly|per year|\/year|every year|12[\s-]?month)\b/.test(lower)) return "yearly";
  if (/\b(?:weekly|per week|every week|\/week)\b/.test(lower)) return "weekly";
  if (/\b(?:monthly|per month|\/month|every month|\/mo\b|mo\/)\b/.test(lower)) return "monthly";
  return undefined;
}

export function parseSubscriptionEmail(text: string): ParsedSubscription {
  if (!text || text.trim().length < 5) return {};
  return {
    name: extractName(text),
    price: extractPrice(text),
    billingCycle: extractCycle(text),
  };
}
