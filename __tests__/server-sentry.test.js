/* Server error reporting (backend/instrument.js, backend/sentry-scrub.js),
   added 2026-10-12. Until then only the app reported to Sentry and a failing
   route was visible only in the Railway log.

   What this pins: the scrubber drops everything a user typed or that
   identifies them, reporting is off unless SENTRY_DSN is set, it is loaded
   before express, and no call site hands it an email or a user id.

   Measured separately, against the real @sentry/node 11.6.0 with a fake DSN
   and the envelope captured before sending: a POST carrying a bearer token,
   a cookie, a forwarded IP, a password, a subscription name and price, an
   unsubscribe id and token, plus a console line with an email address,
   produced one event containing NONE of them, tagged with the route, with
   only accept-language, content-type and user-agent kept as headers. That
   test needs the SDK, which CI does not install at the repo root, so it is
   recorded here rather than committed. */

const fs = require("fs");
const path = require("path");

const read = (...p) => fs.readFileSync(path.join(__dirname, "..", ...p), "utf8");
const { scrubEvent, dropBreadcrumb } = require("../backend/sentry-scrub");
const SERVER = read("backend", "server.js");
const INSTRUMENT = read("backend", "instrument.js");

describe("what an error report may carry", () => {
  const event = () => ({
    exception: { values: [{ type: "Error", value: "boom" }] },
    request: {
      method: "POST",
      url: "https://x/api/trpc/subscriptions.create?u=42&t=SECRETTOKEN",
      query_string: "u=42&t=SECRETTOKEN",
      data: { name: "Netflix", price: 15.99, password: "hunter2" },
      cookies: { c: "1" },
      headers: { Authorization: "Bearer SECRETJWT", cookie: "c=1", "x-forwarded-for": "1.2.3.4", "accept-language": "de", "content-type": "application/json" },
    },
    user: { id: 7, email: "someone@example.com", ip_address: "1.2.3.4" },
    breadcrumbs: [{ category: "console", message: "Email sent to someone@example.com" }],
    contexts: { request: { url: "https://x/?t=SECRETTOKEN" }, runtime: { name: "node" } },
  });

  it("keeps the error and drops every private field", () => {
    const out = scrubEvent(event());
    const blob = JSON.stringify(out);
    for (const secret of ["SECRETJWT", "SECRETTOKEN", "hunter2", "Netflix", "15.99", "someone@example.com", "1.2.3.4", "u=42"]) {
      expect(blob).not.toContain(secret);
    }
    expect(out.exception.values[0].value).toBe("boom");
    expect(out.request.url).toBe("https://x/api/trpc/subscriptions.create");
    expect(Object.keys(out.request.headers).sort()).toEqual(["accept-language", "content-type"]);
    expect(out.contexts.runtime).toEqual({ name: "node" });
  });

  it("drops every breadcrumb", () => {
    expect(dropBreadcrumb({ category: "console", message: "x" })).toBeNull();
  });

  it("does not throw on an event without a request", () => {
    expect(scrubEvent({ exception: {} })).toEqual({ exception: {} });
  });
});

describe("how it is wired", () => {
  it("is off without SENTRY_DSN and never loads the SDK then", () => {
    const before = process.env.SENTRY_DSN;
    delete process.env.SENTRY_DSN;
    const mod = require("../backend/instrument");
    expect(mod.sentryEnabled()).toBe(false);
    expect(() => mod.reportServerError(new Error("x"), "GET /x")).not.toThrow();
    if (before !== undefined) process.env.SENTRY_DSN = before;
  });

  it("initialises with the scrubber, no PII and no tracing", () => {
    expect(INSTRUMENT).toMatch(/sendDefaultPii: false/);
    expect(INSTRUMENT).toMatch(/beforeSend: scrubEvent/);
    expect(INSTRUMENT).toMatch(/beforeBreadcrumb: dropBreadcrumb/);
    expect(INSTRUMENT).toMatch(/tracesSampleRate: 0/);
    expect(INSTRUMENT.indexOf('require("@sentry/node")')).toBeGreaterThan(INSTRUMENT.indexOf("if (dsn)"));
  });

  it("is required before express", () => {
    const sentry = SERVER.indexOf("require('./instrument')");
    expect(sentry).toBeGreaterThan(-1);
    expect(sentry).toBeLessThan(SERVER.indexOf("require('express')"));
  });

  it("handleError reports method and path, never the query or body", () => {
    const fn = SERVER.slice(SERVER.indexOf("function handleError"), SERVER.indexOf("\n}\n", SERVER.indexOf("function handleError")));
    expect(fn).toMatch(/reportServerError\(err, req \? `\$\{req\.method\} \$\{req\.path\}`/);
    expect(fn).not.toMatch(/originalUrl|req\.url|req\.body|req\.query/);
  });

  it("no call site passes an email or a user id", () => {
    const calls = SERVER.split("\n").filter((l) => /reportServerError\(/.test(l) && !/function reportServerError|require\(/.test(l));
    expect(calls.length).toBeGreaterThanOrEqual(4);
    for (const l of calls) {
      // Judge the code, not the prose: string text is dropped, but anything
      // interpolated into a template (${...}) is code and is kept.
      const interpolated = [...l.matchAll(/\$\{([^}]*)\}/g)].map((m) => m[1]).join(" ");
      const code = l.replace(/`[^`]*`|'[^']*'|"[^"]*"/g, '""') + " " + interpolated;
      expect(code).not.toMatch(/\b(email|userId|to|user|req\.body|req\.query)\b/);
    }
  });

  it("the SDK is a declared backend dependency with a lockfile entry", () => {
    expect(JSON.parse(read("backend", "package.json")).dependencies["@sentry/node"]).toBeTruthy();
    expect(read("backend", "package-lock.json")).toMatch(/"node_modules\/@sentry\/node"/);
  });
});
