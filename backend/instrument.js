/* Server error reporting, added 2026-10-12. Until then only the APP reported to
   Sentry, so an error inside a route was answered with a 500 and written to the
   Railway log, and nobody heard about it unless they went and read that log.

   Required FIRST in server.js, before express, as the Sentry SDK expects.

   OFF unless SENTRY_DSN is set in Railway, so a deploy without it behaves
   exactly as before. It never throws: reporting must not be able to take the
   API down. What it sends is decided by sentry-scrub.js, read that first. */

const { scrubEvent, dropBreadcrumb } = require("./sentry-scrub");

let Sentry = null;
const dsn = (process.env.SENTRY_DSN || "").trim();

if (dsn) {
  try {
    Sentry = require("@sentry/node");
    Sentry.init({
      dsn,
      environment: process.env.SENTRY_ENVIRONMENT || "production",
      sendDefaultPii: false,
      tracesSampleRate: 0,
      maxBreadcrumbs: 0,
      beforeBreadcrumb: dropBreadcrumb,
      beforeSend: scrubEvent,
    });
    console.log("Sentry: server error reporting ON");
  } catch (e) {
    Sentry = null;
    console.warn("Sentry: could not start, server error reporting OFF:", e.message);
  }
} else {
  console.log("Sentry: SENTRY_DSN not set, server error reporting OFF");
}

/* Called from handleError. `where` is the route, so an alert says which
   endpoint failed without carrying anything the request contained. */
function reportServerError(err, where) {
  if (!Sentry) return;
  try {
    Sentry.withScope((scope) => {
      if (where) scope.setTag("route", where);
      Sentry.captureException(err);
    });
  } catch {
    // Reporting must never turn one error into two.
  }
}

module.exports = { reportServerError, sentryEnabled: () => Sentry !== null };
