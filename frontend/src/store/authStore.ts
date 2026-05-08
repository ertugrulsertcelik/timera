import { create } from "zustand";
import { User } from "../types";
import { api } from "../api/client";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: (() => {
    try {
      const u = localStorage.getItem("user");
      return u ? (JSON.parse(u) as User) : null;
    } catch {
      return null;
    }
  })(),
  isLoading: false,

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const data = await api.post<{ accessToken: string; refreshToken: string; user: User }>(
        "/auth/login",
        { email, password }
      );
      sessionStorage.setItem("accessToken", data.accessToken); // sekme kapanınca silinir
      localStorage.setItem("refreshToken", data.refreshToken);
      localStorage.setItem("user", JSON.stringify(data.user));
      set({ user: data.user });
    } finally {
      set({ isLoading: false });
    }
  },

  setUser: (user: User) => {
    localStorage.setItem("user", JSON.stringify(user));
    set({ user });
  },

  logout: async () => {
    const rt = localStorage.getItem("refreshToken");
    await api.post("/auth/logout", { refreshToken: rt }).catch(() => {});
    sessionStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    set({ user: null });
    window.location.href = "/login";
  },
}));
