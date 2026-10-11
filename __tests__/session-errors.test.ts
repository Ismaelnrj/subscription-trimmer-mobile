/* Which failures end a session. Until 2026-10-11 every failure did: launching
   offline, or during the minute a Railway deploy restarts the server, deleted
   both tokens and sent the person back to the login screen.

   The rule is pure and imports nothing, so this drives the real module. The
   wiring in lib/api.ts and lib/auth-store.ts cannot run under jest here (they
   import expo-secure-store and axios), so it is pinned by session-wiring.test.js
   and was measured separately: the real api.ts and auth-store.ts, run on Node
   type stripping against stubbed storage and a stubbed server, pass 10 of 10
   scenarios, and the previous versions fail the six offline and deploy ones. */
import { isTransientFailure, SESSION_UNVERIFIED } from "../lib/session-errors";

describe("isTransientFailure", () => {
  it("treats no response at all (offline, timeout, DNS) as transient", () => {
    expect(isTransientFailure({ message: "Network Error" })).toBe(true);
    expect(isTransientFailure({ response: undefined })).toBe(true);
  });

  it("treats a 5xx as transient, since a deploy restart answers 502 or 503", () => {
    for (const status of [500, 502, 503, 504]) {
      expect(isTransientFailure({ response: { status } })).toBe(true);
    }
  });

  it("treats a 429 from the rate limiter as transient", () => {
    expect(isTransientFailure({ response: { status: 429 } })).toBe(true);
  });

  it("treats a refusal as final: 400, 401, 403 and a deleted account's 404", () => {
    for (const status of [400, 401, 403, 404]) {
      expect(isTransientFailure({ response: { status } })).toBe(false);
    }
  });

  it("lets a stale 401 through when the refresh that would have settled it could not run", () => {
    expect(isTransientFailure({ response: { status: 401 }, [SESSION_UNVERIFIED]: true })).toBe(true);
  });

  it("does not throw on junk", () => {
    expect(isTransientFailure(null)).toBe(false);
    expect(isTransientFailure(undefined)).toBe(false);
  });
});
