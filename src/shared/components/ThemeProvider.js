"use client";

import { createContext, useContext, useEffect, useState } from "react";

const ThemeCtx = createContext({ theme: "dark", setTheme: () => {} });

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState("dark");

  useEffect(() => {
    let t = null;
    try { t = localStorage.getItem("xr_theme"); } catch {}
    if (!t) {
      const m = document.cookie.match(/(?:^|;\s*)xr_theme=([^;]+)/);
      t = m ? decodeURIComponent(m[1]) : "dark";
    }
    apply(t || "dark");
  }, []);

  function apply(t) {
    setThemeState(t);
    const el = document.documentElement;
    el.classList.toggle("light", t === "light");
    el.classList.toggle("dark", t !== "light");
    try { localStorage.setItem("xr_theme", t); } catch {}
    document.cookie = `xr_theme=${t};path=/;max-age=31536000;samesite=lax`;
  }

  // shortcut keyboard: g = ganti tema
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (e.key === "g" || e.key === "G") {
        apply(theme === "light" ? "dark" : "light");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [theme]);

  // catatan: JANGAN return null — SSR harus tetap render children,
  // kalau di-null-in layar jadi item kosong (bug pertama kali launch)
  return (
    <ThemeCtx.Provider value={{ theme, setTheme: apply }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeCtx);
}
