/* Account isolation, pinned as source structure.

   The cache reset happens inside a zustand store that imports expo-secure-store
   and a React Query client, none of which can be instantiated here. So these
   assert on lib/auth-store.ts and lib/query-client.ts rather than on runtime
   behaviour. Weaker, and stated plainly: they would not catch a reset that ran
   but did nothing. What they DO catch is the reset being deleted, reordered, or
   made conditional again, which is how the leak got in.
*/

const fs = require("fs");
const path = require("path");

const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
/* Slice from the IMPLEMENTATION, not the file: every one of these names also
   appears in the AuthState interface above it, so a bare indexOf lands in the
   type declaration and the slices come back empty or inverted. This caught me
   out while writing these tests, which is a fair argument for the tests. */
const AUTH_FILE = read("lib/auth-store.ts");
/* Comments stripped BEFORE slicing. These two assertions used to pass by
   matching the comment that QUOTES the old broken condition as prose, so after
   the condition was fixed they kept passing and pinned nothing at all. A test
   that reads an explanation of a bug instead of the code is worse than no test,
   because it reports green either way. */
const AUTH = AUTH_FILE
  .replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "")
  .slice(AUTH_FILE.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "").indexOf("create<AuthState>"));
const QUERY = read("lib/query-client.ts");

describe("signing out clears the cache", () => {
  it("logout resets the query cache", () => {
    const logout = AUTH.slice(AUTH.indexOf("logout: async"), AUTH.indexOf("restoreToken:"));
    expect(logout).toMatch(/resetQueryCache\(\)/);
  });

  it("logout tears down locally OUTSIDE the try that calls the server", () => {
    /* It used to sit inside one, so anything throwing before it, the dynamic
       import included, jumped to the catch and left the person signed in with
       a logged error. */
    const logout = AUTH.slice(AUTH.indexOf("logout: async"), AUTH.indexOf("restoreToken:"));
    const catchEnd = logout.indexOf("}", logout.indexOf("catch (error)"));
    expect(logout.indexOf('deleteItemAsync("auth_token")')).toBeGreaterThan(catchEnd);
  });

  it("does not wait on the network indefinitely", () => {
    const logout = AUTH.slice(AUTH.indexOf("logout: async"), AUTH.indexOf("restoreToken:"));
    expect(logout).toMatch(/Promise\.race/);
    expect(logout).toMatch(/setTimeout/);
  });
});

describe("switching accounts clears the cache", () => {
  it("setUser resets when the user id changes", () => {
    const setUser = AUTH.slice(AUTH.indexOf("setUser: (user)"), AUTH.indexOf("setLoading:"));
    expect(setUser).toMatch(/previousId !== nextId/);
    expect(setUser).toMatch(/resetQueryCache\(\)/);
  });

  it("does not clear for the same user, so a profile refresh keeps the cache", () => {
    const setUser = AUTH.slice(AUTH.indexOf("setUser: (user)"), AUTH.indexOf("setLoading:"));
    // Identity compared with null counted as an identity, so A -> null -> B
    // resets on both legs while A -> A still keeps the warm cache.
    expect(setUser).toMatch(/previousId = get\(\)\.user\?\.id \?\? null/);
    expect(setUser).toMatch(/nextId = user\?\.id \?\? null/);
  });
});

describe("in-flight requests cannot repopulate the next account's cache", () => {
  it("cancels before clearing", () => {
    /* Order matters: a request already in flight resolves into the cache after
       clear() has run, so cancelling second leaves exactly the window the reset
       exists to close. */
    const cancel = QUERY.indexOf("cancelQueries");
    const clear = QUERY.indexOf("queryClient.clear()");
    expect(cancel).toBeGreaterThan(-1);
    expect(clear).toBeGreaterThan(-1);
    expect(cancel).toBeLessThan(clear);
  });

  it("clears even if cancelling throws", () => {
    expect(QUERY).toMatch(/catch\s*\{[\s\S]*?\}\s*queryClient\.clear\(\)/);
  });

  it("exports a single shared client", () => {
    expect(QUERY).toMatch(/export const queryClient = new QueryClient\(\)/);
    const layout = read("app/_layout.tsx");
    expect(layout).not.toMatch(/new QueryClient\(\)/);
    expect(layout).toMatch(/from "\.\.\/lib\/query-client"/);
  });
});
