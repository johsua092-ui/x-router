"use client";

import { usePathname } from "next/navigation";
import { useTheme } from "./ThemeProvider";
import { useState, useEffect } from "react";

const PAGES = {
  "/dashboard": ["Endpoint & Key", "Base URL, API key & snippet siap pakai", "api"],
  "/": ["Endpoint & Key", "Base URL, API key & snippet siap pakai", "api"],
  "/providers": ["Providers", "Koneksi upstream & katalog provider", "dns"],
  "/models": ["Models", "Katalog model dari provider yang terhubung", "deployed_code"],
  "/usage": ["Usage", "Statistik token, request & latensi", "bar_chart"],
  "/logs": ["Console Log", "Request terakhir yang lewat gateway", "terminal"],
  "/settings": ["Settings", "Tema, keamanan & data gateway", "settings"],
};

export default function Header({ onMenu }) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [title, setTitle] = useState(["X Router", "", "hub"]);
  const [clock, setClock] = useState("");

  useEffect(() => {
    setTitle(PAGES[pathname] || ["X Router", "", "hub"]);
  }, [pathname]);

  useEffect(() => {
    const tick = () =>
      setClock(
        new Date().toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <header className="shrink-0 flex items-center justify-between gap-3 px-4 lg:px-8 pt-3 pb-2 border-b border-border-subtle bg-surface/60 backdrop-blur-xl lg:bg-transparent lg:backdrop-blur-none z-20">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <button
          onClick={onMenu}
          className="lg:hidden shrink-0 justify-center p-1.5 rounded-[10px] text-text-main hover:text-primary hover:bg-surface-2 transition-colors"
          aria-label="Menu"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>

        <div className="hidden sm:flex items-center justify-center size-8 rounded-[10px] bg-brand-500/10 border border-brand-500/20">
          <span className="material-symbols-outlined text-primary text-lg">{title[2]}</span>
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-base lg:text-2xl font-semibold text-text-main tracking-tight truncate">
              {title[0]}
            </h1>
            <span className="text-primary font-bold hidden sm:inline">//</span>
          </div>
          <p className="hidden lg:block text-sm text-text-muted truncate">{title[1]}</p>
        </div>
      </div>

      <div className="flex min-w-0 items-center gap-2">
        {/* jam live */}
        <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-border bg-surface/70 text-xs text-text-muted font-mono">
          {clock}
        </span>

        {/* indikator gateway */}
        <span className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-border bg-surface/70 text-xs text-text-muted">
          <span className="material-symbols-outlined text-[14px] text-primary">router</span>
          <span>gateway</span>
        </span>

        <button
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          className="flex items-center gap-2 px-3 py-1.5 rounded-[10px] text-xs font-medium text-text-muted hover:text-text-main hover:bg-surface-2 transition-all border border-border-subtle"
          title="Ganti tema (G)"
        >
          <span className="material-symbols-outlined text-[16px]">
            {theme === "light" ? "dark_mode" : "light_mode"}
          </span>
          <span className="whitespace-nowrap hidden sm:inline">
            {theme === "light" ? "Gelap" : "Terang"}
          </span>
        </button>
      </div>
    </header>
  );
}
