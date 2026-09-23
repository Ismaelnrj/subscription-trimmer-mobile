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

/* Well-known service name hints extracted from email content.

   FOUR KEYS USED TO BE UMBRELLA BRAND NAMES and each one named a subscription
   that was not being bought. Measured on real pasted text rather than argued:
   a refurbished phone listing reading "Apple iPhone 13" came back named
   "Apple"; an Amazon book order came back "Amazon Prime"; a Surface laptop came
   back "Microsoft 365". Those firms sell hardware and marketplaces as well as
   subscriptions, so a bare mention is not evidence of a subscription, and the
   app's promise is about money, which makes a confident wrong answer worse than
   a blank field the user fills in.

   The fix is to qualify them rather than to drop them: "apple music" and
   "amazon prime" cannot be a phone or a book, and they also produce a BETTER
   name than the umbrella did. Bare "google" additionally mapped to the useless
   label "Google" while "google one" sat two entries below it.

   FOUR KEYS THAT ARE ORDINARY WORDS ARE KNOWINGLY LEFT AS THEY ARE: bear, calm,
   cursor and overcast. All four misfire on a contrived sentence ("Move the
   cursor to continue" names a subscription "Cursor"), and all four are real
   products with no qualifying second word to hang the match on. Removing them
   would cost their actual subscribers the auto-fill; keeping them costs a name
   that is visibly wrong and takes four seconds to correct. That trade is worth
   revisiting with real receipts, and not worth a heuristic invented without
   any. */
