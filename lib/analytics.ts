import PostHog from "posthog-react-native";

// PostHog project API keys are meant to be embedded in client apps (same
// class of credential as a Sentry DSN) -- they can only write events, not
// read project data. Replace this placeholder with the key from your
// PostHog project settings (Project Settings -> Project API Key).
const POSTHOG_API_KEY = "REPLACE_WITH_POSTHOG_PROJECT_API_KEY";
// EU cloud region (the project was created on eu.posthog.com) -- PostHog's
// US and EU regions are entirely separate ingest endpoints, so this has to
// match where the project actually lives or events silently go nowhere.
const POSTHOG_HOST = "https://eu.i.posthog.com";

let client: PostHog | null = null;

export function initAnalytics() {
  if (client || !POSTHOG_API_KEY || POSTHOG_API_KEY.startsWith("REPLACE_WITH")) return;
  client = new PostHog(POSTHOG_API_KEY, {
    host: POSTHOG_HOST,
    // enableSessionReplay defaults to false and is deliberately left that
    // way here: it would show real subscription names and prices on
    // screen, which cuts against this app's own "we never see your data"
    // positioning. Only turn it on after masking those fields in PostHog's
    // dashboard config.
    //
    // Only the funnel events explicitly captured below matter here, not
    // every tap, so autocapture stays off too.
    captureAppLifecycleEvents: false,
  });
}

/** Fire-and-forget event capture. Safe to call before initAnalytics() runs
 *  or if the API key hasn't been configured yet -- just a silent no-op. */
export function track(event: string, properties?: Record<string, any>) {
  client?.capture(event, properties);
}

/** Ties subsequent events to a real user instead of an anonymous device ID. */
export function identifyUser(userId: string | number) {
  client?.identify(String(userId));
}

/** Call on logout so the next session doesn't get attributed to the
 *  previous user. */
export function resetAnalytics() {
  client?.reset();
}
