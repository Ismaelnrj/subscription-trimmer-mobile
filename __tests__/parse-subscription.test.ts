import { parseSubscriptionEmail } from "../lib/parse-subscription";

/* Every case here is a reproduction from the 2026-09-17 review. They are
   written as the defect first, so a regression reads as the old behaviour
   coming back rather than as an abstract assertion failing. */

describe("amount parsing across separator conventions", () => {
  it("reads a German thousands separator instead of truncating it", () => {
    // Was 1.23: replace(",", ".") swapped only the FIRST separator, so
    // "1.234,56" became "1.23" and a four figure charge read as small change.
    expect(parseSubscriptionEmail("Rechnung: €1.234,56 pro Monat").price).toBe("1234.56");
  });

  it("reads an English thousands separator", () => {
    expect(parseSubscriptionEmail("Invoice: $1,234.56 per month").price).toBe("1234.56");
  });

  it("still reads a plain German decimal comma", () => {
    expect(parseSubscriptionEmail("Netflix €14,99 pro Monat").price).toBe("14.99");
  });

  it("still reads a plain English decimal point", () => {
    expect(parseSubscriptionEmail("Netflix $9.99 per month").price).toBe("9.99");
  });

  it("treats a lone group of three as thousands, not a decimal", () => {
    // "1.234" is one thousand two hundred and thirty four, never 1.234
    expect(parseSubscriptionEmail("Jahresrechnung €1.234 pro Jahr").price).toBe("1234.00");
  });
});

describe("currency is reported, never assumed", () => {
  it("reports USD for a dollar receipt", () => {
    const r = parseSubscriptionEmail("Your plan renewed: $9.99 per month");
    expect(r.price).toBe("9.99");
    expect(r.currency).toBe("USD");
  });

  it("reports EUR for a euro receipt", () => {
    expect(parseSubscriptionEmail("Abo verlängert: €9,99 pro Monat").currency).toBe("EUR");
  });

  it("reads a currency code written AFTER the amount", () => {
    const r = parseSubscriptionEmail("Betrag: 12,99 EUR pro Monat");
    expect(r.price).toBe("12.99");
    expect(r.currency).toBe("EUR");
  });

  it("reads a currency code written BEFORE the amount", () => {
    // German receipts do this and only the after-form was matched before
    const r = parseSubscriptionEmail("Betrag: EUR 12,99 pro Monat");
    expect(r.price).toBe("12.99");
    expect(r.currency).toBe("EUR");
  });
});

describe("a payment processor in the footer is not the merchant", () => {
  it("does not blank the name because of a 'Powered by Google Pay' footer", () => {
    // The old word-boundary guard claimed to handle this and did not: "google"
    // is a whole word inside "Google Pay", so the email was treated as an
    // intermediary receipt and extractName gave up and returned undefined.
    const r = parseSubscriptionEmail(
      "Your Vertigo Pro subscription renewed.\n€15,99 per month.\nPowered by Google Pay."
    );
    expect(r.name).toBeDefined();
    expect(r.name).not.toMatch(/google/i);
  });

  it("still treats a genuine PayPal receipt as an intermediary email", () => {
    const r = parseSubscriptionEmail("You sent a payment of €9,99 to Vertigo Pro\nPayPal");
    expect(r.name).not.toMatch(/paypal/i);
  });

  it("never returns the processor itself as the subscription name", () => {
    for (const text of [
      "Receipt from Stripe\nAmount: €9,99",
      "PayPal\nYou paid €9,99",
      "Powered by Google Pay\n€9,99 per month",
    ]) {
      const name = parseSubscriptionEmail(text).name ?? "";
      expect(name).not.toMatch(/paypal|stripe|google pay/i);
    }
  });
});

/* Every case below is a reproduction from the 2026-09-22 session, where the
   owner pasted text lifted off a screenshot with Google Lens and the parse came
   back wrong. The defects it exposed are not about that one merchant: the
   parser was English shaped, on the half of the product whose German depth is
   the reason to choose it. */

