import { normaliseDateInput, parseLocalDate, sanitiseAmountInput, amountForDisplay } from "../lib/utils";

describe("normaliseDateInput", () => {
  it("accepts YYYY-MM-DD unchanged", () => {
    expect(normaliseDateInput("2024-03-15")).toBe("2024-03-15");
  });

  it("returns null for empty string", () => {
    expect(normaliseDateInput("")).toBeNull();
    expect(normaliseDateInput("  ")).toBeNull();
  });

  it("returns null for invalid date", () => {
    expect(normaliseDateInput("2024-13-01")).toBeNull();
    expect(normaliseDateInput("not-a-date")).toBeNull();
  });

  it("parses DD/MM/YYYY", () => {
    expect(normaliseDateInput("15/03/2024")).toBe("2024-03-15");
  });

  it("parses MM/DD/YYYY when DD/MM is invalid", () => {
    // 13/02/2024 — day 13, month 02 is valid as DD/MM
    expect(normaliseDateInput("13/02/2024")).toBe("2024-02-13");
  });

  it("pads single-digit day and month", () => {
    expect(normaliseDateInput("5/3/2024")).toBe("2024-03-05");
  });
});

describe("parseLocalDate", () => {
  it("returns correct local date", () => {
    const d = parseLocalDate("2024-03-15");
    expect(d.getFullYear()).toBe(2024);
    expect(d.getMonth()).toBe(2); // 0-indexed
    expect(d.getDate()).toBe(15);
  });

  it("does not shift date due to timezone", () => {
    const d = parseLocalDate("2024-01-01");
    expect(d.getDate()).toBe(1);
    expect(d.getMonth()).toBe(0);
  });
});

describe("sanitiseAmountInput", () => {
  it("caps a money amount at two decimals", () => {
    // The case that prompted this: 6.944 was accepted, stored at full
    // precision, and shown as 6.94 everywhere afterwards.
    expect(sanitiseAmountInput("6.944")).toBe("6.94");
    expect(sanitiseAmountInput("10.999")).toBe("10.99");
  });

  it("reads a comma as the decimal separator", () => {
    // parseFloat("6,99") is 6, so without this a German keyboard silently
    // drops the cents.
    expect(sanitiseAmountInput("6,99")).toBe("6.99");
    expect(sanitiseAmountInput("6,999")).toBe("6.99");
  });

  it("keeps a trailing separator so decimals can still be typed", () => {
    expect(sanitiseAmountInput("1.")).toBe("1.");
    expect(sanitiseAmountInput("1,")).toBe("1.");
  });

  it("leaves whole numbers alone", () => {
    expect(sanitiseAmountInput("6944")).toBe("6944");
    expect(sanitiseAmountInput("")).toBe("");
  });

  it("strips anything that is not a digit or a separator", () => {
    expect(sanitiseAmountInput("$12.50")).toBe("12.50");
    expect(sanitiseAmountInput("12 50")).toBe("1250");
  });

  it("reads a fully grouped amount as grouping plus a decimal point", () => {
    expect(sanitiseAmountInput("1.234,56")).toBe("1234.56");
    expect(sanitiseAmountInput("1,234.56")).toBe("1234.56");
    expect(sanitiseAmountInput("1.234.567,89")).toBe("1234567.89");
  });

  it("does not treat a decimal point as grouping when a stray separator follows", () => {
    // Counting separators instead of checking the shape turned "1.23," into
    // 123, multiplying the amount by a hundred mid keystroke.
    expect(sanitiseAmountInput("1.23,")).toBe("1.23");
  });

  it("never lets a keystroke produce a value the field should not hold", () => {
    let field = "";
    for (const key of "1.234,56".split("")) {
      field = sanitiseAmountInput(field + key);
      expect(field).toMatch(/^\d*(\.\d{0,2})?$/);
    }
    expect(field).toBe("1.23");
  });

  it("collapses a second separator rather than producing a broken number", () => {
    expect(sanitiseAmountInput("1.2.3")).toBe("1.23");
  });
});


/* A German reader typed "10,99" and watched the comma turn into a period under
   their finger, while the field's own placeholder said "z. B. 9,99". The kept
   text still uses a period (every parseFloat reads it); only what is SHOWN
   changes, so typing through the field must round trip exactly. */
describe("amountForDisplay", () => {
  it("shows a comma to a German reader and a period to everyone else", () => {
    expect(amountForDisplay("10.99", "de")).toBe("10,99");
    expect(amountForDisplay("10.99", "de-AT")).toBe("10,99");
    expect(amountForDisplay("10.99", "en")).toBe("10.99");
    expect(amountForDisplay("10.99", undefined)).toBe("10.99");
    expect(amountForDisplay("", "de")).toBe("");
    expect(amountForDisplay("50", "de")).toBe("50");
  });

  it("round trips every keystroke a German keyboard can send", () => {
    // Simulate the field: what is shown, plus the next key, goes back through
    // the sanitiser, and the kept text must equal typing it directly.
    for (const typed of ["10,99", "1,", "0,5", "1234,56", "10,999", "7"]) {
      let kept = "";
      for (const key of typed) kept = sanitiseAmountInput(amountForDisplay(kept, "de") + key);
      expect(kept).toBe(sanitiseAmountInput(typed));
      expect(parseFloat(kept)).toBe(parseFloat(sanitiseAmountInput(typed)));
    }
  });
});
