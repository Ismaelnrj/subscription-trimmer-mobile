import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

interface User {
  id: number;
  openId: string;
  email: string | null;
  name: string | null;
  role: "user" | "admin";
  isPaid: boolean;
  paidAt: string | null;
  isVerified: boolean;
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

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  setUser: (user) => {
    set({
      user,
      isAuthenticated: !!user,
    });
  },

  setLoading: (isLoading) => {
    set({ isLoading });
  },

  logout: async () => {
    try {
      await SecureStore.deleteItemAsync("auth_token");
      set({
        user: null,
        isAuthenticated: false,
      });
    } catch (error) {
      console.error("Error logging out:", error);
    }
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
      set({ user: null, isAuthenticated: false });
    } finally {
      set({ isLoading: false });
    }
  },
}));
