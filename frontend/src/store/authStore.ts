import { create } from "zustand";
import { User } from "../types";
import { api } from "../api/client";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string, remember?: boolean) => Promise<void>;
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

  login: async (email, password, remember = true) => {
    set({ isLoading: true });
    try {
      const data = await api.post<{ accessToken: string; refreshToken: string; user: User }>(
        "/auth/login",
        { email, password }
      );
      sessionStorage.setItem("accessToken", data.accessToken); // sekme kapanınca silinir
      if (remember) {
        localStorage.setItem("refreshToken", data.refreshToken);
      } else {
        sessionStorage.setItem("refreshToken", data.refreshToken); // sekme kapanınca silinir
      }
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
    const rt = localStorage.getItem("refreshToken") || sessionStorage.getItem("refreshToken");
    await api.post("/auth/logout", { refreshToken: rt }).catch(() => {});
    sessionStorage.removeItem("accessToken");
    sessionStorage.removeItem("refreshToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    set({ user: null });
    window.location.href = "/login";
  },
}));
