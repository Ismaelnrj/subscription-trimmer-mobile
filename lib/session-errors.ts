/* Which request failures mean "this session is over", and which only mean "we
   could not ask right now".

   Until 2026-10-11 the app treated them the same, and that signed people out
   for being offline. restoreToken deleted both tokens on ANY error from
   /auth/me, and refreshAccessToken read any failed refresh as a rejected one.
   So opening the app on a train, in airplane mode, or during the minute a
   Railway deploy restarts the server cost the person their session and sent
   them back to the login screen with no explanation. Every push to master
   deploys Railway, so that last case is not rare.

   The rule now: only an answer FROM the server that refuses the credentials
   ends a session. No answer at all, a 5xx, or a 429 from the rate limiter says
   nothing about the credentials, so the tokens are kept.

   No imports on purpose, so the rule can be executed outside the app. */

export type RefreshOutcome =
  | { kind: "refreshed"; token: string }
  | { kind: "rejected" }
  | { kind: "unavailable" };

/* Set on an error by the response interceptor when a 401 could not be checked
   against /auth/refresh because the refresh call itself failed transiently.
   The 401 is real but stale (an access token that simply expired), so the
   caller must not read it as the server refusing the session. */
export const SESSION_UNVERIFIED = "__trimioSessionUnverified";

export function isTransientFailure(error: unknown): boolean {
  const e = error as { response?: { status?: number }; [k: string]: unknown } | null;
  if (!e || typeof e !== "object") return false;
  if (e[SESSION_UNVERIFIED] === true) return true;
  const status = e.response?.status;
  if (typeof status !== "number") return true; // no response: offline, timeout, DNS
  return status >= 500 || status === 429;
}
