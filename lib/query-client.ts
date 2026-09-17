import { QueryClient } from "@tanstack/react-query";

/* One QueryClient, reachable from outside React.

   It used to be created inline in app/_layout.tsx, which meant only components
   could get at it. The auth store is not a component, so logout had no way to
   touch the cache and simply did not: every key is global (["subscriptions",
   "list"], ["analytics", "summary"] and so on, none of them carrying a user
   id), so signing out of one account and into another left the first account's
   data sitting in the cache under exactly the keys the second account reads.
   React Query serves cached data first and refetches after, so the second
   person saw the first person's subscriptions until the network came back. */
export const queryClient = new QueryClient();

/* Called on every sign-out and on every switch to a different user.

   cancel before clear, and in that order: a request already in flight resolves
   into the cache after clear() has run, which would repopulate the new
   account's cache with the old account's response. Cancelling first removes
   that window. `clear()` then drops both the data and the query metadata, so
   nothing survives to be served as a stale first paint. */
export async function resetQueryCache() {
  try {
    await queryClient.cancelQueries();
  } catch {
    // A cancel that fails must not stop the clear: leaving data behind is the
    // failure that matters here.
  }
  queryClient.clear();
}