describe("German receipt formats", () => {
  it("reads a price written with the symbol AFTER the amount", () => {
    // Was undefined. Symbol-before and code-on-either-side were matched and
    // "15,99 €" was not, which is how every DACH receipt writes it, so a German
    // paste returned no price at all.
    const r = parseSubscriptionEmail("Acme Abo 15,99 € pro Monat");
    expect(r.price).toBe("15.99");
    expect(r.currency).toBe("EUR");
  });

  it("recognises every common German billing cycle", () => {
    const monthly = ["pro Monat", "im Monat", "monatlich", "mtl."];
    const yearly = ["pro Jahr", "im Jahr", "jährlich"];
    const weekly = ["pro Woche", "wöchentlich"];
    // All nine returned undefined before: extractCycle was English only.
    for (const w of monthly) {
      expect(parseSubscriptionEmail(`Acme 15,99 € ${w}`).billingCycle).toBe("monthly");
    }
    for (const w of yearly) {
      expect(parseSubscriptionEmail(`Acme 119,00 € ${w}`).billingCycle).toBe("yearly");
    }
    for (const w of weekly) {
      expect(parseSubscriptionEmail(`Acme 2,99 € ${w}`).billingCycle).toBe("weekly");
    }
  });

  it("does not read a warranty period as a billing cycle", () => {
    // The guard on the entry above. Admitting a bare "Monat" or "Jahr" would
    // turn "12 Monate Garantie" on a refurbished phone into a monthly
    // subscription, which is inventing a recurring charge out of nothing.
    const r = parseSubscriptionEmail("Apple iPhone 13\n429,00 €\n12 Monate Garantie");
    expect(r.billingCycle).toBeUndefined();
  });

  it("reads an English yearly plan written as a count of months", () => {
    // Was undefined: `month\b` cannot match inside "months".
    expect(parseSubscriptionEmail("Acme plan $119.00 every 12 months").billingCycle)
      .toBe("yearly");
  });
});

describe("a value never reaches across a line break", () => {
  it("does not let a currency symbol capture the next line's number", () => {
    // Was 12.00, read out of "12 Monate Garantie" because the € ending one line
    // matched the number starting the next. The real figure on screen was 429.
    const r = parseSubscriptionEmail("refurbed\nApple iPhone 13 128 GB\n429,00 €\n12 Monate Garantie");
    expect(r.price).toBe("429.00");
  });

  it("does not let a merchant name run onto the next line", () => {
    // Was "Refurbed\nAmount": the name pattern's \s matched the newline and
    // swallowed the label of the line below.
    const r = parseSubscriptionEmail("Invoice from Refurbed\nAmount: 4,99 EUR\nBilled monthly");
    expect(r.name).toBe("Refurbed");
  });
});

describe("an umbrella brand is not evidence of a subscription", () => {
  it("does not name a hardware or marketplace purchase after the brand", () => {
    // Each of these named a subscription that was not being bought: a
    // refurbished phone became "Apple", a book order became "Amazon Prime", a
    // laptop became "Microsoft 365". Those firms sell hardware and
    // marketplaces too, so a bare mention is not evidence of a subscription.
    //
    // THE ASSERTION USED TO REQUIRE NO NAME AT ALL, which was narrower than
    // this test's own title and went stale the moment the first-line fallback
    // landed: it now reads "refurbed" off the paste, which is what the screen
    // says and is not an umbrella subscription brand. What must never come
    // back is the UMBRELLA LABEL, so that is what is asserted.
    const buys: [string, RegExp][] = [
      ["refurbed\nApple iPhone 13 128 GB\n429,00 €", /^Apple$/],
      ["Amazon.de Bestellbestätigung\nDas Buch\n19,99 €", /Amazon Prime/],
      ["Microsoft Surface Laptop\n1.299,00 €", /^Microsoft 365$/],
    ];
    for (const [text, umbrella] of buys) {
      expect(parseSubscriptionEmail(text).name ?? "").not.toMatch(umbrella);
    }
  });

  it("still names the qualified subscription products", () => {
    // The fix qualifies those keys rather than dropping them, and the qualified
    // form is also a better name than the umbrella was.
    const cases: [string, string][] = [
      ["Your Apple Music subscription\n$10.99 per month", "Apple Music"],
      ["iCloud+ 200GB\n2,99 € pro Monat", "iCloud+"],
      ["Amazon Prime Mitgliedschaft\n8,99 € im Monat", "Amazon Prime"],
      ["Microsoft 365 Single\n69,00 € pro Jahr", "Microsoft 365"],
      ["Xbox Game Pass Ultimate\n20,99 € monatlich", "Xbox Game Pass"],
      ["Google One 100 GB\n1,99 € pro Monat", "Google One"],
    ];
    for (const [text, expected] of cases) {
      expect(parseSubscriptionEmail(text).name).toBe(expected);
    }
  });
});

