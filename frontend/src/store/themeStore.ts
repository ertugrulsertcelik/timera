import { create } from "zustand";

interface ThemeState {
  isDark: boolean;
  toggle: () => void;
}

function applyTheme(dark: boolean) {
  if (dark) {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

const saved = localStorage.getItem("theme") === "dark";
applyTheme(saved);

export const useThemeStore = create<ThemeState>((set) => ({
  isDark: saved,
  toggle: () =>
    set((s) => {
      const next = !s.isDark;
      applyTheme(next);
      localStorage.setItem("theme", next ? "dark" : "light");
      return { isDark: next };
    }),
}));
