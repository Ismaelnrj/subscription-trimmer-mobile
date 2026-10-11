/* Source reading, and says so: lib/api.ts and lib/auth-store.ts import native
   modules jest cannot load here. The behaviour was measured separately (see the
   header of session-errors.test.ts). These pin the wiring so it cannot quietly
   revert to signing people out for being offline. */
const fs = require("fs");
const path = require("path");
const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
const API = read("lib/api.ts");
const AUTH = read("lib/auth-store.ts");

describe("an unreachable server does not end a session", () => {
  it("refreshAccessToken distinguishes a refused token from an unreachable server", () => {
    const fn = API.slice(API.indexOf("async function refreshAccessToken"), API.indexOf("async function clearSessionAndSignOut"));
    expect(fn).toContain("isTransientFailure(error)");
    expect(fn).toContain('kind: "unavailable"');
    expect(fn).toContain('kind: "rejected"');
  });

  it("the interceptor signs out only on a rejected refresh", () => {
    const i = API.indexOf("interceptors.response.use");
    const handler = API.slice(i);
    const unavailable = handler.indexOf('outcome.kind === "unavailable"');
    const signOut = handler.indexOf("clearSessionAndSignOut()");
    expect(unavailable).toBeGreaterThan(-1);
    expect(signOut).toBeGreaterThan(unavailable);
    expect(handler.slice(unavailable, signOut)).toContain("SESSION_UNVERIFIED");
  });

  it("restoreToken keeps the tokens on a transient failure", () => {
    const restore = AUTH.slice(AUTH.indexOf("restoreToken: async"));
    const transient = restore.indexOf("isTransientFailure(error)");
    const firstDelete = restore.indexOf('deleteItemAsync("auth_token")');
    expect(transient).toBeGreaterThan(-1);
    expect(firstDelete).toBeGreaterThan(transient);
    expect(restore.slice(transient, firstDelete)).toContain("} else {");
  });

  it("the cached user is written on sign in and removed on every sign out path", () => {
    expect(AUTH).toMatch(/setItemAsync\(CACHED_USER_KEY/);
    const logout = AUTH.slice(AUTH.indexOf("logout: async"), AUTH.indexOf("restoreToken: async"));
    expect(logout).toContain("deleteItemAsync(CACHED_USER_KEY)");
    const setUser = AUTH.slice(AUTH.indexOf("setUser: (user)"), AUTH.indexOf("setLoading: (isLoading)"));
    expect(setUser).toContain("deleteItemAsync(CACHED_USER_KEY)");
  });
});
