"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { THEME_CONFIG } from "@/shared/constants/config";

// Both modes are fully solid — frosted/translucent panels are gone in X Router.
// "ember" = warm charcoal panels with a faint brand-orange tint (default),
// "dark" = neutral solid dark panels.
export const THEME_IDS = ["ember", "dark"];

const useThemeStore = create(
  persist(
    (set, get) => ({
      theme: "ember",

      setTheme: (theme) => {
        const id = THEME_IDS.includes(theme) ? theme : "ember";
        set({ theme: id });
        applyTheme(id);
      },

      toggleTheme: () => {
        const next = get().theme === "ember" ? "dark" : "ember";
        set({ theme: next });
        applyTheme(next);
      },

      initTheme: () => {
        applyTheme(get().theme || "ember");
      },
    }),
    {
      name: THEME_CONFIG.storageKey,
    },
  ),
);

// Apply theme to document. "dark" always stays on (both modes are dark);
// "ember" adds the warm brand-tinted overrides in globals.css.
function applyTheme(theme) {
  if (typeof window === "undefined") return;

  const root = document.documentElement;
  root.classList.add("dark");
  root.classList.toggle("ember", theme === "ember");
}

export default useThemeStore;
