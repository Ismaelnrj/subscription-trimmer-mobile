import apiClient from "./api";
import { mergePending } from "./pending-subscriptions";

/* THE ONE PLACE THE SUBSCRIPTION LIST IS FETCHED. Seven screens share the
   ["subscriptions", "list"] query and each used to write its own fetch, so a
   subscription waiting to be saved (lib/pending-subscriptions.ts) would vanish
   from whichever screen fetched last. Every one of them goes through here now,
   and __tests__/pending-subscriptions-wiring.test.js fails on a screen that
   fetches the list any other way. */
export async function fetchSubscriptionList(): Promise<any[]> {
  const rows = (await apiClient.get("/trpc/subscriptions.list")).data.result.data;
  return mergePending(rows);
}
