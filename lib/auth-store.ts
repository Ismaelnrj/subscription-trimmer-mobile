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
    const previous = get().user;
    if (user && previous && previous.id !== user.id) resetQueryCache();
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
        set({ user: res.data, isAuthenticated: true });
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
