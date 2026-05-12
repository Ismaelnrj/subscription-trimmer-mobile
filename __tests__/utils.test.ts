import { normaliseDateInput, parseLocalDate } from "../lib/utils";

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
