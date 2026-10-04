"use client";

import { createContext, useCallback, useContext, useState } from "react";

const ToastCtx = createContext({ toast: () => {} });
const ICONS = { success: "check_circle", error: "error", info: "info", warning: "warning" };

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);

  const toast = useCallback((type, title, detail, ms = 3400) => {
    const id = Math.random().toString(36).slice(2);
    setItems((s) => [...s, { id, type, title, detail }]);
    setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), ms);
  }, []);

  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-[min(92vw,360px)]">
        {items.map((t) => (
          <div
            key={t.id}
            className={`toast flex items-start gap-2.5 rounded-xl border p-3 shadow-[var(--shadow-elev)] backdrop-blur-md text-sm animate-in slide-in-from-right duration-250 ${
              t.type === "success"
                ? "border-green-500/30 bg-green-500/10 text-green-500"
                : t.type === "error"
                ? "border-red-500/30 bg-red-500/10 text-red-500"
                : "border-blue-500/30 bg-blue-500/10 text-blue-500"
            }`}
          >
            <span className="material-symbols-outlined text-[18px] mt-0.5">
              {ICONS[t.type] || ICONS.info}
            </span>
            <div className="min-w-0">
              <div className="font-semibold text-text-main text-[13px]">{t.title}</div>
              {t.detail && (
                <div className="text-xs text-text-muted mt-0.5 break-words">{t.detail}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}