const KNOWN_SERVICES: Record<string, string> = {
  netflix: "Netflix", spotify: "Spotify", disney: "Disney+",
  "apple music": "Apple Music", "apple one": "Apple One",
  "apple tv": "Apple TV+", icloud: "iCloud+", applecare: "AppleCare",
  hulu: "Hulu", "amazon prime": "Amazon Prime", "prime video": "Amazon Prime",
  "amazon music": "Amazon Music", audible: "Audible",
  youtube: "YouTube Premium", "google one": "Google One",
  "microsoft 365": "Microsoft 365", "office 365": "Microsoft 365",
  "xbox game pass": "Xbox Game Pass", onedrive: "OneDrive",
  dropbox: "Dropbox", adobe: "Adobe",
  "adobe creative": "Adobe Creative Cloud", notion: "Notion",
  slack: "Slack", zoom: "Zoom", linkedin: "LinkedIn Premium",
  "duolingo plus": "Duolingo Plus", duolingo: "Duolingo Plus",
  canva: "Canva", figma: "Figma", github: "GitHub",
  nordvpn: "NordVPN", "nord vpn": "NordVPN", expressvpn: "ExpressVPN", grammarly: "Grammarly",
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

/* Lines that are labels, greetings or plumbing rather than a merchant. A
   receipt's first line is very often one of these, and naming a subscription
   "Rechnung" is worse than leaving the field blank. */
const PROCESSOR_FOOTER =
  /\b(?:powered|processed|secured|handled|managed|paid|billed)\s+(?:by|with|through|via)\b/i;

const NOT_A_NAME = new RegExp(
  "^(?:hi|hello|hey|dear|hallo|guten|liebe[rs]?|sehr|invoice|rechnung|receipt|" +
  "quittung|beleg|order|bestellung|subscription|abo|abonnement|total|summe|" +
  "betrag|amount|price|preis|date|datum|thank|thanks|danke|vielen)\\b", "i");

/* LAST RESORT, and deliberately the last one: the first line that reads like a
   brand. It exists because the catalogue can only ever name the 49 services it
   knows, and the pasted text people actually have is usually a screen rather
   than a well formed receipt. Measured on real pastes: a refurbed listing, an
   unknown SaaS pricing page and a German gym all came back with a price and NO
   NAME, which makes the user type the one thing that was already on screen.

   A WRONG NAME IS CHEAP AND A BLANK ONE IS NOT FREE. The name is visible in the
   form before saving and takes seconds to correct, which is the same trade this
   file's KNOWN_SERVICES comment already makes for the ordinary-word keys. A
   wrong PRICE would be a different matter and this never touches one.

   IT ONLY RUNS WHEN A PRICE WAS FOUND, which is the caller's job and the reason
   this is not folded into extractName: without an amount there is no evidence
   the paste is a purchase at all, and naming arbitrary text is noise. */
function nameFromFirstLine(text: string): string | undefined {
  for (const raw of text.split("\n")) {
    const line = raw.trim().replace(/[\s.,;:\-]+$/, "");
    if (line.length < 2 || line.length > 40) continue;
    if (!/[A-Za-z]/.test(line)) continue;          // a price, a date, a number
    if (line.split(/\s+/).length > 4) continue;    // a sentence, not a brand
    if (/[@]|:\/\//.test(line)) continue;          // an address or a URL
    if (NOT_A_NAME.test(line)) continue;
    /* A processor footer is the one line that survives every other guard here,
       and it did: `isIntermediaryText` and `detectKnownService` both read
       "Powered by Google Pay" as an INCIDENTAL mention and correctly decline
       it, which left this fallback free to adopt it as the merchant. Caught by
       the existing suite rather than by reading, which is the argument for
       running it before pushing. A line that says how the card was charged is
       never the thing being bought. */
    if (PROCESSOR_FOOTER.test(line)) continue;
    if (isIntermediaryText(line)) continue;
    if (detectKnownService(line)) continue;        // step 1 already declined it
    return line;
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

  /* Step 3: generic patterns for direct merchant emails.

     The character classes below take a literal space and tab rather than `\s`.
     `\s` matches a newline, so "Invoice from Refurbed\nAmount: 4,99 EUR" came
     back named "Refurbed\nAmount": the pattern ran past the end of the line it
     was reading and swallowed the label of the next one. Measured, not
     reasoned about. A merchant name does not continue onto the next line. */
  const patterns = [
    /your\s+([A-Z][A-Za-z0-9 \t&+.'-]{1,30}?)\s+(?:subscription|membership|plan|account)/i,
    /subscri(?:bed|ption)\s+to\s+([A-Z][A-Za-z0-9 \t&+.'-]{1,30})/i,
    /payment\s+(?:to|for)\s+([A-Z][A-Za-z0-9 \t&+.'-]{1,30})/i,
    /charged\s+by\s+([A-Z][A-Za-z0-9 \t&+.'-]{1,30})/i,
    /receipt\s+from\s+([A-Z][A-Za-z0-9 \t&+.'-]{1,30})/i,
    /thank\s+you\s+for\s+(?:subscribing|your\s+order)[^\n]*?(?:to|from|at)\s+([A-Z][A-Za-z0-9 \t&+.'-]{1,30})/i,
    /invoice\s+from\s+([A-Z][A-Za-z0-9 \t&+.'-]{1,30})/i,
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

/* The window a price has to sit near to be read as the subscription figure
   rather than a total or a one-off fee. It was English only, which on a German
   receipt meant no candidate was contextual and the fallback picked the
   smallest number on the page. Bare "Monat" is deliberately NOT here: "12
   Monate Garantie" on a refurbished phone listing is a warranty, not a cycle,
   and admitting it would turn a hardware receipt into a monthly subscription. */
const BILLING_CONTEXT_RE = /(?:per month|\/month|\/mo\b|monthly|per year|\/year|annually|per week|\/week|subscription|membership|plan|renewal|recurring|charged|pro monat|im monat|monatlich|mtl\.|pro jahr|im jahr|j(?:ä|ae)hrlich|pro woche|w(?:ö|oe)chentlich|abo|abonnement|verl(?:ä|ae)ngerung|zahlung)/i;

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

/* Whitespace that is allowed to sit between an amount and its currency, and
   it deliberately excludes the newline. `\s*` used to be permitted here and a
   currency symbol at the end of one line then reached across the break to
   capture the number at the start of the next. Measured on a real pasted
   screenshot: "429,00 €\n12 Monate Garantie" matched "€\n12" and returned a
   price of 12.00, reading a warranty period as money. An amount and its
   symbol are on the same line in every receipt anybody writes. */
const GAP = "[ \\t]*";

function extractPrice(text: string): { price: string; currency?: string } | undefined {
  // Symbol before the number: $9.99, €14,99, €1.234,56
  const withSymbol = new RegExp(`(${CURRENCY_PATTERN})${GAP}(${NUMBER})`, "g");
  /* Symbol AFTER the number: 15,99 €. This is how German, Austrian and Swiss
     receipts are written, and it was the one form not matched, so a DACH
     receipt returned no price at all on a product whose German depth is the
     reason to choose it. The symbol must not be a decimal point's neighbour,
     so the number is captured first and the gap cannot cross a line. */
  const symbolAfter = new RegExp(`(${NUMBER})${GAP}(${CURRENCY_PATTERN})`, "g");
  // Code on either side: 9,99 EUR and EUR 9,99 both occur in German receipts,
  // and only the first was matched before.
  const codeAfter = new RegExp(`(${NUMBER})${GAP}(USD|EUR|GBP|BRL|CAD|AUD|JPY|MXN|INR)\\b`, "gi");
  const codeBefore = new RegExp(`\\b(USD|EUR|GBP|BRL|CAD|AUD|JPY|MXN|INR)${GAP}(${NUMBER})`, "gi");

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
  while ((m = symbolAfter.exec(text)) !== null) {
    add(parseAmount(m[1]), m.index, SYMBOL_TO_CODE[m[2].replace(/\\/g, "")]);
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

/* German was absent entirely, so "15,99 € pro Monat" came back with no cycle at
   all and the form defaulted. Measured before the fix: pro Monat, monatlich, im
   Monat, jährlich, pro Jahr and wöchentlich all returned undefined, six for six.

   Bare "Monat", "Jahr" and "Woche" are excluded on purpose. They appear in
   durations that are not cycles ("12 Monate Garantie", "2 Jahre Gewährleistung")
   and reading one as a billing cycle invents a subscription out of a warranty.
   Only a phrase that can ONLY mean a rate is admitted.

   `month` also gained its plural: "every 12 months" matched nothing, because
   `month\b` cannot match inside "months", so the commonest way of writing a
   yearly plan in English was read as no cycle. */
function extractCycle(text: string): "monthly" | "yearly" | "weekly" | undefined {
  const lower = text.toLowerCase();
  if (/\b(?:annual|yearly|per year|\/year|every year|12[\s-]?months?|pro jahr|im jahr|j(?:ä|ae)hrlich|1x\s+j(?:ä|ae)hrlich)\b/.test(lower)) return "yearly";
  if (/\b(?:weekly|per week|every week|\/week|pro woche|je woche|w(?:ö|oe)chentlich)\b/.test(lower)) return "weekly";
  /* `mtl.` sits outside the trailing \b on purpose: a word boundary after a
     full stop needs a word character on the other side, so "12,99 € mtl."
     at the end of a line matched nothing while "mtl. 12,99 €" would have. */
  if (/\b(?:monthly|per month|\/month|every month|\/mo\b|mo\/|pro monat|im monat|je monat|monatlich)\b|\bmtl\.?/.test(lower)) return "monthly";
  return undefined;
}

export function parseSubscriptionEmail(text: string): ParsedSubscription {
  if (!text || text.trim().length < 5) return {};
  const amount = extractPrice(text);
  return {
    name: extractName(text) ?? (amount ? nameFromFirstLine(text) : undefined),
    price: amount?.price,
    currency: amount?.currency,
    billingCycle: extractCycle(text),
  };
}
