import { hasPaidPlan, freePremiumUntil } from "../lib/premium-status";

const now = new Date("2026-11-07T12:00:00Z");
const in5 = "2026-11-12T12:00:00.000Z";
const ago = "2026-11-06T12:00:00.000Z";

describe("hasPaidPlan", () => {
  it("reads the server's answer when it sends one", () => {
    expect(hasPaidPlan({ isPaid: true, hasPaidPlan: false })).toBe(false);
    expect(hasPaidPlan({ isPaid: true, hasPaidPlan: true })).toBe(true);
  });
  it("falls back to isPaid for a server from before the field existed", () => {
    expect(hasPaidPlan({ isPaid: true })).toBe(true);
    expect(hasPaidPlan({ isPaid: false })).toBe(false);
  });
  it("no user, no plan", () => {
    expect(hasPaidPlan(null)).toBe(false);
    expect(hasPaidPlan(undefined)).toBe(false);
  });
});

describe("freePremiumUntil", () => {
  it("names the end of free Premium on an account with no purchase", () => {
    expect(freePremiumUntil({ isPaid: true, hasPaidPlan: false, bonusPremiumUntil: in5 }, now)).toBe(in5);
  });
  it("is null once it has ended, or when a purchase stands behind it", () => {
    expect(freePremiumUntil({ isPaid: false, hasPaidPlan: false, bonusPremiumUntil: ago }, now)).toBeNull();
    expect(freePremiumUntil({ isPaid: true, hasPaidPlan: true, bonusPremiumUntil: in5 }, now)).toBeNull();
  });
  it("changes nothing on a server that does not send hasPaidPlan", () => {
    expect(freePremiumUntil({ isPaid: true, bonusPremiumUntil: in5 }, now)).toBeNull();
  });
  it("is null for an unreadable or missing date, or no user", () => {
    expect(freePremiumUntil({ isPaid: true, hasPaidPlan: false, bonusPremiumUntil: "soon" }, now)).toBeNull();
    expect(freePremiumUntil({ isPaid: true, hasPaidPlan: false, bonusPremiumUntil: null }, now)).toBeNull();
    expect(freePremiumUntil(null, now)).toBeNull();
  });
});
