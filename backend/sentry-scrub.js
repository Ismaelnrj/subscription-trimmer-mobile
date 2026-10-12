/* What leaves this server when an error is reported to Sentry, and what never
   does. Kept apart from instrument.js, with no imports, so a test can exercise
   it without the Sentry SDK installed (CI installs only the app's packages).

   The rule: Sentry gets the error, its stack and which route it happened on,
   which is enough to fix it. It never gets anything a user typed or anything
   that identifies them, because the app's promise is about privacy and the
   privacy policy lists Sentry for crash reporting only.

     - request bodies are dropped: they carry passwords, reset codes, emails,
       subscription names and prices;
     - query strings are dropped: unsubscribe links carry a user id and token;
     - every header is dropped except a short allowlist, so the bearer token,
       cookies and the forwarded client IP never leave;
     - user and IP fields are dropped (sendDefaultPii is also off);
     - breadcrumbs are dropped entirely: console lines can include an email
       address and outgoing HTTP breadcrumbs carry RevenueCat subscriber ids. */

const SAFE_HEADERS = new Set(["accept-language", "content-type", "user-agent"]);

function scrubEvent(event) {
  if (!event || typeof event !== "object") return event;
  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
    delete event.request.query_string;
    if (typeof event.request.url === "string") event.request.url = event.request.url.split("?")[0];
    if (event.request.headers) {
      const kept = {};
      for (const [k, v] of Object.entries(event.request.headers)) {
        if (SAFE_HEADERS.has(k.toLowerCase())) kept[k] = v;
      }
      event.request.headers = kept;
    }
  }
  delete event.user;
  delete event.breadcrumbs;
  if (event.contexts) delete event.contexts.request;
  return event;
}

function dropBreadcrumb() {
  return null;
}

module.exports = { scrubEvent, dropBreadcrumb, SAFE_HEADERS };
