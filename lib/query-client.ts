import { QueryClient } from "@tanstack/react-query";

/* One QueryClient, reachable from outside React.

   It used to be created inline in app/_layout.tsx, which meant only components
   could get at it. The auth store is not a component, so logout had no way to
   touch the cache and simply did not: every key is global (["subscriptions",
   "list"], ["analytics", "summary"] and so on, none of them carrying a user
   id), so signing out of one account and into another left the first account's
   data sitting in the cache under exactly the keys the second account reads.
   React Query serves cached data first and refetches after, so the second
   person saw the first person's subscriptions until the network came back.

   cacheTime is a day rather than the default five minutes because of
   lib/offline-cache.ts: a query nobody is looking at is garbage collected after
   cacheTime, and once it is gone from memory the next write drops it from the
   saved copy too, so a screen opened offline later in the day found nothing. The
   data is a few kilobytes and every sign out clears it. */
export const queryClient = new QueryClient({
  defaultOptions: { queries: { cacheTime: 24 * 60 * 60 * 1000 } },
});

/* The latest reset, so code that must not run against a half cleared cache
   (the offline copy, which reads and writes it) can wait for it to finish. */
let pendingReset: Promise<void> = Promise.resolve();

export function cacheResetSettled(): Promise<void> {
  return pendingReset;
}

/* Called on every sign-out and on every switch to a different user.

   cancel before clear, and in that order: a request already in flight resolves
   into the cache after clear() has run, which would repopulate the new
   account's cache with the old account's response. Cancelling first removes
   that window. `clear()` then drops both the data and the query metadata, so
   nothing survives to be served as a stale first paint. */
export function resetQueryCache(): Promise<void> {
  pendingReset = (async () => {
    try {
      await queryClient.cancelQueries();
    } catch {
      // A cancel that fails must not stop the clear: leaving data behind is the
      // failure that matters here.
    }
    queryClient.clear();
  })();
  return pendingReset;
}