/* The 2026-09-23 round. The owner pasted a refurbed listing, the price came
   back right and the NAME CAME BACK BLANK, which the previous round had made
   deliberate. It was the wrong call: the catalogue can only ever name the 49
   services it knows, and what people actually paste is a screen. */

describe("an unknown brand is read off the paste rather than left blank", () => {
  it("names the merchant from the first line when nothing else can", () => {
    // All three returned a price and no name, so the user had to type the one
    // thing that was already on screen.
    expect(parseSubscriptionEmail(
      "refurbed\nApple iPhone 13 128 GB\n429,00 €\n12 Monate Garantie",
    ).name).toBe("refurbed");
    expect(parseSubscriptionEmail("Acme Cloud\nPro plan\n12,99 € pro Monat").name)
      .toBe("Acme Cloud");
  });

  it("does not read a German gym as a VPN", () => {
    /* `nord` was a KNOWN_SERVICES key and Nord is German for north, so
       "Fitnessstudio Nord" came back named NordVPN: the umbrella-brand defect
       of the previous round, surviving in the one key that is an ordinary word
       in the market this app is built for. The key is qualified now. */
    const r = parseSubscriptionEmail("Fitnessstudio Nord\nMitgliedschaft\n29,90 € monatlich");
    expect(r.name).toBe("Fitnessstudio Nord");
    expect(r.name).not.toMatch(/nordvpn/i);
  });

  it("still recognises NordVPN when it is actually named", () => {
    expect(parseSubscriptionEmail("NordVPN\n3,99 € pro Monat").name).toBe("NordVPN");
  });

  it("skips greetings, labels and processor footers", () => {
    /* The footer is the one that got through every other guard: both the
       intermediary check and the known-service scan read "Powered by Google
       Pay" as an INCIDENTAL mention and correctly decline it, which left the
       fallback free to adopt it as the merchant. The existing suite caught it. */
    expect(parseSubscriptionEmail("Hallo Ismael,\nVertigo Pro\n9,99 € pro Monat").name)
      .toBe("Vertigo Pro");
    expect(parseSubscriptionEmail("Rechnung\nVertigo Pro\n9,99 € pro Monat").name)
      .toBe("Vertigo Pro");
    const footer = parseSubscriptionEmail("Powered by Google Pay\n9,99 € pro Monat").name ?? "";
    expect(footer).not.toMatch(/google|powered/i);
  });

  it("stays silent when there is no price, since nothing says it is a purchase", () => {
    /* The gate lives in the caller rather than in extractName: without an
       amount there is no evidence the paste is a purchase at all, and naming
       arbitrary text is noise rather than help. */
    expect(parseSubscriptionEmail("Acme Cloud\nsome notes about nothing").name)
      .toBeUndefined();
  });

  it("never lets the first line outrank a service the catalogue knows", () => {
    // Order matters: the fallback is last, so a real receipt keeps its real name.
    expect(parseSubscriptionEmail("Rechnung von Musterfirma\nNetflix\n15,99 € pro Monat").name)
      .toBe("Netflix");
  });
});
