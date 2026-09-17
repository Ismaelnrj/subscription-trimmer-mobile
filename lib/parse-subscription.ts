// Attempts to extract subscription details from a purchase/confirmation email body.
// Returns partial form fields — whatever it can confidently detect.

export interface ParsedSubscription {
  name?: string;
  price?: string;
  billingCycle?: "monthly" | "yearly" | "weekly";
  /* The currency the RECEIPT was written in, when it could be told. There was
     no such field before, so a "$9.99" receipt returned "9.99" and the form
     stored it in whatever the account's currency happened to be: a US receipt
     silently relabelled as euros, at a nine to one error on the amount. The
     caller compares this against the account currency and says so when they
     differ rather than quietly converting or quietly ignoring. */
  currency?: string;
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
  perplexity: "Perplexity", midjourney: "Midjourney", cursor: "Cursor",
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

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesWholeWord(lower: string, key: string): boolean {
  return new RegExp(`\\b${escapeRegex(key)}\\b`, "i").test(lower);
}

/* A footer saying how the card was charged, as opposed to the email being FROM
   the processor. "Powered by Google Pay" at the bottom of a Netflix receipt is
   the first; a PayPal receipt is the second, and only the second should switch
   on merchant extraction. */
const INCIDENTAL_MENTION = /(?:powered|processed|secured|handled|managed|paid|billed)\s+(?:by|with|through|via)\s*$/i;

/* This used to be a word-boundary test, with a comment claiming the boundary
   stopped "google" matching a footer mention of "Google Pay". It does not:
   "google" IS a whole word inside "Google Pay", so both matched and the email
   was treated as a PayPal-style intermediary receipt. For any service not in
   the known list that then meant extractName returned undefined and the name
   field came back BLANK, because step 2 gives up rather than fall through to
   the generic patterns. A footer line was suppressing merchant detection.

   The boundary check stays, since it is still needed; what is added is that a
   mention introduced by "powered by" and friends is read as incidental. */
function isIntermediaryText(text: string): boolean {
  const lower = text.toLowerCase();
  for (const name of PAYMENT_INTERMEDIARIES) {
    const re = new RegExp(`\\b${escapeRegex(name)}\\b`, "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(lower)) !== null) {
      const preceding = lower.slice(Math.max(0, m.index - 30), m.index);
      if (INCIDENTAL_MENTION.test(preceding)) continue;
      return true;
    }
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

/* Same incidental-mention rule as isIntermediaryText, and for a sharper reason.
   KNOWN_SERVICES contains `google`, so "Powered by Google Pay" in a footer
   matched a known service and the subscription came back named "Google". The
   first fix to the intermediary check moved the failure here rather than
   removing it: the name went from blank to confidently wrong, which is worse.
   A processor named in a "powered by" line is never the thing being bought. */
function mentionedAsService(lower: string, key: string): boolean {
  const re = new RegExp(`\\b${escapeRegex(key)}\\b`, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(lower)) !== null) {
    const preceding = lower.slice(Math.max(0, m.index - 30), m.index);
    if (INCIDENTAL_MENTION.test(preceding)) continue;
    return true;
  }
  return false;
}

function detectKnownService(text: string): string | undefined {
  const lower = text.toLowerCase();
  for (const [key, label] of Object.entries(KNOWN_SERVICES)) {
    if (mentionedAsService(lower, key)) return label;
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

const SYMBOL_TO_CODE: Record<string, string> = {
  "$": "USD", "€": "EUR", "£": "GBP", "₹": "INR", "¥": "JPY",
  "R$": "BRL", "C$": "CAD", "A$": "AUD", "MX$": "MXN",
};

/* A number, with or without thousands separators, in either convention.
   Grouped forms are tried first so "1.234,56" is taken whole instead of the
   engine settling for "1.23". */
const NUMBER = "\\d{1,3}(?:[.,]\\d{3})+(?:[.,]\\d{1,2})?|\\d{1,6}(?:[.,]\\d{1,2})?";

/* `parseFloat(raw.replace(",", "."))` was the old reading, and it replaces only
   the FIRST separator, so "1.234,56" became "1.23": a thousandfold error on any
   amount over 999, quietly, in an app about money.

   When both separators appear the LAST one is the decimal point, which is true
   in both conventions and needs no guess about locale. When only one appears,
   three digits after it means it is a thousands separator ("1.234" is one
   thousand two hundred and thirty four, not 1.234), anything else is a decimal. */
function parseAmount(raw: string): number | undefined {
  const t = raw.trim();
  const lastDot = t.lastIndexOf(".");
  const lastComma = t.lastIndexOf(",");
  let decimal = "";
  if (lastDot >= 0 && lastComma >= 0) decimal = lastDot > lastComma ? "." : ",";
  else if (lastDot >= 0) decimal = /\.\d{3}(?!\d)/.test(t) ? "" : ".";
  else if (lastComma >= 0) decimal = /,\d{3}(?!\d)/.test(t) ? "" : ",";

  let normalised: string;
  if (decimal) {
    const grouping = decimal === "." ? "," : ".";
    normalised = t.split(grouping).join("").replace(decimal, ".");
  } else {
    normalised = t.replace(/[.,]/g, "");
  }
  const n = parseFloat(normalised);
  return isNaN(n) ? undefined : n;
}

function extractPrice(text: string): { price: string; currency?: string } | undefined {
  // Symbol before the number: $9.99, €14,99, €1.234,56
  const withSymbol = new RegExp(`(${CURRENCY_PATTERN})\\s*(${NUMBER})`, "g");
  // Code on either side: 9,99 EUR and EUR 9,99 both occur in German receipts,
  // and only the first was matched before.
  const codeAfter = new RegExp(`(${NUMBER})\\s*(USD|EUR|GBP|BRL|CAD|AUD|JPY|MXN|INR)\\b`, "gi");
  const codeBefore = new RegExp(`\\b(USD|EUR|GBP|BRL|CAD|AUD|JPY|MXN|INR)\\s*(${NUMBER})`, "gi");

  const candidates: { value: number; index: number; currency?: string }[] = [];
  const add = (value: number | undefined, index: number, currency?: string) => {
    if (value !== undefined && value > 0 && value < 100000) {
      candidates.push({ value, index, currency });
    }
  };

  let m: RegExpExecArray | null;
  while ((m = withSymbol.exec(text)) !== null) {
    add(parseAmount(m[2]), m.index, SYMBOL_TO_CODE[m[1].replace(/\\/g, "")]);
  }
  while ((m = codeAfter.exec(text)) !== null) {
    add(parseAmount(m[1]), m.index, m[2].toUpperCase());
  }
  while ((m = codeBefore.exec(text)) !== null) {
    add(parseAmount(m[2]), m.index, m[1].toUpperCase());
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

  // The currency of a candidate that actually carried one, preferring the pool
  // the amount came from. A receipt can mention several, so this takes the one
  // attached to the figure being returned rather than the first seen anywhere.
  const currency = pool.find((c) => c.value === best && c.currency)?.currency
    ?? candidates.find((c) => c.value === best && c.currency)?.currency;

  return { price: best.toFixed(2), currency };
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
  const amount = extractPrice(text);
  return {
    name: extractName(text),
    price: amount?.price,
    currency: amount?.currency,
    billingCycle: extractCycle(text),
  };
}
