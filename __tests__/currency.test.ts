import { fmt, CURRENCIES } from "../lib/currency-store";

describe("fmt", () => {
  it("formats USD amount", () => {
    expect(fmt(9.99, "$")).toBe("$9.99");
  });

  it("formats zero", () => {
    expect(fmt(0, "€")).toBe("€0.00");
  });

  it("rounds to 2 decimal places", () => {
    expect(fmt(1.005, "£")).toBe("£1.01");
    expect(fmt(1.004, "£")).toBe("£1.00");
  });

  it("formats large amount", () => {
    expect(fmt(1234.56, "R$")).toBe("R$1234.56");
  });
});

describe("CURRENCIES", () => {
  it("includes USD as first currency", () => {
    expect(CURRENCIES[0].code).toBe("USD");
    expect(CURRENCIES[0].symbol).toBe("$");
  });

  it("contains expected currencies", () => {
    const codes = CURRENCIES.map((c) => c.code);
    expect(codes).toContain("EUR");
    expect(codes).toContain("GBP");
    expect(codes).toContain("BRL");
  });
});
