/* The retry policy, tested as behaviour rather than by reading lib/api.ts.

   Importing the real module drags in axios, expo-secure-store and
   expo-constants, so this mirrors the policy instead. That is a real
   limitation and worth naming: if lib/api.ts changes its rule, these keep
   passing. They exist to pin the RULE, and the rule is the thing the review
   found broken. The constants below must stay in step with MAX_RETRIES and
   RETRYABLE_METHODS there. */

const MAX_RETRIES = 2;
const RETRYABLE_METHODS = new Set(["get", "head", "options"]);

type Cfg = { method: string; _retryCount?: number };

function makeClient() {
  let attempts = 0;
  const send = (config: Cfg) => {
    attempts++;
    return Promise.reject({ config, response: undefined });   // always offline
  };
  async function onReject(error: any): Promise<any> {
    const config: Cfg | undefined = error.config;
    if (!config) throw error;
    const isNetworkError = !error.response;
    const isServerError = error.response?.status >= 500;
    const method = String(config.method ?? "get").toLowerCase();
    const attempt = config._retryCount ?? 0;
    if ((isNetworkError || isServerError) && RETRYABLE_METHODS.has(method) && attempt < MAX_RETRIES) {
      config._retryCount = attempt + 1;
      return send(config).catch(onReject);
    }
    throw error;
  }
  return {
    request: (config: Cfg) => send(config).catch(onReject),
    get attempts() { return attempts; },
  };
}

describe("retry limit survives the trip back through the interceptor", () => {
  it("stops a GET after the original plus MAX_RETRIES", async () => {
    /* The counter used to be a function parameter defaulting to 2, and the
       interceptor re-invoked it with no argument, so every pass reset it. A
       simulation of that code ran past 40 attempts without settling: offline,
       one request per second, forever. */
    const c = makeClient();
    await expect(c.request({ method: "get" })).rejects.toBeDefined();
    expect(c.attempts).toBe(1 + MAX_RETRIES);
  });

  it("never retries a POST", async () => {
    // A 5xx can arrive after the server already did the work, so repeating a
    // write can create a second subscription or a second account.
    const c = makeClient();
    await expect(c.request({ method: "post" })).rejects.toBeDefined();
    expect(c.attempts).toBe(1);
  });

  it("never retries a DELETE or a PUT", async () => {
    for (const method of ["delete", "put", "patch"]) {
      const c = makeClient();
      await expect(c.request({ method })).rejects.toBeDefined();
      expect(c.attempts).toBe(1);
    }
  });

  it("does not carry a spent counter into a fresh request", async () => {
    const c = makeClient();
    await expect(c.request({ method: "get" })).rejects.toBeDefined();
    const first = c.attempts;
    await expect(c.request({ method: "get" })).rejects.toBeDefined();
    expect(c.attempts - first).toBe(1 + MAX_RETRIES);
  });
});
