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
