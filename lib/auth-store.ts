import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { identifyUser, resetAnalytics } from "./analytics";
import { resetQueryCache } from "./query-client";

interface User {
  id: number;
  openId: string;
  email: string | null;
  name: string | null;
  role: "user" | "admin";
  isPaid: boolean;
  paidAt: string | null;
  isVerified: boolean;
  hasPassword: boolean;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => Promise<void>;
  restoreToken: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  setUser: (user) => {
    /* Switching to a DIFFERENT user wipes the cache before anything renders.
       Logging out and back in as somebody else is the obvious route, but the
       401 refresh path can also swap the session without a logout in between,
       and every query key in this app is global: nothing carries a user id, so
       account B reads account A's data from exactly the keys it expects to own.
       Comparing ids rather than clearing unconditionally keeps the ordinary
       case (a profile refresh for the same person) from throwing away a warm
       cache on every launch. */
    /* Compare IDENTITY, treating signed-out as an identity of its own.

       This used to read `user && previous && previous.id !== user.id`, which
       skips the null transitions entirely: A to null clears nothing because
       `user` is null, and null to B clears nothing because `previous` is null.
       An expired session goes A -> null -> B through exactly that path, since
       clearSessionAndSignOut calls setUser(null) and login calls setUser(B), so
       account B could read account A's subscriptions out of the global query
       keys before its own fetch returned.

       The old comment argued for comparing ids rather than clearing
       unconditionally, to keep a profile refresh from throwing away a warm
       cache. That reasoning was right and is preserved: same id still means no
       reset. It just has to count null as a value rather than as a reason to
       skip the check. */
    const previousId = get().user?.id ?? null;
    const nextId = user?.id ?? null;
    if (previousId !== nextId) {
      resetQueryCache();
      // Reminders belong to the session that scheduled them, so an identity
      // change has to clear the OS queue as well as the in-memory cache.
      import("./notification-scheduler")
        .then((m) => m.cancelAllReminders())
        .catch(() => {});
    }
    if (user) identifyUser(user.id);
    set({
      user,
      isAuthenticated: !!user,
    });
  },

  setLoading: (isLoading) => {
    set({ isLoading });
  },

  logout: async () => {
    /* Telling the server is best effort and capped. Signing out is a local act:
       somebody who taps Log out is logged out whether or not the network
       agrees, and this used to await a call that, through the old unbounded
       retry loop, could never finish while offline.

       The local teardown also sits OUTSIDE the try. It used to be inside one,
       so anything that threw before it, the dynamic import included, jumped to
       the catch and left the person still signed in with a logged error. */
    try {
      const apiClient = (await import("./api")).default;
      await Promise.race([
        apiClient.post("/auth/logout").catch(() => {}),
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]);
    } catch (error) {
      console.error("Server logout failed, signing out locally anyway:", error);
    }
    await SecureStore.deleteItemAsync("auth_token").catch(() => {});
    await SecureStore.deleteItemAsync("refresh_token").catch(() => {});
    resetAnalytics();
    /* Cancel the OS notification queue too. Nothing did, so account A's
       subscription names and amounts stayed scheduled to appear on the lock
       screen after sign-out. cancelAllReminders also bumps a generation
       counter, which stops a scheduler that was already running from re-adding
       them once this finishes. */
    await (await import("./notification-scheduler")).cancelAllReminders();
    // After the token is gone, so nothing in flight can write to the cache
    // with the old credentials still attached.
    await resetQueryCache();
    set({
      user: null,
      isAuthenticated: false,
    });
  },

  restoreToken: async () => {
    try {
      const token = await SecureStore.getItemAsync("auth_token");
      if (token) {
        const apiClient = (await import("./api")).default;
        const res = await apiClient.get("/auth/me");
        // Through setUser, not a bare set(), so restoring a session runs the
        // same identity check and analytics identify as every other path.
        get().setUser(res.data);
      }
    } catch {
      await SecureStore.deleteItemAsync("auth_token");
      await SecureStore.deleteItemAsync("refresh_token");
      set({ user: null, isAuthenticated: false });
    } finally {
      set({ isLoading: false });
    }
  },
}));
