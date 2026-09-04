import { getPasswordScore, isPasswordValid } from "../components/PasswordStrength";

describe("getPasswordScore", () => {
  it("returns score 0 for empty password", () => {
    const s = getPasswordScore("");
    expect(s.score).toBe(0);
  });

  it("returns score 1 for short lowercase password", () => {
    const s = getPasswordScore("abc");
    expect(s.score).toBe(1);
    expect(s.hasLength).toBe(false);
    expect(s.hasUpper).toBe(false);
    expect(s.hasNumber).toBe(false);
  });

  it("returns score 2 for password with length + uppercase", () => {
    const s = getPasswordScore("Abcdefgh");
    expect(s.score).toBe(2);
    expect(s.hasLength).toBe(true);
    expect(s.hasUpper).toBe(true);
    expect(s.hasNumber).toBe(false);
  });

  it("returns score 2 for password with length + number", () => {
    const s = getPasswordScore("abcdefg1");
    expect(s.score).toBe(2);
  });

  it("returns score 3 for password meeting all criteria", () => {
    const s = getPasswordScore("Abcdefg1");
    expect(s.score).toBe(3);
    expect(s.hasLength).toBe(true);
    expect(s.hasUpper).toBe(true);
    expect(s.hasNumber).toBe(true);
  });
});

describe("isPasswordValid", () => {
  it("returns false for weak passwords", () => {
    expect(isPasswordValid("abc")).toBe(false);
    expect(isPasswordValid("abcdefgh")).toBe(false); // no uppercase or number
    expect(isPasswordValid("Abcdefgh")).toBe(false); // no number
    expect(isPasswordValid("abcdefg1")).toBe(false); // no uppercase
  });

  it("returns true for strong password", () => {
    expect(isPasswordValid("Abcdefg1")).toBe(true);
    expect(isPasswordValid("MyPass123")).toBe(true);
  });
});
